import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Baochat',
    short_name: 'Baochat',
    description: 'Trợ lý AI trò chuyện, tìm kiếm và tạo tài liệu',
    start_url: '/',
    display: 'standalone',
    background_color: '#11100E',
    theme_color: '#11100E',
    icons: [
      { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
