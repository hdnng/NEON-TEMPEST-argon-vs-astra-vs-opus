from pathlib import Path
import json,re,html,shutil
from markdown_it import MarkdownIt
from build_data import pair,read,ref,log,img
from model_labels import relabel_markdown
ROOT=Path(__file__).resolve().parents[2];J=ROOT/'judging'
S=read('judging/data/scores.json');M=read('judging/data/metrics.json');C=read('judging/data/checklist.json');T=read('judging/data/report-content.json');ENV=read('judging/data/environment.json')
SCREENS=[
 ('01-boot-logo','Boot / logo','Boot / logo'),('02-title','Title','Màn tiêu đề'),('03-main-menu','Main menu','Menu chính'),
 ('04-character-select','Character select','Chọn nhân vật'),('05-stage-select','Stage select','Chọn sân'),('06-versus-splash','Versus splash','Màn versus'),
 ('07-match-hud-start','Round-start HUD','HUD đầu round'),('08-mid-combo','Connected combo','Combo thực'),('09-super-active','Super cut-in / active','Super cut-in / active'),
 ('10-ko-round-end','KO / round end','KO / cuối round'),('11-training-hitboxes','Training + boxes','Training + box'),('12-move-list','Move list','Danh sách chiêu'),
 ('13-settings','Settings','Thiết lập'),('14-results','Results','Kết quả'),('15-stage-1','Stage I','Sân I'),('16-stage-2','Stage II','Sân II'),('17-stage-3','Stage III','Sân III'),
 ('18-special-strip','Special animation strip','Dải frame special'),('19-pause-menu','Pause','Pause'),('20-mode-select','Separate mode select','Chọn mode riêng'),
 ('21-trials','Trials','Trial'),('22-keyboard-qcf','Keyboard QCF evidence','Bằng chứng QCF keyboard'),('23-super-followthrough','Super follow-through','Phần tiếp diễn của super'),('24-two-minute-play','Sustained keyboard play','Chơi keyboard kéo dài')]
def tx(p,l):return p[l] if isinstance(p,dict)else p
def tr(en,vi,l):return en if l=='en'else vi
def num(v,n=2):return f'{v:.{n}f}'
def evidence(paths):
    result=[]
    for p in paths:
        label=p.replace('judging/work/','').replace('judging/logs/','logs/').replace('judging/screenshots/','screenshots/').replace('#L',':')
        result.append(f'[{label}]({p})')
    return '; '.join(result)
def table(headers,rows):
    return '\n'.join(['| '+' | '.join(str(v)for v in headers)+' |','| '+' | '.join('---'for _ in headers)+' |']+['| '+' | '.join(str(v).replace('\n','<br>')for v in row)+' |'for row in rows])+'\n'
def shot(x,name,label):p=img(x,name);return f'[![{x} — {label}]({p})]({p})'
def main_metrics(l):
    rows=[];expected={}
    def add(key,en,vi,fn):
        values=[str(fn(x,M[x]))for x in 'ABC'];expected[key]=values;rows.append([tr(en,vi,l)+f' <!--metric:{key}-->',*values])
    add('startup','README startup; assisted?','Khởi động theo README; cần hỗ trợ?',lambda x,m:f"{m['startup']['status']} / {'YES'if m['startup']['assisted']else'NO'}")
    add('startup_seconds','Install + ready (s)','Cài + sẵn sàng (s)',lambda x,m:num(m['startup']['duration_seconds'],3))
    add('build_exit','Build exit code','Exit code build',lambda x,m:m['build']['exit_code'])
    add('build_seconds','Build time (s)','Thời gian build (s)',lambda x,m:num(m['build']['duration_seconds'],3))
    add('bundle_bytes','Whole dist / gzip bytes','Toàn bộ dist / byte gzip',lambda x,m:f"{m['bundle']['total_bytes']} / {m['bundle']['gzip_total_bytes']}")
    add('js_bytes','JS only / gzip bytes','Chỉ JS / byte gzip',lambda x,m:' / '.join(str(sum(f[k]for f in m['bundle']['files']if f['path'].endswith('.js')))for k in ['bytes','gzip_bytes']))
    add('unit','Own unit: passed / failed','Unit gốc: đạt / trượt',lambda x,m:f"{m['unit_tests']['numPassedTests']} / {m['unit_tests']['numFailedTests']}")
    add('e2e','Own E2E: expected / unexpected / skipped','E2E gốc: expected / unexpected / skipped',lambda x,m:f"{m['e2e']['expected']} / {m['e2e']['unexpected']} / {m['e2e']['skipped']}")
    add('console','Game console: errors / warnings','Console game: lỗi / cảnh báo',lambda x,m:f"{m['browser_console']['errors']} / {m['browser_console']['warnings']}")
    add('fps_average','GPU: average FPS','GPU: FPS trung bình',lambda x,m:num(m['benchmark']['fps_average']))
    add('fps_low','GPU: 1% low FPS','GPU: FPS 1% low',lambda x,m:num(m['benchmark']['fps_1pct_low']))
    add('p95','GPU: p95 frame time (ms)','GPU: frame time p95 (ms)',lambda x,m:num(m['benchmark']['p95_frame_ms']))
    add('p99','GPU: p99 frame time (ms)','GPU: frame time p99 (ms)',lambda x,m:num(m['benchmark']['p99_frame_ms']))
    add('duration','GPU: measured duration (s)','GPU: thời lượng đo (s)',lambda x,m:num(m['benchmark']['duration_seconds']))
    add('samples','GPU: rAF intervals sampled','GPU: số khoảng rAF đã lấy mẫu',lambda x,m:m['benchmark']['frames'])
    add('heap_start','JS heap start (MiB)','JS heap đầu (MiB)',lambda x,m:num(m['benchmark']['heap_start_bytes']/1048576))
    add('heap_end','JS heap end (MiB)','JS heap cuối (MiB)',lambda x,m:num(m['benchmark']['heap_end_bytes']/1048576))
    add('heap_growth','JS heap growth (MiB)','JS heap tăng (MiB)',lambda x,m:num(m['benchmark']['heap_growth_bytes']/1048576))
    add('pixels','Primary backing canvas','Backing canvas trong lượt chính',lambda x,m:' × '.join(str(v)for v in m['benchmark']['canvas'][0]))
    add('software','Software: average / low FPS','Software: FPS trung bình / low',lambda x,m:f"{num(m['software_benchmark']['fps_average'])} / {num(m['software_benchmark']['fps_1pct_low'])}")
    add('play_seconds','Independent keyboard play (s)','Lượt chơi keyboard độc lập (s)',lambda x,m:num(m['play']['duration_seconds']))
    add('determinism','Independent determinism / serialized continuation','Determinism độc lập / chạy tiếp từ bản serialize',lambda x,m:f"{'PASS'if m['determinism']['pass']else'FAIL'} / {'PASS'if m['determinism']['serialization_roundtrip']else'FAIL'}")
    add('bot','Bot matches / crashes / frame-cap hits','Số trận bot / crash / chạm giới hạn frame',lambda x,m:f"{m['balance']['completed']} / {m['balance']['crashes']} / {m['balance']['softlocks']}")
    add('match_seconds','Mean match length (simulated s)','Thời lượng trận trung bình (giây simulation)',lambda x,m:num(m['balance']['average_match_seconds']))
    add('completion','Spec completion %','Mức hoàn thành spec %',lambda x,m:num(m['spec_completion_percent'])+'%')
    return table([tr('Metric','Chỉ số',l),'A','B','C'],rows),expected

def render(l):
    lines=['**English** | [Tiếng Việt](README.vi.md)'if l=='en'else'[English](README.md) | **Tiếng Việt**','',f'# {tx(T["title"],l)}','',tx(T['summary'],l),'']
    lines.extend([tr('[Open the interactive bilingual HTML report](report.html). Raw evidence and reproducibility scripts are under [judging/](judging/).','[Mở báo cáo HTML song ngữ có nút chuyển ngôn ngữ](report.html). Bằng chứng thô và script tái lập nằm trong [judging/](judging/).',l),''])
    lines+=['## '+tr('1. Summary and ranking','1. Tổng quan và xếp hạng',l),'']
    headers=[tr('Rank','Hạng',l),tr('Project','Bài',l)]+[f"{k} ({w})"for k,w in S['weights'].items()]+[tr('Total / 100','Tổng / 100',l),'Spec %']
    rows=[]
    for x in S['ranking']:
        p=S['projects'][x];rows.append([p['rank'],x+f' <!--score:{x}-->']+[num(p['categories'][k]['score'],1)for k in S['weights']]+[f"**{num(p['total'])}**",num(p['spec_completion_percent'])])
    lines +=[table(headers,rows),'',tr('Weights total **100**. Category scores are on **0–10**; the total is `sum(score × weight / 10)`. The anchors are **5** functional/generic, **8** polished/robust, **9–10** exceptional near-commercial quality. No score enters the exceptional band. All numerical results and rankings are computed by script.','Tổng trọng số là **100**. Mỗi hạng mục chấm theo **0–10**; tổng bằng `sum(score × weight / 10)`. Mốc **5** là hoạt động được/còn phổ thông, **8** là hoàn thiện/vững, **9–10** là xuất sắc gần mức thương mại. Không điểm nào vào vùng xuất sắc. Mọi kết quả số và thứ hạng đều được script tính.',l),'',tx(S['consistency_review'],l),'']
    lines+=[table([tr('Project','Bài',l),tr('Code-based game feel estimate','Ước lượng game feel từ code',l),'Human playtest score'],[[x,num(S['projects'][x]['categories']['feel']['score'],1),'']for x in 'ABC']),'']
    lines +=[tr('Confidence: high for observed commands, assertions and recorded state; moderate for visual/code quality; low for human game feel, listening quality and competitive balance.','Độ tin cậy: cao với lệnh, assertion và trạng thái đã ghi; vừa với chất lượng hình ảnh/code; thấp với game feel của người, chất lượng nghe và cân bằng thi đấu.',l),'']
    lines+=['## '+tr('2. Methodology and limitations','2. Phương pháp và giới hạn',l),'',f"**{tr('Random review order','Thứ tự chấm ngẫu nhiên',l)}:** {' → '.join(ENV['order'])}. **Seed:** {ENV['random_seed']}. **Viewport:** 1920 × 1080; **DPR:** 1; **rAF benchmark:** 60 s; **keyboard play:** 120 s; **headless balance:** 512 matches/project; **input replay:** 7200 frames.",'']
    for p in T['method']:lines +=[tx(p,l),'']
    lines+=[tr('Benchmark match seeds follow each project’s browser defaults; exact seeded reproducibility is established separately in the common balance and input-replay harnesses. There is one primary run per backend, so the reported tails are measurements, not repeat-run confidence intervals.','Seed của trận browser theo mặc định từng dự án; khả năng tái lập với seed cố định được kiểm tra riêng bằng harness cân bằng và input replay chung. Mỗi backend có một lượt đo chính, vì vậy phần đuôi là số đo, không phải khoảng tin cậy từ nhiều lượt lặp.',l),'',tr('Long-running startup commands have no natural exit at readiness: the recorded exit code is null, with the ready duration and PID retained. Build/test commands have ordinary exit codes. Submitted screenshots were never used as visual evidence.','Lệnh khởi động server không tự thoát khi sẵn sàng: exit code ghi null, kèm thời gian sẵn sàng và PID. Lệnh build/test có exit code thông thường. Không dùng screenshot nộp sẵn làm bằng chứng hình ảnh.',l),'']
    lines+=['## '+tr('3. Objective metrics','3. Chỉ số khách quan',l),'']
    mt,expected=main_metrics(l);lines +=[mt,'']
    lines +=[tr('Bundle totals include HTML/CSS/JS; gzip is the sum of independently compressed output files. The heap figures include normal replay recording and the benchmark sampler and do not establish a leak. The primary GPU exposes accelerated Canvas and compositing; the software run uses the default headless-shell software path.','Tổng bundle gồm HTML/CSS/JS; gzip là tổng từng file đầu ra được nén riêng. Heap gồm cả ghi replay thông thường và bộ lấy mẫu benchmark, không đủ kết luận leak. Lượt GPU chính có Canvas/compositing được tăng tốc; lượt software dùng đường software mặc định của headless shell.',l),'']
    lines +=[tr('Evidence: ','Bằng chứng: ',l)+evidence(['judging/data/environment.json','judging/data/objective.json']+[log(x,'independent-benchmark-gpu.json')for x in 'ABC']),'']
    lines+=['### '+tr('Submitted benchmark claims versus observation','Tuyên bố benchmark nộp kèm và kết quả quan sát',l),'']
    rows=[]
    for x in 'ABC':
        c=M[x]['submitted_benchmark_comparison'];rows.append([x,num(c['submitted_avg_fps']),num(M[x]['benchmark']['fps_average']),num(c['avg_relative_change_percent'])+'%',num(c['submitted_1pct_low']),num(M[x]['benchmark']['fps_1pct_low']),num(c['low_relative_change_percent'])+'%',str(c['numeric_mismatch'])])
    lines +=[table([tr('Project','Bài',l),tr('Claim avg','Avg công bố',l),tr('Observed avg','Avg quan sát',l),'Δ %',tr('Claim low','Low công bố',l),tr('Observed low','Low quan sát',l),'Δ %',tr('Mismatch flag','Cờ chênh lệch',l)],rows),'',tr('The mismatch rule is an average FPS difference above **10%** or a low-FPS difference above **25%**, in either direction. All comparison rows have different conditions from the submitted claims: this flags non-reproduction, not dishonesty. A’s method additionally replaces rAF presentation with scheduled offscreen work.','Cờ chênh lệch bật khi FPS trung bình lệch quá **10%** hoặc low FPS lệch quá **25%**, theo bất kỳ chiều nào. Điều kiện của mọi hàng đều khác số liệu nộp kèm: cờ chỉ báo chưa tái lập được, không quy kết thiếu trung thực. Riêng A còn thay trình diễn rAF bằng công việc offscreen tự lên lịch.',l),'']
    lines+=['### '+tr('Independent combat spot-checks','Spot-check combat độc lập',l),'']
    findings={x:read(log(x,'combat-spotchecks.json'))['findings']for x in 'ABC'}
    rows=[]
    for f in findings['A']:
        name=f.get('name')
        if not name:continue
        rows.append([name]+[('PASS'if next(z for z in findings[x]if z.get('name')==name)['pass']else'FAIL')for x in 'ABC'])
    lines +=[table([tr('Probe','Probe',l),'A','B','C'],rows),'',evidence([log(x,'combat-spotchecks.json')for x in 'ABC']+[log('B','edge-cases.json')]),'']
    lines +=['### '+tr('Spec completion by section','Mức hoàn thành theo phần spec',l),'',table(['Section / requirements','A','B','C'],[[s+f" / {C['projects']['A']['sections'][s]['requirements']}"]+[num(M[x]['spec_sections'][s]['completion_percent'])+'%'for x in 'ABC']for s in 'ABCDE']+[[tr('Overall','Toàn bộ',l)]+[num(M[x]['spec_completion_percent'])+'%'for x in 'ABC']]),'']
    lines+=['## '+tr('4. Project reviews and screenshot galleries','4. Đánh giá từng bài và gallery ảnh',l),'']
    for x in 'ABC':
        p=T['projects'][x];visual=read(log(x,'visual-review.json'));lines +=[f'### {x}','',f"**{tr('Strengths','Điểm mạnh',l)}.** {tx(p['strengths'],l)}",'',f"**{tr('Weaknesses','Điểm yếu',l)}.** {tx(p['weaknesses'],l)}",'']
        bugs=[b for b in T['bugs']if x in b['project'].split('/')]
        for b in bugs:lines +=[f"**{tr('Issue','Vấn đề',l)} — {tx(b['title'],l)}.** {tx(b['repro'],l)} "+evidence(b['evidence']),'']
        lines +=['#### '+tr('Balance — row is Player 1 win percentage','Cân bằng — hàng là phần trăm thắng của Player 1',l),'']
        ids=['HAYATE','MAGNUS','SABLE','WARDEN'];bal=M[x]['balance'];lines +=[table(['P1 / P2',*ids],[[ids[i]]+[num(cell['win_percent'])+'%'for cell in row]for i,row in enumerate(bal['matrix'])]),'']
        lines +=[tr('Each ordered cell has **32** matches. Aggregate rates combine both sides, exclude mirror matches and count draws as half-wins. Match duration includes intro/outro, hitstop and round transitions. This is bot-policy balance, with correlated match seeds and limited per-matchup precision.','Mỗi ô có thứ tự gồm **32** trận. Win rate tổng hợp tính cả hai phía, bỏ mirror và tính hòa bằng nửa trận thắng. Thời lượng gồm intro/outro, hitstop và chuyển round. Đây là cân bằng của chính sách bot, với seed có liên hệ và độ chính xác từng matchup còn hạn chế.',l),'',table([tr('Fighter','Võ sĩ',l),'Win %','Wilson 95%'],[[w['id'].upper(),num(w['percent']),f"{num(w['wilson_95_percent'][0])}–{num(w['wilson_95_percent'][1])}"]for w in bal['winRates']]),'',evidence([log(x,'independent-balance.json'),log(x,'roster-inventory.json')]),'']
        lines +=['#### '+tr('Judge-captured gallery — click to inspect originals','Gallery do người chấm chụp — bấm để xem ảnh gốc',l),'',tr('All game captures are **1920 × 1080**. Menu-flow captures use real keyboard traversal; precision combat shots use disclosed fixtures. The blank mode-select placeholders label only the missing separate screen. All images were inspected, including animation frames.','Mọi ảnh game đều **1920 × 1080**. Ảnh luồng menu dùng điều hướng keyboard thật; ảnh combat cần chính xác dùng fixture đã nêu. Placeholder mode select chỉ đánh dấu thiếu màn riêng. Đã xem toàn bộ ảnh, gồm từng frame animation.',l),'']
        rows=[]
        notes={r['image']:r for r in visual['images']}
        for name,en,vi in SCREENS:rows.append([shot(x,name,en if l=='en'else vi),tx(notes[name+'.png']['note'],l)])
        lines +=[table([tr('Screen','Màn hình',l),tr('Visual review / evidence','Nhận xét hình ảnh / bằng chứng',l)],rows),'']
        lines +=[tr('Full animation source frames: ','Các frame animation gốc: ',l)+evidence([img(x,f'animation-{i}')for i in range(1,7)]),'',tr('Visual inspection ledger: ','Sổ ghi nhận việc xem ảnh: ',l)+evidence([log(x,'visual-review.json'),log(x,'image-inventory.json')]),'']
    lines+=['## '+tr('5. Side-by-side screen comparison','5. Đối chiếu màn hình cạnh nhau',l),'']
    lines +=[table([tr('Screen','Màn hình',l),'A','B','C'],[[en if l=='en'else vi]+[shot(x,name,en if l=='en'else vi)for x in 'ABC']for name,en,vi in SCREENS]),'']
    lines+=['## '+tr('6. Category-by-category scoring evidence','6. Phân tích điểm theo từng hạng mục',l),'']
    feelrefs={'A':ref('A','src/core/simulation.ts','Allow buffering cancels during hitstop'),'B':ref('B','src/core/sim.ts','Retain the direction and EX modifier'),'C':ref('C','src/core/loop.ts','Fixed-timestep game loop')}
    for k,w in S['weights'].items():
        lines +=[f"### {tx(S['category_names'][k],l)} ({w})",'']
        for x in 'ABC':
            cat=S['projects'][x]['categories'][k];ev=cat['evidence']+([feelrefs[x]]if k=='feel'else[])
            lines +=[f"**{x}: {num(cat['score'],1)}/10 — {cat['assessment']}.** {tx(T['analysis'][k][x],l)} "+evidence(ev),'']
    lines+=['## '+tr('7. Highest-priority bugs overall','7. Các lỗi cần ưu tiên xử lý',l),'']
    for b in T['bugs']:lines +=[f"### {b['project']} — {b['severity']} — {tx(b['title'],l)}",'',tx(b['repro'],l),'',evidence(b['evidence']),'']
    lines+=['## '+tr('8. Recommendations and human follow-up','8. Khuyến nghị và phần người chơi cần kiểm tra',l),'']
    for x in 'ABC':
        lines +=[f'### {x}','']+['- '+tx(z,l)for z in T['projects'][x]['recommendations']]+['']
    lines +=[tx(T['human'],l),'']
    lines+=['## '+tr('Appendix — every requirement in sections A–E','Phụ lục — toàn bộ yêu cầu phần A–E',l),'',tx(C['method'],l),'']
    for x in 'ABC':
        lines +=[f'### {x}','',table([tr('ID / requirement','ID / yêu cầu',l),tr('Status','Trạng thái',l),tr('Evidence and finding','Bằng chứng và nhận định',l)],[[r['id']+' — '+tx(r['requirement'],l),r['status'],tx(r['finding'],l)+' '+evidence(r['evidence'])]for r in C['projects'][x]['rows']]),'']
    lines+=['## '+tr('Reproduction and final verification','Tái lập và kiểm tra cuối',l),'',tr('The authoritative machine-readable outputs are [scores.json](judging/data/scores.json), [metrics.json](judging/data/metrics.json) and [checklist.json](judging/data/checklist.json). The [script guide](judging/scripts/README.md) gives exact commands, prerequisites and source-protection boundaries. The [harness notes](judging/logs/harness-notes.md) disclose corrected judge probes and capture timing.','Dữ liệu máy đọc chuẩn nằm trong [scores.json](judging/data/scores.json), [metrics.json](judging/data/metrics.json) và [checklist.json](judging/data/checklist.json). [Hướng dẫn script](judging/scripts/README.md) ghi lệnh cụ thể, điều kiện môi trường và phạm vi bảo vệ source. [Ghi chú harness](judging/logs/harness-notes.md) công khai những probe và timing chụp đã được chỉnh của người chấm.',l),'',tr('Final automated checks validate image references, score/metric table values, bilingual numeric/image parity, source hashes, required captures and score evidence paths. The HTML is opened headlessly to verify the language toggle, persistence and every image in both languages. See [file verification](judging/data/verification.json) and [browser verification](judging/data/html-verification.json).','Kiểm tra tự động cuối xác minh đường dẫn ảnh, giá trị bảng điểm/chỉ số, số/ảnh đồng nhất giữa hai ngôn ngữ, hash source, ảnh bắt buộc và đường dẫn bằng chứng cho điểm. HTML được mở headless để kiểm tra nút ngôn ngữ, lưu lựa chọn và mọi ảnh ở cả hai ngôn ngữ. Xem [kiểm tra file](judging/data/verification.json) và [kiểm tra browser](judging/data/html-verification.json).',l),'']
    return relabel_markdown('\n'.join(lines)),expected

CSS='''
:root{color-scheme:dark;--bg:#0b1020;--panel:#131b2d;--ink:#e7eefb;--muted:#aebcd2;--accent:#73dfe5}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.65 system-ui,Segoe UI,sans-serif}header{position:sticky;top:0;z-index:10;display:flex;justify-content:space-between;align-items:center;padding:14px 5vw;background:#0b1020ed;border-bottom:1px solid #35445b;backdrop-filter:blur(12px)}header a{margin-right:16px}button{font:inherit;font-weight:700;background:var(--accent);color:#06131d;border:0;border-radius:6px;padding:9px 20px;cursor:pointer}main{max-width:1500px;margin:auto;padding:30px 4vw 90px}h1{font-size:clamp(28px,3vw,45px);line-height:1.2;max-width:1100px}h2{margin-top:70px;padding-top:18px;border-top:1px solid #35445b;font-size:29px;scroll-margin-top:90px}h3{margin-top:36px;font-size:23px;scroll-margin-top:90px}h4{font-size:18px}p{max-width:1120px}a{color:#9be5f3;text-underline-offset:3px;overflow-wrap:anywhere}strong{color:#fff}code{background:#1d2a42;border-radius:4px;padding:2px 5px}pre{padding:20px;background:#172139;overflow:auto}.table-wrap{overflow-x:auto;margin:20px 0 30px;border:1px solid #34445d;border-radius:6px}table{border-collapse:collapse;width:100%;font-size:14px;line-height:1.5}th,td{padding:11px 12px;text-align:left;vertical-align:top;border-bottom:1px solid #2b3950}th{background:#1c2941;color:#fff}tr:nth-child(even){background:#121c2e}td img{width:100%;min-width:180px;max-width:650px;height:auto;display:block;border:1px solid #3b4f6f;border-radius:3px}td:has(img){width:33.333%}td a:has(img){display:block}details{padding:12px;border:1px solid #34445d}ul{max-width:1120px;padding-left:24px}li{margin:8px 0}.lang-panel[hidden]{display:none!important}.toplinks{font-size:14px}footer{padding:20px 4vw;color:var(--muted);border-top:1px solid #34445d}@media(max-width:700px){main{padding:20px 16px}header{padding:10px 16px}td img{min-width:145px}th,td{padding:8px}h2{font-size:24px}header .toplinks{display:none}}@media print{header{position:static}.lang-panel[hidden]{display:none}body{background:white;color:#17213a}strong{color:#17213a}a{color:#174c73}tr:nth-child(even){background:#eef4fa}th{background:#dce8f4;color:#17213a}.table-wrap{overflow:visible}table{font-size:10px}h2{break-before:page}img{break-inside:avoid}}
'''

def main():
    docs={};expected={}
    for l,file in [('en','README.md'),('vi','README.vi.md')]:
        md,view=render(l);docs[l]=md;expected[l]=view
        dest=ROOT/file
        if l=='en' and not (J/'data/input-root-README.md').exists():shutil.copyfile(dest,J/'data/input-root-README.md')
        dest.write_text(md,encoding='utf-8')
    parser=MarkdownIt('commonmark',{'html':True}).enable('table')
    body={l:parser.render(md)for l,md in docs.items()}
    for l in body:
        body[l]=re.sub(r'<table>(.*?)</table>',r'<div class="table-wrap"><table>\1</table></div>',body[l],flags=re.S)
    script='''const button=document.getElementById('language-toggle');function setLanguage(lang){if(!['en','vi'].includes(lang))lang='en';document.documentElement.lang=lang;document.querySelectorAll('.lang-panel').forEach(p=>p.hidden=p.dataset.lang!==lang);button.textContent=lang==='en'?'Tiếng Việt':'English';button.setAttribute('aria-label',lang==='en'?'Switch to Vietnamese':'Chuyển sang tiếng Anh');try{localStorage.setItem('neonJudgingLang',lang)}catch{} }button.addEventListener('click',()=>setLanguage(document.documentElement.lang==='en'?'vi':'en'));let saved='en';try{saved=localStorage.getItem('neonJudgingLang')||'en'}catch{}setLanguage(saved);'''
    page='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NEON TEMPEST — Independent EN / VI report</title><style>'+CSS+'</style></head><body><header><strong>NEON TEMPEST · A / B / C</strong><nav class="toplinks"><a href="README.md">English Markdown</a><a href="README.vi.md">Tiếng Việt Markdown</a><a href="judging/data/scores.json">Data</a></nav><button id="language-toggle" type="button">Tiếng Việt</button></header><main><article class="lang-panel" data-lang="en">'+body['en']+'</article><article class="lang-panel" data-lang="vi" hidden>'+body['vi']+'</article></main><footer>Independent blind evaluation · Evidence captured locally · No external page assets</footer><script>'+script+'</script></body></html>'
    page=page.replace('NEON TEMPEST · A / B / C','NEON TEMPEST · Argon / Astra / Opus')
    (ROOT/'report.html').write_text(page,encoding='utf-8')
    (J/'data/display-values.json').write_text(json.dumps(expected,ensure_ascii=False,indent=2),encoding='utf-8')
    print('English/Vietnamese Markdown and self-contained HTML rendered from shared data.')
if __name__=='__main__':main()
