import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const root=path.resolve(import.meta.dirname,'../..');
const label=process.argv[2]; const work=path.join(root,'judging/work',label);
const imp=(f:string)=>import(pathToFileURL(path.join(work,f)).href);
const ids=['hayate','magnus','sable','warden'];
const digest=(s:any)=>createHash('sha256').update(JSON.stringify(s)).digest('hex');
let make:any,step:any,brain:any,ai:any,done:any,winner:any,raw:any;
if(label==='A') {
  const sim=await imp('src/core/simulation.ts'), cpu=await imp('src/ai/cpuController.ts');
  make=(a:string,b:string,seed:number)=>sim.createMatchState({p1Char:a,p2Char:b,stageId:'rooftop',seed,roundsToWin:2,skipIntro:false});
  step=(s:any,u:any)=>sim.stepMatch(s,u[0],u[1]);
  brain=(i:number,seed:number)=>new cpu.CpuController('hard'); ai=(s:any,i:number,b:any)=>b.getInput(s,i);
  done=(s:any)=>s.phase==='match_over'; winner=(s:any)=>s.p1RoundsWon===s.p2RoundsWon?-1:s.p1RoundsWon>s.p2RoundsWon?0:1;
  raw=(d:number,bs:string[],f:number)=>cpu.buildRawInputFromNumpad(d,f,Object.fromEntries(bs.map(x=>[x.toLowerCase(),true])));
} else if(label==='B') {
  const sim=await imp('src/core/sim.ts'), cpu=await imp('src/ai/cpu.ts'), types=await imp('src/core/types.ts');
  make=(a:string,b:string,seed:number)=>sim.createMatch(a,b,seed);
  step=sim.step; brain=(i:number,seed:number)=>cpu.createBrain(seed^(i?0xa2a2:0x5151),2); ai=cpu.cpu;
  done=(s:any)=>s.phase==='complete'; winner=(s:any)=>s.winner;
  raw=(d:number,bs:string[],f:number)=>({x:([1,4,7].includes(d)?-1:[3,6,9].includes(d)?1:0)*f,y:[1,2,3].includes(d)?1:[7,8,9].includes(d)?-1:0,buttons:bs.reduce((v,x)=>v|types.bit(x),0)});
} else if(label==='C') {
  await imp('src/data/characters/index.ts');
  const sim=await imp('src/sim/match.ts'), cpu=await imp('src/ai/cpu.ts'), inp=await imp('src/sim/input.ts');
  make=(a:string,b:string,seed:number)=>sim.createMatch(sim.defaultConfig({chars:[a,b],palettes:[0,a===b?1:0],seed,stage:'rooftop'}));
  step=sim.stepMatch; brain=(i:number,seed:number)=>new cpu.CpuController(i,2,seed^(i?0xa2a2:0x5151)); ai=(s:any,i:number,b:any)=>b.next(s,i);
  done=(s:any)=>s.phase==='matchEnd'; winner=(s:any)=>s.matchWinner;
  raw=(d:number,bs:string[],f:number)=>(([7,8,9].includes(d)?inp.UP:0)|([1,2,3].includes(d)?inp.DOWN:0)|([1,4,7].includes(d)?(f===1?inp.LEFT:inp.RIGHT):0)|([3,6,9].includes(d)?(f===1?inp.RIGHT:inp.LEFT):0)|bs.reduce((v,x)=>v|inp[x],0));
} else throw Error('Use A/B/C');
const replay:any[]=[]; let rseed=0x13572468;
for(let frame=0;frame<7200;frame++) {
  rseed^=rseed<<13;rseed^=rseed>>>17;rseed^=rseed<<5;
  const u=(i:number)=>raw(1+((rseed>>>(i*8))%9),frame%11===0?[['LP','MP','HP','LK','MK','HK'][(rseed>>>(i*3))%6]]:[],i===0?1:-1);
  replay.push([u(0),u(1)]);
}
const s1=make('hayate','warden',774921),s2=make('hayate','warden',774921);
let firstDifference=-1;
for(let i=0;i<replay.length;i++){step(s1,replay[i]);step(s2,replay[i]);if(digest(s1)!==digest(s2)&&firstDifference<0) firstDifference=i;}
const checkpoint=JSON.parse(JSON.stringify(s1));const restored=JSON.parse(JSON.stringify(s1));
for(let i=0;i<300;i++){step(checkpoint,replay[i]);step(restored,replay[i]);}
const determinism={frames:7200,seed:774921,firstDifference,pass:firstDifference===-1,hash1:digest(s1),hash2:digest(s2),serialization_roundtrip: digest(checkpoint)===digest(restored),inputs_sha256:digest(replay)};
fs.writeFileSync(path.join(root,`judging/logs/${label}/determinism.json`),JSON.stringify(determinism,null,2));
fs.writeFileSync(path.join(root,`judging/logs/${label}/replay-inputs.json`),JSON.stringify(replay));
console.log(label,'determinism',determinism.pass);
const perPair=Number(process.argv[3]??32), maxSteps=36000;
const matches:any[]=[];const start=performance.now();
for(let a=0;a<4;a++) for(let b=0;b<4;b++){
  for(let k=0;k<perPair;k++){
    const seed=19831+k*317+a*7919+b*1301,s=make(ids[a],ids[b],seed),bs=[brain(0,seed),brain(1,seed)];
    let frames=0,error=null; const activity:any={};
    try {while(!done(s)&&frames<maxSteps){step(s,[ai(s,0,bs[0]),ai(s,1,bs[1])]);frames++;
      for(const e of s.events??[]) {const t=e.type??e.kind??'other';activity[t]=(activity[t]??0)+1;}
      if(s.fighters.some((f:any)=>!Number.isFinite(f.hp)||!Number.isFinite(f.x)||f.meter<0||f.meter>300.001))throw Error('State invariant failed');
    }} catch(e){error=String(e);}
    matches.push({a:ids[a],b:ids[b],seed,steps:frames,simulation_frame:s.frame,winner:done(s)?winner(s):-2,completed:done(s),error,activity});
  }
  console.log(label,ids[a],ids[b],matches.length);
}
const completed=matches.filter(x=>x.completed&&!x.error), matrix=ids.map(a=>ids.map(b=>{let m=completed.filter(x=>x.a===a&&x.b===b);return{matches:m.length,p1Wins:m.filter(x=>x.winner===0).length,p2Wins:m.filter(x=>x.winner===1).length,draws:m.filter(x=>x.winner===-1).length,win_percent:m.length?100*m.reduce((s,x)=>s+(x.winner===0?1:x.winner===-1?.5:0),0)/m.length:null}}));
const winRates=ids.map(id=>{const m=completed.filter(x=>x.a!==x.b&&(x.a===id||x.b===id));return {id,matches:m.length,percent:100*m.reduce((s,x)=>s+(x.winner===-1?.5:x.winner===(x.a===id?0:1)?1:0),0)/m.length}});
const report={label,perPair,attempted:matches.length,completed:completed.length,crashes:matches.filter(x=>x.error).length,softlocks:matches.filter(x=>!x.completed&&!x.error).length,average_match_seconds:completed.reduce((s,x)=>s+x.steps,0)/completed.length/60,elapsed_seconds:(performance.now()-start)/1000,winRates,matrix,determinism,matches};
fs.writeFileSync(path.join(root,`judging/logs/${label}/independent-balance.json`),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,matches:undefined},null,2));
