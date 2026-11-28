// Dùng được ở cả client và server (không import mã máy chủ).
export const DEEP_IDS = ['reasoning', 'research', 'verify', 'council'] as const;
export type DeepId = (typeof DEEP_IDS)[number];

export const DEEP_META: { id: DeepId; vi: string; en: string }[] = [
  { id: 'reasoning', vi: 'Suy luận sâu', en: 'Deep reasoning' },
  { id: 'research', vi: 'Nghiên cứu chuyên sâu', en: 'Deep research' },
  { id: 'verify', vi: 'Tự kiểm chứng', en: 'Self-verify' },
  { id: 'council', vi: 'Hội đồng chuyên gia', en: 'Expert council' },
];

