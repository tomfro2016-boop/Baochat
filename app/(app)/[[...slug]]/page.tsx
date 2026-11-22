import { notFound } from 'next/navigation';
import ChatView from '@/components/ChatView';

// "/" (chat mới) và "/c/<id>" dùng chung một trang để luồng trả lời không bị ngắt khi URL đổi.
export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  if (slug && slug.length) {
    const ok = slug.length === 2 && slug[0] === 'c' && /^[0-9a-f-]{36}$/i.test(slug[1]);
    if (!ok) notFound();
  }
  return <ChatView />;
}
