import JSZip from "jszip";

const TEXT_EXT = /\.(json|jsonc|lang|properties|yml|yaml|txt|mcfunction|ini|cfg|toml|xml|js|ts|java|md)$/i;
const SKIP = /(^|\/)(pack_icon\.png|manifest\.json\.bak|.*\.png|.*\.jpg|.*\.jpeg|.*\.webp|.*\.ogg|.*\.mp3|.*\.wav|.*\.mp4|.*\.mcstructure|.*\.bin)$/i;

export async function translateZip(input:Buffer,target:string,translate:(s:string,target:string,path:string)=>Promise<string>) {
  const zip=await JSZip.loadAsync(input);
  const out=new JSZip();
  const entries=Object.keys(zip.files);
  let translated=0;
  for(const path of entries){
    const file=zip.files[path];
    if(file.dir){ out.folder(path); continue; }
    const data=await file.async("nodebuffer");
    if(TEXT_EXT.test(path) && !SKIP.test(path) && data.length < 500_000){
      try {
        const source=data.toString("utf8");
        const result=await translate(source,target,path);
        out.file(path,result);
        translated++;
      } catch {
        out.file(path,data);
      }
    } else out.file(path,data);
  }
  return {buffer:await out.generateAsync({type:"nodebuffer",compression:"DEFLATE"}),entries,translated};
}