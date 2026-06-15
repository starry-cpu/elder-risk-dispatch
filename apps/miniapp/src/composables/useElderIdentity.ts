// 老人精简信息（与 GET /elders/mine 返回一致）
export interface ElderBrief {
  id: string;
  name: string;
  serviceLevel: string;
  district: string;
}

// 从 elders 列表里按 id 选当前老人，找不到返回 null
export function pickCurrentElder(elders: ElderBrief[], id: string | undefined): ElderBrief | null {
  if (!id) return elders[0] ?? null;
  return elders.find((e) => e.id === id) ?? null;
}
