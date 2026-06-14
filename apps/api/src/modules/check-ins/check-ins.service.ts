import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  Role,
  CheckInMethod,
  WorkOrderType,
  RiskLevel,
  WorkOrderSource,
} from '@prisma/client';
import { AiService, isAbnormalTextResult } from '../ai/ai.service';
import { RiskService } from '../risk/risk.service';
import { WorkOrdersService } from '../work-orders/work-orders.service';
import { DispatchRecommendationService } from '../risk/dispatch-recommendation.service';
import { NotificationsService } from '../notifications/notifications.service';

interface Requester {
  sub: string;
  role: Role;
  district?: string;
}

// 系统身份：家属请求派单时，建单/派单/通知都是系统行为（非家属本人），
// 用 role=ADMIN 绕过 work-orders 的片区/角色校验。
const SYSTEM_REQUESTER: Requester = { sub: 'system', role: Role.ADMIN };

// AI 分类结果 → 默认工单 level 映射（家属请求通常不紧急）
const TYPE_DEFAULT_LEVEL: Record<string, RiskLevel> = {
  HEALTH: RiskLevel.HIGH,
  LIFE: RiskLevel.MEDIUM,
  REPAIR: RiskLevel.MEDIUM,
  ESCORT: RiskLevel.MEDIUM,
  COMPANION: RiskLevel.LOW,
  ERRAND: RiskLevel.LOW,
};

@Injectable()
export class CheckInsService {
  private readonly logger = new Logger(CheckInsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly riskService: RiskService,
    private readonly workOrdersService: WorkOrdersService,
    private readonly dispatchRecommendation: DispatchRecommendationService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(dto: { elderId: string; method: CheckInMethod; content?: string; voiceUrl?: string }, requester: Requester) {
    const elder = await this.prisma.elder.findUnique({
      where: { id: dto.elderId },
      include: { familyLinks: true },
    });
    if (!elder) throw new NotFoundException('老人不存在');

    this.authorizeAccess(elder, requester);

    if (dto.method === CheckInMethod.VOICE && !dto.voiceUrl) {
      throw new BadRequestException('VOICE 模式必须提供语音文件 URL');
    }
    if (dto.method === CheckInMethod.TEXT && !dto.content) {
      throw new BadRequestException('TEXT 模式必须提供文本内容');
    }
    if (dto.method === CheckInMethod.PROXY && !dto.content) {
      throw new BadRequestException('PROXY 模式必须提供备注说明');
    }

    if (dto.voiceUrl) {
      const allowedExtensions = ['.mp3', '.wav', '.m4a', '.aac'];
      const lower = dto.voiceUrl.toLowerCase();
      const valid = allowedExtensions.some((ext) => lower.endsWith(ext));
      if (!valid) {
        throw new BadRequestException(`不支持的语音文件类型，允许: ${allowedExtensions.join(', ')}`);
      }
    }

    const checkIn = await this.prisma.checkIn.create({
      data: {
        elderId: dto.elderId,
        method: dto.method,
        content: dto.content || null,
        voiceUrl: dto.voiceUrl || null,
        status: 'NORMAL',
      },
    });

    // Fire-and-forget: AI abnormal text detection does not block CheckIn response
    if (dto.content && (dto.method === CheckInMethod.TEXT || dto.method === CheckInMethod.PROXY)) {
      void this.detectAbnormalText(dto.elderId, dto.content);
    }

    return checkIn;
  }

  /**
   * 家属请求帮助：家属输入自由文本（如「水管坏了需要人修」），
   * AI 分类 → 推荐有空的同片区 worker → 自动建单 + 指派 + 通知。
   *
   * 全自动派单，但有多个降级路径保证可用性（AI 挂了/无在岗 worker/低置信度都建单）。
   * 返回结果让前端知道是「已自动派单」还是「转人工」。
   */
  async createFamilyRequest(
    input: { elderId: string; text: string },
    requester: Requester,
  ): Promise<{
    checkIn: any;
    workOrder: any;
    aiClassification: { type: string; confidence: number } | null;
    dispatched: boolean;
    reason: string;
  }> {
    // 1. 校验：仅 FAMILY 且有 family-link 关联可发起请求
    if (requester.role !== Role.FAMILY) {
      throw new ForbiddenException('仅家属可发起帮助请求');
    }
    const elder = await this.prisma.elder.findUnique({
      where: { id: input.elderId },
      include: { familyLinks: true },
    });
    if (!elder) throw new NotFoundException('老人不存在');
    const linked = elder.familyLinks?.some((fl: any) => fl.userId === requester.sub);
    if (!linked) throw new ForbiddenException('无权限为此老人发起请求');

    // 2. 落 CheckIn（记录家属请求，区别于普通报平安）
    const checkIn = await this.prisma.checkIn.create({
      data: {
        elderId: input.elderId,
        method: CheckInMethod.TEXT,
        content: input.text,
        requestText: input.text,
        source: 'FAMILY_REQUEST',
        status: 'NORMAL',
      },
    });

    // 3. AI 分类
    let aiClassification: { type: string; confidence: number } | null = null;
    let classifyType: WorkOrderType = WorkOrderType.LIFE; // 兜底默认
    let lowConfidence = true;
    try {
      const result = await this.aiService.classify(input.text);
      aiClassification = { type: result.type, confidence: result.confidence };
      lowConfidence = result.needsHumanReview || result.confidence < 0.6;
      // AI type 已与 WorkOrderType 枚举对齐
      if (Object.values(WorkOrderType).includes(result.type as WorkOrderType)) {
        classifyType = result.type as WorkOrderType;
      }
    } catch (e: any) {
      // DeepSeek 挂了 / 合规拦截：不阻塞，走默认 LIFE + 转人工
      this.logger.warn(`AI classify failed for family request, fallback to manual: ${e?.message ?? e}`);
      lowConfidence = true;
    }

    // 4. 降级分支：低置信度 → 建工单但不自动指派，转人工
    if (lowConfidence) {
      const wo = await this.workOrdersService.create(
        {
          elderId: input.elderId,
          type: classifyType,
          level: RiskLevel.LOW,
          sourceFrom: WorkOrderSource.FAMILY_REQUEST,
          familyRequestText: input.text,
          dispatchReason: `AI 置信度低${aiClassification ? `(${aiClassification.confidence.toFixed(2)})` : '(AI 不可用)'}，需人工确认类型`,
        },
        SYSTEM_REQUESTER,
      );
      return {
        checkIn,
        workOrder: wo.workOrder,
        aiClassification,
        dispatched: false,
        reason: '已转人工派单：AI 无法确定请求类型，工作人员将尽快处理',
      };
    }

    // 5. 正常派单路径：推荐 + 自动指派
    let candidates: Awaited<ReturnType<typeof this.dispatchRecommendation.recommendByType>> = [];
    try {
      candidates = await this.dispatchRecommendation.recommendByType(input.elderId, classifyType);
    } catch (e: any) {
      this.logger.warn(`recommendByType failed: ${e?.message ?? e}`);
    }
    // 取 top1 且在岗且同片区
    const elderDistrict = elder.district;
    const topCandidate = candidates.find(
      (c) => c.dutyStatus === 'ON_DUTY' && c.district === elderDistrict,
    );

    if (!topCandidate) {
      // 暂无在岗同片区 worker：建工单 PENDING，转人工
      const wo = await this.workOrdersService.create(
        {
          elderId: input.elderId,
          type: classifyType,
          level: TYPE_DEFAULT_LEVEL[classifyType] ?? RiskLevel.MEDIUM,
          sourceFrom: WorkOrderSource.FAMILY_REQUEST,
          familyRequestText: input.text,
          dispatchReason: '暂无在岗同片区工作人员，待人工派单',
        },
        SYSTEM_REQUESTER,
      );
      return {
        checkIn,
        workOrder: wo.workOrder,
        aiClassification,
        dispatched: false,
        reason: '已转人工派单：暂无在岗同片区工作人员',
      };
    }

    // 6. 建工单 + 自动指派 + 通知（全自动）
    const wo = await this.workOrdersService.create(
      {
        elderId: input.elderId,
        type: classifyType,
        level: TYPE_DEFAULT_LEVEL[classifyType] ?? RiskLevel.MEDIUM,
        sourceFrom: WorkOrderSource.FAMILY_REQUEST,
        familyRequestText: input.text,
        dispatchReason: `AI 分类: ${classifyType} (${aiClassification!.confidence.toFixed(2)})，自动派给 ${topCandidate.name}`,
      },
      SYSTEM_REQUESTER,
    );
    await this.workOrdersService.assign(wo.workOrder.id, topCandidate.userId, SYSTEM_REQUESTER);

    // 通知 worker（家属本人也收到一条 USER 通知）
    try {
      await this.notificationsService.sendToRecipients({
        elderId: input.elderId,
        payload: {
          thing1: { value: elder.name },
          thing2: { value: `新工单: ${input.text}` },
          thing3: { value: `派给 ${topCandidate.name}` },
        },
      });
    } catch (e: any) {
      // 通知失败不阻塞派单（工单已建已派）
      this.logger.warn(`sendToRecipients failed for family request: ${e?.message ?? e}`);
    }

    return {
      checkIn,
      workOrder: wo.workOrder,
      aiClassification,
      dispatched: true,
      reason: `已自动派给 ${topCandidate.name}（${classifyType}）`,
    };
  }

  async findByElder(elderId: string, query: { page?: number; limit?: number }, requester: Requester) {
    const elder = await this.prisma.elder.findUnique({
      where: { id: elderId },
      include: { familyLinks: true },
    });
    if (!elder) throw new NotFoundException('老人不存在');
    this.authorizeAccess(elder, requester);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.checkIn.findMany({
        where: { elderId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.checkIn.count({ where: { elderId } }),
    ]);

    return { items, total, page, limit };
  }

  /**
   * Asynchronously detect whether check-in text is abnormal.
   * If abnormal, automatically generate a risk event.
   * Silently degrades: AI unavailability does not block CheckIn creation.
   */
  private async detectAbnormalText(elderId: string, content: string): Promise<void> {
    try {
      const result = await this.aiService.classify(content);
      if (isAbnormalTextResult(result)) {
        await this.riskService.evaluateAndCreateEvent({ elderId, abnormalText: true });
      }
    } catch {
      // Silent degradation: AI service unavailable or compliance interception hit, do not block main flow
    }
  }

  private authorizeAccess(elder: any, requester: Requester) {
    if (requester.role === Role.ADMIN) return;
    if (requester.role === Role.FAMILY) {
      const isLinked = elder.familyLinks?.some(
        (fl: any) => fl.userId === requester.sub,
      );
      if (!isLinked) throw new ForbiddenException('无权限为此老人报平安');
      return;
    }
    if (requester.district && elder.district !== requester.district) {
      throw new ForbiddenException('无权限操作其他片区的老人');
    }
  }
}
