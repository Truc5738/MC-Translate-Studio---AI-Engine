const PLACEHOLDER=/(%[A-Za-z0-9_.:-]+%|\{[A-Za-z0-9_.:-]+\}|<[^<>\n]{1,80}>|\$\d+)/g;
const FORMAT=/§[0-9a-fk-or]/gi;
export function protectedTokens(s:string){return [...s.matchAll(new RegExp(`${PLACEHOLDER.source}|${FORMAT.source}`,"gi"))].map(m=>m[0]).sort();}
export function sameTokens(a:string,b:string){const x=protectedTokens(a),y=protectedTokens(b);return x.length===y.length&&x.every((v,i)=>v===y[i]);}
export function looksCorrupt(original:string,translated:string){if(!translated.trim())return true;if(!sameTokens(original,translated))return true;return false;}