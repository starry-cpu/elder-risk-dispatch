import { sanitizeAuditData } from './audit-sensitive.filter';

describe('sanitizeAuditData', () => {
  it('应脱敏手机号字段', () => {
    const result = sanitizeAuditData({ phone: '13812345678' }, ['phone']);
    expect(result.phone).toBe('1*********8');
  });

  it('应脱敏身份证字段', () => {
    const result = sanitizeAuditData({ idCard: '110101199001011234' }, ['idCard']);
    expect(result.idCard).toBe('**************1234');
  });

  it('应移除密码类字段', () => {
    const result = sanitizeAuditData({ password: 'secret123' }, ['password']);
    expect(result.password).toBe('***REDACTED***');
  });

  it('应保持非敏感字段不变', () => {
    const input = { name: '张大爷', phone: '13800000000', address: '朝阳区' };
    const result = sanitizeAuditData(input, ['phone']);
    expect(result.name).toBe('张大爷');
    expect(result.address).toBe('朝阳区');
    expect(result.phone).toBe('1*********0');
  });

  it('嵌套对象中敏感字段也应脱敏', () => {
    const result = sanitizeAuditData(
      { elder: { name: '张大爷', idCard: '110101199001011234' } },
      ['idCard'],
    );
    const elder = result.elder as Record<string, unknown>;
    expect(elder.idCard).toBe('**************1234');
    expect(elder.name).toBe('张大爷');
  });

  it('非字符串敏感字段保持不变', () => {
    const result = sanitizeAuditData({ age: 80, phone: 13812345678 }, ['phone']);
    expect(result.age).toBe(80);
    expect(result.phone).toBe(13812345678);
  });

  it('空对象和空敏感字段列表应原样返回', () => {
    expect(sanitizeAuditData({}, [])).toEqual({});
    expect(sanitizeAuditData({ name: 'test' }, [])).toEqual({ name: 'test' });
  });

  it('null 输入应返回 null 而不崩溃', () => {
    expect(sanitizeAuditData(null as unknown as Record<string, unknown>, ['phone'])).toBeNull();
  });

  it('undefined 输入应返回 undefined', () => {
    expect(sanitizeAuditData(undefined as unknown as Record<string, unknown>, ['phone'])).toBeUndefined();
  });

  it('数组中的对象字段也应脱敏', () => {
    const result = sanitizeAuditData(
      { items: [{ phone: '13812345678' }, { phone: '13987654321' }] },
      ['phone'],
    );
    const items = result.items as Array<Record<string, unknown>>;
    expect(items[0].phone).toBe('1*********8');
    expect(items[1].phone).toBe('1*********1');
  });

  it('深层嵌套对象(3+层)中敏感字段也应脱敏', () => {
    const result = sanitizeAuditData(
      { level1: { level2: { level3: { idCard: '110101199001011234' } } } },
      ['idCard'],
    );
    const level1 = result.level1 as Record<string, unknown>;
    const level2 = level1.level2 as Record<string, unknown>;
    const level3 = level2.level3 as Record<string, unknown>;
    expect(level3.idCard).toBe('**************1234');
  });
});
