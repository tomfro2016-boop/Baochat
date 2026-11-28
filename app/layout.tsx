import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import 'highlight.js/styles/github-dark.css';
import './globals.css';
import Providers from '@/components/Providers';

const sans = Inter({ subsets: ['latin', 'vietnamese'], variable: '--font-sans', display: 'swap' });
const mono = JetBrains_Mono({ subsets: ['latin', 'vietnamese'], variable: '--font-mono', display: 'swap' });

export const metadata: Metadata = {
  title: 'Baochat',
  description: 'Baochat: trợ lý AI đa năng — trò chuyện, tìm kiếm Internet, tạo website, tài liệu, slide và bảng tính.',
  icons: { icon: '/icon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#11100E',
};

// Áp dụng theme trước khi React hydrate để tránh nháy màu.
const themeScript = `try{var t=localStorage.getItem('bc_theme');if(t){document.documentElement.dataset.theme=t}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" data-theme="dark" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
