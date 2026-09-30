# MC Translate Studio — AI Engine

Web app Next.js cho dịch và chuẩn hóa Minecraft Addon, Pack và Java/Paper plugin bằng Gemini + Groq.

## Kiến trúc production

- **Frontend tĩnh:** GitHub Pages
  - https://truc5738.github.io/MC-Translate-Studio---AI-Engine/
- **Backend:** Vercel + Next.js App Router
  - https://mc-translate-studio-ai-engine-git-main-mynodejs1.vercel.app
- **Upload:** Vercel Blob với signed PUT URL, file đi thẳng từ trình duyệt lên Blob.
- **Queue:** Vercel Queues topic `mc-translate`.
- **Job state:** PostgreSQL.
- **AI:** pool tối đa **20 API slots tổng cộng**, mỗi slot là Gemini hoặc Groq.
- **Admin:** password + HttpOnly session cookie; API keys được mã hóa AES-256-GCM khi lưu PostgreSQL.

## Tính năng

- Upload `.mcaddon`, `.mcpack`, `.zip`, `.jar`.
- Duyệt ZIP/JAR và dịch các file text an toàn.
- Bảo vệ identifier, namespace, placeholder, URL, command, selector, UUID và Minecraft formatting code.
- Xuất lại đúng loại file đầu vào.
- Direct browser upload lên Blob, không đẩy file lớn qua Next.js request body.
- Queue xử lý nền và polling Job ID.
- AI pool tự chuyển key khi gặp lỗi/rate limit và có cooldown.
- Admin Panel quản lý 20 API slots, xem pool status, webhook events và translation jobs.
- Repair Center phân tích manifest, plugin.yml, JSON/YAML/text và server log mà không thực thi code upload.
- GitHub webhook và generic webhook hỗ trợ đưa job dịch vào Queue.
- GitHub Pages frontend không yêu cầu Node.js.

## Cấu hình production trên Vercel

Thiết lập các biến môi trường trong **Production**:

```env
ADMIN_PASSWORD=...
AUTH_SECRET=...
ENCRYPTION_KEY=64-hex-characters
POSTGRES_URL=...
AI_KEYS_JSON=[]
GEMINI_MODEL=gemini-3.8-flash
GROQ_MODEL=openai/gpt-oss-20b
MAX_FILE_MB=50
MAX_CONCURRENT_JOBS=4
AI_REQUEST_TIMEOUT_MS=60000

# Webhook security
WEBHOOK_SECRET=...
GITHUB_WEBHOOK_SECRET=...

# Optional: CORS có fallback về GitHub Pages chính thức
STATIC_SITE_ORIGIN=https://truc5738.github.io
```

Khi kết nối Vercel Blob, SDK có thể dùng OIDC hoặc `BLOB_READ_WRITE_TOKEN` tùy cấu hình Blob Store.

## AI API pool

Admin Panel hỗ trợ tối đa **20 slot tổng cộng**, ví dụ:

- Slot 1: Gemini
- Slot 2: Groq
- Slot 3: Gemini
- ...
- Slot 20: Gemini hoặc Groq

Người dùng cuối **không nhập API key**. Key chỉ được xử lý ở server.

## Chạy local

```bash
npm install
npm run dev
```

Build production:

```bash
npm run build
npm start
```

## Bảo mật

- Không commit API key vào GitHub.
- Không đặt secret trong JavaScript client.
- Dùng HTTPS cho production.
- Upload trực tiếp dùng signed URL giới hạn pathname, operation, content type và kích thước.
- Queue handler không thực thi JavaScript/Java/shell/class từ file upload.
- Không dùng `eval` để repair code.

## Luồng dịch production

```text
GitHub Pages
    |
    | POST /api/blob/presign
    v
Vercel Backend
    |
    | signed PUT URL
    v
Vercel Blob
    |
    | POST /api/jobs/create
    v
Vercel Queue: mc-translate
    |
    v
Queue Consumer
    |
    +--> PostgreSQL: processing/completed/failed
    |
    +--> Gemini/Groq AI pool
    |
    v
Vercel Blob: translated output
    |
    v
GitHub Pages nhận Job ID và tải file kết quả
```

## Ghi chú

- `POSTGRES_URL` là bắt buộc cho translation queue hiện tại vì trạng thái Job được lưu bền vững trong PostgreSQL.
- Nếu Vercel project chưa kết nối Blob Store hoặc PostgreSQL, hãy kết nối hai storage này trước khi test translation.
- Credit deduction thực tế của nvnmc.cloud chưa được hardcode; cần endpoint/API contract chính thức của hệ thống credit trước khi bật charge thật.
