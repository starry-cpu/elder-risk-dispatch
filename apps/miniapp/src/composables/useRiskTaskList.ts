export interface RiskTaskItem {
  id: string;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string;
  score: number;
  elderName: string;
  source: string;
  reason: string;
  status: string;
}

const LEVEL_PRIORITY: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export function useRiskTaskList() {
  function sortItems(items: RiskTaskItem[]): RiskTaskItem[] {
    return [...items].sort((a, b) => {
      const levelDiff = (LEVEL_PRIORITY[a.level] ?? 99) - (LEVEL_PRIORITY[b.level] ?? 99);
      if (levelDiff !== 0) return levelDiff;
      return b.score - a.score;
    });
  }
  function filterByStatus(items: RiskTaskItem[], status: string): RiskTaskItem[] {
    if (!status) return items;
    return items.filter(i => i.status === status);
  }
  function filterByLevel(items: RiskTaskItem[], level: string): RiskTaskItem[] {
    if (!level) return items;
    return items.filter(i => i.level === level);
  }
  return { sortItems, filterByStatus, filterByLevel };
}
