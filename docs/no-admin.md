# Local Windows setup

The owner has Python and selected a FastAPI backend with an HTML/CSS/JavaScript frontend.
The strict no-admin constraint was later relaxed, but setup still uses a project-local virtual
environment and an unprivileged loopback port. No Node.js or global package installation is used.

The pinned FastAPI/Starlette versions require **Python 3.11 or newer**. The launcher checks this
before setup. An older Python installation needs an upgrade or a separately agreed compatible
package set. Do not claim compatibility with Python 3.10.

Extract the ZIP into a writable folder. `Start Sound Model.bat` tries the Windows Python launcher
(`py -3`) and then `python`. `launch.py` creates `.venv` beside the app and installs requirements
there. Dependencies are refreshed if the requirements file changes. Initial installation needs
access to PyPI and its package downloads. Map viewing needs `tile.openstreetmap.org`.

The launcher does not request elevation, install services, change PATH, or alter firewall policy.
Corporate execution/network controls can still restrict it. Do not bypass those policies or TLS.
Closing the terminal stops the backend. Native Windows execution remains unverified here.
