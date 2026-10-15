from pathlib import Path
import hashlib, json, os, platform, random, secrets, shutil, subprocess, time

ROOT = Path(__file__).resolve().parents[2]
J = ROOT / 'judging'
IGNORE = {'node_modules', 'dist', 'test-results', '.git', 'playwright-report'}
def manifest(folder):
    return {str(p.relative_to(folder)).replace('\\','/'): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(folder.rglob('*')) if p.is_file() and not any(x in IGNORE for x in p.relative_to(folder).parts)}
def main():
    for d in ['work','logs','screenshots','data','scripts']:
        (J/d).mkdir(parents=True, exist_ok=True)
    seed = secrets.randbits(32)
    order = list('ABC'); random.Random(seed).shuffle(order)
    for x in order:
        src = ROOT/f'project-{x}'; dst=J/'work'/x
        if dst.exists(): raise RuntimeError(f'Will not overwrite existing work copy {dst}')
        shutil.copytree(src,dst,ignore=shutil.ignore_patterns(*IGNORE))
        (J/'logs'/x).mkdir(exist_ok=True)
        (J/'screenshots'/x).mkdir(exist_ok=True)
        (J/'logs'/x/'original-manifest.json').write_text(json.dumps(manifest(src),indent=2),encoding='utf-8')
        (J/'logs'/x/'submitted-bench.json').write_bytes((src/'bench-results.json').read_bytes())
    env={'date_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'platform':platform.platform(),
         'cpu':platform.processor(),'python':platform.python_version(),'node':subprocess.check_output(['node','--version'],text=True).strip(),
         'npm':subprocess.check_output(['cmd','/d','/c','npm --version'],text=True).strip(),
         'order':order,'random_seed':seed,'excluded_copy_dirs':sorted(IGNORE),
         'viewport':{'width':1920,'height':1080},'device_scale_factor':1,'headless':True,
         'source_spec_sha256':hashlib.sha256((ROOT/'SPEC.md').read_bytes()).hexdigest()}
    (J/'data'/'environment.json').write_text(json.dumps(env,indent=2),encoding='utf-8')
    print(json.dumps(env,indent=2))
if __name__=='__main__': main()
