from pathlib import Path
import gzip, json, os, re, subprocess, time, urllib.request
ROOT=Path(__file__).resolve().parents[2]; J=ROOT/'judging'
def run(x,name,command,timeout=240):
    log=J/'logs'/x/f'{name}.log'; t=time.perf_counter()
    with log.open('w',encoding='utf-8') as f:
        f.write(f'COMMAND: {command}\nCWD: judging/work/{x}\n'); f.flush()
        try:
            p=subprocess.run(['cmd','/d','/c',command],cwd=J/'work'/x,stdout=f,stderr=subprocess.STDOUT,timeout=timeout,
                             env={**os.environ,'CI':'1','BROWSER':'none','NO_COLOR':'1'})
            code=p.returncode
        except subprocess.TimeoutExpired: code=124
        duration=time.perf_counter()-t
        f.write(f'\nEXIT_CODE: {code}\nDURATION_SECONDS: {duration:.3f}\n')
    print(x,name,code,round(duration,2),flush=True)
    return {'command':command,'exit_code':code,'duration_seconds':round(duration,3),'log':str(log.relative_to(ROOT)).replace('\\','/')}
def main():
    env=json.loads((J/'data'/'environment.json').read_text()); results={}
    for x in env['order']:
        start='npm install && npm run dev' if x=='A' else 'npm start'
        log=J/'logs'/x/'readme-start.log'; f=log.open('w',encoding='utf-8')
        f.write(f'COMMAND: {start}\nBROWSER=none (suppress browser popup in headless judging)\n');f.flush()
        t=time.perf_counter()
        p=subprocess.Popen(['cmd','/d','/c',start],cwd=J/'work'/x,stdout=f,stderr=subprocess.STDOUT,
                           env={**os.environ,'BROWSER':'none','NO_COLOR':'1'})
        url=None
        while time.perf_counter()-t<240:
            text=log.read_text(encoding='utf-8',errors='replace')
            m=re.findall(r'http://localhost:(\d+)',re.sub(r'\x1b\[[0-9;]*m','',text))
            if m:
                candidate=f'http://localhost:{m[-1]}'
                try:
                    with urllib.request.urlopen(candidate,timeout=2) as response:
                        if response.status==200: url=candidate; break
                except Exception: pass
            if p.poll() is not None: break
            time.sleep(.25)
        elapsed=time.perf_counter()-t
        f.write(f'\nJUDGE_READY_URL: {url}\nREADY_SECONDS: {elapsed:.3f}\n');f.flush()
        assisted=False
        results[x]={'startup':{'command':start,'status':'PASS' if url else 'FAIL','assisted':assisted,
                              'duration_seconds':round(elapsed,3),'exit_code':p.poll(),'pid':p.pid,'url':url,
                              'log':f'judging/logs/{x}/readme-start.log'}}
        (J/'data'/'objective.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
        print(x,'START',url,round(elapsed,2),flush=True)
        if not url:
            # One minimally assisted dependency installation, then one restart.
            results[x]['assistance']=run(x,'assisted-install','npm install')
            assisted=True
            af=(J/'logs'/x/'assisted-start.log').open('w',encoding='utf-8')
            ap=subprocess.Popen(['cmd','/d','/c','npm run dev'],cwd=J/'work'/x,stdout=af,stderr=subprocess.STDOUT,env={**os.environ,'BROWSER':'none'})
            time.sleep(3)
            tx=(J/'logs'/x/'assisted-start.log').read_text(encoding='utf-8',errors='replace')
            ms=re.findall(r'http://localhost:(\d+)',tx)
            url=f'http://localhost:{ms[-1]}' if ms else None
            results[x]['startup'].update(assisted=True,assisted_url=url,assisted_pid=ap.pid)
        results[x]['build']=run(x,'build','npm run build')
        dist=J/'work'/x/'dist'
        files=[{'path':str(q.relative_to(dist)).replace('\\','/'),'bytes':q.stat().st_size,'gzip_bytes':len(gzip.compress(q.read_bytes(),mtime=0))} for q in sorted(dist.rglob('*')) if q.is_file()]
        results[x]['bundle']={'files':files,'total_bytes':sum(y['bytes'] for y in files),'gzip_total_bytes':sum(y['gzip_bytes'] for y in files)}
        results[x]['unit_tests']=run(x,'unit-tests','npm test -- --reporter=json --outputFile=../../logs/'+x+'/unit-results.json')
        (J/'data'/'objective.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
        f.close()
    print('ALL OBJECTIVE BUILDS/UNIT TESTS COMPLETE',flush=True)
if __name__=='__main__': main()
