import Link from 'next/link';
import { notFound } from 'next/navigation';
import { q, q1 } from '@/lib/db';
import Markdown from '@/components/Markdown';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cuộc trò chuyện được chia sẻ · Baochat', robots: { index: false, follow: false } };

export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound();
  const c = await q1<{ id: string; title: string }>(
    `SELECT c.id, c.title FROM shared_conversations s JOIN conversations c ON c.id = s.conversation_id WHERE s.token = $1`,
    [token],
  );
  if (!c) notFound();
  const msgs = await q<{ id: string; role: 'user' | 'assistant'; content: string }>(
    'SELECT id, role, content FROM messages WHERE conversation_id = $1 ORDER BY created_at, id',
    [c.id],
  );
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-10">
      <header className="mb-8 flex items-center justify-between border-b border-line pb-4">
        <div>
          <p className="mono-label mb-1">cuộc trò chuyện được chia sẻ</p>
          <h1 className="text-xl font-semibold text-ink">{c.title}</h1>
        </div>
        <Link href="/" className="btn btn-primary">Dùng Baochat</Link>
      </header>
      <div className="space-y-6">
        {msgs.filter((m) => m.content).map((m) =>
          m.role === 'user' ? (
            <div key={m.id} className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-lg border border-line bg-surface px-4 py-3 text-sm text-ink">{m.content}</div>
          ) : (
            <div key={m.id}>
              <p className="mono-label mb-1">baochat</p>
              <Markdown>{m.content}</Markdown>
            </div>
          ),
        )}
      </div>
      <footer className="mt-10 border-t border-line pt-4 text-xs text-muted">Bản chỉ đọc. Tệp đính kèm không được chia sẻ.</footer>
    </main>
  );
}
