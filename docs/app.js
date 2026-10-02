const configuredBase=(window.MC_TRANSLATE_API_BASE||"").replace(/\/$/,"");
const savedBase=localStorage.getItem("mc_translate_api_base")||configuredBase;
const $=id=>document.getElementById(id);
$("apiBase").value=savedBase;
$("apiBase").addEventListener("change",()=>localStorage.setItem("mc_translate_api_base",$("apiBase").value.trim().replace(/\/$/,"")));
function apiBase(){return ($("apiBase").value.trim()||configuredBase).replace(/\/$/,"")}
function setStatus(message){$("status").textContent=message}
function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
$("file").addEventListener("change",e=>{$("filename").textContent=e.target.files[0]?.name||"Chưa chọn file"});
function refreshRepairLink(){$("repairLink").href=apiBase()+"/repair"}
refreshRepairLink();
$("apiBase").addEventListener("input",refreshRepairLink);
$("translate").addEventListener("click",async()=>{
 const file=$("file").files[0]; if(!file){setStatus("Hãy chọn file trước.");return}
 const base=apiBase(); if(!base){setStatus("Hãy nhập Backend API URL.");return}
 $("translate").disabled=true;
 try{
  setStatus("1/4 Đang tạo URL upload an toàn...");
  const pre=await fetch(base+"/api/blob/presign",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fileName:file.name,size:file.size,contentType:file.type||"application/zip"})});
  const pd=await pre.json(); if(!pre.ok) throw new Error(pd.error||"Không tạo được URL upload");
  setStatus("2/4 Đang tải file trực tiếp lên Blob...");
  const put=await fetch(pd.uploadUrl,{method:"PUT",body:file,headers:{"Content-Type":file.type||"application/zip"}});
  if(!put.ok) throw new Error("Upload Blob thất bại: HTTP "+put.status);
  setStatus("3/4 Đã tải file. Đang xếp job vào Queue...");
  const queued=await fetch(base+"/api/jobs/create",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({fileUrl:pd.fileUrl,pathname:pd.pathname,fileName:file.name,target:$("target").value})});
  const qd=await queued.json(); if(!queued.ok) throw new Error(qd.error||"Không tạo được job");
  const id=qd.jobId;
  for(let i=0;i<180;i++){
   await sleep(2000);
   const r=await fetch(base+"/api/jobs/"+encodeURIComponent(id));
   const d=await r.json();
   if(!r.ok) throw new Error(d.error||"Không đọc được trạng thái job");
   const job=d.job;
   if(job.status==="completed" && job.result?.url){
    const a=document.createElement("a");a.href=job.result.url;a.target="_blank";a.rel="noopener";a.download="translated-"+file.name;a.click();
    setStatus("4/4 Hoàn tất. File dịch đã sẵn sàng. Job: "+id);return;
   }
   if(job.status==="failed"){throw new Error(job.error||"Job dịch thất bại")}
   setStatus("3/4 Đang xử lý AI... "+job.status+" | Job: "+id);
  }
  throw new Error("Job vẫn đang xử lý. Hãy kiểm tra lại sau bằng Job ID: "+id);
 }catch(e){setStatus(e.message||"Có lỗi xảy ra.")}finally{$("translate").disabled=false}
});
