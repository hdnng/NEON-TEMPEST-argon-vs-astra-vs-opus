from pathlib import Path
import json,subprocess,time
ROOT=Path(__file__).resolve().parents[2];J=ROOT/'judging'
raw=subprocess.check_output(['powershell','-NoProfile','-Command','Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Depth 3'],encoding='utf-8',errors='replace')
processes=json.loads(raw);byid={p['ProcessId']:p for p in processes};objective=json.loads((J/'data/objective.json').read_text(encoding='utf-8'));results=[]
for x in 'ABC':
 pid=objective[x]['startup']['pid'];p=byid.get(pid)
 if not p:results.append({'project':x,'pid':pid,'status':'already stopped'});continue
 descendants={pid}
 for _ in range(12):
  more={q['ProcessId']for q in processes if q['ParentProcessId']in descendants};new=descendants|more
  if new==descendants:break
  descendants=new
 vite=[byid[q]for q in descendants if 'vite' in (byid[q].get('CommandLine')or'')]
 if not vite or 'npm' not in (p.get('CommandLine')or''):
  results.append({'project':x,'pid':pid,'status':'not stopped: identity no longer matches recorded startup'});continue
 cp=subprocess.run(['taskkill','/PID',str(pid),'/T','/F'],capture_output=True,text=True)
 results.append({'project':x,'pid':pid,'command':f'taskkill /PID {pid} /T /F','shutdown_command_exit_code':cp.returncode,'status':'terminated by judge after all checks','natural_server_exit_code':None,'verified_descendant_commands':[q['CommandLine']for q in vite]})
for p in processes:
 cmd=p.get('CommandLine')or''
 if 'node' in cmd and cmd.strip().endswith('judging/scripts/server.mjs'):
  cp=subprocess.run(['taskkill','/PID',str(p['ProcessId']),'/T','/F'],capture_output=True,text=True)
  results.append({'helper':'production static servers','pid':p['ProcessId'],'command_identity':cmd,'shutdown_command_exit_code':cp.returncode})
(J/'data/server-shutdown.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(results,indent=2))
