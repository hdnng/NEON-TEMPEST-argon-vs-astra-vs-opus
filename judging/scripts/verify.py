from pathlib import Path
from decimal import Decimal
from html.parser import HTMLParser
import collections,hashlib,json,re,time
from setup import manifest
from model_labels import NAMES, legacy_data, reveal_data
ROOT=Path(__file__).resolve().parents[2];J=ROOT/'judging'
def read(p):return legacy_data(json.loads((ROOT/p).read_text(encoding='utf-8')))
class Parser(HTMLParser):
 def __init__(self):super().__init__();self.images=[];self.links=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if tag=='img':self.images.append(a.get('src',''))
  if tag=='a':self.links.append(a.get('href',''))
def numbers(t):return set(re.findall(r'\d+(?:\.\d+)?',t))
def pathcheck(p):
 if p.startswith(('http:','https:','data:','#','mailto:')):return True
 return (ROOT/p.split('#')[0]).exists()
def main():
 errors=[];checks={};record=lambda k,v:checks.update({k:v})
 en=(ROOT/'README.md').read_text(encoding='utf-8');vi=(ROOT/'README.vi.md').read_text(encoding='utf-8');web=(ROOT/'report.html').read_text(encoding='utf-8')
 p=Parser();p.feed(web)
 mdimages={l:re.findall(r'!\[[^\]]*\]\(([^)]+)\)',t)for l,t in [('en',en),('vi',vi)]}
 allpaths=set(mdimages['en']+mdimages['vi']+p.images)
 missing=[x for x in allpaths if not pathcheck(x)];record('missing_image_paths',missing)
 if missing:errors.append('Missing report images')
 parity=collections.Counter(mdimages['en'])==collections.Counter(mdimages['vi']);record('bilingual_image_parity',parity)
 if not parity:errors.append('Image parity failed')
 n1,n2=numbers(en),numbers(vi);record('bilingual_numeric_set_parity',n1==n2);record('english_only_numbers',sorted(n1-n2));record('vietnamese_only_numbers',sorted(n2-n1))
 if n1!=n2:errors.append('Numeric parity failed')
 record('readme_language_switchers',en.splitlines()[0]=='**English** | [Tiếng Việt](README.vi.md)'and vi.splitlines()[0]=='[English](README.md) | **Tiếng Việt**')
 if not checks['readme_language_switchers']:errors.append('Language switchers')
 scores=read('judging/data/scores.json');metrics=read('judging/data/metrics.json');checklist=read('judging/data/checklist.json');display=read('judging/data/display-values.json')
 tablevalues=True;scorerows=True
 for lang,doc in [('en',en),('vi',vi)]:
  for key,vals in display[lang].items():
   row=next((s for s in doc.splitlines()if f'<!--metric:{key}-->'in s),None)
   actual=[c.strip()for c in row.strip('|').split('|')][1:]if row else None
   if actual!=vals:errors.append(f'{lang}: metric {key}');tablevalues=False
  for x in 'ABC':
   name=NAMES[x]
   row=next(s for s in doc.splitlines()if f'<!--score:{name}-->'in s);cells=[z.strip().replace('**','')for z in row.strip('|').split('|')]
   pr=scores['projects'][x];expected=[str(pr['rank']),name+f' <!--score:{name}-->']+[f"{pr['categories'][k]['score']:.1f}"for k in scores['weights']]+[f"{pr['total']:.2f}",f"{pr['spec_completion_percent']:.2f}"]
   if cells!=expected:errors.append(f'{lang}: score row {x}');scorerows=False
 record('readme_metric_table_values',tablevalues);record('readme_score_table_values',scorerows)
 # Independently format key objective metrics from metrics.json, without trusting display-values alone.
 expected_fields={'fps_average':lambda m:f"{m['benchmark']['fps_average']:.2f}",'fps_low':lambda m:f"{m['benchmark']['fps_1pct_low']:.2f}",'p95':lambda m:f"{m['benchmark']['p95_frame_ms']:.2f}",'heap_growth':lambda m:f"{m['benchmark']['heap_growth_bytes']/1048576:.2f}",'completion':lambda m:f"{m['spec_completion_percent']:.2f}%",'unit':lambda m:f"{m['unit_tests']['numPassedTests']} / {m['unit_tests']['numFailedTests']}",'bundle_bytes':lambda m:f"{m['bundle']['total_bytes']} / {m['bundle']['gzip_total_bytes']}"}
 direct=all(display[l][key]==[fn(metrics[x])for x in 'ABC']for l in ['en','vi']for key,fn in expected_fields.items());record('direct_metrics_json_comparison',direct)
 if not direct:errors.append('Direct metrics mismatch')
 evidence=[];math_ok=True;originals={};work_source={};image_reviews={}
 for x in 'ABC':
  pr=scores['projects'][x];total=sum(Decimal(str(c['score']))*Decimal(str(c['weight']))/10 for c in pr['categories'].values())
  if float(total.quantize(Decimal('.01')))!=pr['total']:math_ok=False
  rows=checklist['projects'][x]['rows'];pct=round(100*sum(r['credit']for r in rows)/len(rows),2)
  if pct!=pr['spec_completion_percent']or pct!=metrics[x]['spec_completion_percent']:math_ok=False
  if len(rows)!=30 or len({r['id']for r in rows})!=30:errors.append(x+' checklist count')
  for c in pr['categories'].values():
   if not 0<=c['score']<=10:errors.append(x+' score bounds')
   if c['score']>5 and not c['evidence']:errors.append(x+' unsupported high score')
   if c['assessment']not in ['verified by tool','judged visually/by reading']:errors.append(x+' score method')
   evidence+=c['evidence']
  for r in rows:evidence+=r['evidence']
  old=read(f'judging/logs/{x}/original-manifest.json');now=manifest(ROOT/f'project-{x}');originals[x]=old==now
  if not originals[x]:errors.append(x+' original modified')
  srcfiles=[p for p in (ROOT/f'project-{x}/src').rglob('*')if p.is_file()]
  work_source[x]=all(p.read_bytes()==(J/'work'/x/p.relative_to(ROOT/f'project-{x}')).read_bytes()for p in srcfiles)
  if not work_source[x]:errors.append(x+' submission source changed in work')
  review=read(f'judging/logs/{x}/visual-review.json');actual={p.name for p in(J/'screenshots'/x).glob('*.png')};seen={r['image']for r in review['images']}
  image_reviews[x]=actual==seen and all(r['reviewed']and r['note']['en']and r['note']['vi']and hashlib.sha256((J/'screenshots'/x/r['image']).read_bytes()).hexdigest()==r['sha256']for r in review['images'])
  if not image_reviews[x]:errors.append(x+' image review or fingerprint')
  from PIL import Image
  if not all(Image.open(J/'screenshots'/x/name).size==(1920,1080)for name in actual):errors.append(x+' capture dimensions')
  if len(actual)!=30:errors.append(x+' expected 30 final PNGs including source animation frames')
  if not read(f'judging/logs/{x}/keyboard-qcf-state.json')['pass']:errors.append(x+' keyboard special failed')
  menus=read(f'judging/logs/{x}/menu-coverage.json')
  if not menus['trace'][-1].get('completed'):errors.append(x+' incomplete menu coverage')
  if metrics[x]['startup']['assisted']and pr['categories']['runs']['score']>6:errors.append(x+' assistance cap')
 record('weighted_and_completion_math',math_ok)
 if not math_ok:errors.append('Math mismatch')
 record('original_manifests_unchanged',reveal_data(originals));record('work_submission_source_unchanged',reveal_data(work_source));record('all_final_images_reviewed_and_fingerprinted',reveal_data(image_reviews))
 if sum(scores['weights'].values())!=100:errors.append('Weights')
 for e in evidence:
  if not pathcheck(e):errors.append('Missing evidence '+e)
  if '#L'in e:
   f,n=e.split('#L');line=int(n)
   if line<1 or line>len((ROOT/f).read_text(encoding='utf-8').splitlines()):errors.append('Bad source line '+e)
 record('all_score_and_checklist_evidence_paths_exist',not any(z.startswith(('Missing evidence','Bad source line'))for z in errors))
 record('html_image_set_matches_markdown',set(p.images)==set(mdimages['en']))
 if not checks['html_image_set_matches_markdown']:errors.append('HTML images differ')
 # Validate all local Markdown/HTML links after creating the self-referenced verification target.
 outpath=J/'data/verification.json'
 if not outpath.exists():outpath.write_text('{}',encoding='utf-8')
 links=p.links+re.findall(r'\]\(([^)]+)\)',en+vi)
 brokenlinks=sorted(set(z for z in links if not pathcheck(z)));record('missing_local_links',brokenlinks)
 if brokenlinks:errors.append('Missing local links')
 html_result=read('judging/data/html-verification.json');record('html_toggle_and_image_check_pass',html_result.get('pass',False))
 if not html_result.get('pass'):errors.append('HTML browser verification')
 result={'pass':not errors,'errors':errors,'checks':checks,'image_references':len(p.images),'unique_report_image_paths':len(allpaths),'reviewed_project_pngs':90,'date_utc':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
 outpath.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps(result,ensure_ascii=False,indent=2));raise SystemExit(0 if result['pass']else 1)
if __name__=='__main__':main()
