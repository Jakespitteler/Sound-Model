# Decision record

Dates use Australia/Perth. Approvals below refer to explicit statements by the project owner
in chat on 2026-11-16; proposals are not approvals.

| ID | Status | Decision | Approver and rationale |
| --- | --- | --- | --- |
| D001 | Approved | Browser application; Greenbushes first, other sites supported | Project owner: browser is fine; app should work anywhere |
| D002 | Approved | Static scenarios | Project owner declined time simulation |
| D003 | Approved | Machine data supplied later | Project owner: add that later |
| D004 | Approved | Cloud cover initially; wind, temperature, terrain, barriers deferred | Project owner explicitly requested this scope |
| D005 | Approved | Free maps; Apple optional | Project owner has no Apple account and requires no payment |
| D006 | Approved | Begin setup with indicative-model limitations | Project owner accepted the stated limitations and said to get started |
| D007 | Superseded | TypeScript, Vite, Leaflet, Vitest | Project owner, 2026-11-16: approved provided installation and running need no admin permissions |
| D008 | Approved | OpenStreetMap standard street tiles as an initial fallback | Project owner, 2026-11-16: approved proposal; satellite remains required and terms must be checked |
| D009 | Approved | Baseline geometric spreading and energetic summation | Project owner, 2026-11-16: approved the documented prototype proposal with no-admin condition |
| D010 | Approved | Cloud cover metadata without numerical correction | Project owner, 2026-11-16: approved prototype proposal |

Do not mark a proposal approved merely because setup was authorised. Record actual subsequent
approval, date, rationale, and any scope changes here.

D011 — Approved, 2026-11-16, project owner: dependency installation and running the app must require no administrator permissions. Use project-local npm dependencies, an existing or user-local Node installation, and an unprivileged port.

## Superseding stack decisions — 2026-11-16

The project owner explicitly selected Python with FastAPI for the backend and HTML, CSS,
and JavaScript for the frontend, and approved Uvicorn in response to the server proposal.
This supersedes D007's TypeScript/Vite/Vitest choice and the intermediate standalone-file
and compiled-backend proposals. Do not use Node.js. The owner has Python on Windows.
Leaflet remains the previously approved map library. Ask before choosing any additional
third-party technology. FastAPI's required transitive dependencies are installed with it.
Use Python unittest and the existing Chromium browser for validation; no test framework is added.
The owner relaxed the strict no-admin constraint, but project-local installation is still preferred.
The frontend calls a local FastAPI backend for acoustic calculations. Uvicorn binds to loopback.

D012 — Approved, 2026-11-16, project owner: Python/FastAPI backend and HTML/CSS/JavaScript frontend; Uvicorn explicitly approved in the follow-up choice. Leaflet remains approved. Ask before any additional third-party technology. This is the active stack decision.
