import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'../..'),j=path.join(root,'judging');const require=createRequire(path.join(j,'work/B/package.json'));
const {chromium}=require('@playwright/test');const label=process.argv[2],url=`http://127.0.0.1:${6101+'ABC'.indexOf(label)}`;
const gpu=process.argv.includes('--gpu-bench-only');
const launch=gpu?{headless:true,channel:'chromium',args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-precise-memory-info']}:{headless:true,args:['--enable-precise-memory-info']};
const browser=await chromium.launch(launch);const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1});
await context.addInitScript(()=>{localStorage.setItem('neon-tempest-settings-v1',JSON.stringify({resolutionScale:1}));});
const page=await context.newPage(),issues=[];page.on('pageerror',e=>issues.push({type:'pageerror',text:e.message}));page.on('console',m=>{if(['error','warning'].includes(m.type()))issues.push({type:m.type(),text:m.text()});});
try{
 const cdp=await browser.newBrowserCDPSession();const system=await cdp.send('SystemInfo.getInfo');
 await page.goto(url);await page.waitForFunction(x=>x==='A'?!!window.__NEON_TEMPEST__:x==='B'?!!window.__NEON__:!!window.__NT,label);
 await page.keyboard.press('Enter');
 await page.evaluate(x=>{
  window.__judgeLabel=x;
  window.__judgeStart=(both=true)=>{
   if(x==='A'){const a=window.__NEON_TEMPEST__.app;a.settings.values.cpuDifficulty='hard';a.launchMatch({p1Char:'hayate',p2Char:'sable',stageId:'rooftop',mode:'versus_cpu',cpuVsCpu:both,skipIntro:false});}
   if(x==='B'){const n=window.__NEON__;n.game.settings.difficulty=2;n.start('hayate','sable',both?'versus':'arcade',0);n.game.cpuBoth=both;}
   if(x==='C')window.__NT.startMatch({mode:'cpu',chars:['hayate','sable'],palettes:[0,0],stage:'rooftop',cpu:[both,true],difficulty:2});
  };
  window.__judgeState=()=>x==='A'?window.__NEON_TEMPEST__.app.matchState:x==='B'?window.__NEON__.state:window.__NT.match();
  window.__judgeOver=()=>{const s=window.__judgeState();return !s||['match_over','complete','matchEnd'].includes(s.phase);};
  window.__judgeStart(true);
 },label);
 await page.waitForTimeout(4000);
 const result=await page.evaluate(async()=>{
  const deltas=[],states=[],heap=[],events={};let matches=1,last=0,start=0,elapsed=0;const memory=()=>performance.memory?.usedJSHeapSize??null;
  const startHeap=memory();const startWall=Date.now();let lastSimFrame=0,fightSamples=0;
  await new Promise(resolve=>{function sample(now){if(!start){start=last=now;requestAnimationFrame(sample);return;}
   if(window.__judgeOver()){window.__judgeStart(true);matches++;}
   const s=window.__judgeState();
   deltas.push(now-last);last=now;elapsed=now-start;if(s?.phase==='fight')fightSamples++;
   if(deltas.length%60===0){heap.push({ms:elapsed,bytes:memory()});states.push({ms:elapsed,frame:s?.frame,phase:s?.phase,hp:s?.fighters.map(f=>f.hp)});}
   for(const e of s?.events??[]){const name=e.type??e.t;events[name]=(events[name]??0)+1;}
   if(elapsed>=60000)resolve();else requestAnimationFrame(sample);
  }requestAnimationFrame(sample);});
  const sorted=[...deltas].sort((a,b)=>a-b),sum=deltas.reduce((s,x)=>s+x,0),worst=sorted.slice(Math.floor(sorted.length*.99));
  const endHeap=memory();return{duration_seconds:sum/1000,frames:deltas.length,fps_average:1000*deltas.length/sum,fps_1pct_low:1000/(worst.reduce((s,x)=>s+x,0)/worst.length),p95_frame_ms:sorted[Math.ceil(sorted.length*.95)-1],p99_frame_ms:sorted[Math.ceil(sorted.length*.99)-1],max_frame_ms:sorted.at(-1),frame_ms_average:sum/deltas.length,heap_start_bytes:startHeap,heap_end_bytes:endHeap,heap_growth_bytes:endHeap-startHeap,heap_samples:heap,states,events,matches,fight_sample_percent:100*fightSamples/deltas.length,raw_frame_deltas_ms:deltas,canvas:[...document.querySelectorAll('canvas')].map(c=>[c.width,c.height]),date:new Date(startWall).toISOString(),viewport:[innerWidth,innerHeight],devicePixelRatio,userAgent:navigator.userAgent};
 });
 fs.writeFileSync(path.join(j,`logs/${label}/independent-benchmark${gpu?'-gpu':''}.json`),JSON.stringify({label,...result,launch,graphics:system.gpu,issues},null,2));
 console.log(label,'BENCH',result.fps_average.toFixed(2),result.fps_1pct_low.toFixed(2),result.p95_frame_ms.toFixed(2));
 if(gpu){console.log(label,'GPU BENCH COMPLETE');await browser.close();process.exit(0);}
 // Two minutes of actual keyboard-controlled P1 against the CPU, same input schedule.
 await page.evaluate(()=>window.__judgeStart(false));await page.waitForTimeout(3500);
 const start=Date.now(),history=[];let i=0;
 const actions=[['KeyD'],['KeyJ'],['KeyS'],['KeyS','KeyD'],['KeyD',label==='B'?'KeyJ':'KeyU'],[label==='B'?'KeyK':'KeyI'],['KeyA'],['KeyS','KeyA'],['KeyW'],['KeyD'],[label==='B'?'KeyU':'KeyJ'],[label==='B'?'KeyL':'KeyO']];
 while(Date.now()-start<120000){
  if(await page.evaluate(()=>window.__judgeOver())){await page.evaluate(()=>window.__judgeStart(false));}
  const keys=actions[i++%actions.length];for(const key of keys)await page.keyboard.down(key);await page.waitForTimeout(180);for(const key of keys)await page.keyboard.up(key);await page.waitForTimeout(40);
  if(i%30===0){history.push(await page.evaluate(()=>{const s=window.__judgeState();return{phase:s?.phase,frame:s?.frame,hp:s?.fighters.map(f=>f.hp),timer:s?.timer??s?.roundTimerFrames}}));console.log(label,'PLAY',Math.round((Date.now()-start)/1000));}
 }
 await page.screenshot({path:path.join(j,`screenshots/${label}/24-two-minute-play.png`)});
 fs.writeFileSync(path.join(j,`logs/${label}/two-minute-play.json`),JSON.stringify({label,duration_seconds:(Date.now()-start)/1000,input_cycles:i,history,issues},null,2));
 console.log(label,'COMPLETE',issues.length,'browser problems');
}catch(e){fs.writeFileSync(path.join(j,`logs/${label}/performance-harness-error.log`),e.stack);throw e;}finally{await browser.close();}
