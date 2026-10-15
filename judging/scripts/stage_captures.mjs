import path from'node:path';import{createRequire}from'node:module';import fs from'node:fs';
const root=path.resolve(import.meta.dirname,'../..'),j=path.join(root,'judging'),require=createRequire(path.join(j,'work/B/package.json')),{chromium}=require('@playwright/test');
const b=await chromium.launch({headless:true,channel:'chromium',args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-precise-memory-info']});
for(const x of JSON.parse(fs.readFileSync(path.join(j,'data/environment.json'))).order){
 const p=await b.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});await p.addInitScript(()=>{localStorage.setItem('neon-tempest-settings-v1',JSON.stringify({resolutionScale:1}));});await p.goto(`http://127.0.0.1:${6101+'ABC'.indexOf(x)}`);await p.waitForFunction(x=>x==='A'?!!window.__NEON_TEMPEST__:x==='B'?!!window.__NEON__:!!window.__NT,x);
 const audit=[];
 for(let stage=0;stage<3;stage++){
  await p.evaluate(({x,stage})=>{if(x==='A')window.__NEON_TEMPEST__.app.launchMatch({p1Char:'hayate',p2Char:'magnus',mode:'versus_2p',stageId:['rooftop','alley','shrine'][stage],skipIntro:false});if(x==='B')window.__NEON__.start('hayate','magnus','versus',stage);if(x==='C')window.__NT.startMatch({mode:'versus',chars:['hayate','magnus'],palettes:[0,0],stage:['rooftop','shrine','pit'][stage],cpu:[false,false],difficulty:2});},{x,stage});
  await p.waitForFunction(({x,stage})=>{const s=x==='A'?window.__NEON_TEMPEST__.app.matchState:x==='B'?window.__NEON__.state:window.__NT.match();return s?.phase==='fight'&&(x!=='C'||s.config.stage===['rooftop','shrine','pit'][stage]);},{x,stage});await p.waitForTimeout(1900);
  const filename=`1${5+stage}-stage-${stage+1}.png`;await p.screenshot({path:path.join(j,'screenshots',x,filename)});audit.push({filename,note:'Native production stage after intro and FIGHT announcement settle; no state or camera edits',viewport:[1920,1080]});console.log(x,filename);
 }
 fs.writeFileSync(path.join(j,'logs',x,'stage-captures.json'),JSON.stringify(audit,null,2));await p.close();
}await b.close();
