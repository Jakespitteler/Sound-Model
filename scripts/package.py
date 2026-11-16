"""Build a portable source ZIP; user supplies Python, dependencies install locally."""
import argparse
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--output', type=Path, default=root.parent / 'artifacts' / 'Sound-Model-Windows.zip')
args = parser.parse_args()
args.output.parent.mkdir(parents=True, exist_ok=True)
files = [root / name for name in ('README.md', 'LICENSE', 'requirements.txt', 'run.py', 'launch.py', 'Start Sound Model.bat')]
for folder in ('app', 'docs', 'tests', 'scripts'):
    files.extend(p for p in (root / folder).rglob('*') if p.is_file() and '__pycache__' not in p.parts and p.suffix != '.pyc')
with zipfile.ZipFile(args.output, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(files):
        archive.write(path, Path('Sound-Model') / path.relative_to(root))
print(f'Created {args.output} ({len(files)} files)')
