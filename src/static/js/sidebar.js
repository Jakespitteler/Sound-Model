/** @fileoverview Two small workspaces reduce sidebar noise while preserving all form state. */
import {$} from './utils.js';

/** Bind accessible Scenario/Contours tabs; switching views never changes acoustic inputs. */
export function setupSidebar() {
  // Share the limited advanced-settings space without discarding either form's drafts.
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
