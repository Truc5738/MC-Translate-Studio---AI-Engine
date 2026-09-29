"use client";
import {useState} from "react";
export default function Home(){
 const [file,setFile]=useState<File|null>(null),[target,setTarget]=useState("Vietnamese"),[busy,setBusy]=useState(false),[msg,setMsg]=useState("");
 async function run(){
  if(!file)return setMsg("Hãy chọn file .mcaddon, .mcpack, .zip hoặc .jar.");
  setBusy(true);setMsg("Đang phân tích pack và dịch bằng AI...");
  try{
   const fd=new FormData();fd.append("file",file);fd.append("target",target);
   const r=await fetch("/api/translate",{method:"POST",body:fd});
   if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.error||"Translation failed")}
   const blob=await r.blob();const url=URL.createObjectURL(blob);const a=document.createElement("a");
   a.href=url;a.download="translated-"+file.name;a.click();URL.revokeObjectURL(url);
   setMsg("Hoàn tất. File dịch đã được tải xuống.");
  }catch(e:any){setMsg(e.message)}finally{setBusy(false)}
 }
 return <main className="shell"><nav className="nav"><div className="brand">MC <span>Translate</span> Studio</div><div style={{display:"flex",gap:16}}><a href="/repair">Repair Center</a><a href="/admin">Admin</a></div></nav>
 <section className="hero"><div><div className="eyebrow">Minecraft AI workspace</div><h1>Dịch. Sửa. Đóng gói lại.</h1><p>Web studio cho Bedrock Addon, Resource Pack, Behavior Pack và Java/Paper plugin. API Gemini/Groq do chủ website quản lý ở server.</p>
 <div className="featuregrid" style={{marginTop:28}}><div className="panel feature"><h3>Safe syntax</h3><p>Giữ identifier, placeholder, namespace, command và formatting code.</p></div><div className="panel feature"><h3>20-key pool</h3><p>Gemini + Groq, xoay vòng key server-side và không hiển thị secret.</p></div><div className="panel feature"><h3>24/7 container</h3><p>Restart policy, healthcheck, non-root và giới hạn tài nguyên.</p></div></div></div>
 <div className="panel" style={{padding:18}}><div className="drop"><input id="file" type="file" accept=".mcaddon,.mcpack,.zip,.jar" onChange={e=>setFile(e.target.files?.[0]||null)}/><label htmlFor="file">{file?"Đổi file":"Chọn hoặc kéo file vào đây"}</label><p className="muted">{file?file.name:"MCAddon, MCPack, ZIP, JAR — tối đa 50 MB"}</p></div>
 <div className="controls"><div className="field"><label>Ngôn ngữ đích</label><select value={target} onChange={e=>setTarget(e.target.value)}><option>Vietnamese</option><option>English</option><option>Chinese</option><option>Japanese</option><option>Korean</option><option>Thai</option><option>Spanish</option><option>French</option><option>German</option><option>Indonesian</option></select></div><div className="field"><label>Engine</label><input value="Gemini + Groq pool" readOnly/></div></div>
 <button className="button primary" style={{width:"100%",marginTop:14}} disabled={busy} onClick={run}>{busy?"Đang xử lý...":"Dịch và tải file"}</button><div className="status">{msg||"Sẵn sàng. API key không cần nhập ở đây."}</div></div></section>
 <section className="panel" style={{marginTop:24,padding:24}}><div className="eyebrow">24/7 production mode</div><h2>Repair Center · Validator · Diff · Glossary · GitHub</h2><p className="muted">Container có healthcheck và restart tự động. Nếu host hỗ trợ gVisor, runtime runsc được cấu hình ở Docker daemon, không cần cấp Docker socket cho ứng dụng.</p></section></main>
}
