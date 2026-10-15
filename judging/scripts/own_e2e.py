from pathlib import Path
import json, subprocess, time, os
ROOT=Path(__file__).resolve().parents[2]; J=ROOT/'judging'
for x in json.loads((J/'data'/'environment.json').read_text())['order']:
    work=J/'work'/x
    (work/'judging.playwright.config.ts').write_text("import base from './playwright.config';\nimport {defineConfig} from '@playwright/test';\nexport default defineConfig({...base, workers:1, reporter:[['list'],['json',{outputFile:'../../logs/"+x+"/e2e-results.json'}]],use:{...base.use,viewport:{width:1920,height:1080}}});\n",encoding='utf-8')
    cmd='npm run test:e2e -- --config=judging.playwright.config.ts'
    t=time.perf_counter()
    with (J/'logs'/x/'own-e2e.log').open('w',encoding='utf-8') as f:
        f.write(f'COMMAND: {cmd}\nVIEWPORT: 1920x1080; original tests, common config override\n');f.flush()
        try:
            p=subprocess.run(['cmd','/d','/c',cmd],cwd=work,stdout=f,stderr=subprocess.STDOUT,timeout=600,env={**os.environ,'BROWSER':'none','CI':'1'})
            code=p.returncode
        except subprocess.TimeoutExpired: code=124
        f.write(f'\nEXIT_CODE: {code}\nDURATION_SECONDS: {time.perf_counter()-t:.3f}\n')
    print(x,'e2e',code,round(time.perf_counter()-t,2),flush=True)
