export interface CheckInInput {
  elderId: string;
  method: string;
  content?: string;
  voiceUrl?: string;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export function useCheckIn() {
  const methodLabels: Record<string, string> = {
    ONE_TAP: '一键报平安',
    VOICE: '语音报平安',
    TEXT: '文字报平安',
    PROXY: '代填报平安',
  };

  function validate(input: CheckInInput): ValidationResult {
    if (!input.elderId || input.elderId.trim().length === 0) {
      return { valid: false, message: '请选择老人ID' };
    }
    if (!input.method || input.method.trim().length === 0) {
      return { valid: false, message: '请选择报平安方式' };
    }
    if (input.method === 'TEXT' && (!input.content || input.content.trim().length === 0)) {
      return { valid: false, message: '请输入报平安内容' };
    }
    if (input.method === 'VOICE' && (!input.voiceUrl || input.voiceUrl.trim().length === 0)) {
      return { valid: false, message: '请录制语音' };
    }
    return { valid: true };
  }

  return { methodLabels, validate };
}
