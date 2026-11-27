'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client/api';
import { accentVars } from '@/lib/client/util';

export type Lang = 'vi' | 'en';
export type Mode = 'serious' | 'casual' | 'funny' | 'playful';

export type TokenInfo = {
  unlimited: boolean;
  balance: number | null;
  quota: number | null;
  usedCycle: number;
  usedTotal: number;
  resetAt: string | null;
  serverNow: string;
};

export type Me = {
  user: {
    id: string;
    publicId: string;
    email: string;
    emailVerified: boolean;
    displayName: string;
    avatarUrl: string | null;
    isAdmin: boolean;
    hasPassword: boolean;
    hasGoogle: boolean;
    uiLang: Lang;
    theme: 'dark' | 'light';
    accent: string;
    defaultMode: Mode;
    memoryEnabled: boolean;
    useHistory: boolean;
    createdAt: string;
  };
  tokens: TokenInfo;
  announcements: { id: string; title: string; body: string }[];
  features: {
    search: boolean;
    google: boolean;
    emailVerificationRequired: boolean;
    models: { id: string; label: string; vision: boolean }[];
    defaultModel: string;
    maxUploadMb: number;
  };
};

type Ctx = {
  me: Me | null;
  loading: boolean;
  refresh: () => Promise<void>;
  lang: Lang;
  tr: (vi: string, en: string) => string;
  setLang: (l: Lang) => void;
  theme: 'dark' | 'light';
  setTheme: (t: 'dark' | 'light') => void;
  setAccent: (hex: string) => void;
  convVersion: number;
  bumpConvs: () => void;
  patchTokens: (t: Partial<TokenInfo>) => void;
};

const AppCtx = createContext<Ctx>(null as any);
export const useApp = () => useContext(AppCtx);

function applyTheme(theme: string, accent: string) {
  const el = document.documentElement;
  el.dataset.theme = theme;
  const v = accentVars(accent, theme);
  el.style.setProperty('--primary', v.primary);
  el.style.setProperty('--accent', v.accent);
  el.style.setProperty('--on-primary', v.onPrimary);
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLangState] = useState<Lang>('vi');
  const [theme, setThemeState] = useState<'dark' | 'light'>('dark');
  const [accent, setAccentState] = useState('#F0A528');
  const [convVersion, setConvVersion] = useState(0);

  // Khôi phục tuỳ chọn tạm thời (trang chưa đăng nhập)
  useEffect(() => {
    try {
      const l = localStorage.getItem('bc_lang') as Lang | null;
      const t = localStorage.getItem('bc_theme') as 'dark' | 'light' | null;
      const a = localStorage.getItem('bc_accent');
      if (l === 'vi' || l === 'en') setLangState(l);
      else if (navigator.language && !navigator.language.startsWith('vi')) setLangState('en');
      if (t) setThemeState(t);
      if (a) setAccentState(a);
    } catch {}
  }, []);

  const refresh = useCallback(async () => {
    try {
      const data = await api<Me>('/api/me');
      setMe(data);
      setLangState(data.user.uiLang);
      setThemeState(data.user.theme);
      setAccentState(data.user.accent);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    applyTheme(theme, accent);
    try {
      localStorage.setItem('bc_theme', theme);
      localStorage.setItem('bc_accent', accent);
      localStorage.setItem('bc_lang', lang);
    } catch {}
    document.documentElement.lang = lang;
  }, [theme, accent, lang]);

  const persist = useCallback(
    (body: Record<string, unknown>) => {
      if (me) api('/api/me', { method: 'PATCH', body }).catch(() => {});
    },
    [me],
  );

  const value = useMemo<Ctx>(
    () => ({
      me,
      loading,
      refresh,
      lang,
      tr: (vi, en) => (lang === 'vi' ? vi : en),
      setLang: (l) => {
        setLangState(l);
        persist({ uiLang: l });
      },
      theme,
      setTheme: (t) => {
        setThemeState(t);
        persist({ theme: t });
      },
      setAccent: (hex) => {
        setAccentState(hex);
        persist({ accent: hex });
      },
      convVersion,
      bumpConvs: () => setConvVersion((v) => v + 1),
      patchTokens: (t) => setMe((m) => (m ? { ...m, tokens: { ...m.tokens, ...t } } : m)),
    }),
    [me, loading, refresh, lang, theme, convVersion, persist],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
