/**
 * @fileoverview Shared JSDoc domain types. No compiler or runtime library needed.
 * @typedef {{id:string, name:string, lwa:number, provenance:string, note?:string, use?:string}} MachineType
 * @typedef {{id:string, type_id:string, lat:number, lng:number}} Source
 * @typedef {{id:string, lat:number, lng:number}} Receiver
 * @typedef {{id:string, level_db:number}} ContourLevel
 * @typedef {{types:MachineType[], sources:Source[], receivers:Receiver[], cloud_cover:number}} Scenario
 * @typedef {{level_db:number, lines:number[][][]}} ContourGeometry
 * @typedef {{level_db:?number, near_field:boolean, contributions:Object[]}} Reading
 */
export {};
