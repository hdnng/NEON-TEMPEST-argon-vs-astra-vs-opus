from pathlib import Path
import json,subprocess,time
ROOT=Path(__file__).resolve().parents[2];J=ROOT/'judging'
for x in json.loads((J/'data'/'environment.json').read_text())['order']:
    cmd=['node',str(J/'work/B/node_modules/tsx/dist/cli.mjs'),str(J/'scripts/headless.ts'),x,'32']
    t=time.perf_counter()
    with (J/'logs'/x/'independent-headless.log').open('w',encoding='utf-8') as f:
        f.write('COMMAND: '+' '.join(cmd)+'\n');f.flush()
        p=subprocess.run(cmd,cwd=ROOT,stdout=f,stderr=subprocess.STDOUT)
        f.write(f'\nEXIT_CODE: {p.returncode}\nDURATION_SECONDS: {time.perf_counter()-t:.3f}\n')
    print(x,'independent512',p.returncode,round(time.perf_counter()-t,2),flush=True)
