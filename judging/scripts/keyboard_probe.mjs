import fs from'node:fs';import path from'node:path';import{createRequire}from'node:module';
const root=path.resolve(import.meta.dirname,'../..'),j=path.join(root,'judging'),require=createRequire(path.join(j,'work/B/package.json')),{chromium}=require('@playwright/test');
const b=await chromium.launch({headless:true,channel:'chromium',args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-precise-memory-info']});
for(const x of JSON.parse(fs.readFileSync(path.join(j,'data/environment.json'))).order){
 const p=await b.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});await p.addInitScript(()=>{localStorage.setItem('neon-tempest-settings-v1',JSON.stringify({resolutionScale:1}));});await p.goto(`http://127.0.0.1:${6101+'ABC'.indexOf(x)}`);await p.waitForFunction(x=>x==='A'?!!window.__NEON_TEMPEST__:x==='B'?!!window.__NEON__:!!window.__NT,x);
 await p.evaluate(x=>{if(x==='A')window.__NEON_TEMPEST__.app.launchMatch({p1Char:'hayate',p2Char:'magnus',mode:'training',stageId:'rooftop',skipIntro:true});if(x==='B')window.__NEON__.start('hayate','magnus','training',0);if(x==='C')window.__NT.startMatch({mode:'training',chars:['hayate','magnus'],palettes:[0,0],stage:'rooftop',cpu:[false,false],difficulty:2});},x);
 await p.waitForFunction(x=>(x==='A'?window.__NEON_TEMPEST__.app.matchState:x==='B'?window.__NEON__.state:window.__NT.match())?.phase==='fight',x);await p.waitForTimeout(1800);
 await p.keyboard.down('KeyS');await p.waitForTimeout(55);await p.keyboard.down('KeyD');await p.waitForTimeout(55);await p.keyboard.up('KeyS');await p.keyboard.down(x==='B'?'KeyJ':'KeyU');await p.waitForTimeout(55);await p.keyboard.up(x==='B'?'KeyJ':'KeyU');await p.keyboard.up('KeyD');
 const activation=await p.evaluate(x=>x==='A'?window.__NEON_TEMPEST__.app.matchState:x==='B'?window.__NEON__.state:window.__NT.match(),x);
 const f=activation.fighters[0],move=f.currentMoveId??f.move??f.lastMove;const pass=x==='A'?/arc_kunai/.test(move):x==='B'?/special0_/.test(move):/orb_/.test(move);
 await p.waitForTimeout(230);await p.screenshot({path:path.join(j,'screenshots',x,'22-keyboard-qcf.png')});
 fs.writeFileSync(path.join(j,'logs',x,'keyboard-qcf-state.json'),JSON.stringify({pass,method:'Real keyboard held S, S+D, D+LP after fight phase; no queued input or direct simulation stepping',selected_move:move,state:activation},null,2));console.log(x,'keyboard QCF',pass,move);await p.close();
}await b.close();
