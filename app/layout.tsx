import type { Metadata, Viewport } from 'next';
import 'highlight.js/styles/github-dark.css';
import './globals.css';
import Providers from '@/components/Providers';

export const metadata: Metadata = {
  title: 'Baochat — Your Personal AI Universe',
  description: 'Baochat: trợ lý AI đa năng — trò chuyện, tìm kiếm Internet, tạo website, tài liệu, slide và bảng tính.',
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0B0D12',
};

// Áp dụng theme trước khi React hydrate để tránh nháy màu.
const themeScript = `try{var t=localStorage.getItem('bc_theme');if(t){document.documentElement.dataset.theme=t}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
