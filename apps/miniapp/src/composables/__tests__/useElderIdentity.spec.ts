import { describe, it, expect } from 'vitest';
import type { ElderBrief } from '../useElderIdentity';
import { pickCurrentElder } from '../useElderIdentity';

describe('ElderBrief type', () => {
  it('should accept the expected shape', () => {
    const elder: ElderBrief = { id: 'e-1', name: '张大爷', serviceLevel: 'HIGH', district: '朝阳区' };
    expect(elder.id).toBe('e-1');
    expect(elder.name).toBe('张大爷');
  });
});

describe('pickCurrentElder', () => {
  const elders: ElderBrief[] = [
    { id: 'e-1', name: '张大爷', serviceLevel: 'HIGH', district: '朝阳区' },
    { id: 'e-2', name: '李奶奶', serviceLevel: 'NORMAL', district: '朝阳区' },
  ];

  it('should return the elder matching the given id', () => {
    expect(pickCurrentElder(elders, 'e-2')?.id).toBe('e-2');
  });

  it('should fall back to the first elder when id is undefined', () => {
    expect(pickCurrentElder(elders, undefined)?.id).toBe('e-1');
  });

  it('should return null when id is given but not found', () => {
    expect(pickCurrentElder(elders, 'e-other')).toBeNull();
  });

  it('should return null for an empty elders list', () => {
    expect(pickCurrentElder([], undefined)).toBeNull();
  });
});
