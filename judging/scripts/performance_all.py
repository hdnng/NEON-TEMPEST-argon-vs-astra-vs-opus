from pathlib import Path
import json,subprocess,time
ROOT=Path(__file__).resolve().parents[2];J=ROOT/'judging'
for x in json.loads((J/'data'/'environment.json').read_text())['order']:
    with (J/'logs'/x/'performance-command.log').open('w',encoding='utf-8') as f:
        cmd=['node','judging/scripts/performance.mjs',x];f.write('COMMAND: '+' '.join(cmd)+'\n');f.flush();t=time.perf_counter()
        p=subprocess.run(cmd,cwd=ROOT,stdout=f,stderr=subprocess.STDOUT)
        f.write(f'\nEXIT_CODE: {p.returncode}\nDURATION_SECONDS: {time.perf_counter()-t:.3f}\n')
    print(x,'performance and play',p.returncode,flush=True)
