# Contour editor task

State: in progress. Owner: Codex. Branch: agent/contour-lines.
Base: walk-back at 33202ad8f37614c7055a43f137fa93789f03db27.

The owner requested combined independent-machine noise contours, editable level count,
decibels, colour, width, style and visibility, including dragging a contour to set its
threshold. Shapes remain computed from combined source energy. No coherent wave model.
Panning/zooming must not trigger acoustic requests. Preserve uv, type hints and Google-style
docstrings. Split frontend responsibilities and document structure/flow in ARCHITECURE.md.
No new third-party libraries. Keep the existing satellite provider.

Plan: typed source-centred contour calculation with analytical/numerical tests; modular
browser state/API/map/UI code; independently refreshed receiver readings and local styling;
architecture diagrams and uv commands; browser request-count/drag/error tests; verify merge
with latest main, then push this branch for human review. Inspect Gemini's ZIP for useful
ideas without accepting its unrequested coherent model, missed contours or stale UI state.

GitHub PR inspection attempted: API returned Forbidden. Git fetch/push are available.
