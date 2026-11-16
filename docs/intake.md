# Project intake

Recorded 2026-11-16 from the project owner's answers in chat.

## Purpose and users

Model noise from mining machines at nearby towns, initially Greenbushes lithium mine,
Western Australia. The owner's intended use is to demonstrate due diligence in checking
whether machinery will be heard from town. Support other locations without code changes.
The initial operator is the project owner; team access requirements are not yet specified.

## Confirmed scope

- Browser application, with a map and noise visualisation at different distances.
- Add, edit, and remove machine types and place multiple instances on the map.
- Move machine instances interactively and recalculate their combined contribution.
- Static operating scenarios; no moving-machine simulation or time schedule in version one.
- Actual machine noise data will be supplied later.
- Include cloud cover initially; record wind, temperature, terrain, and barriers for later.
- Prefer satellite imagery, with a replaceable provider; Apple is not required.
- No paid maps or Apple Developer account. Verify usage terms for the intended mine use.

## Accepted limitation

The owner accepted an indicative prototype with explicit assumptions. Example source data
and cloud cover alone cannot substantiate inaudibility or regulatory compliance.
A later audibility assessment needs validated sources, background measurements, and an
appropriate propagation method. Do not turn the owner's desired conclusion into a model result.

## Outstanding decisions

Python/FastAPI/Uvicorn, HTML/CSS/JavaScript, Leaflet and interim OSM street tiles are now approved. Verify a genuinely
free satellite imagery option. Determine the method for representing meteorology before
cloud cover changes numerical results. Saving and exporting scenarios are proposed additions.
