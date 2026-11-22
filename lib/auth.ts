import { q } from './db';
import { env, isAdminEmail } from './env';
import { ApiError } from './http';
import { getSessionUserRow } from './session';

export type User = {
  id: string;
  seq: number;
  email: string;
  email_verified: boolean;
  password_hash: string | null;
  google_sub: string | null;
  display_name: string;
  avatar_file_id: string | null;
  role: 'user' | 'admin';
  status: 'active' | 'blocked';
  token_quota: number;
  token_balance: number;
  token_used_cycle: number;
  token_used_total: number;
  token_reset_at: string;
  ui_lang: string;
  theme: string;
  accent: string;
  default_mode: 'serious' | 'casual' | 'funny' | 'playful';
  memory_enabled: boolean;
  use_history: boolean;
  created_at: string;
  last_seen_at: string;
  /** Được tính ở server tại mỗi request - KHÔNG tin cột role một mình. */
  isAdmin: boolean;
};

/**
 * Admin chỉ hợp lệ khi đồng thời:
 *  - email nằm trong ADMIN_EMAILS (biến môi trường phía server),
 *  - tài khoản được liên kết với Google (google_sub) và email_verified = true,
 *  - cột role = 'admin' (được đặt ở callback Google sau khi xác minh id_token).
 */
function computeIsAdmin(row: any): boolean {
  return row.role === 'admin' && !!row.google_sub && row.email_verified === true && isAdminEmail(row.email);
}

export async function getUser(): Promise<User | null> {
  const row = await getSessionUserRow();
  if (!row) return null;
  if (row.status === 'blocked') return null;
  // cập nhật hoạt động tối đa mỗi phút
  if (Date.now() - new Date(row.last_seen_at).getTime() > 60_000) {
    q('UPDATE users SET last_seen_at = now() WHERE id = $1', [row.id]).catch(() => {});
  }
  return { ...row, isAdmin: computeIsAdmin(row) } as User;
}

export async function requireUser(): Promise<User> {
  const u = await getUser();
  if (!u) throw new ApiError(401, 'Bạn cần đăng nhập');
  return u;
}

export async function requireVerifiedUser(): Promise<User> {
  const u = await requireUser();
  if (env.smtpConfigured && !u.email_verified) {
    throw new ApiError(403, 'Vui lòng xác minh email trước khi sử dụng.', { code: 'EMAIL_NOT_VERIFIED' });
  }
  return u;
}

export async function requireAdmin(): Promise<User> {
  const u = await requireUser();
  if (!u.isAdmin) throw new ApiError(403, 'Không có quyền truy cập');
  return u;
}

/** Dữ liệu người dùng an toàn để gửi xuống client. */
export function publicUser(u: User) {
  return {
    id: u.id,
    publicId: 'BC-' + String(u.seq).padStart(6, '0'),
    email: u.email,
    emailVerified: u.email_verified,
    displayName: u.display_name,
    avatarUrl: u.avatar_file_id ? `/api/avatar/${u.id}?v=${u.avatar_file_id}` : null,
    isAdmin: u.isAdmin,
    hasPassword: !!u.password_hash,
    hasGoogle: !!u.google_sub,
    uiLang: u.ui_lang,
    theme: u.theme,
    accent: u.accent,
    defaultMode: u.default_mode,
    memoryEnabled: u.memory_enabled,
    useHistory: u.use_history,
    createdAt: u.created_at,
  };
}
