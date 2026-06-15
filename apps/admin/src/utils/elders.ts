/**
 * 性别展示归一化。
 *
 * 历史数据里 gender 是自由字符串（schema 为 String?），存在多种写法：
 *   - 'M' / 'MALE' / 'male' / '男'
 *   - 'F' / 'FEMALE' / 'female' / '女'
 * 不同页面此前各写一套判定，导致同一记录在表格和抽屉里显示不一致
 * （表格只认 MALE/FEMALE，对 'M' 会原样输出 "M"）。
 *
 * 这里集中处理：对常见男/女写法都给出统一中文标签，无法识别时回退原值或 '-'。
 */
export function genderLabel(gender?: string | null): string {
  if (!gender) return '-';
  const g = String(gender).trim();
  const upper = g.toUpperCase();
  if (upper === 'M' || upper === 'MALE' || g === '男') return '男';
  if (upper === 'F' || upper === 'FEMALE' || g === '女') return '女';
  // 未知取值（如 'OTHER'）：原样展示，不吞数据
  return g;
}
