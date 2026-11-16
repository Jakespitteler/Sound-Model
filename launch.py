"""Windows-friendly bootstrap using the user's existing Python. No global installs."""
import hashlib
import os
from pathlib import Path
import subprocess
import sys
import venv


def main():
    if sys.version_info < (3, 10):
        raise RuntimeError('Sound-Model needs Python 3.10 or newer.')
    root = Path(__file__).resolve().parent
    environment = root / '.venv'
    executable = environment / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
    if not executable.exists():
        print('Creating a project-local Python environment…', flush=True)
        venv.create(environment, with_pip=True)
    requirements = root / 'requirements.txt'
    digest = hashlib.sha256(requirements.read_bytes()).hexdigest()
    marker = environment / 'sound-model-requirements.sha256'
    if not marker.exists() or marker.read_text() != digest:
        print('Installing approved Python dependencies. Internet is needed for this first setup.', flush=True)
        subprocess.run([str(executable), '-m', 'pip', 'install', '--disable-pip-version-check',
                        '--cache-dir', str(environment / 'pip-cache'), '-r', str(requirements)], check=True)
        marker.write_text(digest)
    print('Starting Sound-Model. Keep this window open; press Ctrl+C to stop.', flush=True)
    return subprocess.call([str(executable), str(root / 'run.py'), *sys.argv[1:]], cwd=root)


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        pass
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f'Could not start Sound-Model: {error}', file=sys.stderr)
        raise SystemExit(1)
