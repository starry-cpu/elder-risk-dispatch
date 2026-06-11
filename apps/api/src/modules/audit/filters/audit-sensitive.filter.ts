const PHONE_PATTERN = /^phone/i;
const ID_CARD_PATTERN = /^(idCard|idNumber|identityCard)$/i;
const SECRET_PATTERN = /^(password|secret|token|apiKey)$/i;

export function sanitizeAuditData(
  data: Record<string, unknown>,
  sensitiveFields: string[],
): Record<string, unknown> {
  if (data == null || typeof data !== 'object') return data;
  if (!sensitiveFields || sensitiveFields.length === 0) return data;

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item && typeof item === 'object' ? sanitizeAuditData(item as Record<string, unknown>, sensitiveFields) : item
      );
    } else if (value && typeof value === 'object') {
      result[key] = sanitizeAuditData(value as Record<string, unknown>, sensitiveFields);
    } else if (isSensitiveField(key, sensitiveFields)) {
      result[key] = maskValue(key, value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

function isSensitiveField(fieldName: string, sensitiveFields: string[]): boolean {
  return sensitiveFields.some(
    (sf) => fieldName === sf || fieldName.toLowerCase() === sf.toLowerCase(),
  );
}

function maskValue(fieldName: string, value: unknown): unknown {
  if (typeof value !== 'string') return value;

  if (SECRET_PATTERN.test(fieldName)) {
    return '***REDACTED***';
  }
  if (ID_CARD_PATTERN.test(fieldName) && value.length >= 4) {
    return '*'.repeat(value.length - 4) + value.slice(-4);
  }
  if (PHONE_PATTERN.test(fieldName) && value.length >= 3) {
    return value[0] + '*'.repeat(value.length - 2) + value[value.length - 1];
  }
  return '***MASKED***';
}
