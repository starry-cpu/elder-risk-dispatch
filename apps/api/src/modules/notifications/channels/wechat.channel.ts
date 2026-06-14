import { Injectable, Logger } from '@nestjs/common';
import { INotificationChannel, SendNotificationInput, SendNotificationResult } from './notification-channel.interface';
import { PrismaService } from '../../../common/prisma/prisma.service';

interface AccessTokenCache {
  token: string;
  expiresAt: number; // epoch ms
}

interface WeChatTokenResponse {
  access_token?: string;
  expires_in?: number;
  errcode?: number;
  errmsg?: string;
}

interface WeChatSendResponse {
  errcode: number;
  errmsg: string;
}

@Injectable()
export class WeChatChannel implements INotificationChannel {
  private readonly logger = new Logger(WeChatChannel.name);
  private tokenCache: AccessTokenCache | null = null;
  private tokenExpiresAt: number = 0;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 微信 openid 形态：以 'o' 开头、约 28 字符。
   * scheduler 历史传的是 'system'（必然失败）；新 fan-out 流程传的是 userId。
   * 这里做一次归一化：不像 openid 就当 userId 查 User.openid。
   */
  private looksLikeOpenid(v: string): boolean {
    return /^o[A-Za-z0-9_-]{20,}$/.test(v);
  }

  private async resolveOpenid(targetId: string): Promise<string | null> {
    if (!targetId) return null;
    if (this.looksLikeOpenid(targetId)) return targetId;
    // 当 userId 处理
    try {
      const u = await this.prisma.user.findUnique({
        where: { id: targetId },
        select: { openid: true },
      });
      return u?.openid ?? null;
    } catch (error: any) {
      this.logger.warn(`Failed to resolve openid for targetId=${targetId}: ${error?.message ?? error}`);
      return null;
    }
  }

  async send(input: SendNotificationInput): Promise<SendNotificationResult> {
    const appId = process.env.WECHAT_APPID;
    const secret = process.env.WECHAT_SECRET;

    if (!appId || !secret) {
      return { success: false, error: 'WeChat APPID/SECRET not configured' };
    }

    if (!input.templateId) {
      return { success: false, error: 'WeChat templateId is required' };
    }

    const openid = await this.resolveOpenid(input.targetId);
    if (!openid) {
      // 接收人未绑微信（无 openid）：不视为错误抛出，返回失败让 processor 标 FAILED + 审计；
      // 上层 sendToRecipients 仍会为该接收人写一行 Notification（console 兜底可见）。
      return { success: false, error: `No openid for targetId ${input.targetId}` };
    }

    try {
      const accessToken = await this.getAccessToken(appId, secret);

      const body = {
        touser: openid,
        template_id: input.templateId,
        data: input.payload,
      };

      const response = await fetch(
        `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );

      const json = (await response.json()) as WeChatSendResponse;

      if (json.errcode === 0) {
        this.logger.log(`WeChat notification sent to ${openid}`);
        return { success: true };
      }

      this.logger.warn(`WeChat API error: errcode=${json.errcode} errmsg=${json.errmsg}`);
      return { success: false, error: `WeChat error ${json.errcode}: ${json.errmsg}` };
    } catch (error: any) {
      this.logger.error(`WeChat send failed: ${error?.message ?? error}`);
      return { success: false, error: error?.message ?? 'Unknown error' };
    }
  }

  private async getAccessToken(appId: string, secret: string): Promise<string> {
    // Return cached token if still valid (with 200s safety margin)
    if (this.tokenCache && Date.now() < this.tokenExpiresAt - 200_000) {
      return this.tokenCache.token;
    }

    const response = await fetch(
      `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${secret}`,
    );

    const json = (await response.json()) as WeChatTokenResponse;

    if (!json.access_token) {
      throw new Error(`Failed to get WeChat access_token: ${JSON.stringify(json)}`);
    }

    this.tokenExpiresAt = Date.now() + (json.expires_in ?? 7200) * 1000;

    this.tokenCache = {
      token: json.access_token,
      expiresAt: this.tokenExpiresAt,
    };

    return this.tokenCache.token;
  }
}
