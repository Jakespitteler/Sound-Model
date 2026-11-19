/**
 * @fileoverview Shared JSDoc domain types. No compiler or runtime library needed.
 * @typedef {{id:string, name:string, lwa:number, provenance:string, note?:string, source_reference?:string, operating_mode?:string, use?:string, kind?:string, spectrum?:?Object}} MachineType
 * @typedef {{id:string, type_id:string, lat:number, lng:number}} Source
 * @typedef {{id:string, lat:number, lng:number, name?:string}} Receiver
 * @typedef {{id:string, level_db:number, acceptable?:boolean, background?:boolean}} ContourLevel
 * @typedef {{id:string, lat:number, lng:number, level_db:number, name:string, metric:string, test_kind:string, duration_s:?number, source_id:?string, source_context:?Object, activity:string, meter:string, note:string}} Measurement
 * @typedef {{types:MachineType[], sources:Source[], receivers:Receiver[], cloud_cover:number, background_db:?number, background_spectrum:?Object}} Scenario
 * @typedef {{level_db:number, lines:number[][][], status?:string, error?:string}} ContourGeometry
 * @typedef {{level_db:?number, near_field:boolean, contributions:Object[], status?:string, nearest_source_m?:number, includes_distant_sources?:boolean}} Reading
 */
export {};
