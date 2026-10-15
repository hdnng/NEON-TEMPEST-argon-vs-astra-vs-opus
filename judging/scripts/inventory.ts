import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';
const root=path.resolve(import.meta.dirname,'../..'),j=path.join(root,'judging');
for(const x of ['B','C','A']){
 const imp=(p:string)=>import(pathToFileURL(path.join(j,'work',x,p)).href);
 const data=await imp(x==='A'?'src/data/characters.ts':x==='B'?'src/characters/data.ts':'src/data/characters/index.ts');
 const list=x==='B'?Object.values(data.CHARACTERS):data.CHARACTER_LIST;
 const out=(list as any[]).map(c=>{const moves=Array.isArray(c.moves)?c.moves:Object.values(c.moves);return{id:c.id,hp:c.maxHp??c.hp,normal_count:moves.filter((m:any)=>(m.category??m.kind??m.type)==='normal').length,total_moves:moves.length,types:moves.reduce((o:any,m:any)=>{const k=m.category??m.kind??m.type;o[k]=(o[k]??0)+1;return o;},{}),trials:c.trials?.length,moves:moves.map((m:any)=>({id:m.id,type:m.category??m.kind??m.type,input:m.inputNotation??m.input,button:m.button,motion:m.motion,startup:m.startup,active:m.active,recovery:m.recovery,hitstop:m.hitstop,hits:m.hits?.map((h:any)=>({damage:h.damage??h.dmg,frames:h.frames})),per_frame_overrides:m.boxes?.frameOverrides?.length??0}))};});
 fs.writeFileSync(path.join(j,'logs',x,'roster-inventory.json'),JSON.stringify(out,null,2));console.log(x,out.map(c=>({id:c.id,hp:c.hp,normal_count:c.normal_count,total_moves:c.total_moves,trials:c.trials,types:c.types})));
}
