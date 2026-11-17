/**
 * @fileoverview Provisional equipment guesses, NOT a verified Charles Hull/Talison fleet.
 * Values are project-authored screening assumptions (17 November 2026), in LwA re 1 pW.
 * Public company/reference pages could not be fetched. See /machine-estimates for details.
 */
export const MACHINE_PRESETS = [
  {id:'preset-haul', name:'Large haul truck', lwa:120, use:'Moving ore or overburden'},
  {id:'preset-excavator', name:'Hydraulic excavator', lwa:116, use:'Digging and truck loading'},
  {id:'preset-loader', name:'Wheel loader', lwa:113, use:'Stockpile and plant loading'},
  {id:'preset-dozer', name:'Tracked dozer', lwa:115, use:'Pushing material and shaping benches'},
  {id:'preset-grader', name:'Motor grader', lwa:112, use:'Haul-road maintenance'},
  {id:'preset-water', name:'Water cart', lwa:112, use:'Haul-road dust suppression'},
  {id:'preset-drill', name:'Blast-hole drill', lwa:120, use:'Production drilling'},
  {id:'preset-crusher', name:'Crusher / screening plant', lwa:120, use:'Ore sizing and processing'},
].map(machine => ({...machine, kind:machine.id.replace('preset-',''), provenance:'example',
  note:`Project-authored guess: ${machine.lwa} dB(A) LwA, 17 November 2026. ${machine.use}. Representative equipment category, not a confirmed company machine or measured emission. Replace with actual equipment sound-power data before assessment use.`,
}));
