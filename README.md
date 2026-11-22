# Baochat — Your Personal AI Universe

Nền tảng trợ lý AI đa năng (tiếng Việt / English): trò chuyện, tìm kiếm Internet có trích nguồn, AI Studio (website, tài liệu, slide, bảng tính), hệ thống token theo tài khoản, Personalize AI và Admin Dashboard.

Stack: **Next.js 15 (App Router) · TypeScript · Tailwind · Framer Motion · PostgreSQL (hoặc Supabase/Neon) · Google OAuth · API các AI provider**.

---

## 1. Chạy thử trên máy (5 bước)

```bash
cd baochat
npm install
cp .env.example .env.local        # rồi điền các giá trị (xem mục 2)
set -a; source .env.local; set +a
npm run db:migrate                # tạo bảng + dữ liệu cấu hình mặc định (chạy lại nhiều lần vẫn an toàn)
npm run typecheck                 # kiểm tra TypeScript
npm run dev                       # http://localhost:3000
```

Cần PostgreSQL 13+. Nhanh nhất: tạo project miễn phí trên **Supabase** hoặc **Neon**, copy chuỗi kết nối vào `DATABASE_URL` (đặt `DATABASE_SSL=true`).

## 2. Kết nối các dịch vụ (`.env.local`)

Không có khóa nào được lưu trong database hay gửi xuống trình duyệt. Dịch vụ nào chưa cấu hình thì tính năng đó **báo rõ là chưa cấu hình** (không giả lập).

| Tính năng | Biến môi trường | Ghi chú |
|---|---|---|
| Database | `DATABASE_URL`, `DATABASE_SSL` | Bắt buộc |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Bắt buộc cho đăng nhập Google và tài khoản admin |
| Admin | `ADMIN_EMAILS=tomfro2016@gmail.com` | Xem mục 3 |
| AI | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY` | Chỉ cần ít nhất 1 khóa |
| Tìm kiếm Internet | `TAVILY_API_KEY` hoặc `BRAVE_API_KEY` | Nút Search chỉ bật khi có khóa |
| Email (xác minh, quên mật khẩu) | `SMTP_HOST/PORT/USER/PASS/FROM` | Nếu trống: bỏ qua bước xác minh email, link được in ra log server |
| Địa chỉ website | `APP_URL` | Dùng cho OAuth redirect và link email |

**Tạo Google OAuth:** Google Cloud Console → APIs & Services → Credentials → *Create OAuth client ID* → *Web application* → thêm *Authorized redirect URI*: `${APP_URL}/api/auth/google/callback` (ví dụ `http://localhost:3000/api/auth/google/callback` và URL production).

**Tên model:** các tên model mặc định trong `db/schema.sql` chỉ là điểm khởi đầu. Nếu nhà cung cấp đổi tên, vào **Admin → Models & API**, sửa tên và bấm **Test** để kiểm tra khóa + model có chạy thật không.

## 3. Tài khoản đặc quyền `tomfro2016@gmail.com`

Quyền admin chỉ được cấp khi **tất cả** điều kiện sau đúng, và được kiểm tra lại ở **mỗi request** phía server (`lib/auth.ts`):

1. Email nằm trong `ADMIN_EMAILS` (biến môi trường của server, không nằm trong frontend).
2. Đăng nhập qua Google OAuth: server tự đổi `code` lấy `id_token` (PKCE), **xác minh chữ ký, issuer, audience** và `email_verified = true`.
3. Tài khoản đã liên kết `google_sub` và cột `role = 'admin'`.

Email admin **không thể đăng ký bằng mật khẩu**. Admin: token vô hạn, không bị trừ và không reset; có Admin Dashboard (thống kê, người dùng, điều chỉnh token, khóa/mở khóa, model/provider, cấu hình reset, thông báo, nhật ký).

## 4. Hệ thống token

- Tài khoản mới nhận ngẫu nhiên **1.000–10.000 token** (khoảng này chỉnh được trong Admin → Cấu hình).
- Server tính token thật từ `usage` của provider (hoặc ước lượng nếu provider không trả về) × hệ số của model, và trừ bằng **một câu `UPDATE` nguyên tử**; số dư không bao giờ âm.
- Hết token: chặn gửi tin, hiển thị **đồng hồ đếm ngược** (dựa trên giờ của server) đến lần reset; đến hạn, số dư tự reset về hạn mức.
- Client chỉ đọc; mọi API tính/trừ token nằm ở server nên không thể sửa bằng DevTools.

## 5. Triển khai online

### Cách A — Vercel + Supabase/Neon (dễ nhất)
1. Tạo DB trên Supabase/Neon, chạy `npm run db:migrate` một lần từ máy bạn với `DATABASE_URL` của DB đó.
2. Đẩy mã lên GitHub → Vercel → *Import project*.
3. Thêm toàn bộ biến môi trường ở mục 2 vào Vercel (`APP_URL` = URL production, `TRUST_PROXY=1`).
4. Thêm URL callback production vào Google OAuth client.
5. Lưu ý: tạo tài liệu bằng AI có thể chạy lâu (tới 180 giây). Gói Vercel Hobby giới hạn thời gian hàm; nếu gặp timeout hãy dùng gói Pro hoặc Cách B.

### Cách B — VPS / Railway / Render
```bash
npm ci && npm run build
NODE_ENV=production npm start      # chạy sau Nginx/Caddy có HTTPS, đặt TRUST_PROXY=1
```
Đặt biến môi trường như trên. Bắt buộc dùng HTTPS ở production (cookie phiên được đặt `Secure`).

### Sao lưu
`DATABASE_URL=... bash scripts/backup.sh` (pg_dump + gzip, giữ 14 bản gần nhất). Chạy hằng ngày bằng cron: `0 3 * * * cd /đường/dẫn && bash scripts/backup.sh`. Supabase/Neon cũng có sao lưu tự động của nhà cung cấp.

## 6. Cấu trúc thư mục

```
app/
  (auth)/          đăng nhập, đăng ký, quên/đặt lại mật khẩu, xác minh email
  (app)/           giao diện chính: chat ([[...slug]]), studio, personalize, tokens, settings, admin
  api/             auth, chat (SSE), conversations, messages, files, tokens, me, profiles, memories,
                   studio (generate/items/download), admin/*
components/        ChatView, AppShell (sidebar), Markdown (highlight + copy code), ui
lib/               db, auth, session, tokens, settings, ratelimit, google, mail, search, files, log
lib/ai/            providers (OpenAI-compatible + Anthropic, fallback), prompt (4 chế độ), memory
lib/studio/        sinh nội dung + xuất DOCX/PDF/PPTX/XLSX/CSV/ZIP thật
db/schema.sql      toàn bộ bảng + dữ liệu mặc định (idempotent)
```

## 7. Bảo mật (đã có)

Mật khẩu băm bằng bcrypt · phiên lưu băm SHA-256, cookie `HttpOnly`/`SameSite=Lax`/`Secure` · rate limiting trong DB (đăng ký, đăng nhập, chat, tải tệp…) · kiểm tra đầu vào bằng Zod · mọi truy vấn tham số hóa · kiểm tra quyền sở hữu hội thoại/tệp/mục Studio · xem trước website do AI sinh chạy trong `iframe sandbox` **không** có `allow-same-origin` (không đọc được cookie) · ảnh từ URL ngoài trong câu trả lời AI không được tự tải · nhật ký hoạt động và lỗi · header bảo mật (HSTS, nosniff, X-Frame-Options).

## 8. Trạng thái kiểm thử — đọc trước khi triển khai

Môi trường nơi mã này được viết **không cho cài gói npm**, nên chưa thể chạy `next build` hay mở giao diện trong trình duyệt. Đã kiểm tra được:

- Cú pháp toàn bộ 84 tệp TS/TSX, và mọi `import`/export nội bộ đều trỏ đúng tệp.
- `db/schema.sql` chạy sạch trên PostgreSQL 16 (chạy 2 lần), cùng các truy vấn cốt lõi: cấp token, trừ nguyên tử không âm, reset đúng một lần mỗi chu kỳ, thống kê admin, lịch sử token, tìm kiếm hội thoại, ràng buộc hồ sơ AI.

**Chưa** kiểm tra: kiểu TypeScript đầy đủ, build, các luồng gọi AI/Google/email/search thật (cần khóa của bạn). Hãy chạy `npm run typecheck` và `npm run build` lần đầu; nếu có lỗi kiểu, đó là chỗ cần chỉnh nhỏ. Sau đó thử lần lượt: đăng ký → chat → Search → AI Studio → đăng nhập Google bằng `tomfro2016@gmail.com` → Admin.
