import { describe, it, expect } from 'vitest';
import { genderLabel } from '../elders';

describe('genderLabel', () => {
  it('maps male variants to 男', () => {
    expect(genderLabel('M')).toBe('男');
    expect(genderLabel('MALE')).toBe('男');
    expect(genderLabel('male')).toBe('男');
    expect(genderLabel('男')).toBe('男');
  });

  it('maps female variants to 女', () => {
    expect(genderLabel('F')).toBe('女');
    expect(genderLabel('FEMALE')).toBe('女');
    expect(genderLabel('female')).toBe('女');
    expect(genderLabel('女')).toBe('女');
  });

  it('returns - for empty/null/undefined', () => {
    expect(genderLabel(undefined)).toBe('-');
    expect(genderLabel(null)).toBe('-');
    expect(genderLabel('')).toBe('-');
  });

  it('preserves unknown values instead of forcing a gender', () => {
    // 旧行为：表格把 'M' 直接输出为 "M"；抽屉把任何非 'M' 都判成 "女"，
    // 包括 null 和未知值。这里对未知值原样返回，避免误判。
    expect(genderLabel('OTHER')).toBe('OTHER');
  });
});
