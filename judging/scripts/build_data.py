from pathlib import Path
from decimal import Decimal
import collections, json, math, re
ROOT=Path(__file__).resolve().parents[2];J=ROOT/'judging';D=J/'data'
def read(p): return json.loads((ROOT/p).read_text(encoding='utf-8'))
def save(name,data): (D/name).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
def ref(x,file,needle):
    p=J/'work'/x/file
    lines=p.read_text(encoding='utf-8').splitlines()
    for i,line in enumerate(lines,1):
        if needle in line: return f'judging/work/{x}/{file}#L{i}'
    raise ValueError((x,file,needle))
def log(x,n): return f'judging/logs/{x}/{n}'
def img(x,n): return f'judging/screenshots/{x}/{n}.png'
def pair(en,vi): return {'en':en,'vi':vi}

requirements=[
 ('A1','Vite/npm, Canvas/WebGL, documented one-command startup','Vite/npm, Canvas/WebGL, khởi động bằng một lệnh'),
 ('A2','Procedural art, stages, animation, VFX and Web Audio; no external assets','Đồ họa, sân đấu, animation, VFX và Web Audio sinh bằng code; không dùng asset ngoài'),
 ('A3','Deterministic, serializable 60 Hz simulation, decoupled rendering','Simulation 60 Hz có tính determinism, serialize được, tách khỏi rendering'),
 ('A4','Data-defined characters, moves, frame data, boxes and projectiles','Nhân vật, chiêu, frame data, các loại box và projectile được định nghĩa bằng data'),
 ('B1','Full move frame data; separate per-frame collision box types','Frame data đầy đủ; tách riêng các loại collision box theo frame'),
 ('B2','Buffer, SOCD, motions/charge, negative edge, macros, device remapping','Buffer, SOCD, motion/charge, negative edge, macro và remap thiết bị'),
 ('B3','Complete normals, command normals, throws, specials/EX/Super/Ultimate','Đầy đủ normal, command normal, throw, special/EX/Super/Ultimate'),
 ('B4','Movement, blocking, pushblock, throw tech, wakeup, juggle, air tech and walls','Di chuyển, block, pushblock, throw tech, wakeup, juggle, air tech và xử lý góc sân'),
 ('B5','Links/chains/cancels, scaling, combo/damage display and dizzy','Link/chain/cancel, scaling, hiển thị combo/damage và dizzy'),
 ('B6','Three-stock meter, EX, defensive resource tool and risky overdrive','Meter ba stock, EX, công cụ phòng thủ và overdrive có đánh đổi'),
 ('B7','Best-of-three, timer, time-over, KO/draw/perfect and presentation','Đấu theo round, timer, time-over, KO/draw/perfect và phần trình diễn'),
 ('B8','Hitstop, shake, sparks, block FX, camera, shadows and cinematic supers','Hitstop, shake, spark, block FX, camera, bóng nhân vật và super cinematic'),
 ('B9','Difficulty/personality, spacing/defense/combos/meter, fair input-driven CPU','Độ khó/cá tính, spacing/phòng thủ/combo/meter, CPU dùng input công bằng'),
 ('B10','Arcade, local versus, full training, validated trials and last-match replay','Arcade, versus tại máy, training đầy đủ, trial có kiểm tra và replay trận gần nhất'),
 ('C1','Complete animated screen flow, selection, results, pause and return','Luồng màn hình có animation, chọn nhân vật/sân, kết quả, pause và quay lại'),
 ('C2','Complete legible match HUD, trails, meters, inputs, announcements and warnings','HUD đủ thành phần, dễ đọc, có trail, meter, input, thông báo và cảnh báo'),
 ('C3','Described move lists with clear motion icons and training frame data','Move list có mô tả, ký hiệu motion rõ ràng và frame data trong training'),
 ('C4','Remapping, audio/video/accessibility settings, fullscreen, language-ready text','Remap, thiết lập âm thanh/hình ảnh/accessibility, fullscreen, sẵn cấu trúc ngôn ngữ'),
 ('C5','Responsive letterboxing, crisp DPR rendering, keyboard/gamepad menus','Letterbox theo cửa sổ, rendering rõ theo DPR, menu dùng keyboard/gamepad'),
 ('C6','Cohesive design system, interaction motion and sound; no placeholder feel','Thiết kế thống nhất, tương tác có chuyển động/âm thanh, không mang cảm giác placeholder'),
 ('C7','Distinct original animated parallax stages with ambience/music','Các sân đấu riêng biệt, có animation/parallax và âm thanh/nhạc tương ứng'),
 ('C8','Menu/stage/victory music, action/UI SFX, mute and volume controls','Nhạc menu/sân/chiến thắng, SFX cho hành động/UI, mute và chỉnh âm lượng'),
 ('D1','Stable FPS/GC, pooling, low latency, cleanup, visibility pause, clean console','FPS/GC ổn định, pooling, độ trễ thấp, cleanup, pause khi ẩn tab, console sạch'),
 ('D2','Clean typed modular architecture with useful comments','Kiến trúc có type, chia module rõ và comment hữu ích'),
 ('E1','Meaningful passing unit coverage of every specified combat/input topic','Unit test có ý nghĩa, chạy đạt và bao phủ các chủ đề combat/input đã yêu cầu'),
 ('E2','Passing keyboard/menu/special/HUD/round browser verification','Browser test chạy đạt cho keyboard/menu/special/HUD/round'),
 ('E3','Reproducible large CPU balance run, matrix and match length','Chạy cân bằng CPU tái lập được, có ma trận và thời lượng trận'),
 ('E4','Screenshot verification deliverables and visual review/fixes','Có bộ ảnh kiểm tra và bằng chứng rà soát/sửa lỗi hình ảnh'),
 ('E5','Real rendered match benchmark with frame pacing and memory output','Benchmark trận được render thực, có frame pacing và memory'),
 ('E6','Successful production build and measured bundle','Build production thành công và đo bundle'),
]
statuses={
 'A':'I I I I I P I I I I I I P P P I I P P P I I P P P B I P B I'.split(),
 'B':'I I I I I I I P I I I I P I P I I I I I I P P P I I I P I I'.split(),
 'C':'I I I I I P I I I I I I I I I I I I I P I I P I I I I P I I'.split(),
}
status_name={'I':'Implemented','P':'Partial','M':'Missing','B':'Broken'}

def checklist_evidence(x):
    base={
    'A1':(pair('README command reached a live server; production build passed.','Lệnh trong README mở được server; build production chạy đạt.'),[log(x,'readme-start.log'),log(x,'build.log')]),
    'A2':(pair('Source uses procedural drawing/synthesis; no runtime image, font or audio asset files in the submission source.','Source dùng lệnh vẽ và tổng hợp âm thanh; không có file ảnh/font/audio dùng lúc chạy trong source.'),[ref(x,'src/main.ts','import'),log(x,'original-manifest.json')]),
    'A3':(pair('Independent same-input replay and JSON serialization continuation match; fixed-step loop is separate from presentation.','Replay độc lập với cùng input và phần chạy tiếp sau JSON serialization khớp; vòng lặp fixed-step tách khỏi trình diễn.'),[log(x,'determinism.json')]),
    'A4':(pair('Loaded move inventory is defined in character data, including all normal stances.','Inventory lấy trực tiếp từ character data có đầy đủ normal theo tư thế.'),[log(x,'roster-inventory.json')]),
    'B1':(pair('Typed move schema and simulation define timing, boxes, hit levels, cancels, armor and invulnerability.','Schema có type và simulation định nghĩa timing, box, hit level, cancel, armor và invulnerability.'),[log(x,'roster-inventory.json'),log(x,'combat-spotchecks.json')]),
    'B2':(pair('Motion/charge/negative-edge and device paths inspected and exercised; boundary limitations noted below.','Đã đọc và kiểm tra đường xử lý motion/charge/negative edge và thiết bị; các giới hạn ở biên được nêu bên dưới.'),[log(x,'keyboard-qcf-state.json'),log(x,'edge-cases.json')]),
    'B3':(pair('Every fighter has the full standing/crouching/air normal set, directional throws, special variants, EX and finishers.','Mỗi võ sĩ có đủ normal đứng/ngồi/trên không, throw theo hướng, các bản special, EX và chiêu kết liễu.'),[log(x,'roster-inventory.json')]),
    'B4':(pair('Simulation movement/defense paths inspected; throw, guard, charge and air-mobility probes run in the browser.','Đã đọc xử lý di chuyển/phòng thủ và chạy probe throw, guard, charge, di chuyển trên không trong trình duyệt.'),[log(x,'combat-spotchecks.json')]),
    'B5':(pair('Input-driven combo forms, counter advances, scaling exists and is covered by actual combat assertions.','Combo tạo từ input chạy được, counter tăng, có scaling và assertion kiểm tra combat thực.'),[log(x,'combat-spotchecks.json'),img(x,'08-mid-combo')]),
    'B6':(pair('Meter gain and a paid Super Art were observed; EX, defensive tools and overdrive costs/risk are defined.','Đã quan sát meter tăng và Super Art tiêu meter; có định nghĩa chi phí/rủi ro của EX, công cụ phòng thủ và overdrive.'),[log(x,'combat-spotchecks.json'),img(x,'09-super-active')]),
    'B7':(pair('Timer decreases, forced near-expiry uses the real time-over path, and attack-generated KO advances rounds.','Timer giảm, fixture gần hết giờ đi qua xử lý time-over thật, KO từ đòn đánh chuyển được round.'),[log(x,'combat-spotchecks.json'),img(x,'10-ko-round-end')]),
    'B8':(pair('Hitstop, buffered inputs, camera/shake, impact FX and super presentation are visible and implemented in code.','Code có hitstop, input buffer, camera/shake, impact FX; quan sát được phần trình diễn super.'),[img(x,'09-super-active'),img(x,'18-special-strip'),log(x,'combat-spotchecks.json')]),
    'B9':(pair('Hard CPU completes the shared balance workload; decision/input policy reviewed for fairness and personality.','CPU Hard hoàn thành lượt chạy cân bằng chung; đã đọc chính sách quyết định/input để đánh giá tính công bằng và cá tính.'),[log(x,'independent-balance.json')]),
    'B10':(pair('Modes and tools exist; training overlay and trials were opened; replay assertions reviewed.','Có các mode và công cụ; đã mở overlay training và trial, đồng thời đọc assertion replay.'),[img(x,'11-training-hitboxes'),img(x,'21-trials'),log(x,'unit-results.json')]),
    'C1':(pair('Keyboard flow reaches selection, versus and match; settings, move list, pause and results are captured.','Luồng keyboard vào được màn chọn, versus và trận; đã chụp settings, move list, pause và results.'),[log(x,'browser-flow.json'),img(x,'14-results')]),
    'C2':(pair('Health, meter stocks, round pips, timer, stun/input/combo/announcement rendering inspected.','Đã kiểm tra cách vẽ health, stock meter, round pip, timer, stun/input/combo/thông báo.'),[img(x,'07-match-hud-start'),img(x,'08-mid-combo')]),
    'C3':(pair('Character tabs, motion notation, descriptions and frame information are present.','Có tab nhân vật, ký hiệu motion, mô tả chiêu và thông tin frame.'),[img(x,'12-move-list')]),
    'C4':(pair('Settings expose volume, visual toggles and remapping; device/fullscreen/localization paths reviewed.','Settings có âm lượng, tùy chọn hình ảnh và remap; đã đọc đường xử lý thiết bị/fullscreen/ngôn ngữ.'),[img(x,'13-settings')]),
    'C5':(pair('Portrait and ultrawide viewports preserve the game aspect ratio; keyboard flow works; device code reviewed.','Cửa sổ dọc và siêu rộng giữ đúng tỉ lệ sân đấu; luồng keyboard chạy được; đã đọc code thiết bị.'),[log(x,'resize.json'),log(x,'browser-flow.json')]),
    'C6':(pair('Visual consistency judged from the complete judge-captured gallery; detailed legibility/animation limitations are recorded.','Đánh giá tính thống nhất từ toàn bộ ảnh do người chấm chụp; có ghi rõ giới hạn về khả năng đọc và animation.'),[img(x,'03-main-menu'),img(x,'04-character-select'),log(x,'visual-review.json')]),
    'C7':(pair('All stage variants render with animated ambience; screenshots compare their actual layouts.','Tất cả biến thể sân render được với môi trường có chuyển động; ảnh cho thấy bố cục thực tế.'),[img(x,'15-stage-1'),img(x,'16-stage-2'),img(x,'17-stage-3')]),
    'C8':(pair('Synthesized audio paths and volume controls exist; auditory taste has not been human-tested.','Có âm thanh tổng hợp và chỉnh âm lượng; chất lượng nghe chưa được người chơi đánh giá.'),[img(x,'13-settings')]),
    'D1':(pair('No browser errors in the shared play run; visibility event pauses the simulation, but frame-time tails and allocation paths prevent full credit.','Lượt chơi chung không có lỗi trình duyệt; sự kiện visibility dừng simulation, nhưng frame-time đuôi và chỗ cấp phát bộ nhớ chưa đạt trọn yêu cầu.'),[log(x,'two-minute-play.json'),log(x,'visibility.json'),log(x,'independent-benchmark-gpu.json')]),
    'D2':(pair('Typed module separation inspected; monolithic scene/application code and cleanup gaps are called out.','Đã đọc cách chia module có type; chỉ ra những phần scene/application quá tập trung và thiếu sót cleanup.'),[log(x,'source-evidence.json')]),
    'E1':(pair('Executed own unit suite; assertions inspected for behavior rather than filenames or README promises.','Đã chạy unit suite của dự án và đọc assertion theo hành vi, không dựa vào tên test hay lời hứa trong README.'),[log(x,'unit-results.json'),log(x,'source-evidence.json')]),
    'E2':(pair('Executed original browser suite under the common viewport; exact pass/fail result is retained.','Đã chạy browser suite gốc ở viewport chung; lưu nguyên kết quả đạt/trượt.'),[log(x,'own-e2e.log'),log(x,'e2e-results.json')]),
    'E3':(pair('Shared seeded headless balance script completes the full required match workload with no crashes or cap hits.','Script cân bằng headless chung, có seed, hoàn thành số trận yêu cầu mà không crash hoặc chạm giới hạn frame.'),[log(x,'independent-balance.json')]),
    'E4':(pair('Submission screenshot tools/assets exist; the author’s claimed inspection/fix process cannot be independently established. Judge captures are separate evidence.','Có công cụ/ảnh screenshot của bài nộp; chưa xác minh độc lập được quy trình tự xem và sửa mà tác giả tuyên bố. Ảnh của người chấm là bằng chứng riêng.'),[log(x,'original-manifest.json'),log(x,'visual-review.json')]),
    'E5':(pair('Project benchmark method inspected against a shared real-rAF workload; submitted values are treated as claims.','Đã đối chiếu cách benchmark của dự án với workload rAF thực dùng chung; số liệu nộp kèm được xem là tuyên bố cần kiểm chứng.'),[log(x,'submitted-bench.json'),log(x,'independent-benchmark-gpu.json')]),
    'E6':(pair('The exact production build command passed and every output file was measured, including gzip.','Lệnh build production chạy đạt; đã đo mọi file đầu ra, gồm cả gzip.'),[log(x,'build.log'),'judging/data/objective.json']),
    }
    if x=='A':
        base['B2']=(pair('The documented HCF grab binding selects a shoulder charge; unordered cardinals count as a rotation. Gamepad remapping/macros are incomplete.','Binding HCF grab trong tài liệu lại chọn shoulder charge; cardinal sai thứ tự cũng được nhận là rotation. Remap gamepad/macro còn thiếu.'),[log(x,'edge-cases.json'),ref(x,'src/input/inputBuffer.ts',"case '360'")])
        base['B9']=(pair('Uses current opponent attack/level before the neutral cooldown; defensive decisions lack a perception delay.','Đọc đòn/hit level hiện tại của đối thủ trước cooldown neutral; quyết định phòng thủ không có perception delay.'),[ref(x,'src/ai/cpuController.ts','// 4. Defensive Reaction'),log(x,'independent-balance.json')])
        base['B10']=(pair('Training/trial/replay code exists, but the submission has no executable validation of all trials or a browser replay hash.','Có code training/trial/replay, nhưng chưa có kiểm tra thực thi toàn bộ trial hoặc hash replay trong trình duyệt.'),[ref(x,'src/scenes/gameApp.ts','private updateComboTrialValidation'),log(x,'unit-results.json')])
        base['C1']=(pair('The mode choices are merged into the main menu; there is no separate mode-select screen.','Các lựa chọn mode nằm chung trong main menu; không có màn mode select riêng.'),[img(x,'03-main-menu'),img(x,'20-mode-select')])
        base['C4']=(pair('Keyboard remapping and audiovisual toggles exist; fullscreen and gamepad-remapping UI are absent. Many labels are hardcoded.','Có remap keyboard và tùy chọn âm thanh/hình ảnh; thiếu UI fullscreen và remap gamepad. Nhiều nhãn viết cứng trong code.'),[img(x,'13-settings'),ref(x,'src/data/settings.ts','export interface GameSettings')])
        base['C5']=(pair('Letterboxing works, but at the judge viewport the backing canvas remains lower resolution, visibly softening small text.','Letterbox chạy đúng, nhưng backing canvas vẫn có độ phân giải thấp hơn viewport kiểm tra, làm chữ nhỏ bị mềm.'),[log(x,'resize.json'),ref(x,'src/scenes/gameApp.ts','this.canvas.width = Math.round(1280 * dpr)')])
        base['E1']=(pair('The small suite has meaningful broad assertions but lacks granular boundary, trial, replay and finisher coverage.','Suite nhỏ có assertion hành vi hữu ích, nhưng thiếu coverage chi tiết cho biên input, trial, replay và finisher.'),[log(x,'unit-results.json'),ref(x,'tests/simulation.test.ts',"it('parses all motion")])
        base['E2']=(pair('The submitted E2E fails at the move-list keyboard navigation assertion.','E2E của bài nộp trượt ở assertion điều hướng keyboard vào move list.'),[log(x,'own-e2e.log')])
        base['E5']=(pair('The script replaces the game loop and paints into an offscreen software canvas using scheduled steps; it is not an on-screen rAF FPS benchmark.','Script thay vòng lặp game, vẽ vào canvas phần mềm ngoài màn hình và tự lên lịch step; đây không phải benchmark FPS rAF của màn hình game.'),[ref(x,'scripts/bench.ts','const benchCanvas'),ref(x,'scripts/bench.ts','const dueFrames')])
    if x=='B':
        base['B4']=(pair('Normal throws connect, but no tested full-step throw-tech timing succeeds: a defensive throw consumes its edge before collision resolution.','Throw thường trúng, nhưng không timing throw tech nào trong probe full-step thành công: throw phòng thủ dùng mất cạnh input trước khi resolve va chạm.'),[log(x,'edge-cases.json'),ref(x,'src/core/sim.ts','p.input.used = s.frame;'),ref(x,'src/core/sim.ts','trigger(d.input, "THROW")')])
        base['B9']=(pair('Decision waits and rolled motions exist, but guard choice reads the opponent’s current move and exact hit level.','Có thời gian chờ quyết định và motion từng frame, nhưng chọn guard vẫn đọc chiêu và hit level hiện tại của đối thủ.'),[ref(x,'src/ai/cpu.ts','if (o.move && dist < 190'),log(x,'independent-balance.json')])
        base['C1']=(pair('Main menu doubles as mode select; the rest of the flow works and is captured.','Main menu kiêm mode select; các phần còn lại của luồng chạy được và đã chụp ảnh.'),[img(x,'03-main-menu'),img(x,'20-mode-select')])
        base['C8']=(pair('Stage/menu synthesis works, but the distinct victory-tempo branch is not selected by the results flow; SFX use broad action classes.','Nhạc sân/menu tổng hợp chạy được, nhưng luồng results không chọn nhánh tempo chiến thắng riêng; SFX gom theo nhóm hành động rộng.'),[ref(x,'src/audio/synth.ts','this.theme === 3 ? 130'),ref(x,'src/main.ts','if (scene === "results")')])
    if x=='C':
        base['B2']=(pair('Broad parser coverage and device remapping work; rotation recognition deliberately accepts unordered cardinal directions, reducing motion strictness.','Parser có coverage rộng và remap thiết bị chạy được; rotation cố ý nhận cardinal không theo thứ tự, làm điều kiện motion quá dễ.'),[log(x,'edge-cases.json'),ref(x,'src/sim/input.ts','function match360')])
        base['C6']=(pair('Cohesive original neon typography and panels, but glow, thin small labels and busy backdrops reduce readability; it is below the exceptional quality bar.','Typography neon và panel thống nhất, có cá tính; glow, nhãn nhỏ nét mảnh và nền dày chi tiết làm giảm khả năng đọc, chưa đạt mức xuất sắc.'),[img(x,'04-character-select'),img(x,'11-training-hitboxes'),log(x,'visual-review.json')])
        base['C5'][1].append(ref(x,'src/core/view.ts','begin(): void'))
    return base

categories=[
 ('runs',10,'Runs and stability','Khả năng chạy và độ ổn định'),
 ('combat',20,'Combat depth and correctness','Độ sâu và tính đúng đắn của combat'),
 ('feel',10,'Game feel — code estimate','Game feel — ước lượng từ code'),
 ('ai',8,'CPU AI quality','Chất lượng CPU AI'),
 ('ui',20,'UI/UX','UI/UX'),
 ('visuals',10,'Visuals, VFX, stages, audio','Đồ họa, VFX, sân đấu, âm thanh'),
 ('balance',5,'Balance and roster completeness','Cân bằng và độ đầy đủ của roster'),
 ('performance',7,'Performance','Hiệu năng'),
 ('tests',7,'Tests and self-verification','Test và tự kiểm chứng'),
 ('architecture',3,'Code architecture and README accuracy','Kiến trúc code và độ chính xác của README'),
]
raw_scores={'A':[8,7.2,6.5,5.0,6.0,5.4,6.6,None,3.8,4.8],
            'B':[8,7.1,7.1,6.2,8.2,7.1,7.2,None,7.3,7.0],
            'C':[8,8.4,8.0,8.2,7.8,8.0,6.7,None,8.6,8.1]}
def perf_score(b):
    a,l,p=b['fps_average'],b['fps_1pct_low'],b['p95_frame_ms']
    if a>=59 and l>=50 and p<=17.5:return 8.5
    if a>=58 and l>=40 and p<=20:return 8.0
    if a>=55 and l>=30 and p<=33.5:return 7.0
    if a>=50 and l>=25:return 6.0
    if a>=40:return 5.0
    if a>=30:return 4.0
    if a>=20:return 3.0
    if a>=10:return 2.0
    return 1.0

def main():
    objective=read('judging/data/objective.json');metrics={};checklist={'method':pair('Equal-weight requirements; Implemented = full, Partial = half, Missing/Broken = zero. Unnumbered D bullets are D1/D2. Only sections A–E enter this percentage.','Mỗi yêu cầu có trọng số ngang nhau; Implemented tính đủ, Partial tính nửa, Missing/Broken tính không. Hai bullet không đánh số ở phần D được ghi là D1/D2. Chỉ phần A–E được tính phần trăm này.'),'projects':{}}
    source_evidence={}
    for x in 'ABC':
        assert len(statuses[x])==len(requirements)
        ce=checklist_evidence(x);rows=[];sections={}
        for (rid,en,vi),status in zip(requirements,statuses[x]):
            desc,evidence=ce[rid];rows.append({'id':rid,'requirement':pair(en,vi),'status':status_name[status],'credit':1 if status=='I' else .5 if status=='P' else 0,'finding':desc,'evidence':evidence})
        for s in 'ABCDE':
            r=[z for z in rows if z['id'].startswith(s)];sections[s]={'requirements':len(r),'earned':sum(z['credit']for z in r),'completion_percent':round(100*sum(z['credit']for z in r)/len(r),2)}
        completion=round(100*sum(z['credit']for z in rows)/len(rows),2)
        checklist['projects'][x]={'sections':sections,'completion_percent':completion,'rows':rows,'status_counts':dict(collections.Counter(r['status']for r in rows))}
        unit=read(log(x,'unit-results.json'));e2e=read(log(x,'e2e-results.json'));balance=read(log(x,'independent-balance.json'));bench=read(log(x,'independent-benchmark-gpu.json'));software=read(log(x,'independent-benchmark.json'));play=read(log(x,'two-minute-play.json'));flow=read(log(x,'browser-flow.json'));own=read(log(x,'submitted-bench.json'))
        own_avg=own.get('averageFPS',own.get('averageFps'));own_low=own.get('onePercentLowFPS',own.get('onePercentLowFps'))
        metric={'startup':objective[x]['startup'],'build':objective[x]['build'],'bundle':objective[x]['bundle'],
                'unit_tests':{k:unit[k]for k in ['numTotalTests','numPassedTests','numFailedTests']},'e2e':e2e['stats'],
                'browser_console':{'errors':sum(z['type'] in ['error','pageerror']for z in play['issues']+flow['errors']),'warnings':sum(z['type']=='warning'for z in play['issues']+flow['errors']),'scope':'Independent production browser flow and two-minute keyboard gameplay; excludes Vite HMR and node runner color warnings.'},
                'benchmark':{k:v for k,v in bench.items()if k not in ['raw_frame_deltas_ms','states','heap_samples','events']},
                'software_benchmark':{k:software[k]for k in ['fps_average','fps_1pct_low','p95_frame_ms','heap_growth_bytes']},
                'submitted_benchmark_comparison':{'submitted_avg_fps':own_avg,'submitted_1pct_low':own_low,'avg_relative_change_percent':round(100*(bench['fps_average']/own_avg-1),2),'low_relative_change_percent':round(100*(bench['fps_1pct_low']/own_low-1),2),
                    'numeric_mismatch':abs(bench['fps_average']/own_avg-1)>.10 or abs(bench['fps_1pct_low']/own_low-1)>.25,'comparable_conditions':False,'note':pair('Different viewport/backends/workloads; mismatch is a reproduction flag, not proof of a false claim. A also changes the game loop and render target.','Viewport/backend/workload khác nhau; chênh lệch chỉ là cờ cảnh báo tái lập, không chứng minh tuyên bố sai. A còn đổi vòng lặp và render target.')},
                'play':{'duration_seconds':play['duration_seconds'],'input_cycles':play['input_cycles'],'issues':play['issues']},
                'determinism':balance['determinism'],'balance':{k:balance[k]for k in ['attempted','completed','crashes','softlocks','average_match_seconds','winRates','matrix']},
                'spec_completion_percent':completion,'spec_sections':sections}
        for w in metric['balance']['winRates']:
            n=w['matches'];p=w['percent']/100;z=1.96;den=1+z*z/n;c=(p+z*z/(2*n))/den;h=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;w['wilson_95_percent']=[round(100*(c-h),2),round(100*(c+h),2)]
        metrics[x]=metric
        # Copy source lines quoted by checklist/score notes into a reproducible evidence ledger.
        refs={e for row in rows for e in row['evidence']if '#L' in e}
        source_evidence[x]=[]
        for e in sorted(refs):
            file,line=e.split('#L');lines=(ROOT/file).read_text(encoding='utf-8').splitlines();n=int(line)
            source_evidence[x].append({'reference':e,'excerpt':[f'{k+1}: {lines[k]}'for k in range(max(0,n-2),min(len(lines),n+5))]})
        (J/'logs'/x/'source-evidence.json').write_text(json.dumps(source_evidence[x],ensure_ascii=False,indent=2),encoding='utf-8')
    save('metrics.json',metrics);save('checklist.json',checklist)
    scores={'weights':{c[0]:c[1]for c in categories},'category_names':{c[0]:pair(c[2],c[3])for c in categories},'formula':'sum(score_0_to_10 * category_weight / 10); total out of 100',
            'performance_thresholds':'8.5: avg>=59, low>=50, p95<=17.5; 8: avg>=58, low>=40, p95<=20; 7: avg>=55, low>=30, p95<=33.5; 6: avg>=50, low>=25; 5: avg>=40; 4: avg>=30; 3: avg>=20; 2: avg>=10; 1 otherwise. Applied to common GPU-headless benchmark.',
            'projects':{}}
    assert sum(scores['weights'].values())==100
    for x in 'ABC':
        vals=raw_scores[x];vals[7]=perf_score(metrics[x]['benchmark'])
        ev={
        'runs':[log(x,'readme-start.log'),log(x,'build.log'),log(x,'two-minute-play.json'),log(x,'independent-balance.json')],
        'combat':[log(x,'combat-spotchecks.json'),log(x,'edge-cases.json'),log(x,'roster-inventory.json')],
        'feel':[ref(x,'src/core/simulation.ts'if x=='A'else'src/core/sim.ts'if x=='B'else'src/core/loop.ts','Allow buffering cancels during hitstop'if x=='A'else'Retain the direction and EX modifier'if x=='B'else'Fixed-timestep game loop')],
        'ai':[ref(x,'src/ai/cpuController.ts'if x=='A'else'src/ai/cpu.ts','getInput('if x=='A'else'export function cpu'if x=='B'else'private seen()'),log(x,'independent-balance.json')],
        'ui':[log(x,'browser-flow.json'),img(x,'03-main-menu'),img(x,'04-character-select'),img(x,'13-settings')],
        'visuals':[img(x,'15-stage-1'),img(x,'16-stage-2'),img(x,'17-stage-3'),img(x,'09-super-active'),img(x,'18-special-strip')],
        'balance':[log(x,'independent-balance.json'),log(x,'roster-inventory.json')],
        'performance':[log(x,'independent-benchmark-gpu.json'),log(x,'independent-benchmark.json')],
        'tests':[log(x,'unit-results.json'),log(x,'own-e2e.log'),log(x,'edge-cases.json')],
        'architecture':[log(x,'source-evidence.json'),log(x,'own-e2e.log'),ref(x,'src/scenes/gameApp.ts'if x=='A'else'src/main.ts'if x=='B'else'src/core/app.ts','export class GameApp'if x=='A'else'class Game'if x=='B'else'export class App')],
        }
        if x=='A':ev['feel'].append(ref(x,'src/core/simulation.ts','state.cameraZoom = lerp'))
        if x=='B':ev['feel'].append(ref(x,'src/render/renderer.ts','this.camera = lerp'))
        if x=='C':ev['feel'] += [ref(x,'src/sim/input.ts','export const BUFFER_SPECIAL'),ref(x,'src/sim/match.ts','const frozen = [a.hitstop > 0'),ref(x,'src/render/camera.ts','const half = W / 2 / cam.zoom')]
        cats={k:{'score':v,'weight':w,'assessment':'verified by tool'if k in ['runs','performance','tests']else'judged visually/by reading','evidence':ev[k]}for(k,w,_,_),v in zip(categories,vals)}
        total=sum(Decimal(str(v))*Decimal(str(w))/Decimal(10)for(_,w,_,_),v in zip(categories,vals))
        scores['projects'][x]={'categories':cats,'total':float(total.quantize(Decimal('.01'))),'spec_completion_percent':metrics[x]['spec_completion_percent'],'human_playtest_score':None}
    ranking=sorted(scores['projects'],key=lambda x:scores['projects'][x]['total'],reverse=True)
    for i,x in enumerate(ranking,1): scores['projects'][x]['rank']=i
    scores['ranking']=ranking
    scores['consistency_review']=pair('All highest and lowest category scores were reread against the same anchors. Identical run/stability scores are intentional: startup, builds, long play and the balance safety checks all pass. No category reaches the near-commercial band; human game feel and audio taste remain unverified.','Đã đọc lại điểm cao nhất và thấp nhất theo cùng thang chuẩn. Điểm chạy/ổn định bằng nhau là có chủ đích: cả ba đều đạt khởi động, build, chơi kéo dài và kiểm tra an toàn trong lượt cân bằng. Không hạng mục nào đạt mức gần thương mại; game feel và gu âm thanh vẫn chưa được người chơi kiểm chứng.')
    save('scores.json',scores)
    print(json.dumps({'ranking':ranking,'totals':{x:scores['projects'][x]['total']for x in 'ABC'},'completion':{x:metrics[x]['spec_completion_percent']for x in 'ABC'}},indent=2))
if __name__=='__main__':main()
