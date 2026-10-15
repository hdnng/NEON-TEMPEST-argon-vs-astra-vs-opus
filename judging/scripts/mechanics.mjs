import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'../..'),j=path.join(root,'judging'),label=process.argv[2];
const require=createRequire(path.join(j,'work/B/package.json'));const {chromium}=require('@playwright/test');
const urls={A:'http://localhost:5123',B:'http://127.0.0.1:5173',C:'http://localhost:5173'};
const browser=await chromium.launch({headless:true,channel:'chromium',args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-precise-memory-info']});const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
await page.addInitScript(()=>{localStorage.setItem('neon-tempest-settings-v1',JSON.stringify({resolutionScale:1}));});
const consoleLog=[];page.on('pageerror',e=>consoleLog.push(String(e)));page.on('console',m=>{if(['error','warning'].includes(m.type()))consoleLog.push(m.type()+': '+m.text());});
const findings=[];const captures=[];
async function shot(name,note){await page.screenshot({path:path.join(j,`screenshots/${label}/${name}.png`)});captures.push({name,note});}
async function op(fn,arg){return page.evaluate(fn,arg);}
try{
 await page.goto(urls[label]);await page.waitForFunction(x=>x==='A'?!!window.__NEON_TEMPEST__:x==='B'?!!window.__NEON__:!!window.__NT,label);
 await page.evaluate(async x=>{
  let g,sim,chars,raw,reset,step,render;const log=[];
  if(x==='A'){
   g=window.__NEON_TEMPEST__.app;g.fixedUpdate=()=>{};const originalRender=g.render.bind(g);g.render=()=>{};
   sim=await import('/src/core/simulation.ts');const cp=await import('/src/ai/cpuController.ts');chars=(await import('/src/data/characters.ts')).CHARACTERS;
   raw=(d=5,bs=[],f=1)=>cp.buildRawInputFromNumpad(d,f,Object.fromEntries(bs.map(b=>[b.toLowerCase(),true])));
   reset=(a='hayate',b='magnus',dist=70,mode='versus')=>{g.launchMatch({p1Char:a,p2Char:b,stageId:'rooftop',mode:mode==='versus'?'versus_2p':mode,skipIntro:true});g.transitionAlpha=0;g.matchState.fighters[0].x=-dist/2;g.matchState.fighters[1].x=dist/2;window.J.s=g.matchState;};
   step=(a,b)=>{sim.stepMatch(g.matchState,a,b);g.prevMatchState=structuredClone(g.matchState);g.vfx.processSimEvents(g.matchState.events);g.vfx.update();g.sceneFrame++;};
   render=()=>originalRender(1);
  }else if(x==='B'){
   g=window.__NEON__.game;g.loop=()=>{};g.simTick=()=>{};sim=await import('/src/core/sim.ts');chars=(await import('/src/characters/data.ts')).CHARACTERS;const ty=await import('/src/core/types.ts');
   raw=(d=5,bs=[],f=1)=>({x:([1,4,7].includes(d)?-1:[3,6,9].includes(d)?1:0)*f,y:[1,2,3].includes(d)?1:[7,8,9].includes(d)?-1:0,buttons:bs.reduce((v,b)=>v|ty.bit(b),0)});
   reset=(a='hayate',b='magnus',dist=70,mode='versus')=>{window.__NEON__.start(a,b,mode,0);g.state.rules.infiniteHealth=false;g.state.rules.infiniteMeter=false;g.state.phase='fight';g.state.phaseFrames=0;g.state.fighters[0].x=740-dist/2;g.state.fighters[1].x=740+dist/2;window.J.s=g.state;};
   step=(a,b)=>{sim.step(g.state,[a,b]);for(const e of g.state.events)g.renderer.handle(e);g.time+=1/60;g.renderer.render(g.time,1/60,g.scene,g.stage,g.state,g.selected);g.updateUI();};
   render=()=>{g.renderer.render(g.time,1/60,g.scene,g.stage,g.state,g.selected);g.updateUI();};
  }else{
   g=window.__NT.app;g.loop.stop();sim=await import('/src/sim/match.ts');chars=(await import('/src/sim/registry.ts')).CHARACTERS;const inp=await import('/src/sim/input.ts');const {MatchScene}=await import('/src/scenes/match/matchScene.ts');
   raw=(d=5,bs=[],f=1)=>(([7,8,9].includes(d)?inp.UP:0)|([1,2,3].includes(d)?inp.DOWN:0)|([1,4,7].includes(d)?(f===1?inp.LEFT:inp.RIGHT):0)|([3,6,9].includes(d)?(f===1?inp.RIGHT:inp.LEFT):0)|bs.reduce((v,b)=>v|inp[b],0));
   reset=(a='hayate',b='magnus',dist=70,mode='versus')=>{const m=new MatchScene({mode,chars:[a,b],palettes:[0,0],stage:'rooftop',cpu:[false,false],difficulty:2});g.scenes.go(m,'none');m.s.config.skipIntro=true;m.s.config.training=false;m.s.fighters[0].x=-dist*50;m.s.fighters[1].x=dist*50;window.J.s=m.s;};
   step=(a,b)=>{const m=window.__NT.matchScene();m.inputQueue[0].push(a);m.inputQueue[1].push(b);m.tick();m.time+=1/60;};
   render=()=>{g.view.begin();g.scenes.current.render(g.view.ctx,1);g.view.end();};
  }
  const scaling=x==='C'?(await import('/src/sim/combat.ts')).comboScale:null;
  const ResultsScene=x==='C'?(await import('/src/scenes/results.ts')).ResultsScene:null;
  window.J={x,g,chars,raw,scaling,ResultsScene,reset0:reset,step0:step,render,s:null,events:[],frames:[],
   reset(a='hayate',b='magnus',dist=70,mode='versus'){reset(a,b,dist,mode);this.events=[];this.frames=[];for(let i=0;i<300&&this.s.phase!=='fight';i++)this.step();this.run(120);this.events=[];this.frames=[];},
   step(d=5,bs=[],d2=5,bs2=[]){step(raw(d,bs,1),raw(d2,bs2,-1));this.events.push(...structuredClone(this.s.events));const snap=this.snapshot();this.frames.push(snap);return snap;},
   run(n,d=5,bs=[],d2=5,bs2=[]){for(let i=0;i<n;i++)this.step(d,bs,d2,bs2);return this.snapshot();},
   snapshot(){return {phase:this.s.phase,timer:this.s.timer??this.s.roundTimerFrames,round:this.s.round,freeze:this.s.freeze??this.s.screenFreezeFrames??this.s.hitstop,f:this.s.fighters.map(f=>({hp:f.hp,meter:f.meter,x:f.x,y:f.y,vy:f.vy,state:f.status??f.pose??f.state,move:f.currentMoveId??f.move,moveFrame:f.moveFrame??f.mf,combo:f.comboCounter??f.combo,damage:f.comboDamage??f.comboDmg,scale:f.comboScaling??f.comboScale,jumps:f.airJumpsLeft??f.jumps??f.airJumps,airDash:f.airDash??f.airDashesLeft??f.airDashes,invincible:f.invulnFrames??f.invincible??f.invuln,lastMove:f.lastMove}))};},
   type(e){return e.type??e.t;},
  };
 },label);
 const test=async(name,fn,arg)=>{const result=await op(fn,arg);findings.push({name,...result});console.log(label,name,result.pass);return result;};
 await test('QCF projectile',()=>{const j=window.J;j.reset('hayate','magnus',260);j.step(2);j.step(3);j.step(6,['LP']);const triggered=j.snapshot();j.run(80);const events=j.events;return{pass:events.some(e=>/projectile|proj/.test(j.type(e))),triggered,end:j.snapshot(),events};});
 await test('DP startup invincibility',()=>{const j=window.J;j.reset('hayate','hayate',65);const initial=j.snapshot();j.run(15,5,[],5,['LP']);const control=j.snapshot();j.reset('hayate','hayate',65);j.step(6);j.step(2);j.step(3,['HP'],5,['LP']);j.run(12);return{pass:j.snapshot().f[0].hp===initial.f[0].hp&&control.f[0].hp<initial.f[0].hp&&j.frames.some(f=>/rising|rise|dp|special1/i.test(f.f[0].move??'')),control,end:j.snapshot(),events:j.events};});
 await test('Throw and throw tech',()=>{const j=window.J;j.reset('hayate','magnus',55);const hp=j.s.fighters[1].hp;j.step(5,['LP','LK']);j.run(65);const throwEnd=j.snapshot(),thrown=j.s.fighters[1].hp<hp,throwEvents=j.events;let teched=false,techEvents=[],delayFound=null;
  for(let delay=0;delay<15&&!teched;delay++){j.reset('hayate','magnus',55);j.step(5,['LP','LK']);j.run(delay);j.step(5,[],5,['LP','LK']);j.run(45);if(j.events.some(e=>/tech/.test(j.type(e)))){teched=true;techEvents=j.events;delayFound=delay;}}
  return{pass:thrown&&teched,thrown,teched,delayFound,throwEnd,throwEvents,techEvents};});
 await test('High and low guard',()=>{const j=window.J;const results=[];for(const [d,bs,guard]of [[5,['HP'],4],[2,['LK'],1],[2,['LK'],4]]){j.reset('hayate','magnus',65);const hp=j.s.fighters[1].hp;j.step(d,bs,guard);j.run(40,5,[],guard);results.push({attack:[d,bs],guard,damage:hp-j.s.fighters[1].hp,blocked:j.events.some(e=>/block/.test(j.type(e))),events:j.events});}return{pass:results[0].blocked&&results[1].blocked&&results[2].damage>0,results};});
 await test('Combo counter and damage scaling',()=>{const j=window.J;let best=null;for(let delay=1;delay<30;delay++){j.reset('hayate','magnus',60);j.step(2,['LK']);j.run(delay,2);j.step(2,['LP']);j.run(8,2);j.step(1);j.step(4,['LK']);j.run(65);const frames=j.frames;const max=Math.max(...frames.flatMap(f=>f.f.map(z=>z.combo??0)));const scaled=frames.some(f=>f.f.some(z=>z.scale!==undefined&&z.scale<1))||(max>=3&&j.scaling?.(max,false)<100);if(max>=2){best={delay,max,scaled,scale_percent:j.scaling?.(max,false),end:j.snapshot(),events:j.events};if(scaled)break;}}return{pass:!!best?.scaled,best};});
 await test('Super meter gain and Super Art',()=>{const j=window.J;j.reset('hayate','magnus',70);j.step(5,['LP']);j.run(50);const earned=j.s.fighters[0].meter;j.reset('hayate','magnus',90);j.s.fighters[0].meter=300;for(const d of [2,3,6,2,3])j.step(d);j.step(6,['LP']);const activation=j.snapshot();j.render();return{pass:earned>0&&(activation.f[0].meter<300||j.events.some(e=>/super/.test(j.type(e)))),earned,activation,events:j.events};});
 await op(()=>{const j=window.J;j.run(Math.floor((j.s.screenFreezeFrames??j.s.freeze??j.s.hitstop??30)*.7));j.render();});
 await shot('09-super-active','Controlled fixture: 300 meter and spacing; Super Art triggered through double-QCF+LP inputs; captured at seventy percent of initial super freeze');
 await op(()=>{window.J.run(50);window.J.render();});await shot('23-super-followthrough','Same Super Art after simulation advances');
 await test('Timer and time-over',()=>{const j=window.J;j.reset('hayate','magnus',260);const t=j.snapshot().timer;j.run(120);const later=j.snapshot().timer;
  if(j.x==='A')j.s.roundTimerFrames=1;if(j.x==='B')j.s.timer=1;if(j.x==='C'){j.s.timer=1;j.s.timerSub=59;}
  j.s.fighters[1].hp=100;j.run(3);return{pass:later<t&&j.s.phase!=='fight',timerBefore:t,timerAfter:later,end:j.snapshot(),events:j.events};});
 await test('KO and round transition',()=>{const j=window.J;j.reset('hayate','magnus',60);j.s.fighters[1].hp=1;j.step(5,['HP']);let i=0;while(j.s.phase==='fight'&&i++<90)j.step();const ko=j.snapshot();j.render();return{pass:j.s.phase!=='fight'&&j.s.fighters[1].hp<=0,ko,events:j.events};});
 await op(()=>{window.J.run(20);window.J.render();});
 await shot('10-ko-round-end','Controlled fixture: defender begins at 1 HP; normal attack causes actual KO; twenty frames into KO presentation');
 await test('Next round starts',()=>{const j=window.J;const before=j.s.round??j.s.currentRound;j.run(600);return{pass:j.s.phase==='fight'&&j.s.fighters[1].hp>0,before,end:j.snapshot()};});
 // Obtain a genuine multi-hit super for the combo image. Search timing only, never set combo values.
 const comboCapture=await op(()=>{const j=window.J;let found=false,delay=0;for(delay=1;delay<30&&!found;delay++){j.reset('hayate','magnus',60);j.step(2,['LK']);j.run(delay,2);j.step(2,['LP']);for(let i=0;i<40;i++){j.step(2);if(j.s.fighters.some(f=>(f.comboCounter??f.combo??0)>=2)){found=true;break;}}}j.render();return{found,delay,end:j.snapshot(),events:j.events};});
 fs.writeFileSync(path.join(j,`logs/${label}/combo-capture.json`),JSON.stringify(comboCapture,null,2));
 await shot('08-mid-combo','Actual 2LK > 2LP connected combo through raw inputs; no combo counter or damage values injected');
 await test('Warden charge move',()=>{const j=window.J;j.reset('warden','magnus',300);j.run(45,1);j.step(6,['LP']);const trigger=j.snapshot();j.run(50);return{pass:j.events.some(e=>/projectile|proj/.test(j.type(e))),trigger,end:j.snapshot(),events:j.events};});
 await test('Magnus command grab',()=>{const j=window.J;j.reset('magnus','hayate',55);const hp=j.s.fighters[1].hp;for(const d of [6,2,4])j.step(d);j.step(8,['HP']);const trigger=j.snapshot();j.run(100);return{pass:j.s.fighters[1].hp<hp&&j.events.some(e=>/throw|grab/.test(j.type(e))),motion:'360 (6,2,4,8+HP)',trigger,damage:hp-j.s.fighters[1].hp,events:j.events};});
 await test('Sable double jump or air dash',()=>{const j=window.J;j.reset('sable','magnus',260);j.step(8);j.run(12);const before=j.snapshot();j.step(8);j.run(3);const after=j.snapshot();j.step(6);j.step(5);j.step(6);j.run(3);const jumps=j.events.filter(e=>/jump/.test(j.type(e))).length,dashes=j.events.filter(e=>/dash/.test(j.type(e))).length;return{pass:jumps>=2||dashes>=1,before,after,end:j.snapshot(),jumps,dashes,events:j.events};});
 await op(()=>{const j=window.J;j.reset('hayate','magnus',180,'training');if(j.x==='A'){j.g.training.showHitboxes=true;j.g.training.showFrameData=true;j.g.training.showInputHistory=true;}if(j.x==='B'){j.g.renderer.settings.hitboxes=true;j.g.renderer.settings.inputs=true;}if(j.x==='C')window.__NT.showHitboxes(true);j.step(5,['HP']);const id=j.snapshot().f[0].move,c=j.chars.hayate,m=Array.isArray(c.moves)?c.moves.find(z=>z.id===id):c.moves[id];j.run(Math.max(0,m.startup-1));j.render();});
 await shot('11-training-hitboxes','Actual training mode paused on an active heavy normal through raw input; hurtbox, hitbox and spacing fixtures');
 // Six equally spaced simulation samples of QCF LP: all are actual captured game frames.
 await op(()=>{const j=window.J;j.reset('hayate','magnus',340);if(j.x==='B'){j.g.renderer.settings.hitboxes=false;j.g.renderer.settings.inputs=false;}j.step(2);j.step(3);j.step(6,['LP']);j.render();});
 for(let f=0;f<6;f++){if(f)await op(()=>{window.J.run(5);window.J.render();});await shot(`animation-${f+1}`,'Actual QCF LP, 5 simulation frames between samples');}
 // Complete a real match via two low-life KO fixtures so the actual results screen can render.
 await op(()=>{const j=window.J;j.reset('hayate','magnus',60);for(let r=0;r<2;r++){j.s.fighters[1].hp=1;j.step(5,['HP']);j.run(550);if(r===0){const c=j.x==='B'?740:0,sc=j.x==='C'?100:1;j.s.fighters[0].x=(c-30)*sc;j.s.fighters[1].x=(c+30)*sc;}}if(j.x==='A'){j.g.fixedUpdate=()=>{};j.g.changeScene('results');j.g.transitionAlpha=0;}if(j.x==='B')j.g.show('results');if(j.x==='C'){const m=window.__NT.matchScene();j.g.scenes.go(new j.ResultsScene(m),'none');for(let i=0;i<60;i++)j.g.scenes.update();}j.render();});
 await shot('14-results','Actual match results after two KO rounds with low-life fixtures; no wins or outcome values set directly');
}catch(e){findings.push({harness_error:String(e),stack:e.stack});console.error(e);process.exitCode=1;}
finally{fs.writeFileSync(path.join(j,`logs/${label}/combat-spotchecks.json`),JSON.stringify({label,method:'Same real simulation input procedure, in running browser; deterministic fixture spacing/health/meter/timer; no direct move, hit, damage, combo, or winner injection',findings,captures,consoleLog},null,2));await browser.close();}
