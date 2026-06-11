import { Injectable, Logger } from '@nestjs/common';
import { INotificationChannel, SendNotificationInput, SendNotificationResult } from './notification-channel.interface';

@Injectable()
export class ConsoleChannel implements INotificationChannel {
  private readonly logger = new Logger(ConsoleChannel.name);

  async send(input: SendNotificationInput): Promise<SendNotificationResult> {
    this.logger.log(
      `[NOTIFICATION] targetType=${input.targetType} targetId=${input.targetId} ` +
      `templateId=${input.templateId ?? 'N/A'} payload=${JSON.stringify(input.payload)}`,
    );
    return { success: true };
  }
}
