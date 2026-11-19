/** @fileoverview Two small workspaces reduce sidebar noise while preserving all form state. */
import {$} from './utils.js';

/** Bind accessible Scenario/Contours tabs; switching views never changes acoustic inputs. */
export function setupSidebar() {
  // Share the limited advanced-settings space without discarding either form's drafts.
  setupExpandedEditors();
  const settings=[document.querySelector('.catalogue-library'),document.querySelector('.model-settings')];
  settings.forEach(panel=>panel.addEventListener('toggle',()=> {
    if (panel.open) settings.filter(other=>other!==panel).forEach(other=> {other.open=false;});
  }));
  const tabs = [$('scenario-tab'),$('contours-tab')];
  const panels = [$('scenario-panel'),$('contours-panel')];
  /** @param {number} index Selected tab index. @param {boolean} [focus] Move keyboard focus. */
  function select(index, focus = false) {
    tabs.forEach((tab,i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
    document.querySelector('.sidebar')?.dispatchEvent(new Event('sidebar-view'));
    if (focus) tabs[index].focus();
  }
  tabs.forEach((tab,index) => {
    tab.onclick = () => select(index);
    tab.onkeydown = event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      select(event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1-index, true);
    };
  });
}


/** Give expanded desktop editors one viewport-sized scroll area without moving form nodes. */
function setupExpandedEditors() {
  const sidebar=document.querySelector('.sidebar');
  if(!sidebar) return; // Small standalone tab fixtures do not include the app layout.
  const desktop=matchMedia('(min-width:651px)');
  const roots='.catalogue-library,.model-settings,.item-card > details';
  const button=document.createElement('button');
  button.type='button';button.className='close-sidebar-editor';button.textContent='Close editor';button.hidden=true;
  sidebar.prepend(button);
  let active=false, offsets=[], offsetsCaptured=false, lastSummary=null;
  const captureOffsets=()=> {
    offsets=[...sidebar.querySelectorAll('#sources,#receivers,.catalogue-section,.model-settings,#contours-panel')].map(element=>[element,element.scrollTop]);
    offsetsCaptured=true;
  };
  /** @param {Element} details Disclosure to check. @return {boolean} Visible open editor root. */
  const visible=details=>details.open && !details.closest('[hidden]') && !details.parentElement.closest('details:not([open])');
  /** Sync from actual disclosures, including dynamically refreshed receiver cards. */
  const sync=()=> {
    const expanded=desktop.matches && [...sidebar.querySelectorAll(roots)].some(visible);
    if(expanded===active) return;
    if(expanded && !offsetsCaptured) captureOffsets();
    active=expanded;sidebar.classList.toggle('expanded-editor',active);button.hidden=!active;
    if(!active) {
      sidebar.scrollTop=0;
      for(const [element,top] of offsets) if(element.isConnected) element.scrollTop=top;
      offsetsCaptured=false;
    }
  };
  /** Reveal a whole card when it fits, or align a longer editor beneath the close control.
   * @param {HTMLDetailsElement} details Disclosure explicitly opened by the user. */
  const reveal=details=> {
    sync();if(!active || !visible(details)) return;
    const card=details.matches(roots) || details.parentElement.matches('.type-card') ? details.closest('.type-card,.item-card') || details : details;
    const bounds=sidebar.getBoundingClientRect(),rect=card.getBoundingClientRect();
    const submit=details.matches('.source-bands') ? details.closest('form')?.querySelector('button[type=submit]') : null;
    const end=Math.max(rect.bottom,submit?.getBoundingClientRect().bottom ?? rect.bottom);
    const top=bounds.top+button.getBoundingClientRect().height+24,bottom=bounds.bottom-16;
    let distance=0;
    if(end-rect.top>bottom-top || rect.top<top) distance=rect.top-top;
    else if(end>bottom) distance=end-bottom;
    sidebar.scrollTop+=distance;
  };
  sidebar.addEventListener('toggle',()=>requestAnimationFrame(sync),true);
  sidebar.addEventListener('sidebar-view',sync);
  sidebar.addEventListener('click',event=> {
    const summary=event.target.closest('summary');
    if(!summary || !sidebar.contains(summary)) return;
    // Capture before native disclosure expansion changes the browser scroll anchor.
    if(!active && desktop.matches) captureOffsets();
    lastSummary=summary;
    requestAnimationFrame(()=>reveal(summary.parentElement));
  });
  button.onclick=()=> {
    sidebar.querySelectorAll(roots).forEach(details=> {details.open=false;});
    sync();
    const summary=lastSummary;
    if(summary?.isConnected && summary.getClientRects().length) summary.focus({preventScroll:true});
    else $('scenario-tab').focus({preventScroll:true});
  };
  // Rendering can remove the last open card without dispatching its toggle event.
  new MutationObserver(()=>requestAnimationFrame(sync)).observe(sidebar,{childList:true,subtree:true});
  desktop.addEventListener('change',sync);
  sync();
}
