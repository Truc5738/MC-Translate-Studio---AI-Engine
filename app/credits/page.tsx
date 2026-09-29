"use client";

import { useState } from "react";
import { estimateCreditCost } from "@/lib/credits";

export default function CreditsPage() {
  const [size, setSize] = useState(100);
  const [action, setAction] = useState<"translate" | "analyze" | "repair">("translate");
  const cost = estimateCreditCost(action, size * 1024);

  return (
    <main className="shell">
      <section className="hero">
        <div className="eyebrow">NVNMC CREDIT SYSTEM</div>
        <h1>Chi phí sử dụng thấp</h1>
        <p>MC-Translate-Studio chỉ ước tính một khoản xu nhỏ theo tác vụ và kích thước file. Số dư thật được quản lý bởi hệ thống xu của nvnmc.cloud.</p>
      </section>
      <section className="panel">
        <h2>Ước tính chi phí</h2>
        <div className="formgrid">
          <label>Tác vụ<select value={action} onChange={e => setAction(e.target.value as typeof action)}><option value="translate">Dịch</option><option value="analyze">Phân tích</option><option value="repair">Sửa lỗi AI</option></select></label>
          <label>Kích thước file (KB)<input type="number" min="1" value={size} onChange={e => setSize(Math.max(1, Number(e.target.value) || 1))}/></label>
        </div>
        <div className="cost">{cost.toFixed(2)} xu</div>
        <p className="muted">Đây là mức ước tính. Không có số dư nào bị trừ từ trang này.</p>
      </section>
    </main>
  );
}
