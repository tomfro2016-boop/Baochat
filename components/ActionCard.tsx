'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Zap } from 'lucide-react';
import { useApp } from './Providers';
import { api } from '@/lib/client/api';

export type Action =
  | { type: 'navigate'; to: 'tokens' | 'settings' | 'personalize' | 'studio' }
  | { type: 'theme'; value: 'dark' | 'light' }
  | { type: 'mode'; value: 'serious' | 'casual' | 'funny' | 'playful' }
  | { type: 'preset'; value: string }
  | { type: 'new_chat' }
  | { type: 'remember'; content: string };

const PRESET_OK = ['tutor', 'writer', 'novelist', 'coach', 'translator', 'coder', 'planner', 'analyst', 'none'];

export function parseAction(text: string): Action | null {
  try {
    const o = JSON.parse(text);
    if (!o || typeof o !== 'object') return null;
    switch (o.type) {
      case 'navigate': return ['tokens', 'settings', 'personalize', 'studio'].includes(o.to) ? { type: 'navigate', to: o.to } : null;
      case 'theme': return o.value === 'dark' || o.value === 'light' ? { type: 'theme', value: o.value } : null;
      case 'mode': return ['serious', 'casual', 'funny', 'playful'].includes(o.value) ? { type: 'mode', value: o.value } : null;
      case 'preset': return PRESET_OK.includes(o.value) ? { type: 'preset', value: o.value } : null;
      case 'new_chat': return { type: 'new_chat' };
      case 'remember': return typeof o.content === 'string' && o.content.trim().length >= 3 ? { type: 'remember', content: o.content.trim().slice(0, 150) } : null;
    }
  } catch {
    /* không phải JSON hợp lệ */
  }
  return null;
}

const PAGE_LABEL: Record<string, [string, string]> = {
  tokens: ['Token', 'Tokens'],
  settings: ['Cài đặt', 'Settings'],
  personalize: ['Cá nhân hóa', 'Personalize'],
  studio: ['Studio', 'Studio'],
};

export default function ActionCard({ action }: { action: Action }) {
  const { me, tr, setTheme } = useApp();
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  if (!me) return null; // trang chia sẻ công khai: không thực thi hành động

  const label = (() => {
    switch (action.type) {
      case 'navigate': return tr(`Mở trang ${PAGE_LABEL[action.to][0]}`, `Open ${PAGE_LABEL[action.to][1]}`);
      case 'theme': return action.value === 'dark' ? tr('Chuyển sang giao diện tối', 'Switch to dark theme') : tr('Chuyển sang giao diện sáng', 'Switch to light theme');
      case 'mode': return tr(`Đổi giọng điệu: ${action.value}`, `Set tone: ${action.value}`);
      case 'preset': return action.value === 'none' ? tr('Về trợ lý chung', 'Back to general assistant') : tr(`Đổi vai trò: ${action.value}`, `Set role: ${action.value}`);
      case 'new_chat': return tr('Mở cuộc trò chuyện mới', 'Start a new chat');
      case 'remember': return tr(`Ghi nhớ: "${action.content}"`, `Remember: "${action.content}"`);
    }
  })();

  const run = async () => {
    setErr('');
    try {
      switch (action.type) {
        case 'navigate': router.push(`/${action.to}`); break;
        case 'theme': setTheme(action.value); break;
        case 'mode':
        case 'preset': window.dispatchEvent(new CustomEvent('bc-action', { detail: { type: action.type, value: action.value } })); break;
        case 'new_chat': router.push('/'); break;
        case 'remember': await api('/api/memories', { body: { content: action.content } }); break;
      }
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="my-3 flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm">
      <Zap size={15} strokeWidth={1.5} className="shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="break-words">{label}</p>
        {err && <p className="text-xs text-danger">{err}</p>}
      </div>
      <button className="btn btn-primary !h-8 shrink-0 !px-3 text-xs" onClick={run} disabled={done}>
        {done ? <><Check size={14} strokeWidth={1.5} /> {tr('Đã xong', 'Done')}</> : tr('Thực hiện', 'Run')}
      </button>
    </div>
  );
}
