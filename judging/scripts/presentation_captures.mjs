import fs from'node:fs';import path from'node:path';import{createRequire}from'node:module';
const root=path.resolve(import.meta.dirname,'../..'),j=path.join(root,'judging'),require=createRequire(path.join(j,'work/B/package.json')),{chromium}=require('@playwright/test');
const b=await chromium.launch({headless:true,channel:'chromium',args:['--use-angle=d3d11','--enable-gpu','--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-precise-memory-info']});
const captures=[];
for(const [file,query,id,frames]of [
 ['01-boot-logo','','BootScene',105],['02-title','?scene=title','TitleScene',150],['03-main-menu','?scene=menu','MainMenuScene',95],
 ['04-character-select','?scene=select&mode=cpu','CharSelectScene',90],['05-stage-select','?scene=stage&mode=cpu','StageSelectScene',90],
 ['06-versus-splash','?scene=versus&mode=cpu','VersusScene',110],['07-match-hud-start','?scene=match&mode=versus&p1=hayate&p2=magnus','MatchScene',80],
 ]){
 const p=await b.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});await p.addInitScript(()=>{localStorage.setItem('neon-tempest-settings-v1',JSON.stringify({resolutionScale:1}));});
 await p.goto('http://127.0.0.1:6103/'+query);
 await p.waitForFunction(({id,frames})=>window.__NT?.app.scenes.current?.id===id&&window.__NT.app.scenes.current.frames>=frames,{id,frames});
 const state=await p.evaluate(()=>{const a=window.__NT.app;a.loop.stop();a.view.begin();a.scenes.render(a.view.ctx,1);a.view.end();return{scene:a.scenes.current.id,frames:a.scenes.current.frames,transitioning:a.scenes.transitioning,canvas:[a.view.canvas.width,a.view.canvas.height]};});
 await p.screenshot({path:path.join(j,'screenshots/C',file+'.png')});captures.push({file,query,note:'Original built-in scene entry point, actual elapsed frames; frozen after entrance to avoid screenshotting wipes or flickering startup',...state});console.log('C stable',file,state.frames);await p.close();
}
fs.writeFileSync(path.join(j,'logs/C/presentation-captures.json'),JSON.stringify(captures,null,2));await b.close();
