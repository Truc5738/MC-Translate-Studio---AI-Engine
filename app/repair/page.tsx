"use client";

import { useRef, useState } from "react";

type Diagnostic = { severity: "error" | "warning" | "info"; path: string; message: string; suggestion: string };

export default function RepairPage() {
  const [file, setFile] = useState<File | null>(null);
  const [log, setLog] = useState("");
  const [items, setItems] = useState<Diagnostic[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function analyze() {
    if (!file && !log.trim()) { setMsg("Hãy chọn file hoặc dán log lỗi trước khi phân tích."); return; }
    setBusy(true); setMsg("Đang kiểm tra cấu trúc và log...");
    try {
      const fd = new FormData();
      if (file) fd.append("file", file);
      if (log.trim()) fd.append("log", log);
      const response = await fetch("/api/repair/analyze", { method: "POST", body: fd });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Không thể phân tích file.");
      setItems(data.diagnostics || []);
      setMsg("Đã kiểm tra xong: " + data.summary.errors + " lỗi, " + data.summary.warnings + " cảnh báo.");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Có lỗi không xác định.");
    } finally { setBusy(false); }
  }

  const errorCount = items.filter((item) => item.severity === "error").length;
  const warningCount = items.filter((item) => item.severity === "warning").length;

  return (
    <main className="app-shell repair-shell">
      <nav className="topbar glass repair-topbar">
        <a className="brand" href="/" aria-label="MC Translate Studio trang chủ">
          <span className="brand-mark">MC<i>✦</i></span>
          <span className="brand-copy">MC <b>Translate</b> Studio<small>MINECRAFT LOCALIZATION TOOLS</small></span>
        </a>
        <div className="nav-links"><a className="nav-link" href="/">← Quay lại dịch pack</a></div>
        <span className="system-pill"><span className="live-dot" /> REPAIR CENTER</span>
      </nav>

      <section className="repair-hero">
        <div className="eyebrow"><span className="eyebrow-line" /> TOOLKIT / 02 <span className="version-pill">SAFE SCAN</span></div>
        <h1>Kiểm tra pack.<br /><span>Sửa đúng lỗi.</span></h1>
        <p>Phân tích addon, resource pack, plugin và server log trong một giao diện gọn gàng, dễ dùng ngay trên điện thoại.</p>
        <div className="intro-points">
          <span><i className="check-icon">✓</i> Chỉ đọc, không thực thi file</span>
          <span><i className="check-icon">✓</i> Hiển thị lỗi và cách xử lý</span>
        </div>
      </section>

      <section className="repair-layout">
        <div className="repair-workspace glass">
          <div className="card-heading">
            <div className="heading-icon">⌁</div>
            <div><div className="card-kicker">WORKSPACE / 02</div><h2>Phân tích tệp</h2></div>
            <span className="secure-badge"><span>✦</span> SAFE MODE</span>
          </div>
          <p className="card-subtitle">Chọn một gói để kiểm tra hoặc dán log lỗi từ Minecraft / server.</p>

          <input ref={inputRef} className="repair-file-input" type="file" accept=".mcaddon,.mcpack,.zip,.jar,.log,.txt" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          <button type="button" className={"repair-drop " + (file ? "has-file" : "")} onClick={() => inputRef.current?.click()}>
            <span className="upload-symbol"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 21V5m0 0-6 6m6-6 6 6M6 20v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg></span>
            <strong>{file ? file.name : "Chọn file để kiểm tra"}</strong>
            <span className="upload-hint">{file ? (file.size / (1024 * 1024)).toFixed(2) + " MB · Sẵn sàng phân tích" : "Nhấn để chọn từ thiết bị của bạn"}</span>
            <span className="repair-browse">{file ? "Đổi file" : "Duyệt tệp"} <b>↗</b></span>
            <span className="format-note">.MCADDON <i /> .MCPACK <i /> .ZIP <i /> .JAR <i /> .LOG / .TXT</span>
          </button>

          <label className="repair-log-label" htmlFor="repair-log">SERVER LOG <span>TÙY CHỌN</span></label>
          <textarea id="repair-log" className="repair-log" value={log} onChange={(event) => setLog(event.target.value)} placeholder="Dán nội dung lỗi từ Minecraft, console hoặc server vào đây..." />
          <button className="translate-button repair-analyze" disabled={busy} onClick={analyze}><span className="button-star">✦</span><span>{busy ? "ĐANG PHÂN TÍCH..." : "PHÂN TÍCH NGAY"}</span><span className="button-arrow">↗</span></button>
          <div className={"repair-status " + (msg ? "has-message" : "")} role="status" aria-live="polite"><span>{busy ? "◌" : "✓"}</span>{msg || "Sẵn sàng. File tải lên chỉ được đọc để kiểm tra, không chạy mã bên trong."}</div>
        </div>

        <aside className="repair-side">
          <div className="quality-card glass">
            <div className="side-card-top"><span className="card-kicker">WHAT WE CHECK</span><span className="sparkle">✳</span></div>
            <h3>Giữ pack ổn định.<br /><span>Không đoán mò.</span></h3>
            <p>Ưu tiên các lỗi cấu trúc thường gặp trong pack Minecraft và thông tin hữu ích từ log.</p>
            <div className="quality-list">
              <div><span className="quality-icon">⌘</span><span><b>Cấu trúc tệp</b><small>Kiểm tra nội dung và định dạng</small></span><span className="quality-check">✓</span></div>
              <div><span className="quality-icon">⚠</span><span><b>Phát hiện lỗi</b><small>Tách lỗi nghiêm trọng và cảnh báo</small></span><span className="quality-check">✓</span></div>
              <div><span className="quality-icon">⌁</span><span><b>Gợi ý xử lý</b><small>Hiển thị hướng khắc phục theo kết quả</small></span><span className="quality-check">✓</span></div>
            </div>
          </div>
          <div className="repair-tip glass"><span className="tip-icon">✦</span><p><b>MẸO NHỎ</b><br />Nếu lỗi xảy ra khi vào thế giới, hãy dán cả đoạn log quanh thời điểm lỗi để có thêm ngữ cảnh.</p></div>
        </aside>
      </section>

      {items.length > 0 && <section className="repair-results glass">
        <div className="repair-results-head"><div><div className="card-kicker">SCAN REPORT</div><h2>Kết quả phân tích</h2></div><div className="repair-counts"><span className="count-error">{errorCount} lỗi</span><span className="count-warning">{warningCount} cảnh báo</span></div></div>
        <div className="repair-result-list">{items.map((item, index) => <article className={"repair-result repair-" + item.severity} key={index}>
          <span className="result-severity">{item.severity === "error" ? "LỖI" : item.severity === "warning" ? "CẢNH BÁO" : "THÔNG TIN"}</span>
          <div className="result-content"><strong>{item.path || "Log / cấu trúc"}</strong><p>{item.message}</p><small>{item.suggestion}</small></div>
        </article>)}</div>
      </section>}

      <footer className="footer"><a className="footer-brand" href="/">MC Translate Studio</a><span>SAFE SCAN · BUILT FOR MINECRAFT <span className="footer-dot">✦</span></span><span className="footer-status"><span className="live-dot" /> REPAIR READY</span></footer>
    </main>
  );
}
