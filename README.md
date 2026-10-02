# MC Translate Studio — AI Engine

Web app Next.js cho dịch và chuẩn hóa Minecraft Addon, Pack và Java/Paper plugin bằng Browser AI, Local Rules hoặc Gemini + Groq.

## Kiến trúc production

- **Frontend tĩnh:** GitHub Pages
  - https://truc5738.github.io/MC-Translate-Studio---AI-Engine/
- **Backend:** Vercel + Next.js App Router
  - https://mc-translate-studio-ai-engine-git-main-mynodejs1.vercel.app
- **Upload cloud:** Vercel Blob với signed PUT URL.
- **Queue cloud:** Vercel Queues topic `mc-translate`.
- **Job state:** PostgreSQL.
- **Browser AI:** Transformers.js + ONNX chạy trong trình duyệt; không cần API key, không upload file lên backend.
- **Local Rules:** bộ từ điển + glossary, không cần model AI.
- **AI Cloud:** pool tối đa **20 API slots tổng cộng**, mỗi slot là Gemini hoặc Groq.
- **Admin:** password + HttpOnly session cookie; API keys được mã hóa AES-256-GCM khi lưu PostgreSQL.

## Tính năng

- Upload `.mcaddon`, `.mcpack`, `.zip`, `.jar`.
- Duyệt ZIP/JAR và dịch các file text an toàn.
- Bảo vệ identifier, namespace, placeholder, URL, command, selector, UUID và Minecraft formatting code.
- Xuất lại đúng loại file đầu vào.
- **Browser AI:** dịch tại thiết bị và tải file kết quả trực tiếp, không tạo Job/Blob/Queue.
- English → Vietnamese dùng `Xenova/opus-mt-en-vi`; Vietnamese → English dùng `Xenova/opus-mt-vi-en`.
- Các cặp ngôn ngữ khác dùng multilingual `Xenova/nllb-200-distilled-600M`.
- Browser AI tự ưu tiên WebGPU và có fallback WASM; model có thể được cache trong trình duyệt.
- `Local Rules` cho phép glossary tùy chỉnh ngay trên giao diện.
- `AI Cloud` giữ Gemini/Groq server-side và tự chuyển key khi gặp lỗi/rate limit.
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

WEBHOOK_SECRET=...
GITHUB_WEBHOOK_SECRET=...

STATIC_SITE_ORIGIN=https://truc5738.github.io
```

## Browser AI không cần API

Browser AI chạy model ONNX trực tiếp trong trình duyệt. File được đọc, dịch và đóng gói ngay trên thiết bị; không gửi nội dung pack tới backend của dự án. Lần chạy đầu cần tải model từ kho model, nên tốc độ và dung lượng sử dụng phụ thuộc thiết bị và trình duyệt.

```text
File trên điện thoại / PC
        |
        v
GitHub Pages
        |
        +--> Browser AI + ONNX --> ZIP kết quả
        |
        +--> AI Cloud --> Vercel Blob + Queue --> Gemini/Groq
```

## AI Cloud API pool

Admin Panel hỗ trợ tối đa **20 slot tổng cộng**, mỗi slot là Gemini hoặc Groq.

Người dùng cuối **không nhập API key**. Key chỉ được xử lý ở server.

## Chạy local

```bash
npm install
npm run dev
npm run build
npm start
```

## Bảo mật

- Không commit API key vào GitHub.
- Không đặt secret trong JavaScript client.
- Upload cloud dùng signed URL giới hạn pathname, operation, content type và kích thước.
- Browser AI không gửi pack lên backend trong lúc dịch.
- Queue handler không thực thi JavaScript/Java/shell/class từ file upload.
- Không dùng `eval` để repair code.

## Luồng dịch

```text
Browser AI:
GitHub Pages -> Transformers.js/ONNX -> xử lý local -> tải ZIP

AI Cloud:
GitHub Pages -> Vercel -> Blob -> Queue -> Worker -> Gemini/Groq -> Blob -> tải ZIP
```

## Ghi chú

- `POSTGRES_URL` là bắt buộc cho translation queue hiện tại.
- Vercel project cần kết nối Blob Store và PostgreSQL để test AI Cloud/Local Rules.
- Browser AI không phụ thuộc Vercel để dịch; chỉ cần trình duyệt hỗ trợ JavaScript và đủ tài nguyên để chạy model.
- Credit deduction thực tế của nvnmc.cloud chưa được hardcode; cần endpoint/API contract chính thức của hệ thống credit trước khi bật charge thật.
