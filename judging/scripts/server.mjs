import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'};
for(const [i,label] of [...'ABC'].entries()){
 const folder=path.join(root,'judging/work',label,'dist');
 http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');let f=path.resolve(folder,'.'+decodeURIComponent(url.pathname));
  if(!f.startsWith(folder)){res.writeHead(403);res.end();return;}
  if(!fs.existsSync(f)||fs.statSync(f).isDirectory()) f=path.join(folder,'index.html');
  res.writeHead(200,{'Content-Type':types[path.extname(f)]??'application/octet-stream','Cache-Control':'no-store'});res.end(fs.readFileSync(f));
 }).listen(6101+i,'127.0.0.1',()=>console.log(label,`http://127.0.0.1:${6101+i}`));
}
