"""Post-reveal display names; immutable evidence keeps its original A/B/C paths."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NAMES = {'A': 'Argon', 'B': 'Astra', 'C': 'Opus'}
LEGACY = {name: label for label, name in NAMES.items()}
RAW_FIELDS = {
    'command', 'cwd', 'path', 'reference', 'evidence', 'url', 'argv',
    'verified_descendant_commands', 'command_identity',
}


def relabel_prose(text):
    """Replace identities without changing specification sections or the article A."""
    protected = []

    def keep(match):
        protected.append(match.group(0))
        return f'\x00saved{len(protected) - 1}\x00'

    text = re.sub(
        r'A server address overlap|A separate software-rendering run|'
        r'A genuine observation delay|A paced independent keyboard traversal|A[–-]E',
        keep, text,
    )
    # These first-column cells identify sections of SPEC.md, not submissions.
    text = re.sub(r'(?m)^\| [ABC](?= / \d+ \|)', keep, text)
    text = re.sub(r'\b(?:project-)?([ABC])\b', lambda m: NAMES[m[1]], text)
    for i, original in enumerate(protected):
        text = text.replace(f'\x00saved{i}\x00', original)
    return text


def relabel_markdown(text):
    # Link destinations are immutable evidence addresses; labels/alt text change.
    parts = re.split(r'(\]\([^)]*\))', text)
    return ''.join(p if p.startswith('](') else relabel_prose(p) for p in parts)


def reveal_data(value, parent=''):
    if isinstance(value, dict):
        return {
            (NAMES.get(k, k) if parent not in {'sections', 'spec_sections'} else k):
            reveal_data(v, k) for k, v in value.items()
        }
    if isinstance(value, list):
        return [reveal_data(v, parent) for v in value]
    if isinstance(value, str):
        if parent in RAW_FIELDS or re.match(r'^(?:judging[/\\]|[A-Za-z]:[/\\]|\.\.?[/\\])', value):
            return value
        return relabel_prose(value)
    return value


def legacy_data(value, parent=''):
    """Let existing experiment adapters continue using immutable evidence IDs."""
    if isinstance(value, dict):
        return {LEGACY.get(k, k): legacy_data(v, k) for k, v in value.items()}
    if isinstance(value, list):
        return [legacy_data(v, parent) for v in value]
    if isinstance(value, str) and parent in {'label', 'project', 'order', 'ranking'}:
        return '/'.join(LEGACY.get(part, part) for part in value.split('/'))
    return value
