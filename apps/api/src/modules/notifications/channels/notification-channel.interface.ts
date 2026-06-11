export interface SendNotificationInput {
  targetType: 'USER' | 'ELDER';
  targetId: string;
  templateId?: string;
  payload: Record<string, unknown>;
}

export interface SendNotificationResult {
  success: boolean;
  error?: string;
}

export interface INotificationChannel {
  send(input: SendNotificationInput): Promise<SendNotificationResult>;
}

export const NOTIFICATION_CHANNEL = 'NOTIFICATION_CHANNEL';
