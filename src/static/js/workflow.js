/** @fileoverview Task-focused workspaces and a short measurement-estimate journey. */
import {$,escapeHtml as e} from './utils.js';

/** Keep existing controls/data while presenting one primary job at a time.
 * @param {import('./state.js').ScenarioStore} store Shared scenario.
 */
export function setupWorkflow(store) {
  const scenario=$('scenario-panel'),measurements=document.querySelector('.measurement-settings');
  const receivers=$('receivers').closest('section'),catalogue=document.querySelector('.catalogue-library').closest('section');
  const model=document.querySelector('.model-settings');
  model.append(document.querySelector('.background-control'),$('background-status'));
  $('measurement-workspace').append(measurements);measurements.open=true;
  $('listening-workspace').append(receivers);$('equipment-workspace').append(catalogue);
  const tabs=[$('scenario-tab'),$('measurements-tab'),$('receivers-tab'),$('contours-tab')];
  const panels=[scenario,$('measurement-workspace'),$('listening-workspace'),$('contours-panel')];
  /** @param {number} index Active workspace. @param {boolean} focus Move tab focus. */
  function select(index,focus=false) {
    if(panels[index].hidden && store.mode) store.setMode(null);
    tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;panels[i].hidden=i!==index;});
    $('equipment-workspace').hidden=index!==0;
    $('workflow-help').hidden=index===0;
    $('workflow-help').textContent=index===1?'Record the sound at each test location. Drag a meter pin to correct its location.':index===2?'Place a point at the town or property you want to check.':'Choose which sound levels appear on the map.';
    if(index===1) measurements.open=true;
    document.querySelector('.sidebar').dispatchEvent(new Event('sidebar-view'));
    if(focus) tabs[index].focus();
  }
  tabs.forEach((tab,index)=> {
    tab.onclick=()=>select(index);
    tab.onkeydown=event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();select(event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:tabs.length-1))%tabs.length,true);};
  });
  $('start-estimate').addEventListener('click',()=>{
    for(const card of document.querySelectorAll('.measurement-card > details')) card.open=false;
  });
  $('source-from-readings').onclick=()=>{
    select(1);
    const next=store.measurements.length>=3?$('start-estimate'):$('add-measurement');
    next.focus();
    if(next.id==='start-estimate' && !$('measurement-fit').open) next.click();
  };
  $('open-walkthrough').onclick=()=>$('walkthrough').showModal();
  $('sound-key').open=false;
  select(0);
  document.addEventListener('open-measurement',()=>{select(1);$('measurement-fit').open=false;});
  document.addEventListener('estimate-applied',()=>{
    measurements.open=false;
    select(2);
    const target=$('receivers').querySelector('.entity-summary') || $('place-receiver');
    target.focus();
    target.scrollIntoView({block:'nearest'});
  });
  setupFitJourney(store);
}

/** Present the existing fit contract in three steps; do not infer missing test data.
 * @param {import('./state.js').ScenarioStore} store Shared scenario. */
function setupFitJourney(store) {
  const form=$('fit-form'),steps=[...form.querySelectorAll('[data-fit-step]')];let active=0;
  const manual=form.elements.activity;
  /** @param {number} index Step to show. */
  function show(index) {
    active=index;steps.forEach((step,i)=>step.hidden=i!==index);
    document.querySelectorAll('[data-fit-go]').forEach(button=>button.setAttribute('aria-current',Number(button.dataset.fitGo)===index?'step':'false'));
  }
  form.noValidate=true;
  form.addEventListener('fit-invalid',()=>{const invalid=[...form.elements].find(input=>input.willValidate && !input.validity.valid);const step=invalid?.closest('[data-fit-step]');if(step)show(steps.indexOf(step));if(invalid)for(let node=invalid.parentElement;node && node!==form;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;});
  form.querySelectorAll('[data-fit-next]').forEach(button=>button.onclick=()=>{
    const invalid=[...steps[active].querySelectorAll('input,select')].find(input=>input.willValidate && !input.checkValidity());
    if(active===1 && !invalid) {const roles=[...$('fit-selections').querySelectorAll('select')].map(select=>select.value);if(roles.filter(role=>role==='fit').length<2 || !roles.includes('check')) {$('fit-selection-help').textContent='Choose at least two readings to Build estimate and one different reading to Check prediction.';$('fit-selections').querySelector('select')?.focus();return;}}
    if(invalid){for(let node=invalid.parentElement;node && node!==form;node=node.parentElement)if(node.tagName==='DETAILS')node.open=true;invalid.reportValidity();return;}show(Math.min(2,active+1));
    if(active===2) form.requestSubmit();
  });
  form.querySelectorAll('[data-fit-go]').forEach(button=>button.onclick=()=>show(Number(button.dataset.fitGo)));
  form.addEventListener('input',summary);form.addEventListener('change',summary);
  /** Describe selected roles and activity mismatches before a model request. */
  function summary() {
    let build=0,check=0,mismatch=0;
    for(const row of $('fit-selections').children) {const role=row.querySelector('select').value;if(role==='skip')continue;role==='fit'?build++:check++;const reading=store.measurements.find(item=>item.id===row.dataset.fitReading);if(reading?.activity!==manual.value)mismatch++;}
    $('fit-selection-help').textContent=`${build} to build the estimate · ${check} to check it.`+(mismatch?` ${mismatch} selected reading(s) have a different activity. Edit them if recorded incorrectly, or leave them out.`:'');
  }
  $('fit-test-choice').onchange=()=>{manual.value=$('fit-test-choice').value;manual.dispatchEvent(new Event('input',{bubbles:true}));};
  $('fit-background-input').onchange=()=>{const input=$('fit-background-input');if(input.checkValidity())store.setBackground(input.value===''?null:Number(input.value));};
  /** Keep choices and readiness text synchronized without overwriting manual drafts. */
  function sync() {
    const labels=[...new Set(store.measurements.map(item=>item.activity).filter(Boolean))];
    $('fit-test-choice').innerHTML='<option value="">Choose a recorded activity</option>'+labels.map(value=>`<option value="${e(value)}">${e(value)}</option>`).join('');
    if(!manual.value && labels.length===1){manual.value=labels[0];manual.dispatchEvent(new Event('input',{bubbles:true}));}
    $('fit-test-choice').value=manual.value;
    $('fit-background-input').value=store.background_db??'';summary();
    const needed=Math.max(0,3-store.measurements.length);
    $('measurement-next').textContent=needed
      ? `To build a sound source, record at least ${needed} more reading${needed===1?'':'s'} at different locations.`
      : 'Choose readings from the same activity to build and check your estimate.';
    $('source-from-readings').textContent=store.sources.length?'Add an estimate from readings':'Use meter readings instead';
  }
  store.subscribe(reason=>{if(reason==='ui')return;sync();if(reason==='restore')show(0);});
  $('measurement-fit').addEventListener('toggle',()=>{if($('measurement-fit').open){sync();show(0);}});
  sync();show(0);
}
