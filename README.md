# Sound-Model

A local browser application for exploring combined noise from multiple machines, initially
around Greenbushes, Western Australia. Python/FastAPI performs the calculations; plain
HTML, CSS, JavaScript and bundled Leaflet provide the interactive map.

## Run on Windows

1. Extract the whole project ZIP to a writable folder, such as Documents. Do not run it inside the ZIP.
2. Double-click **Start Sound Model.bat**. Python **3.11 or newer** must already be installed.
3. On first launch, it creates `.venv` in this folder and downloads the Python dependencies.
   Keep the terminal open. Your browser opens after the local server is ready.
4. Press **Ctrl+C** in that terminal to stop the server.

No Node.js, npm, global Python installation changes, API key, or paid map account is needed.
Internet access is required for first-time dependency installation and online map tiles.
If your organisation restricts Python execution or internet access, its policies still apply.
The server binds only to your computer (`127.0.0.1`), on port 8765 by default.
If that port is in use, run `python launch.py --port 8766` from the project folder.

## Use the prototype

- Click **Try example** for fictional equipment and positions, or create your own machine types.
- Enter **A-weighted sound power (LwA)**; do not substitute measured sound pressure without a conversion.
- Select a type, click **Place a machine on map**, then click the desired position.
- Drag markers or edit their coordinates. Changing a type updates all its machines.
- Place receivers to see combined levels and each source's contribution and distance.
- Use the latitude/longitude controls to move to another site.
- Cloud cover is recorded but does not change predicted levels in this version.

**Sessions are held in memory. Closing or reloading the page loses your scenario.**
Street mapping is the approved interim layer. Satellite imagery is not yet included.
Online tiles are subject to OpenStreetMap's usage policy and availability; no offline map download exists.

## Model limits

This is an indicative full-space point-source model, not evidence that mine equipment is inaudible
or compliant. It omits ground reflection, terrain, barriers, atmospheric absorption and refraction.
Real source data, background measurements, and a suitable validated propagation method are needed
for an audibility assessment. See [model assumptions](docs/modelling.md).

## Development and checks

See [development](docs/development.md), [architecture](docs/architecture.md),
[map provider notes](docs/maps.md), and [validation evidence](docs/validation.md).
