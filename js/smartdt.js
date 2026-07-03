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
    store.set('df_last_sync_status', 'Saved on this device. Syncing to Google Sheets…');
    try {
      if(useBeacon && navigator.sendBeacon) {
        const ok = navigator.sendBeacon(APPS_SCRIPT_WEB_APP_URL, new Blob([body], { type: 'text/plain;charset=UTF-8' }));
        store.set('df_last_sync_status', ok ? 'Synced to Google Sheets.' : 'Sync failed. Your work is still saved on this device. Please try syncing again when internet is stable.');
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
        store.set('df_last_sync_status', 'Synced to Google Sheets.');
        store.set('df_last_sync_time', new Date().toISOString());
        return true;
      }).catch(err => {
        console.warn('Smart DT Google Sheets sync failed:', err);
        store.set('df_last_sync_status', 'Sync failed. Your work is still saved on this device. Please try syncing again when internet is stable.');
        store.set('df_last_sync_error', String(err && err.message || err));
        return false;
      });
    } catch(err) {
      console.warn('Smart DT Google Sheets sync error:', err);
      store.set('df_last_sync_status', 'Sync failed. Your work is still saved on this device. Please try syncing again when internet is stable.');
      store.set('df_last_sync_error', String(err && err.message || err));
      return Promise.resolve(false);
    }
  }

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
    // Completion-based only. No supervisor gate dependency.
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
    $('[data-field="supervisor"]') && ($('[data-field="supervisor"]').textContent=store.get('df_supervisor')||'My Supervisor');
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
                <strong style="font-weight:600;font-size:12px">Last action: ${escapeHtml(store.get('df_last_sync_action')||'None')} · Status: ${escapeHtml(store.get('df_last_sync_status')||'—')}</strong>
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
    const grid=$('#badgeGrid'); if(grid){ grid.innerHTML=badgeData().map(b=>`<div class="badge-card-v9 ${b.earned?'':'locked'}"><img src="${b.img}" alt=""><strong>${b.name}</strong><small>${b.text}</small></div>`).join(''); }
    $('#continuePhaseBtn')?.addEventListener('click',()=>{ location.href = PHASE_ROUTES[current] || 'portfolio-completion.html'; });
  }

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
    hydrateHeader();
    setupAuth();
    setupAccordions();
    setupDashboard();
    setupNavActive();
    renderProfile();
    renderProgress();
    renderPortfolio();
  });
})();
