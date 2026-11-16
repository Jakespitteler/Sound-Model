@echo off
setlocal
cd /d "%~dp0"
py -3 -c "import sys; sys.exit(0 if sys.version_info >= (3,11) else 1)" >nul 2>&1
if not errorlevel 1 (
  py -3 launch.py
  goto finished
)
python -c "import sys; sys.exit(0 if sys.version_info >= (3,11) else 1)" >nul 2>&1
if not errorlevel 1 (
  python launch.py
  goto finished
)
echo Python 3.11 or newer was not found. Check your existing Python installation.
:finished
pause
