/** @fileoverview Camera-only grouping and space for map overlays; never acoustic source selection. */

/** @typedef {{id:string, collection:string}} ObjectIdentity */
/** @typedef {ObjectIdentity & {lat:number, lng:number}} MapObject */
/** @typedef {{left:number, right:number, top:number, bottom:number}} Rectangle */

/** @param {MapObject} a First location. @param {MapObject} b Second location.
 * @return {number} Great-circle distance in metres, using the model's mean Earth radius. */
export function objectDistance(a,b) {
  const radians=Math.PI/180;
  const h=Math.sin((b.lat-a.lat)*radians/2)**2 +
    Math.cos(a.lat*radians)*Math.cos(b.lat*radians)*Math.sin((b.lng-a.lng)*radians/2)**2;
  return 2*6371008.8*Math.asin(Math.sqrt(Math.max(0,Math.min(1,h))));
}

/** @param {?ObjectIdentity} a First object. @param {?ObjectIdentity} b Second object.
 * @return {boolean} Same object, including its collection (IDs may repeat across collections). */
export function sameObject(a,b) {return !!a && !!b && a.id===b.id && a.collection===b.collection;}

/** Build a deterministic anchored group whose maximum pairwise distance is 10 km.
 * @param {MapObject[]} objects All scenario locations, retained unchanged.
 * @param {MapObject|null|undefined} anchor Chosen existing location.
 * @return {MapObject[]} Greedy local group, anchor first; not necessarily the largest clique. */
export function localGroup(objects,anchor) {
  if (!anchor) return [];
  const compare=(a,b)=>a<b ? -1 : a>b ? 1 : 0;
  const candidates=objects.filter(item=>!sameObject(item,anchor)).map(item=>({item,distance:objectDistance(anchor,item)}))
    .sort((a,b)=>a.distance-b.distance || compare(a.item.id,b.item.id) || compare(a.item.collection,b.item.collection));
  const group=[anchor];
  for (const {item} of candidates) {
    // One micrometre absorbs floating-point roundoff at the inclusive 10 km boundary.
    if (group.every(member=>objectDistance(member,item)<=10000+1e-6)) group.push(item);
  }
  return group;
}

/** Find the largest rectangular map space clear of visible overlays, with marker margins.
 * @param {number} width Map width in CSS pixels. @param {number} height Map height.
 * @param {Rectangle[]} obstacles Visible overlay bounds relative to the map.
 * @return {Rectangle} Safe fit rectangle; a central fallback when overlays cover the map. */
export function freeMapRectangle(width,height,obstacles) {
  const frame={left:56,right:Math.max(57,width-56),top:36,bottom:Math.max(37,height-36)};
  const blocked=obstacles.map(r=>({left:Math.max(frame.left,r.left-12),right:Math.min(frame.right,r.right+12),
    top:Math.max(frame.top,r.top-12),bottom:Math.min(frame.bottom,r.bottom+12)}))
    .filter(r=>r.left<r.right && r.top<r.bottom);
  const edges=[...new Set([frame.left,frame.right,...blocked.flatMap(r=>[r.left,r.right])])].sort((a,b)=>a-b);
  let best=frame, area=0;
  for (const left of edges) for (const right of edges) {
    if (right-left<100) continue;
    const intervals=blocked.filter(r=>r.left<right && r.right>left).sort((a,b)=>a.top-b.top);
    let top=frame.top;
    for (const interval of [...intervals,{top:frame.bottom,bottom:frame.bottom}]) {
      const candidate=(right-left)*(interval.top-top);
      if (interval.top-top>=80 && candidate>area) {best={left,right,top,bottom:interval.top}; area=candidate;}
      top=Math.max(top,interval.bottom);
    }
  }
  return best;
}
