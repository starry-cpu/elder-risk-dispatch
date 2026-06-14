/**
 * 演示数据填充脚本（独立于 prisma/seed.ts 的最小启动数据）。
 *
 * 用途：把数据库填充成「真实社区照护系统」的样子，让 admin 后台各页面
 * （dashboard / elders / risk / work-orders / users / audit / rules）和
 * miniapp（工单进度 / 风险待办 / 走访记录）都有非空、逼真的内容可演示。
 *
 * 幂等：开头按依赖逆序清空相关表，再重新插入。可反复执行。
 *
 * 跑法：
 *   pnpm --filter @care/api seed:demo
 *   或 scripts\dev.cmd demo-seed
 *
 * 注意：会清掉现有 User/Elder/WorkOrder/CheckIn/RiskEvent/Visit/...
 * 包括手动建的家属关联；但会重新用你的真实微信 openid 关联 demo 老人，
 * 所以微信登录仍能直接进家属端看到工单进度。
 */
import { PrismaClient } from '@prisma/client';
import {
  Role,
  DutyStatus,
  ServiceLevel,
  RiskLevel,
  RiskSource,
  RiskStatus,
  WorkOrderType,
  WorkOrderStatus,
  WorkOrderSource,
  CheckInMethod,
  CheckInStatus,
} from '@prisma/client';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ====== 复用 FieldEncryptionService 同款 AES-256-GCM（见 seed.ts）======
function encryptField(plaintext: string): string {
  const keyBase64 = process.env.FIELD_ENCRYPTION_KEY;
  if (!keyBase64) throw new Error('FIELD_ENCRYPTION_KEY environment variable is required');
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) throw new Error(`FIELD_ENCRYPTION_KEY must be 32 bytes, got ${key.length}`);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}
function hashPhone(phone: string): string {
  return crypto.createHash('sha256').update(phone).digest('hex');
}

// ====== 工具：相对当前时间偏移 ======
const NOW = new Date();
function daysAgo(n: number, hour = 10, min = 0): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  d.setHours(hour, min, 0, 0);
  return d;
}
function daysFromNow(n: number, hour = 18, min = 0): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() + n);
  d.setHours(hour, min, 0, 0);
  return d;
}

// ====== 固定 ID 前缀（幂等 + 便于互相引用）======
const id = (k: string) => `demo_${k}`;

// 统一片区词汇表（与 admin elders 筛选下拉一致：朝阳/海淀/东城）
const DISTRICTS = ['朝阳', '海淀', '东城'] as const;

// 你之前真机登录产生的微信 openid（保留登录可用）
const REAL_FAMILY_OPENID = 'oDKho3RshaTJxx1PJ3iVezykgwno';

async function main() {
  console.log('▶ 清空旧数据（按依赖逆序）...');
  // 注意顺序：先删依赖方，再删被依赖方
  await prisma.serviceEvaluation.deleteMany();
  await prisma.workOrderTimeline.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.visitRecord.deleteMany();
  await prisma.deviceData.deleteMany();
  await prisma.checkIn.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.riskEvent.deleteMany();
  await prisma.emergencyContact.deleteMany();
  await prisma.elderFamilyLink.deleteMany();
  await prisma.riskRule.deleteMany();
  await prisma.elder.deleteMany();
  await prisma.user.deleteMany();
  console.log('✓ 旧数据已清空');

  // ============================================================
  // 1. Users（1 admin + 2 family + 7 staff）
  // ============================================================
  console.log('▶ 插入 Users...');

  const adminPwd = await bcrypt.hash('admin123', 10);

  // 系统管理员（PC 后台登录用 13800138000 / admin123）
  await prisma.user.create({
    data: {
      id: id('admin_1'),
      name: '王管理',
      phone: hashPhone('13800138000'),
      passwordHash: adminPwd,
      role: Role.ADMIN,
      district: '朝阳',
      dutyStatus: DutyStatus.ON_DUTY,
      skills: ['系统管理'],
    },
  });

  // 家属 1：测试家属（openid 命中种子，便于小程序直接登成关联老人）
  await prisma.user.create({
    data: { id: id('family_1'), name: '李芳', role: Role.FAMILY, openid: 'test-family-openid-001' },
  });
  // 家属 2：你的真实微信账号（真机登录命中）
  await prisma.user.create({
    data: { id: id('family_2'), name: '张伟', role: Role.FAMILY, openid: REAL_FAMILY_OPENID },
  });

  // 工作人员（覆盖各角色 + 各片区 + 技能 + 在岗状态 + 响应时间）
  const staffSpec: Array<{
    k: string; name: string; role: Role; district: string; skills: string[];
    duty: DutyStatus; avgResp?: number; phone?: string;
  }> = [
    { k: 'worker_1', name: '陈秀英', role: Role.GRID_WORKER, district: '朝阳', skills: ['LIFE', 'HEALTH'], duty: DutyStatus.ON_DUTY, avgResp: 25, phone: '13901100001' },
    { k: 'worker_2', name: '刘建国', role: Role.GRID_WORKER, district: '朝阳', skills: ['REPAIR'], duty: DutyStatus.ON_DUTY, avgResp: 40, phone: '13901100002' },
    { k: 'worker_3', name: '赵敏', role: Role.COMMUNITY_DOCTOR, district: '海淀', skills: ['HEALTH'], duty: DutyStatus.ON_DUTY, avgResp: 30, phone: '13901100003' },
    { k: 'worker_4', name: '孙志强', role: Role.GRID_WORKER, district: '海淀', skills: ['LIFE', 'REPAIR'], duty: DutyStatus.OFF_DUTY, avgResp: 55, phone: '13901100004' },
    { k: 'worker_5', name: '周婷', role: Role.VOLUNTEER, district: '东城', skills: ['LIFE'], duty: DutyStatus.ON_DUTY, avgResp: 60, phone: '13901100005' },
    { k: 'worker_6', name: '吴海', role: Role.PROPERTY, district: '东城', skills: ['REPAIR'], duty: DutyStatus.ON_DUTY, avgResp: 35, phone: '13901100006' },
    { k: 'worker_7', name: '黄丽', role: Role.GRID_WORKER, district: '朝阳', skills: ['LIFE', 'HEALTH', 'REPAIR'], duty: DutyStatus.ON_DUTY, avgResp: 20, phone: '13901100007' },
  ];
  for (const s of staffSpec) {
    await prisma.user.create({
      data: {
        id: id(s.k),
        name: s.name,
        role: s.role,
        district: s.district,
        skills: s.skills,
        dutyStatus: s.duty,
        avgResponseMin: s.avgResp ?? null,
        ...(s.phone ? { phone: hashPhone(s.phone) } : {}),
      },
    });
  }

  // ============================================================
  // 2. Elders（12 位，分布在 3 片区）
  // ============================================================
  console.log('▶ 插入 Elders + 紧急联系人...');
  const elderSpec: Array<{
    k: string; name: string; gender: string; birth: string; district: string;
    level: ServiceLevel; tags: string[]; idCard: string; addr: string;
    contactName: string; contactRel: string; contactPhone: string;
  }> = [
    { k: 'elder_1', name: '张桂兰', gender: 'F', birth: '1942-05-12', district: '朝阳', level: ServiceLevel.HIGH, tags: ['高血压', '糖尿病'], idCard: '110105194205121234', addr: '朝阳区幸福路 12 号 3 单元 201', contactName: '张伟', contactRel: '儿子', contactPhone: '13800001111' },
    { k: 'elder_2', name: '李德福', gender: 'M', birth: '1938-11-03', district: '朝阳', level: ServiceLevel.HIGH, tags: ['冠心病', '独居'], idCard: '110105193811035678', addr: '朝阳区长青街 88 号 5 单元 102', contactName: '李芳', contactRel: '女儿', contactPhone: '13800002222' },
    { k: 'elder_3', name: '王秀珍', gender: 'F', birth: '1945-08-20', district: '朝阳', level: ServiceLevel.KEY, tags: ['关节炎'], idCard: '110105194508209012', addr: '朝阳区和平里 7 号院 4 号楼 303', contactName: '王强', contactRel: '儿子', contactPhone: '13800003333' },
    { k: 'elder_4', name: '赵广明', gender: 'M', birth: '1940-02-14', district: '海淀', level: ServiceLevel.HIGH, tags: ['脑梗后遗症', '失能'], idCard: '110108194002146789', addr: '海淀区学院路 30 号 2 单元 501', contactName: '赵静', contactRel: '女儿', contactPhone: '13800004444' },
    { k: 'elder_5', name: '钱玉芬', gender: 'F', birth: '1948-07-30', district: '海淀', level: ServiceLevel.NORMAL, tags: ['听力下降'], idCard: '110108194807304321', addr: '海淀区中关村南大街 6 号 8 单元 1102', contactName: '钱伟', contactRel: '儿子', contactPhone: '13800005555' },
    { k: 'elder_6', name: '孙立人', gender: 'M', birth: '1936-12-09', district: '海淀', level: ServiceLevel.HIGH, tags: ['阿尔茨海默', '独居'], idCard: '110108193612098765', addr: '海淀区清河小营东路 15 号 1 单元 402', contactName: '孙莉', contactRel: '女儿', contactPhone: '13800006666' },
    { k: 'elder_7', name: '周淑兰', gender: 'F', birth: '1944-03-22', district: '东城', level: ServiceLevel.KEY, tags: ['骨质疏松'], idCard: '110101194403221098', addr: '东城区东直门内大街 27 号 3 单元 601', contactName: '周明', contactRel: '儿子', contactPhone: '13800007777' },
    { k: 'elder_8', name: '吴长青', gender: 'M', birth: '1943-09-18', district: '东城', level: ServiceLevel.NORMAL, tags: ['前列腺增生'], idCard: '110101194309182109', addr: '东城区交道口南大街 64 号 2 单元 305', contactName: '吴婷', contactRel: '女儿', contactPhone: '13800008888' },
    { k: 'elder_9', name: '郑慧敏', gender: 'F', birth: '1946-06-05', district: '朝阳', level: ServiceLevel.NORMAL, tags: ['糖尿病'], idCard: '110105194606053210', addr: '朝阳区双井桥东 200 米 5 号楼 1801', contactName: '郑磊', contactRel: '儿子', contactPhone: '13800009999' },
    { k: 'elder_10', name: '冯国安', gender: 'M', birth: '1939-04-27', district: '海淀', level: ServiceLevel.HIGH, tags: ['心衰', '独居'], idCard: '110108193904276543', addr: '海淀区西二旗北路 9 号院 3 号楼 1203', contactName: '冯雪', contactRel: '女儿', contactPhone: '13800001010' },
    { k: 'elder_11', name: '陈月华', gender: 'F', birth: '1947-10-11', district: '东城', level: ServiceLevel.KEY, tags: ['帕金森'], idCard: '110101194710114321', addr: '东城区安定门内大街 99 号 1 单元 401', contactName: '陈浩', contactRel: '儿子', contactPhone: '13800001212' },
    { k: 'elder_12', name: '褚国良', gender: 'M', birth: '1941-01-08', district: '朝阳', level: ServiceLevel.NORMAL, tags: ['慢阻肺'], idCard: '110105194101081234', addr: '朝阳区望京西园三区 12 号楼 506', contactName: '褚颖', contactRel: '女儿', contactPhone: '13800001313' },
  ];

  for (const e of elderSpec) {
    await prisma.elder.create({
      data: {
        id: id(e.k),
        name: e.name,
        gender: e.gender,
        birthDate: new Date(e.birth),
        district: e.district,
        serviceLevel: e.level,
        healthTags: e.tags,
        idCard: encryptField(e.idCard),
        address: encryptField(e.addr),
        livingStatus: e.tags.includes('独居') ? 'LIVING_ALONE' : 'WITH_FAMILY',
      },
    });
    await prisma.emergencyContact.create({
      data: {
        elderId: id(e.k),
        name: e.contactName,
        relation: e.contactRel,
        phone: encryptField(e.contactPhone),
        isPrimary: true,
      },
    });
  }

  // ============================================================
  // 3. ElderFamilyLink：把 2 个家属关联到多个老人
  // ============================================================
  console.log('▶ 插入家属-老人关联...');
  // family_1（测试家属）关联 elder_1, elder_2, elder_4
  // family_2（你的真实微信）关联 elder_1, elder_3
  const links: Array<{ elder: string; family: string; rel: string }> = [
    { elder: 'elder_1', family: 'family_1', rel: '女儿' },
    { elder: 'elder_2', family: 'family_1', rel: '女儿' },
    { elder: 'elder_4', family: 'family_1', rel: '女儿' },
    { elder: 'elder_1', family: 'family_2', rel: '儿子' },
    { elder: 'elder_3', family: 'family_2', rel: '儿子' },
  ];
  for (const l of links) {
    await prisma.elderFamilyLink.create({
      data: { elderId: id(l.elder), userId: id(l.family), relation: l.rel },
    });
  }

  // ============================================================
  // 4. RiskRules（复刻原 seed 的 6 条规则）
  // ============================================================
  console.log('▶ 插入风险规则...');
  const rules: Array<{ name: string; condition: object; weight: number; level: RiskLevel }> = [
    { name: '连续未报平安', condition: { field: 'hoursSinceLastCheckIn', operator: 'gte', value: 24 }, weight: 60, level: RiskLevel.HIGH },
    { name: '设备跌倒报警', condition: { field: 'metricType', operator: 'in', value: ['FALL_ALARM'] }, weight: 50, level: RiskLevel.HIGH },
    { name: '烟感/水浸报警', condition: { field: 'metricType', operator: 'in', value: ['SMOKE_ALARM', 'WATER_LEAK'] }, weight: 40, level: RiskLevel.MEDIUM },
    { name: '异常文本内容', condition: { field: 'abnormalText', operator: 'eq', value: true }, weight: 35, level: RiskLevel.MEDIUM },
    { name: '高龄+慢病叠加', condition: { field: 'age', operator: 'gte', value: 80, requireChronicDisease: true }, weight: 20, level: RiskLevel.MEDIUM },
    { name: '近7天高风险史', condition: { field: 'recentHighRisk', operator: 'eq', value: true }, weight: 15, level: RiskLevel.LOW },
  ];
  for (const r of rules) {
    await prisma.riskRule.create({ data: { name: r.name, condition: r.condition, weight: r.weight, level: r.level, version: 1, enabled: true } });
  }

  // ============================================================
  // 5. CheckIns（40 条，覆盖今天 + 7 天内 + 含 ABNORMAL）
  // ============================================================
  console.log('▶ 插入报平安记录...');
  const checkInSpecs: Array<{ elder: string; day: number; method: CheckInMethod; status: CheckInStatus; content?: string }> = [
    // 今天（让 dashboard todayCheckInRate 非零）
    { elder: 'elder_1', day: 0, method: CheckInMethod.ONE_TAP, status: CheckInStatus.NORMAL },
    { elder: 'elder_2', day: 0, method: CheckInMethod.TEXT, status: CheckInStatus.NORMAL, content: '今天感觉不错' },
    { elder: 'elder_3', day: 0, method: CheckInMethod.ONE_TAP, status: CheckInStatus.NORMAL },
    { elder: 'elder_5', day: 0, method: CheckInMethod.VOICE, status: CheckInStatus.NORMAL },
    { elder: 'elder_7', day: 0, method: CheckInMethod.TEXT, status: CheckInStatus.ABNORMAL, content: '今天头晕得厉害，站不稳' },
    { elder: 'elder_9', day: 0, method: CheckInMethod.ONE_TAP, status: CheckInStatus.NORMAL },
    { elder: 'elder_11', day: 0, method: CheckInMethod.TEXT, status: CheckInStatus.NORMAL, content: '血压有点高' },
    // 近 7 天散布（让 trend 有多天数据）
    ...[1, 2, 3, 4, 5, 6].flatMap((d) => [
      { elder: 'elder_1', day: d, method: CheckInMethod.ONE_TAP, status: CheckInStatus.NORMAL },
      { elder: 'elder_2', day: d, method: CheckInMethod.ONE_TAP, status: CheckInStatus.NORMAL },
      { elder: 'elder_4', day: d, method: d % 2 === 0 ? CheckInMethod.TEXT : CheckInMethod.VOICE, status: CheckInStatus.NORMAL, content: d % 2 === 0 ? '按时吃药了' : undefined },
      { elder: 'elder_6', day: d, method: CheckInMethod.ONE_TAP, status: d === 3 ? CheckInStatus.ABNORMAL : CheckInStatus.NORMAL },
      { elder: 'elder_8', day: d, method: CheckInMethod.ONE_TAP, status: CheckInStatus.NORMAL },
      { elder: 'elder_10', day: d, method: CheckInMethod.TEXT, status: d === 5 ? CheckInStatus.ABNORMAL : CheckInStatus.NORMAL, content: d === 5 ? '胸口闷，喘不上气' : '一切正常' },
    ]),
  ];
  for (const c of checkInSpecs) {
    await prisma.checkIn.create({
      data: {
        elderId: id(c.elder),
        method: c.method,
        content: c.content ?? null,
        status: c.status,
        source: 'FAMILY',
        createdAt: daysAgo(c.day, 8 + (c.day % 10), c.day * 7 % 60),
      },
    });
  }

  // ============================================================
  // 6. RiskEvents（15 条，多 level/source/status，7 天内多天）
  // ============================================================
  console.log('▶ 插入风险事件...');
  const riskSpecs: Array<{
    elder: string; day: number; level: RiskLevel; source: RiskSource;
    score: number; reason: string; status: RiskStatus; reviewer?: string;
  }> = [
    // PENDING_REVIEW（让 risk 待办列表 + 操作按钮有内容）
    { elder: 'elder_7', day: 0, level: RiskLevel.HIGH, source: RiskSource.ABNORMAL_TEXT, score: 85, reason: '报平安文本异常:头晕站不稳,高龄,慢病叠加', status: RiskStatus.PENDING_REVIEW },
    { elder: 'elder_10', day: 0, level: RiskLevel.HIGH, source: RiskSource.ABNORMAL_TEXT, score: 80, reason: '报平安文本异常:胸闷喘不上气,心衰史,独居', status: RiskStatus.PENDING_REVIEW },
    { elder: 'elder_6', day: 1, level: RiskLevel.HIGH, source: RiskSource.MISSED_CHECKIN, score: 75, reason: '连续 36 小时未报平安,阿尔茨海默,独居', status: RiskStatus.PENDING_REVIEW },
    { elder: 'elder_4', day: 1, level: RiskLevel.MEDIUM, source: RiskSource.MISSED_CHECKIN, score: 60, reason: '连续 30 小时未报平安,失能', status: RiskStatus.PENDING_REVIEW },
    { elder: 'elder_2', day: 2, level: RiskLevel.MEDIUM, source: RiskSource.DEVICE, score: 50, reason: '烟感报警触发,冠心病史', status: RiskStatus.PENDING_REVIEW },
    { elder: 'elder_11', day: 2, level: RiskLevel.MEDIUM, source: RiskSource.ABNORMAL_TEXT, score: 45, reason: '报平安内容异常,帕金森', status: RiskStatus.PENDING_REVIEW },
    { elder: 'elder_1', day: 3, level: RiskLevel.MEDIUM, source: RiskSource.MISSED_CHECKIN, score: 60, reason: '连续 26 小时未报平安,高血压,糖尿病', status: RiskStatus.PENDING_REVIEW },
    // CONFIRMED（已确认，可派单）
    { elder: 'elder_6', day: 3, level: RiskLevel.HIGH, source: RiskSource.DEVICE, score: 90, reason: '跌倒报警触发,阿尔茨海默,独居', status: RiskStatus.CONFIRMED, reviewer: id('admin_1') },
    { elder: 'elder_10', day: 4, level: RiskLevel.HIGH, source: RiskSource.MISSED_CHECKIN, score: 75, reason: '连续 48 小时未报平安,心衰,独居', status: RiskStatus.CONFIRMED, reviewer: id('admin_1') },
    { elder: 'elder_4', day: 4, level: RiskLevel.MEDIUM, source: RiskSource.DEVICE, score: 50, reason: '水浸报警触发,失能', status: RiskStatus.CONFIRMED, reviewer: id('admin_1') },
    // IGNORED（已忽略，历史）
    { elder: 'elder_2', day: 5, level: RiskLevel.LOW, source: RiskSource.HISTORY, score: 20, reason: '历史风险回顾:慢病管理', status: RiskStatus.IGNORED, reviewer: id('admin_1') },
    { elder: 'elder_8', day: 5, level: RiskLevel.LOW, source: RiskSource.MANUAL, score: 15, reason: '人工评估:状况良好', status: RiskStatus.IGNORED, reviewer: id('admin_1') },
    { elder: 'elder_9', day: 6, level: RiskLevel.LOW, source: RiskSource.HISTORY, score: 18, reason: '历史风险回顾:糖尿病管理', status: RiskStatus.IGNORED, reviewer: id('admin_1') },
    // DISPATCHED（已派单）
    { elder: 'elder_6', day: 6, level: RiskLevel.HIGH, source: RiskSource.MISSED_CHECKIN, score: 70, reason: '连续未报平安,阿尔茨海默', status: RiskStatus.DISPATCHED, reviewer: id('admin_1') },
    { elder: 'elder_12', day: 6, level: RiskLevel.MEDIUM, source: RiskSource.DEVICE, score: 45, reason: '烟感报警,慢阻肺', status: RiskStatus.DISPATCHED, reviewer: id('admin_1') },
  ];
  for (const r of riskSpecs) {
    await prisma.riskEvent.create({
      data: {
        elderId: id(r.elder),
        level: r.level,
        source: r.source,
        score: r.score,
        reason: r.reason,
        status: r.status,
        reviewedBy: r.reviewer ?? null,
        createdAt: daysAgo(r.day, 9 + r.day, (r.day * 13) % 60),
      },
    });
  }

  // ============================================================
  // 7. WorkOrders（15 条，覆盖 6 type / 5 status / 4 sourceFrom）
  // ============================================================
  console.log('▶ 插入工单 + 时间线...');
  // elder/worker 的片区映射，确保 assignee 与 elder 同片区（演示真实派单）
  const elderDistrict: Record<string, string> = Object.fromEntries(elderSpec.map((e) => [e.k, e.district]));
  const workerDistrict: Record<string, string> = Object.fromEntries(staffSpec.map((s) => [s.k, s.district]));
  // 每片区可用的 worker（on-duty 优先）
  const workersInDistrict = (district: string, k: string) => {
    const same = staffSpec.filter((s) => s.district === district && s.duty === DutyStatus.ON_DUTY).map((s) => s.k);
    return same.includes(k) ? id(k) : (same[0] ? id(same[0]) : id('worker_7'));
  };

  const orderSpecs: Array<{
    k: string; elder: string; type: WorkOrderType; level: RiskLevel; status: WorkOrderStatus;
    source: WorkOrderSource; assigneeK?: string; createdDay: number; deadlDay?: number;
    completedDay?: number; result?: string; reqText?: string; reason: string;
  }> = [
    // COMPLETED（含完成时间 + 结果，让 dashboard 完成率 + 评价有数据）
    { k: 'wo_1', elder: 'elder_1', type: WorkOrderType.LIFE, level: RiskLevel.MEDIUM, status: WorkOrderStatus.COMPLETED, source: WorkOrderSource.RISK_DISPATCH, assigneeK: 'worker_1', createdDay: 5, deadlDay: 4, completedDay: 3, result: '已协助老人完成日常起居，血压测量正常', reason: '风险派单:连续未报平安' },
    { k: 'wo_2', elder: 'elder_2', type: WorkOrderType.HEALTH, level: RiskLevel.HIGH, status: WorkOrderStatus.COMPLETED, source: WorkOrderSource.RISK_DISPATCH, assigneeK: 'worker_1', createdDay: 5, deadlDay: 4, completedDay: 4, result: '陪同就医，开具降压药处方', reason: '风险派单:异常血压' },
    { k: 'wo_3', elder: 'elder_4', type: WorkOrderType.LIFE, level: RiskLevel.HIGH, status: WorkOrderStatus.COMPLETED, source: WorkOrderSource.RISK_DISPATCH, assigneeK: 'worker_3', createdDay: 6, deadlDay: 5, completedDay: 4, result: '失能老人照护，完成清洁与喂餐', reason: '风险派单:失能照护' },
    { k: 'wo_4', elder: 'elder_6', type: WorkOrderType.HEALTH, level: RiskLevel.HIGH, status: WorkOrderStatus.COMPLETED, source: WorkOrderSource.SOS, assigneeK: 'worker_3', createdDay: 4, deadlDay: 4, completedDay: 3, result: '跌倒后上门检查，无骨折，联系家属', reason: '紧急求助:跌倒报警' },
    { k: 'wo_5', elder: 'elder_9', type: WorkOrderType.REPAIR, level: RiskLevel.LOW, status: WorkOrderStatus.COMPLETED, source: WorkOrderSource.FAMILY_REQUEST, assigneeK: 'worker_2', createdDay: 3, deadlDay: 2, completedDay: 2, result: '已维修厨房水管漏水', reqText: '厨房水管漏水，需要维修', reason: '家属请求:水管维修' },
    // IN_PROGRESS
    { k: 'wo_6', elder: 'elder_7', type: WorkOrderType.HEALTH, level: RiskLevel.HIGH, status: WorkOrderStatus.IN_PROGRESS, source: WorkOrderSource.RISK_DISPATCH, assigneeK: 'worker_5', createdDay: 1, deadlDay: 0, reason: '风险派单:头晕站不稳' },
    { k: 'wo_7', elder: 'elder_10', type: WorkOrderType.HEALTH, level: RiskLevel.HIGH, status: WorkOrderStatus.IN_PROGRESS, source: WorkOrderSource.RISK_DISPATCH, assigneeK: 'worker_3', createdDay: 1, deadlDay: 0, reason: '风险派单:胸闷喘不上气' },
    { k: 'wo_8', elder: 'elder_3', type: WorkOrderType.ESCORT, level: RiskLevel.MEDIUM, status: WorkOrderStatus.IN_PROGRESS, source: WorkOrderSource.FAMILY_REQUEST, assigneeK: 'worker_1', createdDay: 0, deadlDay: 1, reqText: '需要陪同去社区医院复诊', reason: '家属请求:陪诊' },
    // ASSIGNED（已派单待处理，worker 端待处理 tab 有内容）
    { k: 'wo_9', elder: 'elder_2', type: WorkOrderType.REPAIR, level: RiskLevel.MEDIUM, status: WorkOrderStatus.ASSIGNED, source: WorkOrderSource.FAMILY_REQUEST, assigneeK: 'worker_2', createdDay: 0, deadlDay: 1, reqText: '家里电路跳闸，需要电工检修', reason: '家属请求:电路维修' },
    { k: 'wo_10', elder: 'elder_5', type: WorkOrderType.ERRAND, level: RiskLevel.LOW, status: WorkOrderStatus.ASSIGNED, source: WorkOrderSource.FAMILY_REQUEST, assigneeK: 'worker_4', createdDay: 0, deadlDay: 1, reqText: '需要代买降压药和米面', reason: '家属请求:代购' },
    { k: 'wo_11', elder: 'elder_11', type: WorkOrderType.COMPANION, level: RiskLevel.MEDIUM, status: WorkOrderStatus.ASSIGNED, source: WorkOrderSource.FAMILY_REQUEST, assigneeK: 'worker_5', createdDay: 0, deadlDay: 2, reqText: '希望有人陪老人聊天解闷', reason: '家属请求:陪伴' },
    // PENDING（待分配，admin 派单按钮有内容；含超期一条让 dashboard overdueCount 非零）
    { k: 'wo_12', elder: 'elder_8', type: WorkOrderType.LIFE, level: RiskLevel.MEDIUM, status: WorkOrderStatus.PENDING, source: WorkOrderSource.FAMILY_REQUEST, createdDay: 2, deadlDay: 1, reqText: '需要帮忙打扫卫生', reason: '家属请求:家政（AI 低置信度，转人工）' },
    { k: 'wo_13', elder: 'elder_12', type: WorkOrderType.REPAIR, level: RiskLevel.LOW, status: WorkOrderStatus.PENDING, source: WorkOrderSource.MANUAL, createdDay: 3, deadlDay: 1, reason: '手动建单:烟感报警复核' },
    // CANCELLED
    { k: 'wo_14', elder: 'elder_1', type: WorkOrderType.ERRAND, level: RiskLevel.LOW, status: WorkOrderStatus.CANCELLED, source: WorkOrderSource.FAMILY_REQUEST, assigneeK: 'worker_7', createdDay: 4, deadlDay: 3, reason: '家属取消:已自行解决' },
    { k: 'wo_15', elder: 'elder_4', type: WorkOrderType.REPAIR, level: RiskLevel.MEDIUM, status: WorkOrderStatus.ASSIGNED, source: WorkOrderSource.SOS, assigneeK: 'worker_4', createdDay: 0, deadlDay: 1, reason: '紧急求助:水管爆裂' },
  ];

  for (const o of orderSpecs) {
    const district = elderDistrict[o.elder];
    const assigneeId = o.assigneeK ? workersInDistrict(district, o.assigneeK) : null;
    const createdWo = await prisma.workOrder.create({
      data: {
        id: id(o.k),
        elderId: id(o.elder),
        type: o.type,
        level: o.level,
        status: o.status,
        sourceFrom: o.source,
        familyRequestText: o.reqText ?? null,
        assigneeId,
        createdById: id('admin_1'),
        deadline: o.deadlDay !== undefined ? (o.deadlDay < 0 ? daysAgo(-o.deadlDay) : daysFromNow(o.deadlDay)) : null,
        completedAt: o.completedDay !== undefined ? daysAgo(o.completedDay, 16) : null,
        result: o.result ?? null,
        dispatchReason: o.reason,
        createdAt: daysAgo(o.createdDay, 10 + o.createdDay),
      },
    });

    // 时间线（每单 2-4 条，按状态决定）
    const timeline: Array<{ action: string; day: number; note?: string }> = [{ action: 'CREATED', day: o.createdDay, note: o.reason }];
    if (o.status !== WorkOrderStatus.PENDING) {
      timeline.push({ action: 'ASSIGNED', day: Math.max(0, o.createdDay - 1), note: '系统派单' });
    }
    if (o.status === WorkOrderStatus.IN_PROGRESS || o.status === WorkOrderStatus.COMPLETED) {
      timeline.push({ action: 'STARTED', day: Math.max(0, o.createdDay - 1) });
    }
    if (o.status === WorkOrderStatus.COMPLETED) {
      timeline.push({ action: 'COMPLETED', day: o.completedDay ?? 0, note: o.result });
    }
    if (o.status === WorkOrderStatus.CANCELLED) {
      timeline.push({ action: 'CANCELLED', day: Math.max(0, o.createdDay - 1), note: '家属取消' });
    }
    for (const t of timeline) {
      await prisma.workOrderTimeline.create({
        data: {
          workOrderId: createdWo.id,
          action: t.action,
          operatorId: assigneeId ?? id('admin_1'),
          note: t.note ?? null,
          createdAt: daysAgo(t.day, 10 + t.day),
        },
      });
    }

    // 评价（仅 COMPLETED 单，5 条让评价页有内容）
    if (o.status === WorkOrderStatus.COMPLETED && ['wo_1', 'wo_2', 'wo_3', 'wo_4', 'wo_5'].includes(o.k)) {
      const ratings = [5, 5, 4, 5, 4];
      const comments = ['服务很周到，谢谢！', '工作人员很专业', '响应很快', '非常满意', '态度很好'];
      const idx = ['wo_1', 'wo_2', 'wo_3', 'wo_4', 'wo_5'].indexOf(o.k);
      await prisma.serviceEvaluation.create({
        data: {
          workOrderId: createdWo.id,
          rating: ratings[idx],
          comment: comments[idx],
          createdAt: daysAgo(o.completedDay ?? 0, 17),
        },
      });
    }
  }

  // ============================================================
  // 8. VisitRecords（8 条走访，部分带照片）
  // ============================================================
  console.log('▶ 插入走访记录...');
  const visitSpecs: Array<{ elder: string; workerK: string; day: number; obs: string; photos: number; note?: string }> = [
    { elder: 'elder_1', workerK: 'worker_1', day: 2, obs: '老人精神状态良好，血压 135/85，按时服药。家中整洁。', photos: 2, note: '建议家属关注老人夜间起夜安全' },
    { elder: 'elder_2', workerK: 'worker_1', day: 3, obs: '陪同社区医院复诊，开具降压药。老人主诉偶有胸闷。', photos: 1 },
    { elder: 'elder_4', workerK: 'worker_3', day: 4, obs: '失能照护：协助清洁、喂餐、翻身。皮肤完整无压疮。', photos: 3 },
    { elder: 'elder_6', workerK: 'worker_3', day: 1, obs: '跌倒后上门：无骨折，额头部淤青已处理。建议家属安装防滑垫。', photos: 2, note: '阿尔茨海默症状稳定' },
    { elder: 'elder_7', workerK: 'worker_5', day: 2, obs: '电话核实：老人反映头晕缓解，已联系家属陪同就医。', photos: 0 },
    { elder: 'elder_9', workerK: 'worker_7', day: 5, obs: '日常走访：糖尿病管理指导，血糖控制可。', photos: 1 },
    { elder: 'elder_11', workerK: 'worker_5', day: 3, obs: '陪伴服务：与老人聊天 40 分钟，情绪改善。', photos: 0 },
    { elder: 'elder_12', workerK: 'worker_6', day: 4, obs: '烟感报警复核：误报，厨房油烟触发。已复位。', photos: 1 },
  ];
  for (const v of visitSpecs) {
    await prisma.visitRecord.create({
      data: {
        elderId: id(v.elder),
        gridWorkerId: workersInDistrict(elderDistrict[v.elder], v.workerK),
        observation: v.obs,
        photos: Array.from({ length: v.photos }, (_, i) => `https://demo.care.local/visit/${v.elder}_${v.day}_${i + 1}.jpg`),
        note: v.note ?? null,
        visitTime: daysAgo(v.day, 14),
      },
    });
  }

  // ============================================================
  // 9. AuditLogs（15 条，混 action/resourceType）
  // ============================================================
  console.log('▶ 插入审计日志...');
  const auditSpecs: Array<{ day: number; action: string; res: string; resId: string; user: string; ip: string }> = [
    { day: 0, action: 'LOGIN', res: 'USER', resId: id('admin_1'), user: id('admin_1'), ip: '127.0.0.1' },
    { day: 0, action: 'CREATE', res: 'WORK_ORDER', resId: id('wo_8'), user: id('admin_1'), ip: '127.0.0.1' },
    { day: 0, action: 'UPDATE', res: 'RISK_EVENT', resId: id('elder_7'), user: id('admin_1'), ip: '127.0.0.1' },
    { day: 1, action: 'CREATE', res: 'ELDER', resId: id('elder_12'), user: id('admin_1'), ip: '127.0.0.1' },
    { day: 1, action: 'UPDATE', res: 'USER', resId: id('worker_3'), user: id('admin_1'), ip: '127.0.0.1' },
    { day: 2, action: 'DELETE', res: 'WORK_ORDER', resId: id('wo_14'), user: id('admin_1'), ip: '127.0.0.1' },
    { day: 2, action: 'LOGIN', res: 'USER', resId: id('worker_1'), user: id('worker_1'), ip: '192.168.1.20' },
    { day: 3, action: 'CREATE', res: 'WORK_ORDER', resId: id('wo_3'), user: id('admin_1'), ip: '127.0.0.1' },
    { day: 3, action: 'UPDATE', res: 'RISK_EVENT', resId: id('elder_6'), user: id('admin_1'), ip: '127.0.0.1' },
    { day: 4, action: 'CREATE', res: 'WORK_ORDER', resId: id('wo_4'), user: id('admin_1'), ip: '127.0.0.1' },
    { day: 4, action: 'LOGIN', res: 'USER', resId: id('admin_1'), user: id('admin_1'), ip: '127.0.0.1' },
    { day: 5, action: 'UPDATE', res: 'ELDER', resId: id('elder_2'), user: id('admin_1'), ip: '127.0.0.1' },
    { day: 5, action: 'CREATE', res: 'WORK_ORDER', resId: id('wo_5'), user: id('admin_1'), ip: '127.0.0.1' },
    { day: 6, action: 'DELETE', res: 'USER', resId: id('family_1'), user: id('admin_1'), ip: '127.0.0.1' },
    { day: 6, action: 'LOGIN', res: 'USER', resId: id('worker_3'), user: id('worker_3'), ip: '192.168.1.30' },
  ];
  for (const a of auditSpecs) {
    await prisma.auditLog.create({
      data: {
        userId: a.user,
        action: a.action,
        resourceType: a.res,
        resourceId: a.resId,
        ip: a.ip,
        createdAt: daysAgo(a.day, 9 + a.day),
      },
    });
  }

  // ============================================================
  // 10. Notifications（几条 USER 类，让通知 inbox 有内容）
  // ============================================================
  console.log('▶ 插入通知...');
  await prisma.notification.createMany({
    data: [
      { targetType: 'USER', targetId: id('worker_1'), channel: 'console', payload: { text: '您有新的工单：陪同就医' }, status: 'SENT', sentAt: daysAgo(1, 10) },
      { targetType: 'USER', targetId: id('worker_3'), channel: 'console', payload: { text: '紧急工单：胸闷喘不上气' }, status: 'SENT', sentAt: daysAgo(1, 11) },
      { targetType: 'USER', targetId: id('admin_1'), channel: 'console', payload: { text: '2 条风险事件待复核' }, status: 'SENT', sentAt: daysAgo(0, 9) },
      { targetType: 'USER', targetId: id('family_2'), channel: 'console', payload: { text: '您的请求已派单给陈秀英' }, status: 'SENT', sentAt: daysAgo(0, 10) },
    ],
  });

  console.log('✓ 演示数据填充完成');
  console.log('  管理端登录：13800138000 / admin123');
  console.log('  小程序：你的微信账号已关联 张桂兰(elder_1)、王秀珍(elder_3)');
}

main()
  .catch((e) => {
    console.error('✗ 演示数据填充失败：', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
