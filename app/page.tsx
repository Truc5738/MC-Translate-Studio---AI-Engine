"use client";

import { useRef, useState } from "react";

const languages = [
  ["Vietnamese", "Tiếng Việt"], ["English", "English"], ["Chinese", "中文"],
  ["Japanese", "日本語"], ["Korean", "한국어"], ["Thai", "ไทย"],
  ["Spanish", "Español"], ["French", "Français"], ["German", "Deutsch"],
  ["Indonesian", "Bahasa Indonesia"],
];

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState("Vietnamese");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function acceptFile(next: File | undefined) {
    if (!next) return;
    setFile(next);
    setMsg("");
  }

  async function run() {
    if (!file) {
      setMsg("Hãy chọn file .mcaddon, .mcpack, .zip hoặc .jar trước nhé.");
      return;
    }
    setBusy(true);
    setMsg("Đang phân tích pack và dịch bằng AI…");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("target", target);
      const response = await fetch("/api/translate", { method: "POST", body: fd });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Không thể dịch file. Hãy thử lại.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "translated-" + file.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setMsg("Hoàn tất! File đã dịch đang được tải xuống.");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Đã xảy ra lỗi khi dịch file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar glass">
        <a className="brand" href="/" aria-label="MC Translate Studio trang chủ">
          <span className="brand-mark"><span>MC</span><i>✳</i></span>
          <span className="brand-copy">Translate <b>Studio</b><small>AI PACK WORKSPACE</small></span>
        </a>
        <nav className="nav-links" aria-label="Điều hướng">
          <a className="nav-link active" href="/">Studio</a>
          <a className="nav-link" href="/repair">Repair Center <span className="nav-arrow">↗</span></a>
          <a className="nav-link" href="/admin">Admin</a>
        </nav>
        <div className="system-pill"><span className="live-dot" /> AI ENGINE <span className="pill-divider" /> READY</div>
      </header>

      <section className="intro">
        <div className="intro-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> MINECRAFT CONTENT TOOLKIT <span className="version-pill">V1.0</span></div>
          <h1>Make every<br /><span>world your language.</span></h1>
          <p className="intro-description">Dịch và xử lý Minecraft add-on trong một workspace gọn gàng. Giữ nguyên cấu trúc pack, identifier và những đoạn code không được phép đụng vào.</p>
          <div className="intro-points">
            <span><span className="check-icon">✓</span> Giữ nguyên cấu trúc</span>
            <span><span className="check-icon">✓</span> API key bảo mật phía server</span>
          </div>
        </div>
        <div className="orb-stage" aria-hidden="true">
          <div className="orb-ring ring-one" /><div className="orb-ring ring-two" /><div className="orb-ring ring-three" />
          <div className="orb"><div className="orb-core">文<span>A</span></div><div className="orb-spark">✦</div></div>
          <div className="float-chip chip-top"><span className="chip-glyph">✧</span> AI TRANSLATION</div>
          <div className="float-chip chip-bottom"><span className="live-dot" /> PACK INTEGRITY <b>100%</b></div>
        </div>
      </section>

      <section className="workspace-grid" aria-label="Workspace dịch pack">
        <div className="translator-card glass">
          <div className="card-heading">
            <div className="heading-icon">↗</div>
            <div><div className="card-kicker">WORKSPACE / 01</div><h2>Translate your pack</h2></div>
            <span className="secure-badge"><span>✦</span> SECURE</span>
          </div>
          <p className="card-subtitle">Tải pack lên, chọn ngôn ngữ đích và để engine xử lý phần còn lại.</p>

          <div
            className={`drop-zone ${dragging ? "is-dragging" : ""} ${file ? "has-file" : ""}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files?.[0]); }}
          >
            <input ref={inputRef} id="pack-file" className="file-input" type="file" accept=".mcaddon,.mcpack,.zip,.jar" onChange={(event) => acceptFile(event.target.files?.[0])} />
            <div className="upload-symbol"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M16 21V5m0 0-6 6m6-6 6 6M6 20v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
            {file ? <><strong className="file-name">{file.name}</strong><span className="upload-hint">{(file.size / (1024 * 1024)).toFixed(2)} MB · Sẵn sàng xử lý</span></> : <><strong>Kéo thả file vào đây</strong><span className="upload-hint">hoặc chọn từ thiết bị của bạn</span></>}
            <button type="button" className="browse-button" onClick={() => inputRef.current?.click()}>{file ? "Đổi file" : "Chọn file"} <span>↗</span></button>
            <span className="format-note">.MCADDON <i /> .MCPACK <i /> .ZIP <i /> .JAR <span className="size-note">TỐI ĐA 50 MB</span></span>
          </div>

          <div className="settings-row">
            <label className="setting-field"><span className="field-label">NGÔN NGỮ ĐÍCH</span><span className="select-wrap"><span className="language-icon">文</span><select value={target} onChange={(event) => setTarget(event.target.value)}>{languages.map(([value, label]) => <option key={value} value={value}>{label} · {value}</option>)}</select><span className="select-chevron">⌄</span></span></label>
            <div className="setting-field"><span className="field-label">TRANSLATION ENGINE</span><div className="engine-box"><span className="engine-orb">✦</span><span>Gemini + Groq pool<small>Auto failover enabled</small></span><span className="engine-status" /></div></div>
          </div>

          <button className="translate-button" onClick={run} disabled={busy}><span className="button-star">✦</span><span>{busy ? "ĐANG XỬ LÝ PACK…" : "DỊCH VÀ TẢI FILE"}</span><span className="button-arrow">↗</span></button>
          <div className={`status-message ${msg ? "has-message" : ""}`} role="status" aria-live="polite"><span className="status-icon">{msg ? (busy ? "◌" : "i") : "✓"}</span>{msg || "Sẵn sàng. API key được quản lý an toàn ở phía server."}</div>
        </div>

        <aside className="side-column">
          <div className="quality-card glass">
            <div className="side-card-top"><span className="card-kicker">BUILT FOR MODDERS</span><span className="sparkle">✳</span></div>
            <h3>Không chỉ là<br /><span>dịch từng chữ.</span></h3>
            <p>Ưu tiên ngữ cảnh Minecraft, tránh phá vỡ logic của pack khi bản địa hóa.</p>
            <div className="quality-list">
              <div><span className="quality-icon">⌘</span><span><b>Syntax-aware</b><small>Giữ identifier, namespace và placeholder</small></span><span className="quality-check">✓</span></div>
              <div><span className="quality-icon">◈</span><span><b>Multi-engine</b><small>Gemini + Groq, xoay vòng phía server</small></span><span className="quality-check">✓</span></div>
              <div><span className="quality-icon">⛨</span><span><b>Private by design</b><small>Không cần nhập API key trên giao diện</small></span><span className="quality-check">✓</span></div>
            </div>
          </div>
          <a className="repair-card glass" href="/repair"><span className="repair-icon">⌁</span><span className="repair-copy"><b>Repair Center</b><small>Kiểm tra và khắc phục pack</small></span><span className="repair-arrow">↗</span></a>
          <div className="tip-card"><span className="tip-icon">✦</span><p><b>TIP FOR BEST RESULTS</b><br />Dùng file ZIP hoặc pack gốc. Đừng giải nén trước khi tải lên.</p></div>
        </aside>
      </section>

      <section className="workflow">
        <div className="workflow-title"><span className="card-kicker">SIMPLE BY DESIGN</span><h2>From upload to in-game.</h2></div>
        <div className="workflow-steps">
          <div className="workflow-step"><span className="step-number">01</span><span className="step-icon">↑</span><b>Upload pack</b><small>Chọn file Minecraft của bạn</small></div>
          <span className="step-connector">········→</span>
          <div className="workflow-step"><span className="step-number">02</span><span className="step-icon">✧</span><b>AI translates</b><small>Giữ cấu trúc và cú pháp</small></div>
          <span className="step-connector">········→</span>
          <div className="workflow-step"><span className="step-number">03</span><span className="step-icon">↓</span><b>Download pack</b><small>Đưa pack vào game</small></div>
        </div>
      </section>

      <footer className="footer"><a className="footer-brand" href="/">MC Translate Studio</a><span>MADE FOR THE MINECRAFT COMMUNITY <span className="footer-dot">✦</span></span><span className="footer-status"><span className="live-dot" /> ENGINE READY</span></footer>
    </main>
  );
}
