const configuredBase=(window.MC_TRANSLATE_API_BASE||"").replace(/\/$/,"");
const savedBase=localStorage.getItem("mc_translate_api_base")||configuredBase;
const savedEngine=localStorage.getItem("mc_translate_engine")||"browser-ai";
const savedSource=localStorage.getItem("mc_translate_source")||"English";
const savedTarget=localStorage.getItem("mc_translate_target")||"Vietnamese";
const savedGlossary=localStorage.getItem("mc_translate_glossary")||"";
const $=id=>document.getElementById(id);

$("apiBase").value=savedBase;
$("engine").value=savedEngine;
$("source").value=savedSource;
$("target").value=savedTarget;
$("glossary").value=savedGlossary;

$("apiBase").addEventListener("change",()=>{
 localStorage.setItem("mc_translate_api_base",$("apiBase").value.trim().replace(/\/$/,""));
 refreshRepairLink();
});
$("apiBase").addEventListener("input",refreshRepairLink);

$("engine").addEventListener("change",()=>{
 localStorage.setItem("mc_translate_engine",$("engine").value);
 updateEngineUI();
});

$("source").addEventListener("change",()=>{
 localStorage.setItem("mc_translate_source",$("source").value);
 updateModelHint();
});

$("target").addEventListener("change",()=>{
 localStorage.setItem("mc_translate_target",$("target").value);
 updateModelHint();
});

$("glossary").addEventListener("input",()=>{
 localStorage.setItem("mc_translate_glossary",$("glossary").value);
});

function apiBase(){
 return ($("apiBase").value.trim()||configuredBase).replace(/\/$/,"");
}

function setStatus(message){
 $("status").textContent=message;
}

function sleep(ms){
 return new Promise(r=>setTimeout(r,ms));
}

function refreshRepairLink(){
 $("repairLink").href=(apiBase()||"#")+"/repair";
}

function parseGlossary(){
 const out={};
 for(const raw of $("glossary").value.split(/\r?\n/)){
  const line=raw.trim();
  if(!line||line.startsWith("#")) continue;
  const index=line.indexOf("=");
  if(index<=0) continue;
  const from=line.slice(0,index).trim();
  const to=line.slice(index+1).trim();
  if(from&&to) out[from]=to;
 }
 return out;
}

function updateModelHint(){
 const browser=$("engine").value==="browser-ai";
 if(!browser){
  $("modelHint").textContent="";
  return;
 }
 const source=$("source").value;
 const target=$("target").value;
 if(source===target){
  $("modelHint").textContent="Hãy chọn ngôn ngữ nguồn khác ngôn ngữ đích.";
  return;
 }
 $("modelHint").textContent=(source==="English"&&target==="Vietnamese")
  ?"English → Vietnamese dùng Xenova/opus-mt-en-vi, model chuyên cho cặp này."
  :"Cặp này dùng Xenova/nllb-200-distilled-600M multilingual.";
}

function updateEngineUI(){
 const engine=$("engine").value;
 const browser=engine==="browser-ai";
 $("browserAiOptions").style.display=browser?"grid":"none";
 $("cloudUrl").style.display=engine==="ai"?"block":"none";
 $("apiBase").disabled=browser||engine==="local";
 $("apiBase").style.opacity=browser||engine==="local"?".45":"1";
 document.querySelectorAll(".engine-tab").forEach(tab=>{
   tab.classList.toggle("active",tab.dataset.engine===engine);
 });

 if(browser){
  $("engineHint").textContent="Browser AI runs on your device. No API key and no pack upload to the backend.";
  $("translateButton").innerHTML="Translate with Browser AI <span>↗</span>";
 }else if(engine==="local"){
  $("engineHint").textContent="Local Rules uses built-in rules and your custom glossary. No AI API.";
  $("translateButton").innerHTML="Translate with Local Rules <span>↗</span>";
 }else{
  $("engineHint").textContent="AI Cloud runs Gemini/Groq server-side. Your API keys stay on the backend.";
  $("translateButton").innerHTML="Translate with AI Cloud <span>↗</span>";
 }
 updateModelHint();
}

function downloadBlob(blob,fileName){
 const url=URL.createObjectURL(blob);
 const a=document.createElement("a");
 a.href=url;
 a.download=fileName;
 a.rel="noopener";
 document.body.appendChild(a);
 a.click();
 a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function browserProgress(info){
 if(info.phase==="model"){
  const p=typeof info.progress==="number" ? " "+Math.round(info.progress)+"%" : "";
  setStatus("Đang tải/khởi động Browser AI"+p+" | "+(info.label||"model"));
  return;
 }
 if(info.phase==="text"){
  const p=info.total?Math.round((info.current/info.total)*100):0;
  setStatus("Browser AI đang dịch: "+p+"% | "+(info.path||"file"));
  return;
 }
 if(info.phase==="files"){
  const p=info.total?Math.round((info.current/info.total)*100):0;
  setStatus("Browser AI đang xử lý pack: "+p+"% | "+(info.label||""));
  return;
 }
 if(info.phase==="zip") setStatus("Đang đóng gói file dịch...");
}

refreshRepairLink();
updateEngineUI();

$("file").addEventListener("change",e=>{
 $("filename").textContent=e.target.files[0]?.name||"Chưa chọn file";
});

$("translateButton").addEventListener("click",async()=>{
 const file=$("file").files[0];
 if(!file){
  setStatus("Hãy chọn file trước.");
  return;
 }

 const engine=$("engine").value;
 const glossary=parseGlossary();
 $("translateButton").disabled=true;

 try{
  if(engine==="browser-ai"){
   const browserAI=window.MC_TRANSLATE_BROWSER_AI;
   if(!browserAI) throw new Error("Browser AI chưa được nạp. Hãy tải lại trang.");

   const source=$("source").value;
   const target=$("target").value;
   if(source===target) throw new Error("Ngôn ngữ nguồn và đích phải khác nhau.");

   setStatus("1/3 Đang mở Browser AI...");
   const result=await browserAI.translateZipInBrowser(file,{
    source,
    target,
    glossary,
    onProgress:browserProgress
   });

   setStatus("2/3 Đang chuẩn bị file tải xuống...");
   downloadBlob(result.blob,"translated-"+file.name);
   setStatus("3/3 Hoàn tất. "+result.translated+" file text đã được dịch. Model: "+result.model+" | "+result.device);
   return;
  }

  const base=apiBase();
  if(!base) throw new Error("Hãy nhập Backend API URL.");

  setStatus("1/4 Đang tạo phiên upload an toàn...");
  const pre=await fetch(base+"/api/blob/presign",{
   method:"POST",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify({
    fileName:file.name,
    size:file.size,
    contentType:file.type||"application/zip"
   })
  });

  const pd=await pre.json();
  if(!pre.ok) throw new Error(pd.error||"Không tạo được phiên upload");

  setStatus("2/4 Đang tải file trực tiếp lên Blob...");
  const put=await fetch(pd.uploadUrl,{
   method:"PUT",
   body:file,
   headers:{"Content-Type":file.type||"application/zip"}
  });
  if(!put.ok) throw new Error("Upload Blob thất bại: HTTP "+put.status);

  setStatus(engine==="local"
   ?"3/4 Đang dịch bằng Local Rules..."
   :"3/4 Đang xếp job AI vào Queue...");

  const queued=await fetch(base+"/api/jobs/create",{
   method:"POST",
   headers:{"Content-Type":"application/json"},
   body:JSON.stringify({
    uploadId:pd.uploadId,
    target:$("target").value,
    engine,
    glossary
   })
  });

  const qd=await queued.json();
  if(!queued.ok) throw new Error(qd.error||"Không tạo được job");

  const id=qd.jobId;

  for(let i=0;i<180;i++){
   await sleep(2000);
   const r=await fetch(base+"/api/jobs/"+encodeURIComponent(id));
   const d=await r.json();
   if(!r.ok) throw new Error(d.error||"Không đọc được trạng thái job");

   const job=d.job;
   if(job.status==="completed"&&job.result?.url){
    const a=document.createElement("a");
    a.href=job.result.url;
    a.target="_blank";
    a.rel="noopener";
    a.download="translated-"+file.name;
    a.click();
    setStatus("4/4 Hoàn tất. File dịch đã sẵn sàng. Job: "+id);
    return;
   }

   if(job.status==="failed"){
    throw new Error(job.error||"Job dịch thất bại");
   }

   setStatus(
    (engine==="local"?"3/4 Đang dịch cục bộ... ":"3/4 Đang xử lý AI... ")
    +job.status+" | Job: "+id
   );
  }

  throw new Error("Job vẫn đang xử lý. Hãy kiểm tra lại sau bằng Job ID: "+id);
 }catch(e){
  setStatus(e?.message||"Có lỗi xảy ra.");
 }finally{
  $("translateButton").disabled=false;
 }
});
