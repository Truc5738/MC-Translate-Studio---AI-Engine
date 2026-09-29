# MC Translate Studio — AI Engine

Web app Next.js cho dịch và chuẩn hóa Minecraft Addon, Pack và Java/Paper plugin bằng Gemini + Groq.

## Tính năng hiện tại

- Upload `.mcaddon`, `.mcpack`, `.zip`, `.jar`.
- Duyệt cấu trúc ZIP/JAR và dịch các file text an toàn.
- Bảo vệ identifier, namespace, placeholder, URL, command, selector, UUID và Minecraft formatting code.
- Xuất lại thành ZIP.
- Admin-only AI pool tối đa **20 API slots tổng cộng**, mỗi slot là Gemini hoặc Groq.
- API key được xử lý server-side; khi có PostgreSQL, key được mã hóa AES-256-GCM khi lưu.
- Không yêu cầu người dùng cuối nhập API key.

## Cấu hình

1. Copy `.env.example` thành `.env.local`.
2. Đặt `ADMIN_PASSWORD`, `AUTH_SECRET` và `ENCRYPTION_KEY` (64 ký tự hex).
3. Khuyến nghị đặt `POSTGRES_URL` để Admin Panel lưu API pool bền vững.
4. Chạy `npm install` rồi `npm run dev`.

Gemini dùng endpoint `models.generateContent`; Groq dùng endpoint OpenAI-compatible `/openai/v1/chat/completions`. Model mặc định nằm trong env để có thể đổi mà không sửa code.

## Bảo mật

Không commit API key vào GitHub. Không đặt secret trong code client. Production nên bật HTTPS và dùng mật khẩu admin mạnh.

## Roadmap

Repair Center cho manifest/JSON/YAML, diff preview, glossary, translation memory, batch jobs, GitHub import/export, validation report và lịch sử dự án.
