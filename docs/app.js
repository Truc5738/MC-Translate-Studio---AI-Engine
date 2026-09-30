const API_BASE=(window.MC_TRANSLATE_API_BASE||"").replace(/\/$/,"");
const $=id=>document.getElementById(id);
$("file").addEventListener("change",e=>{$("filename").textContent=e.target.files[0]?.name||"Chưa chọn file"});
$("repairLink").href=API_BASE+"/repair";
$("translate").addEventListener("click",async()=>{
 const file=$("file").files[0]; if(!file){$("status").textContent="Hãy chọn file trước.";return}
 $("translate").disabled=true;$("status").textContent="Đang gửi file đến backend...";
 try{
  const fd=new FormData();fd.append("file",file);fd.append("target",$("target").value);
  const r=await fetch(API_BASE+"/api/translate",{method:"POST",body:fd});
  if(!r.ok){let d={};try{d=await r.json()}catch{}throw new Error(d.error||"Translation failed")}
  const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="translated-"+file.name;a.click();URL.revokeObjectURL(url);
  $("status").textContent="Hoàn tất. File đã được tải xuống.";
 }catch(e){$("status").textContent=e.message||"Có lỗi xảy ra."}finally{$("translate").disabled=false}
});