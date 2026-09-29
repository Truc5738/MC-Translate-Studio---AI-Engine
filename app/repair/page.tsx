"use client";
import {useState} from "react";

type Diagnostic={severity:"error"|"warning"|"info";path:string;message:string;suggestion:string};

export default function RepairPage(){
 const [file,setFile]=useState<File|null>(null);
 const [log,setLog]=useState("");
 const [items,setItems]=useState<Diagnostic[]>([]);
 const [busy,setBusy]=useState(false);
 const [msg,setMsg]=useState("");

 async function analyze(){
  if(!file&&!log.trim()){setMsg("Chọn file hoặc dán log lỗi.");return}
  setBusy(true);setMsg("Đang kiểm tra cấu trúc và log...");
  try{
   const fd=new FormData();if(file)fd.append("file",file);if(log)fd.append("log",log);
   const r=await fetch("/api/repair/analyze",{method:"POST",body:fd});
   const d=await r.json();if(!r.ok)throw new Error(d.error||"Analyze failed");
   setItems(d.diagnostics||[]);
   setMsg("Hoàn tất: "+d.summary.errors+" lỗi, "+d.summary.warnings+" cảnh báo.");
  }catch(e:any){setMsg(e.message)}finally{setBusy(false)}
 }

 return <main className="shell"><nav className="nav"><div className="brand">MC <span>Translate</span> Studio</div><a href="/">Translate</a></nav>
 <section className="panel" style={{padding:28}}>
  <div className="eyebrow">Repair Center</div><h1 style={{fontSize:52,margin:"12px 0"}}>Phân tích Addon / Pack / Plugin</h1>
  <p className="muted">Validator chỉ đọc file. Không tự ý chạy JavaScript, Java, shell hoặc class trong file upload.</p>
  <div className="drop" style={{minHeight:220,marginTop:20}}><input id="repair-file" type="file" accept=".mcaddon,.mcpack,.zip,.jar,.log,.txt" onChange={e=>setFile(e.target.files?.[0]||null)}/><label htmlFor="repair-file">{file?file.name:"Chọn file để kiểm tra"}</label></div>
  <textarea value={log} onChange={e=>setLog(e.target.value)} placeholder="Hoặc dán server log vào đây..." style={{width:"100%",minHeight:180,marginTop:16,background:"#08192b",color:"#eef5ff",border:"1px solid #20364e",borderRadius:12,padding:14}}/>
  <button className="button primary" disabled={busy} onClick={analyze} style={{marginTop:14}}>{busy?"Đang phân tích...":"Analyze"}</button>
  <div className="status">{msg||"Validator an toàn, chỉ đọc file."}</div>
  <div className="rows">{items.map((x,i)=><div className="keyrow" style={{gridTemplateColumns:"100px 1fr"}} key={i}><strong>{x.severity.toUpperCase()}</strong><div><b>{x.path}</b><div>{x.message}</div><small className="muted">{x.suggestion}</small></div></div>)}</div>
 </section></main>
}
