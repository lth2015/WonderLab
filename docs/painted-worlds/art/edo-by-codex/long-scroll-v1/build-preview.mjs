import fs from 'node:fs/promises';
import path from 'node:path';
const dir=path.dirname(new URL(import.meta.url).pathname);
const m=JSON.parse(await fs.readFile(path.join(dir,'manifest-v1.json'),'utf8'));
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const tiles=[`<svg x="0" width="2000" height="700" viewBox="0 0 2000 700" overflow="hidden"><image href="../edo-nihonbashi-key-v1.webp" width="2100" height="700"/></svg>`];
const cards=[`<article><h2>01–02 日本桥关键画（已接受）</h2><img src="../edo-nihonbashi-key-v1.webp"><p>原生2172×724，等比绘制2100×700，前2000可见，右100用于接缝。</p></article>`];
for(const a of m.assets){
 const w=a.world,s=a.sourceWindow;
 tiles.push(`<svg x="${w.visibleX}" width="1000" height="700" viewBox="${w.visibleX} 0 1000 700" overflow="hidden"><svg x="${w.x}" width="1128" height="700" viewBox="${s.x} ${s.y} ${s.width} ${s.height}"><image href="${escape(a.webp.file)}" width="${a.native.width}" height="${a.native.height}"/></svg></svg>`);
 cards.push(`<article><h2>${String(a.section).padStart(2,'0')} ${escape(a.title)}</h2><a href="${escape(a.native.file)}"><img loading="lazy" src="${escape(a.webp.file)}"></a><p>原生${a.native.width}×${a.native.height} · WebP ${Math.round(a.webp.bytes/1024)} KiB · ${escape(a.review)}</p></article>`);
}
const lines=Array.from({length:14},(_,i)=>`<path d="M${i*1000} 0v700"/><text x="${i*1000+20}" y="35">${String(i+1).padStart(2,'0')}</text>`).join('');
const html=`<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>江户十四段原画制作预览</title><style>body{margin:24px;background:#eee7d5;color:#424e43;font-family:serif}h1{font-weight:500}p{line-height:1.7}.note{max-width:900px}button{font:inherit;padding:8px 12px;margin:4px;border:1px solid #b5aa8a;background:#f3eddb;color:inherit;cursor:pointer}.strip{overflow:auto;border:1px solid #b5aa8a;max-width:100%;background:#e9ddbd}.strip>svg{display:block;width:4900px;height:245px}.ruler{fill:#a25540;stroke:#a25540;stroke-width:2;font-size:24px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,440px),1fr));gap:24px;margin-top:24px}article{padding:16px;background:#f4eddb;border:1px solid #c7bda1}h2{font-size:19px;font-weight:500}img{width:100%;display:block}article p{font:13px/1.7 system-ui;color:#646956}</style><h1>江户十四段 · 原画制作预览</h1><p class="note">已生成${m.assets.length+2}/14段。上方是按建议中心裁窗作的硬切粗拼，用来暴露接缝、尺度与走道问题，尚未做最小差异切线；不代表运行接缝已通过。下方保留每张完整原画，点击可看原生PNG。生成工具返回的真实尺寸逐张记录。</p><nav>${Array.from({length:14},(_,i)=>`<button data-section="${i}">${String(i+1).padStart(2,'0')}</button>`).join('')}</nav><div class="strip"><svg viewBox="0 0 14000 700" xmlns="http://www.w3.org/2000/svg">${tiles.join('')}<g class="ruler">${lines}</g></svg></div><div class="grid">${cards.join('')}</div><script>for(const b of document.querySelectorAll('button'))b.onclick=()=>document.querySelector('.strip').scrollTo({left:Number(b.dataset.section)*350,behavior:'smooth'});</script></html>`;
await fs.writeFile(path.join(dir,'preview.html'),html);
console.log(`Prepared preview for ${m.assets.length+2}/14 sections.`);
