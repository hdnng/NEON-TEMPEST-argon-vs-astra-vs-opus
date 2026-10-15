import fs from'node:fs';import path from'node:path';import{createRequire}from'node:module';
const root=path.resolve(import.meta.dirname,'../..'),j=path.join(root,'judging'),require=createRequire(path.join(j,'work/B/package.json')),{chromium}=require('@playwright/test');
const b=await chromium.launch({headless:true});const p=await b.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
for(const x of ['A','B']){
 await p.setContent(`<html><style>body{margin:0;display:grid;place-content:center;height:100vh;background:#0b1020;color:#e7eeff;font:32px Arial}article{border:2px dashed #efb55b;padding:70px;max-width:1300px}h1{color:#efb55b;font-size:70px}small{color:#9cb1ce}</style><article><small>JUDGE-GENERATED PLACEHOLDER / PROJECT ${x}</small><h1>NOT IMPLEMENTED</h1><h2>Separate mode-select screen</h2><p>Mode choices are integrated into the main menu.</p><p>This is a missing separate screen, not a claim that the modes are absent.</p><p>Compare 03-main-menu.png for the actual implementation.</p></article></html>`);
 await p.screenshot({path:path.join(j,`screenshots/${x}/20-mode-select.png`)});
}
await b.close();
