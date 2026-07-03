(function(){
  'use strict';

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const store = {
    get: k => localStorage.getItem(k) || '',
    set: (k,v) => localStorage.setItem(k, String(v)),
    del: k => localStorage.removeItem(k),
    json: (k,def={}) => { try { return JSON.parse(localStorage.getItem(k) || '') || def; } catch { return def; } },
    setJson: (k,v) => localStorage.setItem(k, JSON.stringify(v))
  };

  const PHASE_ROUTES = {
    '01': 'phase01-empathy.html',
    '02': 'phase02-define.html',
    '03': 'phase03-ideation.html',
    '04': 'phase04-prototype.html',
    '05': 'phase05-test.html',
    portfolio: 'portfolio-completion.html'
  };

  const NEXT_PHASE = {
    '01': { label:'Phase 02 Define', url:'phase02-define.html' },
    '02': { label:'Phase 03 Ideation', url:'phase03-ideation.html' },
    '03': { label:'Phase 04 Prototype', url:'phase04-prototype.html' },
    '04': { label:'Phase 05 Test', url:'phase05-test.html' },
    '05': { label:'Portfolio Completion', url:'portfolio-completion.html' }
  };


  const APPS_SCRIPT_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxlebje7xNNM5lshlG07XMoynY8r0WHQjuAT8jXVoGujZYfmF-HNeX-a1u8wbbFzgVY/exec';
  window.SMART_DT_CONFIG = window.SMART_DT_CONFIG || {};
  window.SMART_DT_CONFIG.appsScriptWebAppUrl = APPS_SCRIPT_WEB_APP_URL;

  function studentPayload(){
    return {
      studentName: store.get('df_student_name'),
      email: store.get('df_email'),
      regNo: store.get('df_reg_no') || store.get('df_registration_no'),
      className: store.get('df_class'),
      team: store.get('df_team'),
      supervisor: store.get('df_supervisor'),
      projectName: store.get('df_project_name')
    };
  }

  function syncToGoogleSheets(action, payload={}, useBeacon=false){
    if(!APPS_SCRIPT_WEB_APP_URL) return Promise.resolve(false);
    const body = JSON.stringify({
      action,
      source: 'Smart DT Project',
      appVersion: 'v16-future-fix',
      page: document.body.dataset.page || '',
      phase: phase() || '',
      timestamp: new Date().toISOString(),
      student: studentPayload(),
      payload
    });
    store.set('df_last_sync_action', action);
    setSyncStatus('pending', 'Saved on this device. Syncing to Google Sheets...');
    try {
      if(useBeacon && navigator.sendBeacon) {
        const ok = navigator.sendBeacon(APPS_SCRIPT_WEB_APP_URL, new Blob([body], { type: 'text/plain;charset=UTF-8' }));
        if(ok){
          setSyncStatus('synced', 'Synced to Google Sheets.');
        } else {
          setSyncStatus('failed', 'Sync failed. Your work is still saved on this device. Please try syncing again when internet is stable.');
        }
        return Promise.resolve(ok);
      }
      return fetch(APPS_SCRIPT_WEB_APP_URL, {
        method: 'POST',
        mode: 'no-cors',
        cache: 'no-store',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body
      }).then(() => {
        setSyncStatus('synced', 'Synced to Google Sheets.');
        return true;
      }).catch(err => {
        console.warn('Smart DT Google Sheets sync failed:', err);
        setSyncStatus('failed', 'Sync failed. Your work is still saved on this device. Please try syncing again when internet is stable.');
        store.set('df_last_sync_error', String(err && err.message || err));
        toast('Sync failed. Your work is still saved on this device.');
        return false;
      });
    } catch(err) {
      console.warn('Smart DT Google Sheets sync error:', err);
      setSyncStatus('failed', 'Sync failed. Your work is still saved on this device. Please try syncing again when internet is stable.');
      store.set('df_last_sync_error', String(err && err.message || err));
      toast('Sync failed. Your work is still saved on this device.');
      return Promise.resolve(false);
    }
  }

  const PHASE_TEMPLATES = {
    '01': ['t01','t02','t03','t04'],
    '02': ['t05','t06'],
    '03': ['t07','t08','t09','t10'],
    '04': ['t11'],
    '05': ['t12','t13','t14']
  };

  const quizSets = {
    '01': [
      {q:'What is the MAIN goal of the Empathy phase?',a:0,o:['To understand users real feelings, needs and experiences','To build the final product immediately','To choose the cheapest solution','To prepare a presentation only']},
      {q:'Should you already know the solution before interviewing users?',a:1,o:['True — decide first','False — keep an open mind and discover','True — the app requires it','False — no interviews are needed']},
      {q:'Which is the BEST interview question for Empathy?',a:2,o:['Do you agree my idea is good?','Do you want our product?','Tell me about your experience using the canteen during peak hours.','Is this problem serious?']},
      {q:'Is interviewing one person enough for the Empathy phase?',a:1,o:['True — one user is enough','False — interview at least 3 users to find patterns','True — if the user is your friend','False — no interviews are needed']},
      {q:'Which tool maps what a user SAYS, THINKS, DOES and FEELS?',a:3,o:['Persona only','Problem Statement','SCAMPER','Empathy Map']}
    ],
    '02': [
      {q:'What is the MAIN output of the Define phase?',a:0,o:['A clear user-centred problem statement based on research','A finished prototype','A list of random ideas','A final presentation script']},
      {q:'Should the problem statement include a solution?',a:1,o:['True — include the app idea immediately','False — define the problem only, never the solution','True — project guides prefer evidence first','False — skip the problem statement']},
      {q:'Which HMW question is correctly formatted?',a:2,o:['We should build a canteen app.','Can you make students eat faster?','How might we help students eat lunch faster on campus?','Why is the canteen crowded?']},
      {q:'Can you skip Define if Empathy was thorough enough?',a:1,o:['True — Empathy is enough','False — Empathy and Define serve different purposes','True — go straight to Ideation','False — skip Ideation instead']},
      {q:'What should a good problem statement focus on?',a:1,o:['The technology your team likes','The user’s need and the insight behind it','The cheapest available solution','The project guide’s preferred direction']}
    ],
    '03': [
      {q:'What is the golden rule of brainstorming?',a:0,o:['No judging or evaluating ideas during the session','Choose the cheapest idea first','Only write ideas from the team leader','Start building the prototype immediately']},
      {q:'Should you stop when you find your first good idea?',a:1,o:['True — one good idea is enough','False — push for 20+ ideas before evaluating','True — avoid wasting time','False — skip SCAMPER instead']},
      {q:'What does the S in SCAMPER stand for?',a:2,o:['Score','Sketch','Substitute','Submit']},
      {q:'Does the Idea Selection Matrix use gut feelings to choose?',a:1,o:['True — choose based on preference','False — it uses criteria with numerical scores','True — the team leader decides','False — it uses interviews only']},
      {q:'What is the correct order for the Ideation phase?',a:3,o:['Select → Brainstorm → SCAMPER → Justify','Prototype → Brainstorm → Submit → Test','SCAMPER → Test → Persona → Matrix','Brainstorm → SCAMPER → Select → Justify']}
    ],
    '04': [
      {q:'What type of prototype should students build FIRST?',a:0,o:['Low-fidelity rough sketch or paper prototype','Fully polished final product','Expensive commercial version','Only a written report']},
      {q:'Must the prototype be polished before testing with users?',a:1,o:['True — it must look perfect','False — rough prototypes generate honest feedback','True — users cannot test rough ideas','False — do not test at all']},
      {q:'What is the MAIN purpose of building a prototype?',a:2,o:['To decorate the final report','To replace user testing','To test the idea and learn from real user feedback','To avoid improving the idea']},
      {q:'If a prototype fails during testing, has the project failed?',a:1,o:['True — failure means stop the project','False — failure reveals problems to improve','True — delete the version log','False — ignore all feedback']},
      {q:'What should the Version Log record for each iteration?',a:3,o:['Only the team members names','Only the final score','Only the project guide comment','What was built, feedback received, and what to improve next']}
    ],
    '05': [
      {q:'Who should you select as test participants?',a:1,o:['Your friends and family for convenience','Real target users who match the user group studied in Empathy','Only your classmates','Your project guide and lecturers']},
      {q:'Should you explain how the prototype works before testing?',a:1,o:['True — explain every feature first','False — never explain first; watching struggle is useful data','True — users cannot test without full explanation','False — cancel the test instead']},
      {q:'What is most important to do during a user test?',a:2,o:['Persuade users to like the prototype','Change the design during the test','Observe and listen without interfering','Ask only yes/no questions']},
      {q:'If testers complete the task, is testing done?',a:1,o:['True — completion means no more analysis','False — also identify friction points and improvement opportunities','True — submit immediately','False — restart from Empathy']},
      {q:'What should happen AFTER collecting all test feedback?',a:1,o:['Complete the phase without analysing feedback','Analyse feedback patterns, create an improvement plan, then reflect','Rebuild the entire prototype from scratch','Present results to class immediately']}
    ]
  };

  function phase(){
    if (document.body.dataset.phase) return document.body.dataset.phase.padStart(2,'0');
    const t = document.title;
    if (/Phase 05|Test/i.test(t)) return '05';
    if (/Phase 04|Prototype/i.test(t)) return '04';
    if (/Phase 03|Ideation/i.test(t)) return '03';
    if (/Phase 02|Define/i.test(t)) return '02';
    if (/Phase 01|Empathy/i.test(t)) return '01';
    return '';
  }

  function initials(name){
    return (name || 'Student').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase() || 'ST';
  }

  function toast(msg){
    let el = $('#smartToast');
    if(!el){ el=document.createElement('div'); el.id='smartToast'; el.className='smart-toast'; document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(()=>el.classList.remove('show'),2600);
  }

  function setSyncStatus(status, message){
    store.set('df_last_sync_status', status);
    store.set('df_last_sync_message', message);
    store.set('df_last_sync_time', new Date().toISOString());
  }

  function hydrateHeader(){
    const name = store.get('df_student_name') || (store.get('df_email') ? store.get('df_email').split('@')[0] : 'Student');
    $$('.student-name').forEach(e=>e.textContent=name);
    $$('.avatar,.profile-initials').forEach(e=>e.textContent=initials(name));
  }

  function syncPhaseCompletionKeys(){
    ['01','02','03','04','05'].forEach(n=>{
      if(store.get('p'+n+'_completed')==='true' && store.get('df_submitted_phase'+n)!=='true'){
        store.set('df_submitted_phase'+n, 'true');
      }
      const rawScore = store.get('p'+n+'_quiz_score'); // stored as "N/5"
      if(rawScore && !store.get('df_quiz_phase'+n)){
        const num = parseInt(String(rawScore).split('/')[0], 10);
        if(!isNaN(num)){
          store.set('df_quiz_phase'+n, String(num));
          if(num>=3) store.set('df_unlocked_phase'+n,'true');
        }
      }
    });
  }

  function isPhaseSubmitted(n){ return store.get('df_submitted_phase'+n)==='true'; }
  function quizScore(n){ return store.get('df_quiz_phase'+n); }
  function quizPassed(n){ const s = parseInt(quizScore(n)||'-1',10); return s >= 3 || store.get('df_unlocked_phase'+n)==='true'; }
  function completedCount(){ let c=0; ['01','02','03','04','05'].forEach(n=>{ if(isPhaseSubmitted(n)) c++; }); return c; }
  function currentPhase(){
    // Completion-based only. No approval gate dependency.
    for(const n of ['01','02','03','04','05']){
      if(isPhaseSubmitted(n)) continue;
      return n;
    }
    return 'portfolio';
  }

  function setupAuth(){
    const reg = $('#registrationForm');
    if(reg){
      reg.addEventListener('submit',e=>{
        e.preventDefault();
        const data=Object.fromEntries(new FormData(reg));
        Object.entries(data).forEach(([k,v])=>store.set(k,(v||'').trim()));
        store.set('df_registered','true');
        setSyncStatus('saved', 'Saved on this device.');
        syncToGoogleSheets('student_registration', { form: data }, true);
        location.href='dashboard.html';
      });
    }
    const login = $('#loginForm');
    if(login){
      login.addEventListener('submit',e=>{
        e.preventDefault();
        const data=Object.fromEntries(new FormData(login));
        Object.entries(data).forEach(([k,v])=>store.set(k,(v||'').trim()));
        store.set('df_registered','true');
        if(!store.get('df_student_name')) store.set('df_student_name',(data.df_email||'Student').split('@')[0]);
        setSyncStatus('saved', 'Saved on this device.');
        syncToGoogleSheets('student_login', { form: data }, true);
        location.href='dashboard.html';
      });
    }
  }

  function setupAccordions(){
    $$('.accordion-item').forEach((item,idx)=>{
      const btn=$('.acc-head',item);
      if(idx===0) item.classList.add('open');
      btn?.addEventListener('click',()=>item.classList.toggle('open'));
    });
  }

  function setupDashboard(){
    if(document.body.dataset.page !== 'dashboard') return;
    hydrateHeader();
    $('.greeting-name') && ($('.greeting-name').textContent = store.get('df_student_name') || 'Student');
    $('.project-title') && ($('.project-title').textContent = store.get('df_project_name') || 'My FYP Project');
    const meta = `${store.get('df_team') || 'My Team'} · ${store.get('df_supervisor') || 'My Project Guide'}`;
    $('.project-meta') && ($('.project-meta').textContent = meta);
    const pct = Math.round(completedCount()/5*100);
    $$('.progress-fill').forEach(e=>e.style.width=pct+'%');
    $('.pct') && ($('.pct').textContent=pct+'%');
    const cp = currentPhase();
    $$('.step').forEach((s,i)=>{ const n=String(i+1).padStart(2,'0'); s.classList.toggle('done', n < cp || (cp==='portfolio')); s.classList.toggle('active', n===cp); });
    $('[data-continue]')?.addEventListener('click',()=>{ location.href = PHASE_ROUTES[cp] || 'phase01-empathy.html'; });
  }

  function setupTabs(){
    const ph = phase();
    updateTemplateLock();

    $$('.tab').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const id=btn.dataset.tab;
        if(id==='templatesPanel' && ph && !quizPassed(ph)){
          toast('Please pass the quiz with at least 3/5 before opening templates.');
          switchPanel('quizPanel');
          return;
        }
        switchPanel(id);
      });
    });

    $$('.subtab').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const id=btn.dataset.subtab;
        $$('.subtab').forEach(b=>b.classList.toggle('active',b===btn));
        $$('.template-panel').forEach(p=>p.classList.toggle('active',p.id===id));
      });
    });

    $$('.switch button').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const box=btn.closest('.template-card');
        if(!box) return;
        const mode=btn.dataset.mode;
        $$('.switch button',box).forEach(b=>b.classList.toggle('active',b===btn));
        const samplePanels = $$('[data-panel="sample"], .sample-panel', box);
        const fillPanels = $$('[data-panel="fill"], .fill-panel, .fill', box);
        if(samplePanels.length || fillPanels.length){
          samplePanels.forEach(p=>{ p.hidden = mode !== 'sample'; p.classList.toggle('hidden', mode !== 'sample'); });
          fillPanels.forEach(p=>{ p.hidden = mode !== 'fill'; p.classList.toggle('active', mode === 'fill'); });
        } else {
          $('.sample',box)?.classList.toggle('hidden',mode!=='sample');
          const fill=$('.fill',box); if(fill) fill.classList.toggle('active',mode==='fill');
        }
      });
    });

    $$('[data-next-subtab]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        const next = btn.dataset.nextSubtab;
        const target = next ? document.querySelector(`[data-subtab="${next}"]`) : null;
        if(target){ target.click(); setTimeout(()=>document.getElementById(next)?.scrollIntoView({behavior:'smooth',block:'start'}), 50); }
      });
    });
  }

  function switchPanel(id){
    $$('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===id));
    $$('.panel').forEach(p=>p.classList.toggle('active',p.id===id));
    if(id==='templatesPanel') setTimeout(updateTemplateStatuses,50);
  }

  function updateTemplateLock(){
    const ph=phase(); if(!ph) return;
    const t=$('[data-tab="templatesPanel"]'); if(!t) return;
    const passed=quizPassed(ph);
    t.classList.toggle('locked',!passed);
    t.setAttribute('aria-disabled', String(!passed));
    t.title = passed ? 'Templates unlocked' : 'Pass quiz with 3/5 to unlock templates';
    const lockIcon = t.querySelector('.lock-note') || document.createElement('span');
    if(!passed && !t.querySelector('.lock-note')){ lockIcon.className='lock-note'; lockIcon.textContent=' 🔒'; t.appendChild(lockIcon); }
    if(passed) t.querySelector('.lock-note')?.remove();
  }

  function setupQuiz(){
    const box=$('#quizBox'); if(!box) return;
    const ph=phase();
    const quiz=quizSets[ph] || quizSets['01'];
    let current=0;
    const selected = Array(quiz.length).fill(null);
    const letters=['A','B','C','D'];

    function render(){
      const q=quiz[current];
      const pct=Math.round(((current+1)/quiz.length)*100);
      box.innerHTML = `
        <div class="quiz-card smart-quiz" role="region" aria-label="Phase ${ph} quiz question ${current+1}">
          <div class="quiz-progress"><span>Question ${current+1} of ${quiz.length}</span><b>${pct}%</b></div>
          <div class="quiz-bar"><span style="width:${pct}%"></span></div>
          <span class="q-count">Phase ${ph} · Quick Check</span>
          <h2 class="q-title">${escapeHtml(q.q)}</h2>
          <div class="options-list">
            ${q.o.map((o,i)=>`<button type="button" class="option ${selected[current]===i?'selected':''}" data-opt="${i}"><span class="option-letter">${letters[i]}</span><span class="option-text">${escapeHtml(o)}</span></button>`).join('')}
          </div>
          <div class="quiz-nav">
            <button type="button" class="btn ghost" id="qPrev" ${current===0?'disabled':''}>Back</button>
            <span class="quiz-status">Select A, B, C or D</span>
            <button type="button" class="btn primary" id="qNext">${current===quiz.length-1?'Submit Quiz':'Next'}</button>
          </div>
        </div>`;
      $$('.option',box).forEach(btn=>btn.addEventListener('click',()=>{ selected[current]=Number(btn.dataset.opt); render(); }));
      $('#qPrev')?.addEventListener('click',()=>{ if(current>0){ current--; render(); }});
      $('#qNext')?.addEventListener('click',()=>{
        if(selected[current]===null){ toast('Please choose an answer first.'); return; }
        if(current < quiz.length-1){ current++; render(); return; }
        showQuizResult();
      });
    }

    function showQuizResult(){
      const score = selected.reduce((s,v,i)=>s+(v===quiz[i].a?1:0),0);
      store.set('df_quiz_phase'+ph, String(score));
      if(score>=3) store.set('df_unlocked_phase'+ph,'true');
      syncToGoogleSheets('quiz_score', { phase: ph, score, total: quiz.length, passed: score >= 3, answers: selected });
      updateTemplateLock();
      const passed = score>=3;
      box.innerHTML = `
        <div class="quiz-result ${passed?'pass':'retry'}">
          <div class="result-badge">${passed?'✓':'!'}</div>
          <h2>${passed?'Templates Unlocked':'Try Again'}</h2>
          <p>You scored <strong>${score}/5</strong>. ${passed?'You can now continue to the phase templates.':'Score 3/5 or more to unlock templates.'}</p>
          <div class="result-actions">
            <button type="button" class="btn ghost" id="reviewQuiz">Review Quiz</button>
            ${passed?'<button type="button" class="btn primary" id="openTemplates">Open Templates</button>':'<button type="button" class="btn primary" id="retryQuiz">Retry Quiz</button>'}
          </div>
        </div>`;
      $('#reviewQuiz')?.addEventListener('click',()=>{current=0; render();});
      $('#retryQuiz')?.addEventListener('click',()=>{current=0; selected.fill(null); render();});
      $('#openTemplates')?.addEventListener('click',()=>switchPanel('templatesPanel'));
      toast(passed ? 'Great! Templates unlocked.' : 'Score saved. Try again when ready.');
    }
    render();
  }

  function formValues(root){
    const data={};
    $$('input, textarea, select', root).forEach(el=>{
      const key = el.name || el.dataset.key;
      if(!key) return;
      if(el.type === 'file') { data[key] = el.files && el.files.length ? Array.from(el.files).map(f=>f.name).join(', ') : ''; }
      else if(el.type === 'checkbox') data[key] = el.checked ? 'true' : 'false';
      else data[key] = el.value;
    });
    return data;
  }

  function applyValues(root,data){
    $$('input, textarea, select', root).forEach(el=>{
      const key = el.name || el.dataset.key;
      if(!key || data[key] === undefined || el.type === 'file') return;
      if(el.type === 'checkbox') el.checked = data[key] === 'true';
      else el.value = data[key];
    });
  }

  function panelIdFor(el){
    const panel = el.closest('.template-panel');
    if(panel?.id) return panel.id;
    const card = el.closest('.template-card');
    const title = card?.querySelector('h2')?.textContent || 'general';
    return title.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'') || 'general';
  }

  function saveTemplateFrom(btn){
    const ph=phase(); if(!ph) return;
    const panel = btn.closest('.template-panel') || btn.closest('.template-card') || document;
    const tid = panelIdFor(btn);
    const all = store.json('df_phase'+ph+'_templates',{});
    all[tid] = { savedAt: new Date().toISOString(), values: formValues(panel) };
    store.setJson('df_phase'+ph+'_templates', all);
    store.set('df_template_phase'+ph+'_'+tid, 'true');
    syncToGoogleSheets('template_save', { phase: ph, templateId: tid, values: all[tid].values, savedAt: all[tid].savedAt });
    updateTemplateStatuses();
    toast(`Saved ${tid.toUpperCase()} on this device.`);
  }

  function restoreTemplates(){
    const ph=phase(); if(!ph) return;
    const all = store.json('df_phase'+ph+'_templates',{});
    Object.entries(all).forEach(([tid,entry])=>{
      const panel = document.getElementById(tid);
      if(panel && entry.values) applyValues(panel,entry.values);
    });
    updateTemplateStatuses();
  }

  function templateFilled(id){
    const ph=phase();
    if(store.get('df_template_phase'+ph+'_'+id)==='true') return true;
    const panel=document.getElementById(id); if(!panel) return false;
    return Object.values(formValues(panel)).some(v => String(v||'').trim() !== '');
  }

  function updateTemplateStatuses(){
    const ph=phase(); if(!ph) return;
    $$('.template-panel').forEach(panel=>{
      const done = templateFilled(panel.id);
      panel.classList.toggle('template-saved', done);
      const status = panel.querySelector('.status');
      if(status){ status.textContent = done ? 'Saved' : status.textContent.replace('Saved','Not Started') || 'Not Started'; status.classList.toggle('saved',done); }
    });
    $$('.subtab').forEach(btn=>{
      const id=btn.dataset.subtab;
      if(id) btn.classList.toggle('saved', templateFilled(id));
    });
  }

  function setupForms(){
    restoreTemplates();
    $$('[data-save]').forEach(btn=>btn.addEventListener('click',()=>saveTemplateFrom(btn)));
    $('[data-print]')?.addEventListener('click',()=>window.print());

    const submit = $('[data-submit-phase]') || $('#submitPhaseBtn');
    if(submit){
      submit.addEventListener('click',()=>{
        const ph=phase();
        const expected = PHASE_TEMPLATES[ph] || $$('.template-panel').map(p=>p.id);
        const missing = expected.filter(id => document.getElementById(id) && !templateFilled(id));
        if(missing.length){
          const ok = confirm(`Some templates are not saved yet: ${missing.map(x=>x.toUpperCase()).join(', ')}.\n\nSubmit Phase ${ph} anyway?`);
          if(!ok) return;
        }
        const allData = {};
        expected.forEach(id=>{ const panel=document.getElementById(id); if(panel) allData[id]=formValues(panel); });
        store.setJson('df_phase'+ph+'_submission', { submittedAt:new Date().toISOString(), templates:allData });
        store.set('df_submitted_phase'+ph,'true');
        setSyncStatus('saved', 'Saved on this device.');
        syncToGoogleSheets('phase_submit', { phase: ph, submission: allData, submittedAt: new Date().toISOString(), nextPhase: NEXT_PHASE[ph] || null });
        const next = NEXT_PHASE[ph];
        showSubmitSuccess(ph,next);
      });
    }

    // ── T01 Interview Recording ──────────────────────────────────────────
    (function setupRecording(){
      const startBtn  = $('#startRec');
      const pauseBtn  = $('#pauseRec');
      const stopBtn   = $('#stopRec');
      const timerEl   = document.querySelector('.timer');
      if(!startBtn || !pauseBtn || !stopBtn) return;

      let mediaRecorder = null;
      let chunks        = [];
      let timerInterval = null;
      let elapsed       = 0;   // seconds
      let isPaused      = false;

      function formatTime(s){ return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0'); }

      function tickTimer(){
        elapsed++;
        if(timerEl) timerEl.textContent = formatTime(elapsed);
      }

      function setButtons(state){
        // state: 'idle' | 'recording' | 'paused'
        startBtn.disabled  = state !== 'idle';
        pauseBtn.disabled  = state === 'idle';
        stopBtn.disabled   = state === 'idle';
        startBtn.textContent = state === 'idle' ? 'Start Recording' : '● Recording';
        pauseBtn.textContent = state === 'paused' ? 'Resume' : 'Pause';
        startBtn.style.opacity = state !== 'idle' ? '.55' : '1';
      }

      setButtons('idle');

      startBtn.addEventListener('click', async ()=>{
        if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
          toast('Microphone not supported on this browser.');
          return;
        }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          chunks = [];
          elapsed = 0;
          if(timerEl) timerEl.textContent = '00:00';
          mediaRecorder = new MediaRecorder(stream);
          mediaRecorder.ondataavailable = e => { if(e.data.size > 0) chunks.push(e.data); };
          mediaRecorder.onstop = ()=>{
            const blob = new Blob(chunks, { type: 'audio/webm' });
            const url  = URL.createObjectURL(blob);
            // Inject or update the audio player in the audio-box
            let audioBox = document.querySelector('.audio-box');
            if(audioBox){
              let player = audioBox.querySelector('audio#recPlayer');
              if(!player){
                player = document.createElement('audio');
                player.id      = 'recPlayer';
                player.controls = true;
                player.style.cssText = 'width:100%;margin-top:10px;border-radius:12px;';
                audioBox.appendChild(player);
              }
              player.src = url;
            }
            stream.getTracks().forEach(t=>t.stop());
            clearInterval(timerInterval);
            setButtons('idle');
            toast('Recording saved. Review the audio above.');
          };
          mediaRecorder.start(250);
          timerInterval = setInterval(tickTimer, 1000);
          setButtons('recording');
          isPaused = false;
          toast('Recording started. Speak clearly.');
        } catch(err){
          toast('Microphone access denied. Please allow microphone permission.');
        }
      });

      pauseBtn.addEventListener('click', ()=>{
        if(!mediaRecorder) return;
        if(mediaRecorder.state === 'recording'){
          mediaRecorder.pause();
          clearInterval(timerInterval);
          isPaused = true;
          setButtons('paused');
          toast('Recording paused.');
        } else if(mediaRecorder.state === 'paused'){
          mediaRecorder.resume();
          timerInterval = setInterval(tickTimer, 1000);
          isPaused = false;
          setButtons('recording');
          toast('Recording resumed.');
        }
      });

      stopBtn.addEventListener('click', ()=>{
        if(!mediaRecorder || mediaRecorder.state === 'inactive') return;
        mediaRecorder.stop();
        toast('Recording stopped.');
      });
    })();

    // ── T01 Auto Transcribe (Web Speech API) ─────────────────────────────
    (function setupAutoTranscribe(){
      const btn = $('#autoTranscribe');
      if(!btn) return;
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if(!SpeechRecognition){
        btn.title = 'Speech recognition not supported on this browser.';
        btn.style.opacity = '.5';
        btn.addEventListener('click', ()=> toast('Auto Transcribe requires Chrome or Edge on desktop.'));
        return;
      }
      let recognising = false;
      const recog = new SpeechRecognition();
      recog.continuous    = true;
      recog.interimResults = true;
      recog.lang          = 'en-US';
      let finalTranscript = '';

      recog.onresult = e => {
        let interim = '';
        for(let i = e.resultIndex; i < e.results.length; i++){
          const t = e.results[i][0].transcript;
          if(e.results[i].isFinal) finalTranscript += t + ' ';
          else interim += t;
        }
        const ta = $('textarea[name="t01_transcript"]');
        if(ta) ta.value = finalTranscript + interim;
      };

      recog.onerror = e => {
        toast('Speech error: ' + e.error + '. Try again.');
        recognising = false;
        btn.textContent = 'Auto Transcribe';
      };

      recog.onend = () => {
        if(recognising){ recog.start(); } // keep alive while toggled on
      };

      btn.addEventListener('click', ()=>{
        if(!recognising){
          finalTranscript = $('textarea[name="t01_transcript"]')?.value || '';
          recog.start();
          recognising = true;
          btn.textContent = '⏹ Stop Transcribe';
          toast('Listening… speak now. Click Stop when done.');
        } else {
          recognising = false;
          recog.stop();
          btn.textContent = 'Auto Transcribe';
          toast('Transcription stopped. Review and edit the text.');
        }
      });
    })();

    // ── T05 POV Auto-Assembly ─────────────────────────────────────────────
    (function setupPOVAssembly(){
      const userEl    = $('[name="df_p02_t05_user"]');
      const needEl    = $('[name="df_p02_t05_need"]');
      const insightEl = $('[name="df_p02_t05_insight"]');
      const povEl     = $('[name="df_p02_t05_pov"]');
      if(!userEl || !needEl || !insightEl || !povEl) return;

      function assemblePOV(){
        const u = userEl.value.trim();
        const n = needEl.value.trim();
        const s = insightEl.value.trim();
        if(!u && !n && !s){ povEl.value = ''; return; }
        let pov = '';
        if(u) pov += u;
        if(n) pov += (pov ? ' ' : '') + n;
        if(s) pov += (pov ? ' ' : '') + (s.startsWith('because') || s.startsWith('Because') ? s : 'because ' + s);
        if(pov && !pov.endsWith('.')) pov += '.';
        // Only auto-fill if student hasn't manually edited the POV field beyond what assembly would produce
        povEl.value = pov;
      }

      [userEl, needEl, insightEl].forEach(el => el.addEventListener('input', assemblePOV));
    })();

    // ── T06 Best HMW Live Select ──────────────────────────────────────────
    (function setupHMWSelect(){
      // Replace the Best HMW textarea with a <select> that mirrors the 5 HMW fields
      const bestTa = $('[name="df_p02_t06_best_hmw"]');
      if(!bestTa) return;

      // Create the select element, styled exactly like .select
      const sel = document.createElement('select');
      sel.name      = 'df_p02_t06_best_hmw';
      sel.className = 'select';

      function rebuildOptions(){
        const current = sel.value;
        sel.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '— Select the best HMW question —';
        sel.appendChild(placeholder);

        const names = ['df_p02_t06_hmw1','df_p02_t06_hmw2','df_p02_t06_hmw3','df_p02_t06_hmw4','df_p02_t06_hmw5'];
        names.forEach((n, i) => {
          const src = $('[name="'+n+'"]');
          const text = src ? src.value.trim() : '';
          if(!text) return;
          const opt = document.createElement('option');
          opt.value = text;
          opt.textContent = 'HMW '+(i+1)+': '+text;
          sel.appendChild(opt);
        });

        // Custom typed option — always add so student can type their own
        const customOpt = document.createElement('option');
        customOpt.value   = '__custom__';
        customOpt.textContent = '✏️ Type my own…';
        sel.appendChild(customOpt);

        // Restore previous selection if it still exists
        const match = Array.from(sel.options).find(o => o.value === current);
        if(match) sel.value = current;
      }

      // Build a custom-input textarea that appears when student picks "Type my own"
      const customInput = document.createElement('textarea');
      customInput.className   = 'textarea';
      customInput.placeholder = 'Type your own best HMW question here…';
      customInput.name        = '__df_p02_t06_best_hmw_custom__';
      customInput.style.cssText = 'margin-top:8px;display:none;';

      sel.addEventListener('change', ()=>{
        if(sel.value === '__custom__'){
          customInput.style.display = 'block';
          customInput.focus();
        } else {
          customInput.style.display = 'none';
        }
      });

      // Replace textarea with select + customInput
      bestTa.parentNode.insertBefore(sel, bestTa);
      bestTa.parentNode.insertBefore(customInput, bestTa);
      bestTa.remove();

      // Listen on each HMW field to rebuild options dynamically
      const hmwNames = ['df_p02_t06_hmw1','df_p02_t06_hmw2','df_p02_t06_hmw3','df_p02_t06_hmw4','df_p02_t06_hmw5'];
      hmwNames.forEach(n => {
        const el = $('[name="'+n+'"]');
        if(el) el.addEventListener('input', rebuildOptions);
      });

      rebuildOptions();

      // On save, if custom was chosen, copy custom textarea value into the select's stored value
      // We override formValues for this field by patching after save
      const t06panel = document.getElementById('t06');
      if(t06panel){
        const saveBtn = t06panel.querySelector('[data-save]');
        if(saveBtn){
          saveBtn.addEventListener('click', ()=>{
            if(sel.value === '__custom__' && customInput.value.trim()){
              // Add the custom value as a real option and select it
              const existing = Array.from(sel.options).find(o => o.value === customInput.value.trim());
              if(!existing){
                const opt = document.createElement('option');
                opt.value = customInput.value.trim();
                opt.textContent = customInput.value.trim();
                sel.insertBefore(opt, sel.querySelector('[value="__custom__"]'));
              }
              sel.value = customInput.value.trim();
              customInput.style.display = 'none';
            }
          }, true); // capture phase so it fires before the main save handler
        }
      }

      // Restore saved value after restoreTemplates runs (it fires on DOMContentLoaded)
      // We use a small timeout to let applyValues complete first
      setTimeout(()=>{
        const saved = sel.value;
        rebuildOptions();
        if(saved && saved !== '__custom__'){
          // Try to re-select; if not in list (because HMW fields empty), add it
          const match = Array.from(sel.options).find(o => o.value === saved);
          if(!match && saved){
            const opt = document.createElement('option');
            opt.value = saved;
            opt.textContent = saved;
            sel.insertBefore(opt, sel.querySelector('[value="__custom__"]'));
          }
          sel.value = saved;
        }
      }, 150);
    })();
  }

  function showSubmitSuccess(ph,next){
    const panel=$('.panel.active') || $('main') || document.body;
    const card=document.createElement('div');
    card.className='submit-success-card';
    let nextHtml = '';
    if(next){
      nextHtml = `<p>Next step: continue to <strong>${next.label}</strong>.</p>
      <div class="success-actions">
        <a class="btn ghost" href="progress.html">View Progress</a>
        <a class="btn primary" href="${next.url}">Go to ${next.label}</a>
      </div>`;
    } else {
      nextHtml = `<div class="success-actions"><a class="btn ghost" href="progress.html">View Progress</a></div>`;
    }
    card.innerHTML=`
      <div class="success-mark">✓</div>
      <h2>Phase ${ph} Completed Successfully</h2>
      <p>Phase completed successfully. Your work has been saved on this device. You may continue to the next phase.</p>
      ${nextHtml}`;
    panel.prepend(card);
    card.scrollIntoView({behavior:'smooth',block:'start'});
    toast(`Phase ${ph} completed.`);
  }

  // ── Gate approval logic removed: no approval gate in this app ─────
  function isGateApproved(){ return true; }
  function isGateApprovedByNum(){ return true; }
  function checkGateApproval(){ return Promise.resolve(true); }
  function pollGateApproval(){ return null; }

  function setupGateGuard(){
    // No approval gate in this app. Function kept as a safe no-op
    // so any existing call sites (e.g. init()) do not error.
    return;
  }


  function setupNavActive(){
    const page=document.body.dataset.page;
    $$('.nav-item').forEach(a=>a.classList.toggle('active',a.dataset.nav===page));
  }

  function renderProfile(){
    if(document.body.dataset.page!=='profile') return;
    const name=store.get('df_student_name') || (store.get('df_email') ? store.get('df_email').split('@')[0] : 'Student');
    $('.profile-name') && ($('.profile-name').textContent=name);
    $('[data-field="reg"]') && ($('[data-field="reg"]').textContent=store.get('df_reg_no')||store.get('df_registration_no')||'Not added');
    $('[data-field="class"]') && ($('[data-field="class"]').textContent=store.get('df_class')||'Not added');
    $('[data-field="team"]') && ($('[data-field="team"]').textContent=store.get('df_team')||'My Team');
    $('[data-field="supervisor"]') && ($('[data-field="supervisor"]').textContent=store.get('df_supervisor')||'My Project Guide');
    // Show project name field if present in HTML
    $('[data-field="project"]') && ($('[data-field="project"]').textContent=store.get('df_project_name')||'Not added');
    $('#profileTasks') && ($('#profileTasks').textContent=pendingTasks());
    $('#profileEvidence') && ($('#profileEvidence').textContent=completedCount());
    $('#profileFeedback') && ($('#profileFeedback').textContent=['01','02','03','04','05'].filter(n=>quizPassed(n)).length);
    $('#profileBadges') && ($('#profileBadges').textContent=badgeData().filter(b=>b.earned).length);
    $('#logoutBtn')?.addEventListener('click',()=>{ if(confirm('Log out from Smart DT Project on this device?')){ store.del('df_registered'); location.href='welcome.html'; } });
    $('#editProfileBtn')?.addEventListener('click',()=>enableProfileEdit());

    // ── Camera dot: upload photo stored as dataURL ────────────────────
    const cameraDot = $('.camera-dot');
    const avatarEl  = $('.profile-avatar-v9');
    const initialsEl = $('.profile-initials');
    if(cameraDot && avatarEl){
      // Restore saved photo
      const savedPhoto = store.get('df_profile_photo');
      if(savedPhoto){
        avatarEl.style.backgroundImage = `url(${savedPhoto})`;
        avatarEl.style.backgroundSize  = 'cover';
        avatarEl.style.backgroundPosition = 'center';
        if(initialsEl) initialsEl.style.display = 'none';
      }
      // Wire the + button to a hidden file input
      let photoInput = $('#profilePhotoInput');
      if(!photoInput){
        photoInput = document.createElement('input');
        photoInput.type    = 'file';
        photoInput.id      = 'profilePhotoInput';
        photoInput.accept  = 'image/*';
        photoInput.style.display = 'none';
        document.body.appendChild(photoInput);
      }
      cameraDot.addEventListener('click', ()=> photoInput.click());
      photoInput.addEventListener('change', ()=>{
        const file = photoInput.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = e => {
          const dataUrl = e.target.result;
          store.set('df_profile_photo', dataUrl);
          avatarEl.style.backgroundImage    = `url(${dataUrl})`;
          avatarEl.style.backgroundSize     = 'cover';
          avatarEl.style.backgroundPosition = 'center';
          if(initialsEl) initialsEl.style.display = 'none';
          toast('Profile photo updated.');
        };
        reader.readAsDataURL(file);
      });
    }

    // ── Profile menu buttons: inline expand panels ────────────────────
    setupProfileMenuPanels();
  }

  function setupProfileMenuPanels(){
    // Each button maps to a panel definition.
    // Panels expand below their button; only one open at a time.
    // Existing Edit Profile (card-level) and Logout are untouched.
    const menuList = $('.menu-list-v9');
    if(!menuList) return;

    const panels = {
      personalInfo: {
        title: 'Personal Information',
        render: ()=>{
          const email = store.get('df_email') || 'Not added';
          const reg   = store.get('df_reg_no') || store.get('df_registration_no') || 'Not added';
          const cls   = store.get('df_class') || 'Not added';
          return `
            <div class="profile-info-panel">
              <div class="profile-field"><span>Full Name</span><strong>${escapeHtml(store.get('df_student_name')||'Not added')}</strong></div>
              <div class="profile-field"><span>Email</span><strong>${escapeHtml(email)}</strong></div>
              <div class="profile-field"><span>Registration No.</span><strong>${escapeHtml(reg)}</strong></div>
              <div class="profile-field"><span>Class</span><strong>${escapeHtml(cls)}</strong></div>
              <div class="profile-field" style="grid-column:1/-1"><span>Project Title</span><strong>${escapeHtml(store.get('df_project_name')||'Not added')}</strong></div>
              <p style="font-size:11.5px;color:var(--muted);margin-top:8px">To update details, use <strong>Edit Profile</strong> above.</p>
            </div>`;
        }
      },
      teamRoles: {
        title: 'Team & Roles',
        render: ()=>{
          const team = store.get('df_team') || 'Not added';
          const sup  = store.get('df_supervisor') || 'Not added';
          return `
            <div class="profile-info-panel">
              <div class="profile-field"><span>Team Name</span><strong>${escapeHtml(team)}</strong></div>
              <div class="profile-field"><span>Project Guide</span><strong>${escapeHtml(sup)}</strong></div>
              <p style="font-size:11.5px;color:var(--muted);margin-top:8px">To update these details, use <strong>Edit Profile</strong> above.</p>
            </div>`;
        }
      },
      myReflections: {
        title: 'My Pitch & Reflections',
        render: ()=>{
          const slides = [1,2,3,4,5,6,7,8].map(i=>store.get('p05_t14_slide'+i));
          const pitchDone = !!slides[0];
          const filledCount = slides.filter(s=>s).length;
          const issue = store.get('p05_t13_issue');
          const fix   = store.get('p05_t13_fix');
          if(!pitchDone && !issue){
            return `<div class="profile-info-panel"><p style="font-size:13px;color:var(--muted);padding:8px 0">Your Improvement Plan (T13) and Pitch (T14) have not been completed yet. Complete Phase 05 Test to see them here.</p><a class="btn ghost" style="font-size:12px;min-height:40px;margin-top:8px" href="phase05-test.html">Go to Phase 05</a></div>`;
          }
          return `
            <div class="profile-info-panel">
              ${issue ? `<div class="profile-field" style="grid-column:1/-1"><span>Main Issue Found (T13)</span><strong style="font-weight:600;font-size:12px">${escapeHtml(issue)}</strong></div>` : ''}
              ${fix   ? `<div class="profile-field" style="grid-column:1/-1"><span>Proposed Fix (T13)</span><strong style="font-weight:600;font-size:12px">${escapeHtml(fix)}</strong></div>` : ''}
              <div class="profile-field" style="grid-column:1/-1"><span>Pitch Progress (T14)</span><strong>${filledCount}/8 slides completed</strong></div>
              ${pitchDone ? `<div class="profile-field" style="grid-column:1/-1"><span>Slide 1 — Title</span><strong style="font-weight:600;font-size:12px">${escapeHtml(slides[0])}</strong></div>` : ''}
            </div>`;
        }
      },
      settings: {
        title: 'Settings',
        render: ()=>{
          return `
            <div class="profile-info-panel">
              <div class="profile-field" style="grid-column:1/-1">
                <span>Local Data</span>
                <strong style="font-weight:600;font-size:12px">All progress is saved on this device using local storage.</strong>
              </div>
              <div class="profile-field" style="grid-column:1/-1">
                <span>Sync Status</span>
                <strong style="font-weight:600;font-size:12px">${escapeHtml(store.get('df_last_sync_message')||'No sync activity yet.')}</strong><small style="display:block;margin-top:4px;color:var(--muted)">Last action: ${escapeHtml(store.get('df_last_sync_action')||'None')} · Status: ${escapeHtml(store.get('df_last_sync_status')||'—')}</small>
              </div>
              <div style="grid-column:1/-1;margin-top:8px">
                <button class="btn ghost" style="font-size:12px;min-height:40px;width:100%" id="clearPhotoBtn">Remove Profile Photo</button>
              </div>
              <p style="font-size:11px;color:var(--muted);margin-top:8px;grid-column:1/-1">To reset all progress, use Log Out and re-register.</p>
            </div>`;
        },
        afterRender: (panel)=>{
          panel.querySelector('#clearPhotoBtn')?.addEventListener('click',()=>{
            store.del('df_profile_photo');
            const av = $('.profile-avatar-v9');
            const init = $('.profile-initials');
            if(av){ av.style.backgroundImage=''; av.style.backgroundSize=''; }
            if(init) init.style.display='';
            toast('Profile photo removed.');
          });
        }
      }
    };

    // Map button text content to panel key
    const btnMap = [
      ['Personal Information', 'personalInfo'],
      ['Team & Roles',         'teamRoles'],
      ['My Reflections',       'myReflections'],
      ['Settings',             'settings']
    ];

    $$('.menu-row-v9', menuList).forEach(btn => {
      const label = btn.querySelector('strong')?.textContent?.trim() || '';
      const match = btnMap.find(([text]) => label.includes(text));
      if(!match) return;
      const [, key] = match;

      btn.addEventListener('click', ()=>{
        // Close any open panel for this button
        const existing = btn.nextElementSibling;
        if(existing && existing.classList.contains('profile-menu-panel')){
          existing.remove();
          btn.classList.remove('menu-row-open');
          return;
        }
        // Close all other open panels
        $$('.profile-menu-panel', menuList).forEach(p=>p.remove());
        $$('.menu-row-open', menuList).forEach(b=>b.classList.remove('menu-row-open'));

        // Build and insert panel
        const def = panels[key];
        const panel = document.createElement('div');
        panel.className = 'profile-menu-panel';
        panel.innerHTML = def.render();
        btn.insertAdjacentElement('afterend', panel);
        btn.classList.add('menu-row-open');
        if(def.afterRender) def.afterRender(panel);
        panel.scrollIntoView({behavior:'smooth', block:'nearest'});
      });
    });
  }

  function pendingTasks(){
    let count=0; ['01','02','03','04','05'].forEach(n=>{ if(!isPhaseSubmitted(n)) count++; if(!quizScore(n)) count++; });
    return Math.min(count,9);
  }

  function enableProfileEdit(){
    const card=$('.profile-card-v9'); if(!card || card.classList.contains('edit-mode')) return;
    card.classList.add('edit-mode');
    const fields={reg:['df_reg_no','Registration No.'], class:['df_class','Class'], team:['df_team','Team'], supervisor:['df_supervisor','Project Guide']};
    Object.entries(fields).forEach(([key,[storeKey,label]])=>{ const el=$(`[data-field="${key}"]`); if(el) el.innerHTML=`<input aria-label="${label}" value="${escapeAttr(store.get(storeKey)||'')}" data-edit-key="${storeKey}" placeholder="${label}">`; });
    const actions=document.createElement('div'); actions.className='edit-actions'; actions.innerHTML='<button class="btn teal" type="button" id="saveProfileEdit">Save Details</button><button class="btn ghost" type="button" id="cancelProfileEdit">Cancel</button>'; card.appendChild(actions);
    $('#saveProfileEdit').onclick=()=>{ $$('[data-edit-key]').forEach(i=>store.set(i.dataset.editKey,i.value.trim())); syncToGoogleSheets('profile_update', { profile: studentPayload() }, true); location.reload(); };
    $('#cancelProfileEdit').onclick=()=>location.reload();
  }

  function renderProgress(){
    if(document.body.dataset.page!=='progress') return;
    const phases=[
      {n:'01', name:'Phase 01 — Empathy', url:'phase01-empathy.html'},
      {n:'02', name:'Phase 02 — Define', url:'phase02-define.html'},
      {n:'03', name:'Phase 03 — Ideation', url:'phase03-ideation.html'},
      {n:'04', name:'Phase 04 — Prototype', url:'phase04-prototype.html'},
      {n:'05', name:'Phase 05 — Test', url:'phase05-test.html'}
    ];
    const done=completedCount(), pct=Math.round(done/5*100), current=currentPhase();
    $('#progressDoneText') && ($('#progressDoneText').textContent=`${done} of 5 phases complete`);
    $('#progressPct') && ($('#progressPct').textContent=pct+'%');
    $('#progressFill') && ($('#progressFill').style.width=pct+'%');
    const list=$('#phaseProgressList');
    if(list){ list.innerHTML=phases.map(p=>{
      const q=quizScore(p.n); const isDone=isPhaseSubmitted(p.n); const isCurrent=current===p.n;
      return `<a class="phase-card-v9 ${isDone?'done':''} ${isCurrent?'current':''}" href="${p.url}"><span class="phase-num-v9">${isDone?'✓':p.n}</span><span class="phase-body-v9"><strong>${p.name}</strong><span class="phase-tags-v9"><em class="tag-v9 ${q?'pass':'locked'}">${q?'Quiz Passed '+q+'/5':'Quiz pending'}</em><em class="tag-v9 ${isDone?'done':'pending'}">${isDone?'Phase Completed':(isCurrent?'Next Phase Available':'Not yet started')}</em></span></span><span class="phase-arrow-v9">›</span></a>`;
    }).join(''); }
    const gates=$('#gateList');
    if(gates){ gates.innerHTML=phases.map(p=>{
      const q=quizScore(p.n); const isDone=isPhaseSubmitted(p.n);
      const statusClass = isDone ? 'approved' : (q ? 'submitted' : 'pending');
      const statusText  = isDone ? 'Phase Completed' : (q ? 'Templates Saved' : 'Not yet started');
      return `<div class="gate-row-v9"><span class="gate-ico ${isDone?'approved':''}"><img src="${isDone?'https://iili.io/CJgMhp1.png':'https://iili.io/Cd3sBGS.png'}" alt=""></span><span class="gate-info-v9"><strong>${p.name}</strong><small>Quiz ${q?q+'/5 passed':'pending'} · Templates ${isDone?'saved':'in progress'}</small></span><span class="gate-pill-v9 ${statusClass}">${statusText}</span></div>`;
    }).join(''); }
    const grid=$('#badgeGrid'); if(grid){ grid.innerHTML=badgeData().map(b=>`<div class="badge-card-v9 ${b.earned?'':'locked'}"><img src="${b.img}" alt=""><strong>${b.name}</strong><small>${b.text}</small></div>`).join(''); }
    $('#continuePhaseBtn')?.addEventListener('click',()=>{ location.href = PHASE_ROUTES[current] || 'portfolio-completion.html'; });
  }

  function gateSubmitted(){ return true; }
  function badgeData(){
    const d=completedCount();
    return [
      {name:'DT Explorer', img:'https://iili.io/CdFdugj.png', earned:d>=3, text:'3 of 5 phases completed'},
      {name:'Empathy Champion', img:'https://iili.io/CdFdnz7.png', earned:isPhaseSubmitted('01'), text:'Phase 01 completed'},
      {name:'Problem Framer', img:'https://iili.io/CdFdIqu.png', earned:isPhaseSubmitted('02'), text:'Phase 02 completed'},
      {name:'Idea Generator', img:'https://iili.io/CdFdqe2.png', earned:isPhaseSubmitted('03'), text:'Ideation completed'},
      {name:'Prototype Builder', img:'https://iili.io/CdFdT0b.png', earned:isPhaseSubmitted('04'), text:'Prototype evidence completed'},
      {name:'User Tester', img:'https://iili.io/CdFdRdx.png', earned:isPhaseSubmitted('05'), text:'Test phase completed'},
      {name:'DT Graduate', img:'https://iili.io/CdFdoX9.png', earned:d>=5, text:'All phases completed'},
      {name:'Full Portfolio', img:'https://iili.io/CdFdBbS.png', earned:d>=5, text:'Ready for portfolio'}
    ];
  }


  function renderPortfolio(){
    if(document.body.dataset.page!=='portfolio') return;
    const name  = store.get('df_student_name') || 'Student';
    const proj  = store.get('df_project_name') || 'My FYP Project';
    const team  = store.get('df_team')         || 'My Team';
    const sup   = store.get('df_supervisor')   || 'My Project Guide';
    const done  = completedCount();
    const badges = badgeData().filter(b=>b.earned);
    const allDone = done >= 5;
    const pitchDone = !!store.get('p05_t14_slide1');
    const summaryCard = $('#portfolioSummary');
    if(summaryCard){
      const phasesLeft = 5-done;
      summaryCard.innerHTML =
        '<div class="portfolio-student-row">'
        +'<div class="portfolio-avatar">'+escapeHtml(initials(name))+'</div>'
        +'<div>'
        +'<h2 class="portfolio-student-name">'+escapeHtml(name)+'</h2>'
        +'<p class="portfolio-student-meta">'+escapeHtml(proj)+'</p>'
        +'<p class="portfolio-student-meta" style="margin-top:2px">'+escapeHtml(team)+' &middot; Project Guide: '+escapeHtml(sup)+'</p>'
        +'</div></div>'
        +'<div class="portfolio-stats-row">'
        +'<div class="portfolio-stat '+(allDone?'done':'')+'"><strong>'+done+'/5</strong><span>Phases<br>Completed</span></div>'
        +'<div class="portfolio-stat '+(pitchDone?'done':'')+'"><strong>'+(pitchDone?'✓':'—')+'</strong><span>Final Pitch<br>Completed</span></div>'
        +'<div class="portfolio-stat '+(badges.length>0?'done':'')+'"><strong>'+badges.length+'</strong><span>Badges<br>Earned</span></div>'
        +'</div>'
        +(allDone
          ? '<div class="portfolio-ready-banner">All phases complete &mdash; ready for showcase / portfolio export!</div>'
          : '<div class="portfolio-pending-banner">'
            +(phasesLeft>0 ? phasesLeft+' phase'+(phasesLeft!==1?'s':'')+' remaining.' : '')
            +'</div>');
    }
    const checklistEl = $('#portfolioChecklist');
    if(checklistEl){
      const improvementDone = !!(store.get('p05_t13_issue') || store.get('p05_t13_fix'));
      const items = [
        { label:'Phase 01 completed',                 done: isPhaseSubmitted('01') },
        { label:'Phase 02 completed',                 done: isPhaseSubmitted('02') },
        { label:'Phase 03 completed',                 done: isPhaseSubmitted('03') },
        { label:'Phase 04 completed',                 done: isPhaseSubmitted('04') },
        { label:'Phase 05 completed',                 done: isPhaseSubmitted('05') },
        { label:'Improvement Plan completed',          done: improvementDone },
        { label:'Final Pitch completed',                done: pitchDone },
        { label:'Ready for showcase / portfolio export', done: allDone }
      ];
      checklistEl.innerHTML = items.map(item=>
        '<li class="portfolio-checklist-item '+(item.done?'done':'')+'">'
        +'<span class="checklist-dot '+(item.done?'done':'')+'">'+( item.done ? '&#10003;' : '&#9675;' )+'</span>'
        +'<span>'+escapeHtml(item.label)+'</span></li>'
      ).join('');
    }
    $('#portfolioPrintBtn')?.addEventListener('click',()=>window.print());
    $('#portfolioProgressBtn')?.addEventListener('click',()=>{ location.href='progress.html'; });
  }

  function escapeHtml(str){ return String(str||'').replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":"&#39;",'"':'&quot;'}[c])); }
  function escapeAttr(str){ return escapeHtml(str).replace(/`/g,'&#96;'); }

  document.addEventListener('DOMContentLoaded',()=>{
    syncPhaseCompletionKeys();
    setupGateGuard();
    hydrateHeader();
    setupAuth();
    setupAccordions();
    setupDashboard();
    setupTabs();
    setupQuiz();
    setupForms();
    setupNavActive();
    renderProfile();
    renderProgress();
    renderPortfolio();
  });
})();
