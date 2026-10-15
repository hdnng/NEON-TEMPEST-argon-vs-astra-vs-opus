import fs from'node:fs';import path from'node:path';import{createRequire}from'node:module';
const root=path.resolve(import.meta.dirname,'../..'),j=path.join(root,'judging'),require=createRequire(path.join(j,'work/B/package.json')),{chromium}=require('@playwright/test');
const b=await chromium.launch({headless:true,channel:'chromium',args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--enable-gpu-rasterization']});
for(const x of JSON.parse(fs.readFileSync(path.join(j,'data/environment.json'))).order){
 const p=await b.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});const trace=[];const issues=[];p.on('pageerror',e=>issues.push(e.message));
 const scene=()=>p.evaluate(x=>x==='A'?window.__NEON_TEMPEST__?.app.scene:x==='B'?window.__NEON__?.scene:window.__NT?.sceneName(),x);
 const press=async(key,n=1)=>{for(let i=0;i<n;i++){await p.keyboard.press(key);await p.waitForTimeout(230);}trace.push({key,n,scene:await scene()});};
 const wait=async(s)=>p.waitForFunction(({x,s})=>(x==='A'?window.__NEON_TEMPEST__?.app.scene:x==='B'?window.__NEON__?.scene:window.__NT?.sceneName())===s,{x,s});
 const focus=async(sel)=>{for(let i=0;i<80;i++){if(await p.locator(sel).evaluate(e=>e===document.activeElement))return;await press('Tab');}throw Error('Unreachable '+sel);};
 try{
  await p.goto(`http://127.0.0.1:${6101+'ABC'.indexOf(x)}`);await wait(x==='C'?'TitleScene':'title');await p.waitForTimeout(900);await press('Enter');await p.waitForTimeout(1100);
  const main=x==='C'?'MainMenuScene':'menu';await wait(main);
  if(x==='B'){
   for(const mode of ['arcade','versus','training','trials']){await focus(`[data-action="mode:${mode}"]`);await press('Enter');await wait('character');trace.push({mode,reached:true});await press('Escape');await wait(main);}
   await focus('[data-action="replay"]');await press('Enter');trace.push({mode:'empty replay',stays_on_menu:(await scene())===main});
  }else if(x==='A'){
   for(let idx=0;idx<5;idx++){let current=await p.evaluate(()=>window.__NEON_TEMPEST__.app.menuIndex);if(current!==idx)await press('ArrowDown',(idx-current+8)%8);await press('Enter');await wait('char_select');trace.push({mode_index:idx,reached:true});await press('Escape');await wait(main);}
   let current=await p.evaluate(()=>window.__NEON_TEMPEST__.app.menuIndex);await press('ArrowDown',(5-current+8)%8);await press('Enter');trace.push({mode:'empty replay generates showcase',scene:await scene()});if((await scene())==='match'){await press('Escape');await press('ArrowDown',4);await press('Enter');await wait(main);}
  }else{
   for(let idx=0;idx<5;idx++){await press('Enter');await wait('ModeSelectScene');await p.waitForTimeout(650);if(idx)await press('ArrowRight',idx);await press('Enter');await wait('CharSelectScene');trace.push({mode_index:idx,reached:true});await press('Escape');await p.waitForTimeout(800);let count=0;while((await scene())!==main&&count++<3){await press('Escape');await p.waitForTimeout(800);}await wait(main);}
  }
  trace.push({completed:true,scene:await scene()});console.log(x,'all mode entries and back paths passed');
 }catch(e){trace.push({error:String(e)});console.error(x,e);}
 fs.writeFileSync(path.join(j,'logs',x,'menu-coverage.json'),JSON.stringify({label:x,method:'Real DOM keyboard only; mode entries followed by actual back paths; no injected menu index or scene',trace,issues},null,2));await p.close();
}await b.close();
