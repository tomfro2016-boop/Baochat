// Dùng được ở cả client và server (không import mã máy chủ).
export const DEEP_IDS = ['reasoning', 'research', 'verify', 'council', 'swarm', 'premortem', 'simulate'] as const;
export type DeepId = (typeof DEEP_IDS)[number];

export const DEEP_META: { id: DeepId; vi: string; en: string }[] = [
  { id: 'reasoning', vi: 'Suy luận sâu', en: 'Deep reasoning' },
  { id: 'research', vi: 'Nghiên cứu chuyên sâu', en: 'Deep research' },
  { id: 'verify', vi: 'Tự kiểm chứng', en: 'Self-verify' },
  { id: 'council', vi: 'Hội đồng chuyên gia', en: 'Expert council' },
  { id: 'swarm', vi: 'Nhóm chuyên gia song song', en: 'Parallel expert team' },
  { id: 'premortem', vi: 'Rà soát trước khi gửi', en: 'Pre-send review' },
  { id: 'simulate', vi: 'Mô phỏng phản ứng', en: 'Reaction simulator' },
];

