import { Injectable, Logger } from '@nestjs/common';
import { INotificationChannel, SendNotificationInput, SendNotificationResult } from './notification-channel.interface';

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

  async send(input: SendNotificationInput): Promise<SendNotificationResult> {
    const appId = process.env.WECHAT_APPID;
    const secret = process.env.WECHAT_SECRET;

    if (!appId || !secret) {
      return { success: false, error: 'WeChat APPID/SECRET not configured' };
    }

    try {
      const accessToken = await this.getAccessToken(appId, secret);

      const body = {
        touser: input.targetId,
        template_id: input.templateId ?? '',
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
        this.logger.log(`WeChat notification sent to ${input.targetId}`);
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
