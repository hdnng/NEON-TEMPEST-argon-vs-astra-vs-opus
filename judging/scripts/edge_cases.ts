import fs from 'node:fs';import path from 'node:path';import{pathToFileURL}from'node:url';
const root=path.resolve(import.meta.dirname,'../..'),j=path.join(root,'judging');
for(const x of ['B','C','A']){
 const imp=(p:string)=>import(pathToFileURL(path.join(j,'work',x,p)).href);let make:any,step:any,raw:any,move:any,parse:any;
 if(x==='A'){
  const sim=await imp('src/core/simulation.ts'),cp=await imp('src/ai/cpuController.ts'),inp=await imp('src/input/inputBuffer.ts');
  make=(a='hayate',b='magnus')=>sim.createMatchState({p1Char:a,p2Char:b,stageId:'rooftop',skipIntro:true,seed:19831});step=(s:any,u:any)=>sim.stepMatch(s,u[0],u[1]);raw=(d=5,bs:string[]=[],f=1)=>cp.buildRawInputFromNumpad(d,f,Object.fromEntries(bs.map(b=>[b.toLowerCase(),true])));move=(f:any)=>f.currentMoveId;
  parse=(dirs:number[])=>{const s=make(),f=s.fighters[0];dirs.forEach((d,i)=>inp.pushInputFrame(f,raw(d),i+1));return inp.checkMotionInput(f,'360');};
 }else if(x==='B'){
  const sim=await imp('src/core/sim.ts'),ty=await imp('src/core/types.ts'),inp=await imp('src/input/motions.ts');
  make=(a='hayate',b='magnus')=>{const s=sim.createMatch(a,b,19831);s.phase='fight';s.fighters[0].x=710;s.fighters[1].x=770;return s;};step=sim.step;raw=(d=5,bs:string[]=[],f=1)=>({x:([1,4,7].includes(d)?-1:[3,6,9].includes(d)?1:0)*f,y:[1,2,3].includes(d)?1:[7,8,9].includes(d)?-1:0,buttons:bs.reduce((s,b)=>s|ty.bit(b),0)});move=(f:any)=>f.move;
  parse=(dirs:number[])=>{const input=inp.createInput();dirs.forEach((d,i)=>inp.poll(input,raw(d),1,i+1));return inp.motion(input,'360');};
 }else{
  const sim=await imp('src/sim/match.ts'),inp=await imp('src/sim/input.ts');
  make=(a='hayate',b='magnus')=>{const s=sim.createMatch(sim.defaultConfig({chars:[a,b],seed:19831,skipIntro:true}));sim.stepMatch(s,[0,0]);s.fighters[0].x=-3000;s.fighters[1].x=3000;return s;};step=sim.stepMatch;raw=(d=5,bs:string[]=[],f=1)=>([7,8,9].includes(d)?1:0)|([1,2,3].includes(d)?2:0)|([1,4,7].includes(d)?(f===1?4:8):0)|([3,6,9].includes(d)?(f===1?8:4):0)|bs.reduce((v,b)=>v|inp[b],0);move=(f:any)=>f.move;
  parse=(dirs:number[])=>{const s=make(),f=s.fighters[0];dirs.forEach(d=>inp.pushInput(f,raw(d)));return inp.matchMotion(f,'360',0)>=0;};
 }
 const neutral=raw();
 const invalid=[6,4,2,8];let invalidAccepted:any;
 try{invalidAccepted=parse(invalid);}catch(e){invalidAccepted={error:String(e)};}
 const hcf=make('magnus','hayate');for(const d of [4,1,2,3])step(hcf,[raw(d),neutral]);step(hcf,[raw(6,['HP']),neutral]);const hcfMove=move(hcf.fighters[0]);
 const techAttempts=[];
 for(let delay=0;delay<15;delay++){
  const s=make();if(x==='A'){s.fighters[0].x=-30;s.fighters[1].x=30;}
  const hp=s.fighters.map((f:any)=>f.hp);const events:any[]=[];const trace:any[]=[];
  for(let f=0;f<65;f++){
   step(s,[raw(5,f===0?['LP','LK']:[]),raw(5,f===delay?['LP','LK']:[],-1)]);
   events.push(...structuredClone(s.events));if(f<15)trace.push({frame:f,moves:s.fighters.map(move),hp:s.fighters.map((z:any)=>z.hp),inputUsed:s.fighters.map((z:any)=>z.input?.used)});
  }
  techAttempts.push({delay,hpStart:hp,hpEnd:s.fighters.map((f:any)=>f.hp),tech:events.some(e=>/tech/.test(e.type??e.t)),events,trace});
 }
 const report={label:x,invalid_360:{directions:invalid,accepted:invalidAccepted,expected:false},hcf_punch:{directions:[4,1,2,3,6],button:'HP',selected:hcfMove,note:'Only A documents this binding as a command grab; B and C use a different HCF binding.'},techAttempts,teched:techAttempts.filter(t=>t.tech).length};
 fs.writeFileSync(path.join(j,'logs',x,'edge-cases.json'),JSON.stringify(report,null,2));console.log(x,JSON.stringify({invalidAccepted,hcfMove,techSuccesses:report.teched}));
}
