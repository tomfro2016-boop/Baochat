# Baochat redesign — cài đặt

## 1. Cài đặt
```bash
npm i gsap
```
Chép các tệp vào dự án (cùng đường dẫn):

| Tệp | Việc |
|---|---|
| `tailwind.config.ts` | thay tệp cũ (giữ nguyên tên token, thêm animation) |
| `app/theme.css` | **mới**: bảng màu + tiện ích (`.spot`, `.kbd`, `.press`) |
| `lib/fonts.ts` | **mới**: Be Vietnam Pro + JetBrains Mono |
| `components/fx/*` | **mới**: Logo, DotField, Magnetic, TiltCard, ScrambleText, CountUp, PromptMarquee, ComposerDemo |
| `components/AuthShell.tsx`, `app/(auth)/layout.tsx` | **mới**: khung đăng nhập/đăng ký (nếu đã có layout này thì chỉ bọc `{children}` bằng `<AuthShell>`) |
| `components/EmptyChat.tsx` | **mới**: màn hình chat trống |

## 2. `app/layout.tsx`
```tsx
import './globals.css';
import './theme.css';            // sau globals.css để ghi đè biến màu
import { sans, mono } from '@/lib/fonts';
// <html lang="vi" data-theme="dark" className={`${sans.variable} ${mono.variable}`}>
```
Chỉ cần đổi biến, toàn bộ component cũ dùng `bg-bg`, `bg-surface`, `text-ink`, `border-line`, `bg-primary`… sẽ tự đổi màu.

## 3. Dùng hiệu ứng ở chỗ khác
```tsx
<Magnetic><button className="press rounded-lg bg-primary px-4 h-10 text-white">Đăng nhập</button></Magnetic>
<CountUp value={balance} />                      // số dư token đếm lên, admin hiện ∞
<TiltCard className="rounded-2xl border border-line bg-surface">…</TiltCard>   // thẻ Studio
<Logo />                                          // thay logo cũ trong sidebar
<EmptyChat onPick={(p) => setInput(p)} />        // khi chưa có tin nhắn
```

## 4. Đã áp dụng
- **unslop:** bỏ gradient/glow màu, một accent, nền trung tính ấm, một icon set (lucide 16px, nét 1.5), tiêu đề không chào hỏi, animation chỉ đổi transform/opacity/màu, một đường cong easing.
- **gsap-utils:** `mapRange` (nghiêng thẻ, trôi khung), `clamp` + `mapRange` (nam châm), `interpolate` (màu chấm, tốc độ marquee), `wrap` (marquee vô tận), `random` (giải mã chữ), `distribute` (vào lần lượt), `toArray`.
- **Web Interface Guidelines:** `:focus-visible`, `prefers-reduced-motion` (CSS và JS), input ≥16px trên mobile, `touch-action: manipulation`, `overscroll-behavior`, hiệu ứng trang trí `aria-hidden`, dùng CSS cho hover/press, JS chỉ cho thứ CSS không làm được, trạng thái tải có dấu “…”.

## 5. Chưa làm được, cần bạn gửi thêm
Mình chỉ có file cấu hình nên **chưa sửa** `ChatView`, `AppShell` (sidebar), trang tokens/settings/admin, Studio. Gửi thư mục `app/` và `components/` (hoặc các tệp đó) mình sẽ áp dụng cùng hệ thiết kế.
Mình cũng chưa chạy được `npm run typecheck`/`build` (môi trường không cài được gói npm), nên hãy chạy hai lệnh đó lần đầu.
Nếu giao diện sáng của bạn không đặt `data-theme="light"`, mặc định sẽ là giao diện tối.
