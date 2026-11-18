/** @fileoverview Address suggestions change only the map camera, through the approved local adapter. */
import {$} from './utils.js';

/** Validate the local API boundary again before a result can move the camera.
 * @param {unknown} raw Untrusted response. @return {Object[]} Labelled points with optional validated bounds. */
export function validPlaces(raw) {
  if (!Array.isArray(raw)) throw new Error('Address search returned an invalid response.');
  return raw.filter(p=>p && typeof p.label==='string' && p.label.trim() &&
    Number.isFinite(p.lat) && Math.abs(p.lat)<=85 && Number.isFinite(p.lng) && Math.abs(p.lng)<=180)
    .slice(0,5).map(p=> {
      const b=p.bounds;
      const bounds=Array.isArray(b) && b.length===4 && b.every(Number.isFinite) &&
        -85<=b[0] && b[0]<=p.lat && p.lat<=b[2] && b[2]<=85 && b[0]<b[2] &&
        -180<=b[1] && b[1]<=p.lng && p.lng<=b[3] && b[3]<=180 && b[1]<b[3] ? b : null;
      return {label:p.label,lat:p.lat,lng:p.lng,bounds};
    });
}

/** A small editable combobox; typing and selection never mutate acoustic inputs. */
export class AddressSearch {
  /** @param {function():Object} centre Current camera latitude/longitude.
   * @param {function(Object):void} navigate Select an explicit returned location.
   * @param {function(string,Object):Promise<Response>} [request] HTTP operation, injectable for offline checks. */
  constructor(centre,navigate,request=(url,options)=>fetch(url,options)) {
    this.centre=centre; this.navigate=navigate; this.request=request;
    this.input=$('address-query'); this.list=$('address-results'); this.form=$('address-form');
    this.panel=$('address-search').closest('.map-navigation') || $('address-search'); this.status=$('address-status');
    this.version=0; this.items=[]; this.active=-1; this.lastRequest=-Infinity; this.waitUntil=0;
    this.timer=null; this.controller=null; this.selected=false;
    this.input.addEventListener('input',event=> {if(!event.isComposing) this.schedule();});
    this.input.addEventListener('compositionstart',()=>this.dismiss());
    this.input.addEventListener('compositionend',()=>this.schedule());
    this.input.addEventListener('keydown',event=>this.keydown(event));
    this.form.addEventListener('submit',event=> {event.preventDefault(); this.schedule(0);});
    document.addEventListener('pointerdown',event=> {if(!this.panel.contains(event.target)) this.dismiss();});
    this.panel.addEventListener('focusout',()=>setTimeout(()=> {
      if(!this.panel.contains(document.activeElement)) this.dismiss();
    },0));
    this.panel.querySelector('.coordinate-entry')?.addEventListener('toggle',event=> {if(event.target.open) this.dismiss();});
    window.addEventListener('blur',()=>this.dismiss());
  }

  /** Invalidate pending work and close suggestions, without changing entered text or the camera. */
  dismiss() {
    this.version++; clearTimeout(this.timer); this.controller?.abort();
    this.items=[]; this.active=-1; this.list.replaceChildren(); this.list.hidden=true;
    this.input.setAttribute('aria-expanded','false'); this.input.removeAttribute('aria-activedescendant');
    this.input.setAttribute('aria-busy','false'); this.setStatus(''); $('address-credit').hidden=!this.selected;
  }

  /** @param {string} message Concise live feedback. */
  setStatus(message) {this.status.textContent=message; this.status.hidden=!message;}

  /** Debounce new input and space requests; errors never start an automatic retry loop.
   * @param {number} [delay] Typing pause, or zero for an explicit Search action. */
  schedule(delay=500) {
    this.selected=false; this.dismiss();
    const text=this.input.value.trim();
    if(text.length<3) {if(text) this.setStatus('Enter at least 3 characters.'); return;}
    if(text.length>160) {this.setStatus('Use 160 characters or fewer.'); return;}
    const version=this.version;
    const wait=Math.max(delay,1100-(performance.now()-this.lastRequest),this.waitUntil-performance.now());
    this.input.setAttribute('aria-busy','true'); this.setStatus('Searching…');
    this.timer=setTimeout(()=>this.lookup(text,version),wait);
  }

  /** @param {string} text Committed query snapshot. @param {number} version Guards against stale results. */
  async lookup(text,version) {
    this.lastRequest=performance.now(); this.controller=new AbortController();
    const c=this.centre(), lng=((c.lng+180)%360+360)%360-180;
    try {
      const response=await this.request('/api/geocode',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({query:text,lat:c.lat,lng}),signal:this.controller.signal});
      const raw=await response.json();
      if(version!==this.version) return;
      if(!response.ok) {
        if(response.status===429) {
          const seconds=Number(response.headers.get('Retry-After'));
          this.waitUntil=performance.now()+Math.min(300,Number.isFinite(seconds) && seconds>0 ? seconds : 1)*1000;
        }
        throw new Error(typeof raw.detail==='string' ? raw.detail : 'Address search is unavailable. Try again.');
      }
      this.items=validPlaces(raw); this.render();
      this.setStatus(this.items.length ? `${this.items.length} suggestions. Choose a location.` : 'No matching locations. Try adding a town or postcode.');
    } catch(error) {
      if(version===this.version && error?.name!=='AbortError') {
        this.setStatus(error instanceof TypeError ? 'Address search is offline. Try again or use coordinates.' : (error?.message || 'Address search is unavailable. Try again.'));
      }
    } finally {
      if(version===this.version) this.input.setAttribute('aria-busy','false');
    }
  }

  /** Render text-only options; DOM focus stays in the editable input. */
  render() {
    this.list.replaceChildren(); this.active=-1;
    this.items.forEach((item,index)=> {
      const option=document.createElement('li'); option.id=`address-option-${this.version}-${index}`;
      option.setAttribute('role','option'); option.setAttribute('aria-selected','false');
      option.textContent=item.label;
      option.addEventListener('pointerdown',event=>event.preventDefault());
      option.addEventListener('click',()=>this.choose(index));
      option.addEventListener('pointermove',()=>this.highlight(index));
      this.list.append(option);
    });
    this.list.hidden=!this.items.length; $('address-credit').hidden=!this.items.length;
    this.input.setAttribute('aria-expanded',String(!!this.items.length));
  }

  /** @param {number} index Visually active suggestion. */
  highlight(index) {
    this.active=index;
    [...this.list.children].forEach((option,i)=>option.setAttribute('aria-selected',String(i===index)));
    const option=this.list.children[index];
    if(option) {this.input.setAttribute('aria-activedescendant',option.id); option.scrollIntoView({block:'nearest'});}
  }

  /** @param {KeyboardEvent} event Standard editable-combobox keyboard interaction. */
  keydown(event) {
    if(event.isComposing) return;
    if(event.key==='Escape') {event.preventDefault(); this.dismiss(); return;}
    if(['ArrowDown','ArrowUp'].includes(event.key) && this.items.length) {
      event.preventDefault();
      this.highlight(this.active<0 ? (event.key==='ArrowDown' ? 0 : this.items.length-1) :
        (this.active+(event.key==='ArrowDown' ? 1 : -1)+this.items.length)%this.items.length);
    }
    if(event.key==='Enter' && this.items.length) {
      event.preventDefault();
      if(this.active>=0) this.choose(this.active);
      else this.setStatus('Use the arrow keys or click to choose a location.');
    }
  }

  /** @param {number} index Explicitly selected suggestion. */
  choose(index) {
    const item=this.items[index]; if(!item) return;
    this.selected=true; this.dismiss(); this.input.value=item.label; this.navigate(item); this.setStatus('Location selected.');
  }
}
