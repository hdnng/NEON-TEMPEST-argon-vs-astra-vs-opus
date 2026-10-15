from pathlib import Path
import json,subprocess,time
ROOT=Path(__file__).resolve().parents[2];J=ROOT/'judging'
for x in json.loads((J/'data'/'environment.json').read_text())['order']:
    cmd=['node','judging/scripts/performance.mjs',x,'--gpu-bench-only'];t=time.perf_counter()
    with (J/'logs'/x/'gpu-performance-command.log').open('w',encoding='utf-8') as f:
        f.write('COMMAND: '+' '.join(cmd)+'\n');f.flush();p=subprocess.run(cmd,cwd=ROOT,stdout=f,stderr=subprocess.STDOUT)
        f.write(f'\nEXIT_CODE: {p.returncode}\nDURATION_SECONDS: {time.perf_counter()-t:.3f}\n')
    print(x,'GPU benchmark',p.returncode,flush=True)
