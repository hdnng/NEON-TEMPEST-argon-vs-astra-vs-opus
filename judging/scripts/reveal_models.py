"""One-time reversible label migration. Never touches source, logs, or game captures."""
import json
import shutil
from model_labels import ROOT, reveal_data


def main():
    before = ROOT / 'judging/logs/reveal/before'
    if before.exists():
        raise SystemExit('Reveal baseline already exists; no second migration was performed.')
    (before / 'data').mkdir(parents=True)
    for name in ['README.md', 'README.vi.md', 'report.html']:
        shutil.copyfile(ROOT / name, before / name)
    for path in sorted((ROOT / 'judging/data').glob('*.json')):
        if path.name == 'run-configuration.json':
            continue
        shutil.copyfile(path, before / 'data' / path.name)
        old = json.loads(path.read_text(encoding='utf-8'))
        path.write_text(json.dumps(reveal_data(old), ensure_ascii=False, indent=2), encoding='utf-8')
    print('Original reports/data archived; project labels migrated, numerical values preserved.')


if __name__ == '__main__':
    main()
