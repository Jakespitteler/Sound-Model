/** @fileoverview Small original SVG symbols; no icon library or untrusted SVG input. */
const ART = {
  area:'<circle cx="12" cy="12" r="9" stroke-dasharray="3 2"/><circle cx="12" cy="12" r="2"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>',
  haul:'<path d="M2 8h11l3 5h5v6H2zM4 8V5h10l-1 3M16 13v-4h3l3 4"/><circle cx="6" cy="20" r="2"/><circle cx="18" cy="20" r="2"/>',
  excavator:'<path d="M3 16h10v4H3zM5 16v-6h6v6M11 11l4-7 4 2 2 8-4 2-2-3"/><path d="M2 21h13"/>',
  loader:'<path d="M3 17V9h7v8M10 13l5 4 5-2v5h-6M3 17h12"/><circle cx="6" cy="20" r="2"/><circle cx="14" cy="20" r="2"/>',
  dozer:'<path d="M2 18h14v4H2zM5 18V9h7v9M16 18l4-7v10h3M2 14h13"/>',
  grader:'<path d="M2 17h20M7 17V8h6v9M14 17l-4 5M18 17v-5h3"/><circle cx="4" cy="20" r="2"/><circle cx="20" cy="20" r="2"/>',
  water:'<path d="M2 17V8h12v9M14 12h5l3 5H2"/><circle cx="5" cy="20" r="2"/><circle cx="19" cy="20" r="2"/><path d="M8 9c-4 5-3 6 0 6s4-1 0-6"/>',
  drill:'<path d="M5 21V3h4v18M3 21h17M9 14h9v5H9M18 14V9h3v10M7 3v19"/>',
  crusher:'<path d="M3 4h18l-5 9H8zM8 13v5h8v-5M2 22l6-4M16 18l6 4M8 7l3 3 3-3 3 2"/>',
  generic:'<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 9h8M8 13h8M8 17h4"/>',
  trees:'<path d="M7 3L2 12h3l-4 6h12l-4-6h3zM7 18v4M17 5l-4 8h3l-3 5h9l-3-5h2zM17 18v4"/>',
  camp:'<path d="M2 21L12 4l10 17zM8 21l4-9 4 9M17 4l2-2M21 7h2"/>',
  mug:'<path d="M3 9h14v8a5 5 0 01-5 5H8a5 5 0 01-5-5zM17 10h3a3 3 0 010 6h-3M7 6V3M12 6V2"/>',
  bird:'<path d="M8 8l-3-5 5 2 2-4 2 5M8 8a7 7 0 0111 6l3 2-4 1c-2 6-9 6-11 0l-4 3 2-7 3-5M13 11h1M11 17l4-2"/>',
  speaker:'<path d="M3 9h5l6-5v16l-6-5H3zM18 8a6 6 0 010 8M21 5a10 10 0 010 14"/>',
};

/** @param {string} kind Built-in category. @return {string} Trusted original illustration. */
export function illustration(kind) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${Object.hasOwn(ART,kind) ? ART[kind] : ART.generic}</svg>`;
}
