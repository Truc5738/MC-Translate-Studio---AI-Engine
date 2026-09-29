import {getAIKeys} from "./keys";
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
function minecraftPrompt(source:string,target:string,filePath:string){return `You are a Minecraft localization and repair engine.
Translate human-facing text from the source language to ${target}.
File: ${filePath}

STRICT RULES:
- Return ONLY the translated/repaired content. No Markdown fences or commentary.
- Preserve JSON/YAML/properties syntax exactly.
- Never translate identifiers, namespaces, registry IDs, resource paths, URLs, commands, selectors, UUIDs, version numbers, API/class/method names, placeholders such as %player%, {count}, <player>, $1, or Minecraft formatting codes such as §a.
- For .mcfunction files, never alter commands; only translate comments beginning with #.
- Preserve whitespace and line structure as much as possible.
- Translate only player-facing natural language.
- If the input is already in the target language, keep it unchanged.

CONTENT:
${source}`;}
async function callGemini(key:string,prompt:string){const model=process.env.GEMINI_MODEL||"gemini-3.8-flash";const res=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{temperature:0.15}})});const data=await res.json();if(!res.ok)throw new Error(`Gemini ${res.status}: ${JSON.stringify(data).slice(0,500)}`);return data?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text||"").join("")||"";}
async function callGroq(key:string,prompt:string){const model=process.env.GROQ_MODEL||"openai/gpt-oss-20b";const res=await fetch("https://api.groq.com/openai/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${key}`},body:JSON.stringify({model,messages:[{role:"system",content:"You are a precise Minecraft localization engine."},{role:"user",content:prompt}],temperature:0.15})});const data=await res.json();if(!res.ok)throw new Error(`Groq ${res.status}: ${JSON.stringify(data).slice(0,500)}`);return data?.choices?.[0]?.message?.content||"";}
export async function generateTranslation(source:string,target:string,filePath:string){
 const enabled=(await getAIKeys()).filter(k=>k.enabled&&k.key);if(!enabled.length)throw new Error("No AI API key is configured. Open Admin and add Gemini/Groq keys.");
 const prompt=minecraftPrompt(source,target,filePath);const start=Math.floor(Math.random()*enabled.length);let lastError="Unknown AI error";
 for(let round=0;round<enabled.length;round++){const k=enabled[(start+round)%enabled.length];try{const out=k.provider==="gemini"?await callGemini(k.key,prompt):await callGroq(k.key,prompt);if(out.trim())return out;throw new Error("Empty model response");}catch(e:any){lastError=e?.message||String(e);await sleep(150);}}
 throw new Error(lastError);
}