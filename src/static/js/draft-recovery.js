/** @fileoverview One browser-local recovery draft; named saves remain explicit. */
import {$,uuid} from './utils.js';

const KEY='sound-model.recovery.v1';

/** Recover accepted edits after reload, with explicit consent and cross-tab ownership. */
export class DraftRecovery {
  /** @param {import('./scenario-files.js').ScenarioFilesUI} files Save/Open lifecycle. */
  constructor(files) {
    this.files=files; this.writer=`${uuid()}-${Math.random().toString(36).slice(2)}`; this.starting=true; this.blocked=false;
    this.raw=null; this.candidate=null; this.timer=null; this.ignoredRevision=null; this.busy=false;
    files.subscribe(()=>this.changed());
    $('review-recovery').onclick=()=>this.offer();
    $('restore-recovery').onclick=()=>this.restore();
    $('discard-recovery').onclick=()=>this.discard();
    $('later-recovery').onclick=()=>$('recovery-dialog').close();
    $('recovery-dialog').addEventListener('cancel',event=> {if(this.busy) event.preventDefault();});
    window.addEventListener('pagehide',()=>this.flush());
    window.addEventListener('storage',event=> {
      if(event.key!==KEY && event.key!==null) return;
      clearTimeout(this.timer);
      try {
        const raw=localStorage.getItem(KEY);
        this.read(raw);
        if(raw===null && $('recovery-dialog').open) $('recovery-dialog').close();
        if($('recovery-dialog').open && raw!==null) {
          this.offer();
          $('recovery-error').textContent='The draft changed in another tab. Review the latest version before continuing.';
        }
        this.status(raw ? 'Another tab has a recovery draft. Review it before replacing it; Save still works.' : 'Recovery draft cleared in another tab. Further edits can be recovered.');
      } catch {this.status('Recovery storage is unavailable. Use Save to keep your work.');}
    });
  }

  /** Reopen a named URL first, then offer the draft without silently replacing it. */
  async start() {
    await this.files.restoreFromUrl();
    try {
      this.read(localStorage.getItem(KEY));
      if(this.raw!==null) this.offer();
    } catch {this.status('Recovery storage is unavailable. Use Save to keep your work.');}
    finally {this.starting=false;}
  }

  /** @param {?string} raw Untrusted persisted envelope, kept intact until an explicit decision. */
  read(raw) {
    this.raw=raw; this.candidate=null; this.blocked=raw!==null;
    $('review-recovery').hidden=!this.blocked;
    if(!this.blocked) {$('restore-recovery').disabled=true; return;}
    this.status('A recovery draft is available. Named saves are unchanged.');
    try {
      if(raw.length>1024*1024) throw new Error('Draft exceeds the recovery size limit.');
      const data=JSON.parse(raw);
      if(data.version!==1 || typeof data.writer!=='string' || typeof data.token!=='string' ||
        typeof data.name!=='string' || data.name.length>100 || !Number.isFinite(Date.parse(data.updated_at)) ||
        !(data.saved_id===null || typeof data.saved_id==='string' && /^[0-9a-f-]{36}$/i.test(data.saved_id)) ||
        !data.document || typeof data.document!=='object' || Array.isArray(data.document)) {
        throw new Error('Unsupported or invalid recovery draft.');
      }
      this.candidate=data; $('recovery-error').textContent='';
    } catch(error) {$('recovery-error').textContent=`${error.message} Nothing was restored. You may keep or discard this draft.`;}
    $('restore-recovery').disabled=!this.candidate;
  }

  /** Display the current candidate, including its identity when the URL names another scene. */
  offer() {
    if(this.raw===null) return;
    const data=this.candidate;
    $('recovery-description').textContent=data ?
      `${data.name || 'Unnamed scenario'} · draft from ${new Date(data.updated_at).toLocaleString('en-AU')}.${data.saved_id!==this.files.id ? ' This is a different scenario from the current page.' : ''}` :
      'This browser contains a draft that could not be read. Your working scene and saved files have not changed.';
    if(!$('recovery-dialog').open) $('recovery-dialog').showModal();
  }

  /** @param {string} message Recovery-specific feedback, independent from model/save messages. */
  status(message) {$('recovery-status').textContent=message; $('recovery-status').hidden=!message;}

  /** Debounce accepted state changes; do not overwrite a draft awaiting review. */
  changed() {
    if(this.starting) return;
    clearTimeout(this.timer);
    if(this.blocked) return;
    if(this.files.revision===this.files.savedRevision) {
      this.ignoredRevision=null;
      try {
        const raw=localStorage.getItem(KEY);
        if(raw && JSON.parse(raw).writer===this.writer) localStorage.removeItem(KEY);
        this.status('');
      } catch {this.status('Recovery storage is unavailable. Use Save to keep your work.');}
      return;
    }
    if(this.files.revision!==this.ignoredRevision) this.timer=setTimeout(()=>this.flush(),200);
  }

  /** Store the last accepted scene synchronously, including on page exit; failed writes preserve old data. */
  flush() {
    clearTimeout(this.timer);
    if(this.starting || this.blocked || this.files.revision===this.files.savedRevision || this.files.revision===this.ignoredRevision) return;
    try {
      const previous=localStorage.getItem(KEY);
      if(previous && JSON.parse(previous).writer!==this.writer) {
        this.read(previous); this.status('Another draft is waiting. Review it first; Save still works.'); return;
      }
      const draft={version:1,writer:this.writer,token:uuid(),saved_id:this.files.id,name:this.files.name,
        updated_at:new Date().toISOString(),document:this.files.snapshot()};
      const raw=JSON.stringify(draft);
      if(raw.length>1024*1024) throw new Error('Recovery draft too large');
      localStorage.setItem(KEY,raw);
      this.status('Recovery draft stored in this browser. Use Save for a named copy.');
    } catch {this.status('Could not store a recovery draft. Use Save to keep your work; any previous draft was preserved.');}
  }

  /** @param {?string} [expected] Exact reviewed envelope. @return {boolean} Candidate is still current. */
  current(expected=this.raw) {
    const latest=localStorage.getItem(KEY);
    if(latest===expected) return true;
    this.read(latest);
    $('recovery-error').textContent='The draft changed in another tab. Review the latest version before continuing.';
    if(latest===null) $('recovery-dialog').close(); else this.offer();
    return false;
  }

  /** Validate before applying; recover missing saved files as new unsaved work, never as a server write. */
  async restore() {
    if(this.busy || !this.candidate) return;
    this.setBusy(true);
    try {
      if(!this.current()) return;
      const candidate=this.candidate;
      const reviewed=this.raw;
      const response=await fetch('/api/scenarios/validate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(candidate.document)});
      if(!response.ok) throw new Error(response.status===422 ? 'Draft inputs are invalid or unsupported. Nothing was restored.' : 'Could not validate draft. Try Restore again when the backend is available.');
      const document=await response.json();
      let record=null;
      if(candidate.saved_id) {
        const saved=await fetch(`/api/scenarios/${encodeURIComponent(candidate.saved_id)}`);
        if(saved.ok) record=await saved.json();
        else if(saved.status!==404) throw new Error('Could not check the named save. Try again; the draft was preserved.');
      }
      if(!this.current(reviewed)) return;
      // Claim only the candidate the user reviewed. Other tabs pause on ownership change.
      const claimed={...candidate,writer:this.writer,token:uuid()};
      localStorage.setItem(KEY,JSON.stringify(claimed));
      this.files.applyRecovery(document,record);
      if(!record) this.files.name=candidate.name || 'Recovered scenario';
      this.blocked=false; this.raw=null; this.candidate=null; this.ignoredRevision=null;
      $('review-recovery').hidden=true; $('recovery-dialog').close();
      this.files.renderStatus(); this.flush();
      this.status(record ? 'Unsaved edits restored. Choose Save to update the named scenario.' : 'Draft restored as an unsaved scenario. Choose Save to keep a named copy.');
    } catch(error) {$('recovery-error').textContent=`${error.message} Named saves are unchanged.`;}
    finally {this.setBusy(false);}
  }

  /** Remove only the reviewed draft, without changing the working scene or named files. */
  discard() {
    if(this.busy) return;
    try {
      if(!this.current()) return;
      localStorage.removeItem(KEY);
      this.raw=null; this.candidate=null; this.blocked=false; this.ignoredRevision=this.files.revision;
      $('review-recovery').hidden=true; $('recovery-dialog').close();
      this.status('Draft discarded. Further edits can be recovered; named saves are unchanged.');
    } catch { $('recovery-error').textContent='Could not discard the draft. Browser storage is unavailable; nothing was restored.'; }
  }

  /** @param {boolean} busy Disable overlapping decisions during asynchronous validation. */
  setBusy(busy) {
    this.busy=busy;
    $('restore-recovery').disabled=busy || !this.candidate;
    $('discard-recovery').disabled=busy; $('later-recovery').disabled=busy;
  }
}
