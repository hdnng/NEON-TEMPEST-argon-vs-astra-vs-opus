import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'../..'),j=path.join(root,'judging');
const require=createRequire(path.join(j,'work/B/package.json'));
const {chromium}=require('@playwright/test');
const label=process.argv[2],url=`http://127.0.0.1:${6101+'ABC'.indexOf(label)}`;
const browser=await chromium.launch({headless:true,channel:'chromium',args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-precise-memory-info']});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
await page.addInitScript(()=>{localStorage.setItem('neon-tempest-settings-v1',JSON.stringify({resolutionScale:1}));});
const errors=[],actions=[],captures=[];
page.on('pageerror',e=>errors.push({type:'pageerror',text:e.message}));
page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push({type:m.type(),text:m.text()});});
const log=()=>fs.writeFileSync(path.join(j,`logs/${label}/browser-flow.json`),JSON.stringify({label,url,actions,captures,errors},null,2));
const scene=()=>page.evaluate(x=>x==='A'?window.__NEON_TEMPEST__?.app.scene:x==='B'?window.__NEON__?.scene:window.__NT?.sceneName(),label);
const press=async(key,n=1,delay=180)=>{for(let i=0;i<n;i++){await page.keyboard.press(key);await page.waitForTimeout(delay);}actions.push({key,n,scene:await scene()});log();};
const wait=async(name)=>{await page.waitForFunction(({x,name})=>(x==='A'?window.__NEON_TEMPEST__?.app.scene:x==='B'?window.__NEON__?.scene:window.__NT?.sceneName())===name,{x:label,name},{timeout:22000});};
const shot=async(name,note='Captured from actual running UI; keyboard flow')=>{await page.screenshot({path:path.join(j,`screenshots/${label}/${name}.png`)});captures.push({name,note,scene:await scene(),time:new Date().toISOString()});log();console.log(label,name);};
const focus=async(selector)=>{for(let i=0;i<90;i++){if(await page.locator(selector).evaluate(e=>e===document.activeElement))return;await press('Tab',1,30);}throw Error('Could not keyboard-focus '+selector);};
async function fixture({mode='versus',stage=0,a='hayate',b='magnus',cpu=false}={}){
 await page.evaluate(({x,mode,stage,a,b,cpu})=>{
  if(x==='A')window.__NEON_TEMPEST__.app.launchMatch({p1Char:a,p2Char:b,stageId:['rooftop','alley','shrine'][stage],mode:mode==='versus'?'versus_2p':mode,skipIntro:mode!=='versus',cpuVsCpu:cpu});
  if(x==='B'){const n=window.__NEON__;n.start(a,b,mode,stage);n.game.cpuBoth=cpu;}
  if(x==='C')window.__NT.startMatch({mode,chars:[a,b],palettes:[0,0],stage:['rooftop','shrine','pit'][stage],cpu:[cpu,cpu],difficulty:2});
 },{x:label,mode,stage,a,b,cpu});
 await wait(label==='A'?'match':label==='B'?'match':'MatchScene'); await page.waitForTimeout(850);
}
try{
 await page.goto(url);await page.waitForFunction(x=>x==='A'?!!window.__NEON_TEMPEST__:x==='B'?!!window.__NEON__:!!window.__NT,label);
 await page.waitForTimeout(450);await shot('01-boot-logo');
 if((await scene()).toLowerCase().includes('boot'))await press('Enter',1,550);
 await wait(label==='C'?'TitleScene':'title');await page.waitForTimeout(2500);await shot('02-title');
 await press('Enter',1,750);await wait(label==='C'?'MainMenuScene':'menu');await shot('03-main-menu');
 if(label==='B'){
  for(const [action,name] of [['moves','12-move-list'],['settings','13-settings'],['howto',null]]){
   await focus(`[data-action="${action}"]`);await press('Enter',1,500);await wait(action);if(name)await shot(name);await press('Escape',1,400);
  }
  for(const mode of ['arcade','trials']){await focus(`[data-action="mode:${mode}"]`);await press('Enter');await wait('character');await press('Escape');}
  await focus('[data-action="mode:versus"]');await press('Enter',1,600);await wait('character');await shot('04-character-select');
  await press('Enter',2,300);await wait('stage');await shot('05-stage-select');
  await focus('[data-action="stage:0"]');await press('Enter',1,400);await wait('versus');await shot('06-versus-splash');await wait('match');
 }else if(label==='A'){
  await press('ArrowDown',6);await press('Enter',1,400);await wait('movelist');await shot('12-move-list');await press('Escape',1,350);
  await press('ArrowDown',1);await press('Enter',1,450);await wait('settings');await shot('13-settings');await press('Escape',1,350);
  await press('ArrowUp',6);await press('Enter',1,500);await wait('char_select');await shot('04-character-select');
  await press('Enter',2,220);await wait('stage_select');await shot('05-stage-select');await press('Enter',1,450);await wait('versus_splash');await shot('06-versus-splash');await press('Enter',1,250);await wait('match');
 }else{
  await press('ArrowDown',2);await press('Enter',1,850);await wait('MoveListScene');await shot('12-move-list');await press('Escape',1,850);
  await press('ArrowDown',3);await press('Enter',1,850);await wait('SettingsScene');await shot('13-settings');await press('KeyE',4,200);await press('Escape',1,850);
  await press('ArrowDown',4);await press('Enter',1,850);await wait('CreditsScene');await press('Escape',1,850);
  await press('Enter',1,850);await wait('ModeSelectScene');await shot('20-mode-select');await press('ArrowRight',2);await press('Enter',1,950);await wait('CharSelectScene');await shot('04-character-select');
  await press('Enter',3,650);await wait('StageSelectScene');await shot('05-stage-select');await press('Enter',1,1000);await wait('VersusScene');await shot('06-versus-splash');await wait('MatchScene');
 }
 await shot('07-match-hud-start');
 await press('Escape',1,500);await shot('19-pause-menu');await press('Escape',1,400);
 const sizes=[];
 for(const vp of [{width:800,height:900},{width:2560,height:1080},{width:1920,height:1080}]){
  await page.setViewportSize(vp);await page.waitForTimeout(400);
  sizes.push(await page.evaluate(()=>({viewport:[innerWidth,innerHeight],canvas:[...document.querySelectorAll('canvas')].map(c=>({pixels:[c.width,c.height],rect:c.getBoundingClientRect().toJSON()})),bodyScroll:[document.body.scrollWidth,document.body.scrollHeight]})));
 }
 fs.writeFileSync(path.join(j,`logs/${label}/resize.json`),JSON.stringify(sizes,null,2));
 for(let stage=0;stage<3;stage++){await fixture({stage});await page.waitForTimeout(800);await shot(`1${5+stage}-stage-${stage+1}`,'Controlled stage fixture; original rendering; standard starting health/meter');}
 await fixture({mode:'training'});await page.waitForFunction(x=>(x==='A'?window.__NEON_TEMPEST__.app.matchState:x==='B'?window.__NEON__.state:window.__NT.match())?.phase==='fight',label);await page.waitForTimeout(1600);
 await page.evaluate(x=>{if(x==='A'){const a=window.__NEON_TEMPEST__.app;a.training.showHitboxes=true;a.training.showInputHistory=true;}if(x==='B'){const a=window.__NEON__.game;a.renderer.settings.hitboxes=true;a.renderer.settings.inputs=true;}if(x==='C')window.__NT.showHitboxes(true);},label);
 await shot('11-training-hitboxes','Actual training mode, enabled overlay through exposed settings; no synthesized game art');
 await fixture({mode:'trials'});await shot('21-trials','Actual trial mode fixture; no completion injected');
 // Independent keyboard QCF execution in the real game, from neutral training state.
 await fixture({mode:'training'});
 await page.keyboard.down('KeyS');await page.waitForTimeout(55);await page.keyboard.down('KeyD');await page.waitForTimeout(55);await page.keyboard.up('KeyS');
 await page.keyboard.down(label==='B'?'KeyJ':'KeyU');await page.waitForTimeout(55);await page.keyboard.up(label==='B'?'KeyJ':'KeyU');await page.keyboard.up('KeyD');
 const qcf=await page.evaluate(x=>x==='A'?window.__NEON_TEMPEST__.app.matchState:x==='B'?window.__NEON__.state:window.__NT.match(),label);
 fs.writeFileSync(path.join(j,`logs/${label}/keyboard-qcf-state.json`),JSON.stringify(qcf,null,2));
 await page.waitForTimeout(500);await shot('22-keyboard-qcf','Actual DOM keyboard QCF input (S, S+D, D+punch)');
 // Hidden-tab event path: emulate visibility property because headless pages lack a physical tab.
 await fixture();await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 const hidden1=await page.evaluate(x=>x==='A'?{paused:window.__NEON_TEMPEST__.app.isPaused,frame:window.__NEON_TEMPEST__.app.matchState.frame}:x==='B'?{scene:window.__NEON__.scene,frame:window.__NEON__.state.frame}:{paused:window.__NT.matchScene()?.paused,frame:window.__NT.match()?.frame},label);
 await page.waitForTimeout(600);
 const hidden2=await page.evaluate(x=>x==='A'?{paused:window.__NEON_TEMPEST__.app.isPaused,frame:window.__NEON_TEMPEST__.app.matchState.frame}:x==='B'?{scene:window.__NEON__.scene,frame:window.__NEON__.state.frame}:{paused:window.__NT.matchScene()?.paused,frame:window.__NT.match()?.frame},label);
 fs.writeFileSync(path.join(j,`logs/${label}/visibility.json`),JSON.stringify({method:'document.hidden mocked true + visibilitychange; not real OS tab hiding',before:hidden1,after:hidden2},null,2));
 log();
}catch(e){actions.push({error:String(e),stack:e.stack});log();console.error(e);process.exitCode=1;}
finally{await browser.close();}
