import nodemailer from 'nodemailer';
import { env } from './env';

export async function sendMail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  if (!env.smtpConfigured) {
    // Không giả vờ đã gửi: ghi log để dev lấy link, và trả về false.
    console.warn(`[mail] SMTP chưa cấu hình. Email tới ${to}: ${subject}\n${text}`);
    return false;
  }
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
    text,
  });
  return true;
}

function wrap(title: string, body: string, cta: string, link: string) {
  return `<div style="font-family:Inter,Arial,sans-serif;background:#0B0D12;padding:32px">
  <div style="max-width:480px;margin:auto;background:#131722;border-radius:16px;padding:32px;color:#F5F5FA">
    <h2 style="margin:0 0 12px;color:#A99CFF">Baochat</h2>
    <h3 style="margin:0 0 12px">${title}</h3>
    <p style="color:#9298AA;line-height:1.6">${body}</p>
    <p style="margin:24px 0"><a href="${link}" style="background:#7867FF;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;display:inline-block">${cta}</a></p>
    <p style="color:#9298AA;font-size:12px;word-break:break-all">${link}</p>
  </div></div>`;
}

export async function sendVerifyEmail(to: string, token: string) {
  const link = `${env.appUrl}/verify?token=${encodeURIComponent(token)}`;
  return sendMail(
    to,
    'Xác minh email Baochat / Verify your Baochat email',
    wrap('Xác minh email của bạn', 'Nhấn nút bên dưới để xác minh email. Liên kết có hiệu lực 24 giờ.', 'Xác minh email', link),
    `Xác minh email Baochat: ${link}`,
  );
}

export async function sendResetEmail(to: string, token: string) {
  const link = `${env.appUrl}/reset?token=${encodeURIComponent(token)}`;
  return sendMail(
    to,
    'Đặt lại mật khẩu Baochat / Reset your Baochat password',
    wrap('Đặt lại mật khẩu', 'Nhấn nút bên dưới để đặt mật khẩu mới. Liên kết có hiệu lực 1 giờ. Nếu không phải bạn yêu cầu, hãy bỏ qua email này.', 'Đặt lại mật khẩu', link),
    `Đặt lại mật khẩu Baochat: ${link}`,
  );
}
