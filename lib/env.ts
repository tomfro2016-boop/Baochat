// Đọc biến môi trường tại thời điểm chạy (không bake vào bundle client).
export const env = {
  get appUrl() {
    return (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
  },
  get isProd() {
    return process.env.NODE_ENV === 'production';
  },
  get googleClientId() {
    return process.env.GOOGLE_CLIENT_ID || '';
  },
  get googleClientSecret() {
    return process.env.GOOGLE_CLIENT_SECRET || '';
  },
  get googleConfigured() {
    return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  },
  get adminEmails(): string[] {
    return (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  },
  get smtpConfigured() {
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  },
  get tavilyKey() {
    return process.env.TAVILY_API_KEY || '';
  },
  get braveKey() {
    return process.env.BRAVE_API_KEY || '';
  },
  get searchConfigured() {
    return !!(process.env.TAVILY_API_KEY || process.env.BRAVE_API_KEY);
  },
  get trustProxy() {
    return Number(process.env.TRUST_PROXY || '0') > 0;
  },
};

export function isAdminEmail(email: string) {
  return env.adminEmails.includes(email.trim().toLowerCase());
}
