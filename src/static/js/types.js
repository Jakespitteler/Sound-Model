/**
 * @fileoverview Shared JSDoc domain types. No compiler or runtime library needed.
 * @typedef {{id:string, name:string, lwa:number, provenance:string, note?:string, source_reference?:string, operating_mode?:string, use?:string, kind?:string}} MachineType
 * @typedef {{id:string, type_id:string, lat:number, lng:number}} Source
 * @typedef {{id:string, lat:number, lng:number, name?:string}} Receiver
 * @typedef {{id:string, level_db:number}} ContourLevel
 * @typedef {{types:MachineType[], sources:Source[], receivers:Receiver[], cloud_cover:number}} Scenario
 * @typedef {{level_db:number, lines:number[][][], status?:string, error?:string}} ContourGeometry
 * @typedef {{level_db:?number, near_field:boolean, contributions:Object[], status?:string, nearest_source_m?:number, includes_distant_sources?:boolean}} Reading
 */
export {};
