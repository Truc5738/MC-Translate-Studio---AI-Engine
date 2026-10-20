"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type KeySlot = { id?: number; provider: "gemini" | "groq"; key: string; enabled: boolean; hasKey: boolean };
type Row = Record<string, unknown> & { id?: string | number; type?: string; source?: string; status?: string; created_at?: string; attempts?: number };
type ApiError = { error?: string };

async function readJson<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((data as ApiError).error || `Yêu cầu thất bại (${response.status})`);
  return data as T;
}

export default function Admin() {
  const [password, setPassword] = useState("");
  const [logged, setLogged] = useState(false);
  const [keys, setKeys] = useState<KeySlot[]>([]);
  const [events, setEvents] = useState<Row[]>([]);
  const [jobs, setJobs] = useState<Row[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const keyData = await readJson<{ keys: Array<{ id: number; provider: "gemini" | "groq"; key: string; enabled: boolean }> }>(await fetch("/api/admin/keys", { cache: "no-store" }));
      setLogged(true);
      setKeys(keyData.keys.map((item) => ({ id: item.id, provider: item.provider, key: "", enabled: item.enabled, hasKey: Boolean(item.key) })));
      const [eventResult, jobResult] = await Promise.allSettled([
        fetch("/api/admin/webhooks?limit=25", { cache: "no-store" }).then(readJson<{ events: Row[] }>),
        fetch("/api/jobs?limit=25", { cache: "no-store" }).then(readJson<{ jobs: Row[] }>),
      ]);
      if (eventResult.status === "fulfilled") setEvents(eventResult.value.events || []);
      else setError("Đã tải API pool nhưng không thể tải webhook: " + eventResult.reason.message);
      if (jobResult.status === "fulfilled") setJobs(jobResult.value.jobs || []);
      else setError((current) => current ? current + " · Không thể tải danh sách job." : "Không thể tải danh sách job.");
      setMessage(quiet ? "Dữ liệu đã được làm mới." : "");
    } catch (e) {
      const reason = e instanceof Error ? e.message : "Không thể kết nối máy chủ.";
      if (reason.toLowerCase().includes("unauthorized")) setLogged(false);
      setError(reason);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(true); }, [load]);

  function change(index: number, field: "provider" | "key" | "enabled", value: string | boolean) {
    setKeys((current) => {
      const next = [...current];
      const item = next[index] || { provider: "gemini" as const, key: "", enabled: true, hasKey: false };
      next[index] = { ...item, [field]: value };
      return next;
    });
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      await readJson(await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) }));
      setPassword("");
      await load();
      setMessage("Đăng nhập quản trị thành công.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Đăng nhập thất bại.");
    } finally { setBusy(false); }
  }

  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      await readJson(await fetch("/api/admin/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys: keys.map((item) => ({ id: item.id, provider: item.provider, ...(item.key.trim() ? { key: item.key.trim() } : {}), enabled: item.enabled })) }),
      }));
      setMessage("Đã lưu API pool. Khóa đã lưu được giữ nguyên nếu bạn không nhập khóa thay thế.");
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể lưu API pool.");
    } finally { setBusy(false); }
  }

  const enabledCount = keys.filter((item) => item.enabled && (item.hasKey || item.key.trim())).length;
  const configuredCount = keys.filter((item) => item.hasKey || item.key.trim()).length;
  const formatDate = (value?: string) => {
    if (!value) return "Không có thời gian";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN");
  };

  if (!logged) return (
    <main className="app-shell admin-shell">
      <header className="topbar glass admin-topbar">
        <a className="brand" href="/" aria-label="MC Translate Studio trang chủ"><span className="brand-mark">MC<i>✦</i></span><span className="brand-copy">MC <b>Translate</b> Studio<small>ADMIN CONTROL CENTER</small></span></a>
        <a className="nav-link" href="/">← Trang chủ</a>
      </header>
      <section className="admin-login-layout">
        <div className="admin-login-copy"><div className="eyebrow"><span className="eyebrow-line" /> PRIVATE WORKSPACE / 01</div><h1>Quản trị.<br /><span>Kiểm soát an toàn.</span></h1><p>Quản lý API pool và theo dõi hoạt động dịch thuật trong một bảng điều khiển gọn gàng, tối ưu cho cả điện thoại.</p><div className="admin-safe-points"><span>✓ Khóa API chỉ xử lý ở máy chủ</span><span>✓ Phiên đăng nhập bảo vệ bằng cookie</span></div></div>
        <form className="admin-login-card glass" onSubmit={login}>
          <div className="admin-icon">⌘</div><div className="card-kicker">ADMIN AUTHENTICATION</div><h2>Đăng nhập quản trị</h2><p>Nhập mật khẩu quản trị để tiếp tục. Không chia sẻ mật khẩu hoặc API key.</p>
          <label className="admin-field-label" htmlFor="admin-password">MẬT KHẨU</label>
          <div className="admin-password-wrap"><input id="admin-password" autoComplete="current-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nhập mật khẩu admin" required/><button type="button" className="admin-show-password" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "Ẩn" : "Hiện"}</button></div>
          <button className="admin-primary-button" type="submit" disabled={busy}>{busy ? "ĐANG XÁC THỰC..." : "ĐĂNG NHẬP"} <span>↗</span></button>
          {error && <p className="admin-alert error" role="alert">{error}</p>}
          <div className="admin-login-foot"><span className="admin-status-dot" /> KẾT NỐI ĐƯỢC BẢO VỆ</div>
        </form>
      </section>
      <footer className="admin-footer"><a href="/">MC Translate Studio</a><span>ADMIN · PRIVATE ACCESS</span></footer>
    </main>
  );

  return (
    <main className="app-shell admin-shell">
      <header className="topbar glass admin-topbar">
        <a className="brand" href="/" aria-label="MC Translate Studio trang chủ"><span className="brand-mark">MC<i>✦</i></span><span className="brand-copy">MC <b>Translate</b> Studio<small>ADMIN CONTROL CENTER</small></span></a>
        <nav className="admin-nav"><a className="nav-link" href="/">Trang dịch</a><button className="admin-refresh" onClick={() => void load()} disabled={loading}>↻ <span>{loading ? "Đang tải" : "Làm mới"}</span></button></nav>
        <span className="system-pill"><span className="live-dot" /> SESSION ACTIVE</span>
      </header>

      <section className="admin-hero">
        <div><div className="eyebrow"><span className="eyebrow-line" /> SYSTEM / ADMINISTRATOR</div><h1>AI Control<br /><span>Center.</span></h1><p>Quản lý nhà cung cấp AI, theo dõi webhook và kiểm tra hàng đợi tác vụ trong một nơi.</p></div>
        <div className="admin-hero-mark glass"><span>MC</span><i>✦</i><small>CONTROL<br/>PLANE</small></div>
      </section>

      <section className="admin-stats">
        <article className="admin-stat glass"><span className="admin-stat-icon">⌘</span><span className="admin-stat-label">API ĐÃ CẤU HÌNH</span><strong>{configuredCount}<small> / 20</small></strong><span className="admin-stat-note">Slot có khóa được lưu</span></article>
        <article className="admin-stat glass"><span className="admin-stat-icon">✳</span><span className="admin-stat-label">API ĐANG BẬT</span><strong>{enabledCount}<small> / 20</small></strong><span className="admin-stat-note">Sẵn sàng được chọn</span></article>
        <article className="admin-stat glass"><span className="admin-stat-icon">⌁</span><span className="admin-stat-label">WEBHOOK GẦN ĐÂY</span><strong>{events.length}<small> sự kiện</small></strong><span className="admin-stat-note">Tối đa 25 bản ghi mới</span></article>
        <article className="admin-stat glass"><span className="admin-stat-icon">◷</span><span className="admin-stat-label">JOB GẦN ĐÂY</span><strong>{jobs.length}<small> tác vụ</small></strong><span className="admin-stat-note">Tối đa 25 bản ghi mới</span></article>
      </section>

      {error && <div className="admin-alert error" role="alert">{error}</div>}
      {message && <div className="admin-alert success" role="status">{message}</div>}

      <section className="admin-main-grid">
        <div className="admin-panel glass">
          <div className="admin-panel-heading"><div><div className="card-kicker">PROVIDER MANAGEMENT / 01</div><h2>API provider pool</h2><p>20 slot Gemini và Groq. Để trống khóa nếu không muốn thay khóa đã lưu.</p></div><span className="admin-panel-badge">SERVER-SIDE</span></div>
          <div className="admin-key-list">{Array.from({ length: 20 }, (_, index) => {
            const item = keys[index] || { provider: "gemini" as const, key: "", enabled: true, hasKey: false };
            return <div className="admin-key-row" key={index}>
              <div className="admin-slot-number">{String(index + 1).padStart(2, "0")}</div>
              <div className="admin-key-fields"><label className="admin-field-label" htmlFor={`provider-${index}`}>NHÀ CUNG CẤP</label><select id={`provider-${index}`} value={item.provider} onChange={(event) => change(index, "provider", event.target.value)}><option value="gemini">Google Gemini</option><option value="groq">Groq</option></select></div>
              <div className="admin-key-fields"><label className="admin-field-label" htmlFor={`key-${index}`}>API KEY {item.hasKey ? "· ĐÃ LƯU" : "· CHƯA CÓ"}</label><input id={`key-${index}`} type="password" autoComplete="new-password" value={item.key} onChange={(event) => change(index, "key", event.target.value)} placeholder={item.hasKey ? "Đã có khóa · nhập để thay thế" : "Dán API key tại đây"} /></div>
              <label className="admin-enabled"><input type="checkbox" checked={item.enabled} onChange={(event) => change(index, "enabled", event.target.checked)}/><span>{item.enabled ? "Bật" : "Tắt"}</span></label>
              <span className={item.enabled && (item.hasKey || item.key.trim()) ? "admin-key-state ready" : "admin-key-state"}><i />{item.hasKey || item.key.trim() ? (item.enabled ? "READY" : "DISABLED") : "EMPTY"}</span>
            </div>;
          })}</div>
          <div className="admin-save-row"><span>Khóa hiện có không hiển thị lại trên trình duyệt.</span><button className="admin-primary-button" onClick={() => void save()} disabled={busy}>{busy ? "ĐANG LƯU..." : "LƯU THAY ĐỔI"} <span>↗</span></button></div>
        </div>

        <aside className="admin-side-column">
          <section className="admin-panel glass admin-health"><div className="card-kicker">SYSTEM HEALTH / 02</div><h2>Trạng thái quản trị</h2><div className="admin-health-row"><span><i className="admin-status-dot"/>Phiên quản trị</span><b>Đã xác thực</b></div><div className="admin-health-row"><span><i className="admin-status-dot"/>API key storage</span><b>Server-side</b></div><div className="admin-health-row"><span><i className="admin-status-dot"/>Chế độ quản lý</span><b>20 slot</b></div><p className="admin-health-note">Không dán API key vào ảnh chụp màn hình hoặc log công khai.</p></section>
          <section className="admin-tip glass"><span>✦</span><div><b>LƯU Ý BẢO MẬT</b><p>API key được mã hóa ở máy chủ. Chỉ nhập khóa mới khi cần thay đổi; khóa đã lưu sẽ được giữ nguyên nếu trường nhập để trống.</p></div></section>
        </aside>
      </section>

      <section className="admin-panel glass admin-activity">
        <div className="admin-panel-heading"><div><div className="card-kicker">OBSERVABILITY / 03</div><h2>Hoạt động hệ thống</h2><p>Sự kiện webhook và tác vụ gần đây, cập nhật khi bạn làm mới.</p></div><button className="admin-refresh" onClick={() => void load()} disabled={loading}>↻ Làm mới dữ liệu</button></div>
        <div className="admin-activity-grid">
          <div className="admin-activity-block"><div className="admin-subheading"><h3>Webhook events</h3><span>{events.length} bản ghi</span></div>{events.length ? events.map((event, index) => <article className="admin-activity-row" key={String(event.id ?? index)}><span className="admin-event-icon">⌁</span><div className="admin-activity-copy"><strong>{String(event.type || "Event")}</strong><small>{String(event.source || "Không rõ nguồn")} · {formatDate(event.created_at)}</small></div><span className={`admin-state-pill ${String(event.status || "").toLowerCase()}`}>{String(event.status || "unknown")}</span></article>) : <div className="admin-empty"><span>⌁</span><b>Chưa có webhook</b><p>Sự kiện mới sẽ xuất hiện ở đây.</p></div>}</div>
          <div className="admin-activity-block"><div className="admin-subheading"><h3>Jobs</h3><span>{jobs.length} bản ghi</span></div>{jobs.length ? jobs.map((job, index) => <article className="admin-activity-row" key={String(job.id ?? index)}><span className="admin-event-icon">◷</span><div className="admin-activity-copy"><strong>{String(job.type || "Job")}</strong><small>{formatDate(job.created_at)} · Lần thử: {Number(job.attempts || 0)}</small></div><span className={`admin-state-pill ${String(job.status || "").toLowerCase()}`}>{String(job.status || "unknown")}</span></article>) : <div className="admin-empty"><span>◷</span><b>Hàng đợi đang trống</b><p>Chưa có tác vụ để hiển thị.</p></div>}</div>
        </div>
      </section>
      <footer className="admin-footer"><a href="/">MC Translate Studio</a><span>PRIVATE ADMIN WORKSPACE <i>✦</i></span><span className="footer-status"><span className="live-dot" /> SECURE SESSION</span></footer>
    </main>
  );
}
