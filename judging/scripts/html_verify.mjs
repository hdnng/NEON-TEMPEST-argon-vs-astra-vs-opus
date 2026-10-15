import fs from'node:fs';import path from'node:path';import http from'node:http';import{createRequire}from'node:module';
const root=path.resolve(import.meta.dirname,'../..'),j=path.join(root,'judging'),require=createRequire(path.join(j,'work/B/package.json')),{chromium}=require('@playwright/test');
const mime={'.html':'text/html; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.md':'text/plain; charset=utf-8'};
const server=http.createServer((req,res)=>{let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(p==='/favicon.ico'){res.writeHead(204);res.end();return;}const f=path.resolve(root,'.'+p);if(!f.startsWith(root)||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':mime[path.extname(f)]??'text/plain; charset=utf-8'});fs.createReadStream(f).pipe(res);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${server.address().port}/report.html`;
const browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});const problems=[];page.on('pageerror',e=>problems.push(e.message));page.on('console',m=>{if(m.type()==='error')problems.push(m.text());});
const states=[];const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
async function images(){await page.evaluate(async()=>{await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});return page.evaluate(()=>({count:document.images.length,unique:new Set([...document.images].map(i=>i.getAttribute('src'))).size,broken:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.getAttribute('src'))}));}
async function state(){return page.evaluate(()=>({lang:document.documentElement.lang,enVisible:!document.querySelector('[data-lang="en"]').hidden,viVisible:!document.querySelector('[data-lang="vi"]').hidden,button:document.getElementById('language-toggle').textContent,saved:localStorage.getItem('neonJudgingLang')}));}
let result;
try{
 await page.goto(url,{waitUntil:'networkidle'});let im=await images();assert(!im.broken.length,'Broken images');const initial=await state();states.push(initial);assert(initial.lang==='en'&&initial.enVisible&&!initial.viVisible,'Initial language');
 await page.screenshot({path:path.join(j,'screenshots/report-en.png')});
 await page.locator('#language-toggle').click();let vi=await state();states.push(vi);assert(vi.lang==='vi'&&vi.viVisible&&!vi.enVisible&&vi.saved==='vi','Vietnamese toggle');await images();await page.screenshot({path:path.join(j,'screenshots/report-vi.png')});
 await page.reload({waitUntil:'networkidle'});const persisted=await state();states.push(persisted);assert(persisted.lang==='vi'&&persisted.viVisible,'localStorage persistence');
 await page.locator('#language-toggle').click();const en=await state();states.push(en);assert(en.lang==='en'&&en.enVisible&&en.saved==='en','English toggle');im=await images();assert(!im.broken.length,'Broken images after toggling');assert(!problems.length,'Console/page errors');
 result={pass:true,transport:'Temporary local HTTP server; closed after verification',states,images:im,console_errors:problems};
}catch(e){result={pass:false,error:String(e),stack:e.stack,states,console_errors:problems};process.exitCode=1;}finally{fs.writeFileSync(path.join(j,'data/html-verification.json'),JSON.stringify(result,null,2));await browser.close();await new Promise(r=>server.close(r));}
console.log(JSON.stringify(result,null,2));
