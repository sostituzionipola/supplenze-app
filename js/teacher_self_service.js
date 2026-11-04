/**
 * TEACHER_SELF_SERVICE.JS — La Mia Area Docente
 * Profilo personale del docente con 4 schede:
 * 1. Notifiche & Sostituzioni
 * 2. Il Mio Orario
 * 3. Le Mie Ore
 * 4. Esporta i Miei Dati
 */
var TeacherSelfServiceView = (() => {
  const DAYS = ['LUNEDI','MARTEDI','MERCOLEDI','GIOVEDI','VENERDI'];
  const DAY_LABELS = { LUNEDI:'Lunedì', MARTEDI:'Martedì', MERCOLEDI:'Mercoledì', GIOVEDI:'Giovedì', VENERDI:'Venerdì' };
  const HOURS_BY_DAY = { LUNEDI:[8,9,10,11,12,13,14,15], MARTEDI:[8,9,10,11,12,13], MERCOLEDI:[8,9,10,11,12,13,14,15], GIOVEDI:[8,9,10,11,12,13,14,15], VENERDI:[8,9,10,11,12,13] };

  let _tab = 'notifiche';
  let _teacherId = null;
  let _yearId = null;
  let _teacher = null;
  let _history = [];
  let _schedule = [];
  let _allSchedule = [];

  async function render(container, state) {
    _teacherId = state.user?.teacher_id || 100;
    _yearId = state.yearId;

    if (!_yearId) {
      container.innerHTML = '<div class="alert alert-warning">Seleziona un anno scolastico per procedere.</div>';
      return;
    }

    container.innerHTML = `
      <div class="page-header" style="padding-bottom:12px; border-bottom:1px solid var(--border);">
        <div class="page-title">👤 La Mia Area Docente</div>
        <div class="page-subtitle" id="ts-subtitle">Caricamento...</div>
      </div>

      <div id="ts-stats-bar" style="margin-top:12px; display:flex; gap:16px; flex-wrap:wrap;"></div>

      <div class="mt-20 mb-24" style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
        <div class="btn-group" style="background:var(--bg-card); padding:4px; border-radius:var(--radius); border:1px solid var(--border); display:inline-flex; gap:4px;">
          <button class="btn btn-sm ${_tab==='notifiche'?'btn-primary':'btn-ghost'}" id="ts-tab-notifiche">🔔 Notifiche</button>
          <button class="btn btn-sm ${_tab==='orario'?'btn-primary':'btn-ghost'}" id="ts-tab-orario">📅 Il Mio Orario</button>
          <button class="btn btn-sm ${_tab==='ore'?'btn-primary':'btn-ghost'}" id="ts-tab-ore">📊 Le Mie Ore</button>
          <button class="btn btn-sm ${_tab==='esporta'?'btn-primary':'btn-ghost'}" id="ts-tab-esporta">📄 Esporta</button>
        </div>
        <button class="btn btn-sm ${_tab==='segnala'?'btn-primary':'btn-ghost'}" id="ts-tab-segnala" style="border:1px solid var(--accent); font-weight:700;">➕ Segnala Assenza</button>
      </div>

      <div id="ts-content"></div>
      
      <!-- Info Alert per Docenti -->
      <div id="ts-alerts-container" style="margin-top:24px;">
        <div class="card" style="background:rgba(59,130,246,0.05); border:1px solid rgba(59,130,246,0.2); padding:16px; border-radius:var(--radius);">
          <div style="display:flex; gap:12px;">
            <div style="font-size:20px;">ℹ️</div>
            <div style="font-size:12px; line-height:1.6; color:var(--text-secondary);">
              <strong style="color:var(--text-primary); display:block; margin-bottom:4px;">Promemoria Operativo</strong>
              <ul style="margin:0; padding-left:16px;">
                <li><strong>Proporzionalità:</strong> Tutti i permessi e le ferie sono proporzionali alla durata del contratto (per docenti non di ruolo).</li>
                <li><strong>Non cumulabilità:</strong> I 5 giorni di formazione non si cumulano se si è sia docenti che formatori.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    `;

    container.querySelector('#ts-tab-notifiche').onclick = () => { _tab='notifiche'; render(container, state); };
    container.querySelector('#ts-tab-orario').onclick = () => { _tab='orario'; render(container, state); };
    container.querySelector('#ts-tab-ore').onclick = () => { _tab='ore'; render(container, state); };
    container.querySelector('#ts-tab-esporta').onclick = () => { _tab='esporta'; render(container, state); };
    container.querySelector('#ts-tab-segnala').onclick = () => { _tab='segnala'; render(container, state); };

    // Load teacher info
    try {
      const teachers = await API.get(`/teachers?year_id=${_yearId}`);
      _teacher = teachers.find(t => t.id == _teacherId) || { name: state.user?.username || 'Docente', subject: '', weekly_hours: 18, hours_subs: 0, hours_trips: 0 };
      const weeklyH = _teacher.weekly_hours || 18;
      container.querySelector('#ts-subtitle').textContent = `${_teacher.name} — ${_teacher.subject || ''} (Cattedra ${weeklyH}h)`;
      
      // Load stats & absences to compute dynamic counters
      const [stats, myAbsences] = await Promise.all([
        API.get(`/absences/stats?teacher_id=${_teacherId}&year_id=${_yearId}`) || {},
        API.get(`/absences?year_id=${_yearId}`)
      ]);

      const teacherAbs = (myAbsences || []).filter(a => a.teacher_id == _teacherId && a.status !== 'rejected');
      
      let shortPermitHours = 0;
      let malattiaDays = 0;
      let malattiaHours = 0;
      let permessiGiornalieriCount = 0;
      let altroPermessoCount = 0;
      let studioHours = 0;
      let assembleaHours = 0;

      teacherAbs.forEach(a => {
        const type = (a.type || '').toLowerCase();
        const hoursCount = a.hours_count ? parseInt(a.hours_count) : (a.hours && Array.isArray(a.hours) ? a.hours.length : 0);
        if (type === 'permesso_orario' || type === 'permit_hour' || type === 'permesso_breve' || type === 'permesso_ora') {
          shortPermitHours += (hoursCount || 1);
        } else if (type === 'malattia') {
          if (a.hours && Array.isArray(a.hours) && a.hours.length > 0) {
            malattiaHours += a.hours.length;
          } else if (a.date_end && a.date_end !== a.date) {
            const d1 = new Date(a.date);
            const d2 = new Date(a.date_end);
            const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
            malattiaDays += Math.max(1, diffDays);
          } else {
            malattiaDays += 1;
          }
        } else if (type === 'assenza_giornaliera' || type === 'motivi_personali') {
          permessiGiornalieriCount++;
        } else if (type === 'altro_permesso') {
          altroPermessoCount++;
        } else if (type === 'diritto_studio' || type === '150_ore' || type === 'studio') {
          studioHours += (hoursCount || 1);
        } else if (type === 'assemblea' || type === 'assemblee') {
          assembleaHours += (hoursCount || 1);
        }
      });

      let luttoCount = 0;
      teacherAbs.forEach(a => {
        if ((a.type || '').toLowerCase() === 'lutto') luttoCount++;
      });

      const s = {
        malattia: `${malattiaDays} gg${malattiaHours > 0 ? ` (${malattiaHours}h)` : ''}`,
        permessi_giornalieri: stats.permessi_giornalieri || permessiGiornalieriCount || 0,
        altro_permesso: altroPermessoCount || 0,
        studio: studioHours,
        ferie: stats.ferie || 0,
        formazione: stats.formazione || 0,
        concorsi: stats.concorsi || 0,
        matrimonio: stats.matrimonio || 0,
        lutto: stats.lutto || luttoCount || 0,
        sindacali: stats.permessi_sindacali || 0,
        assemblea: assembleaHours || stats.assemblea || 0
      };

      container.querySelector('#ts-stats-bar').innerHTML = `
        <div class="badge badge-error" style="background:var(--bg-card); border:1px solid var(--border); padding:8px 12px; font-size:12px;">🤒 Malattia: <strong>${s.malattia}</strong></div>
        <div class="badge badge-success" style="background:var(--bg-card); border:1px solid var(--border); padding:8px 12px; font-size:12px;">🚫 Permessi Giornalieri: <strong>${s.permessi_giornalieri}/3</strong></div>
        <div class="badge badge-success" style="background:var(--bg-card); border:1px solid var(--border); padding:8px 12px; font-size:12px;">📄 Altri Permessi: <strong>${s.altro_permesso}/3</strong></div>
        <div class="badge badge-warning" style="background:var(--bg-card); border:1px solid var(--border); padding:8px 12px; font-size:12px;">⏳ Permessi Brevi: <strong>${shortPermitHours}/${weeklyH} h</strong></div>
        <div class="badge badge-info" style="background:var(--bg-card); border:1px solid var(--border); padding:8px 12px; font-size:12px;">🎓 Diritto Studio: <strong>${s.studio}/150 h</strong></div>
        <div class="badge badge-info" style="background:var(--bg-card); border:1px solid var(--border); padding:8px 12px; font-size:12px;">🏝️ Ferie: <strong>${s.ferie}/6</strong></div>
        <div class="badge badge-secondary" style="background:var(--bg-card); border:1px solid var(--border); padding:8px 12px; font-size:12px;">📚 Formazione: <strong>${s.formazione}/5</strong></div>
        <div class="badge badge-secondary" style="background:var(--bg-card); border:1px solid var(--border); padding:8px 12px; font-size:12px;">📝 Concorsi: <strong>${s.concorsi}/8</strong></div>
        <div class="badge badge-neutral" style="background:var(--bg-card); border:1px solid var(--border); padding:8px 12px; font-size:12px;">💍 Matrimonio: <strong>${s.matrimonio}/15</strong></div>
        <div class="badge badge-neutral" style="background:var(--bg-card); border:1px solid var(--border); padding:8px 12px; font-size:12px;">🕊️ Lutto: <strong>${s.lutto} gg</strong> <span style="font-size:10px; opacity:0.8">(3gg/ev)</span></div>
        <div class="badge badge-ghost" style="background:var(--bg-card); border:1px solid var(--border); padding:8px 12px; font-size:12px;">👥 Assemblee: <strong>${s.assemblea}/10 h</strong></div>
        <div class="badge badge-neutral" style="background:var(--bg-card); border:1px solid var(--border); padding:8px 12px; font-size:12px;">📢 Sindacale (RSU): <strong>${s.sindacali}/12 gg</strong></div>
      `;
    } catch(e) { console.error('Stats error:', e); }

    const content = container.querySelector('#ts-content');
    if (_tab === 'notifiche') await renderNotifiche(content, state);
    else if (_tab === 'orario') await renderOrario(content, state);
    else if (_tab === 'ore') await renderOre(content, state);
    else if (_tab === 'segnala') await renderSegnala(content, state);
    else await renderEsporta(content, state);
  }


  async function renderNotifiche(container, state) {
    container.innerHTML = `
      <div class="card mb-20">
        <div class="card-header border-b mb-16">
          <h3 class="card-title">🔔 Notifiche</h3>
        </div>
        <div id="ts-notifications"></div>
      </div>

      <div class="card mb-20">
        <div class="card-header border-b mb-16">
          <h3 class="card-title">✍️ Sostituzioni Assegnate</h3>
          <span style="font-size:12px; color:var(--text-secondary);">Firma per confermare la presa in carico</span>
        </div>
        <div id="ts-assignments"></div>
      </div>

      <div class="card mb-20">
        <div class="card-header border-b mb-16">
          <h3 class="card-title">📝 Le Mie Richieste</h3>
          <span style="font-size:12px; color:var(--text-secondary);">Stato delle tue segnalazioni di assenza</span>
        </div>
        <div id="ts-my-requests"></div>
      </div>
    `;
    
    loadMyNotifications(container);
    loadMyAssignments(container);
    loadMyRequests(container);
  }

  async function renderSegnala(container, state) {
    container.innerHTML = `
      <div class="card mb-20" style="border:2px solid var(--accent);">
        <div class="card-header border-b mb-16">
          <h3 class="card-title">📝 Nuova Segnalazione Assenza</h3>
        </div>
        <form id="ts-absence-form">
          <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:10px; margin-bottom:16px;">
            <label id="ts-tipo-mal-lbl" style="display:flex; align-items:center; gap:8px; padding:10px; border-radius:10px; cursor:pointer; border:2px solid var(--border); background:var(--bg-secondary);">
              <input type="radio" name="ts-abs-tipo" id="ts-tipo-mal" value="malattia" style="width:15px;height:15px;">
              <div><div style="font-weight:700; font-size:11px;">🤒 Malattia</div><div style="font-size:9px; color:var(--text-secondary);">Intera giornata</div></div>
            </label>
            <label id="ts-tipo-mal-ore-lbl" style="display:flex; align-items:center; gap:8px; padding:10px; border-radius:10px; cursor:pointer; border:2px solid var(--border); background:var(--bg-secondary);">
              <input type="radio" name="ts-abs-tipo" id="ts-tipo-mal-ore" value="malattia_ore" style="width:15px;height:15px;">
              <div><div style="font-weight:700; font-size:11px;">🩺 Malattia a Ore</div><div style="font-size:9px; color:var(--text-secondary);">Singole ore</div></div>
            </label>
            <label id="ts-tipo-gen-lbl" style="display:flex; align-items:center; gap:8px; padding:10px; border-radius:10px; cursor:pointer; border:2px solid var(--accent); background:var(--accent-light);">
              <input type="radio" name="ts-abs-tipo" id="ts-tipo-gen" value="assenza_giornaliera" checked style="width:15px;height:15px;">
              <div><div style="font-weight:700; font-size:11px;">🚫 Permesso Giornaliero</div><div style="font-size:9px; color:var(--text-secondary);">Max 3gg/anno</div></div>
            </label>
            <label id="ts-tipo-alt-lbl" style="display:flex; align-items:center; gap:8px; padding:10px; border-radius:10px; cursor:pointer; border:2px solid var(--border); background:var(--bg-secondary);">
              <input type="radio" name="ts-abs-tipo" id="ts-tipo-alt" value="altro_permesso" style="width:15px;height:15px;">
              <div><div style="font-weight:700; font-size:11px;">📄 Altro Permesso</div><div style="font-size:9px; color:var(--text-secondary);">Max 3/anno (non rec.)</div></div>
            </label>
            <label id="ts-tipo-ora-lbl" style="display:flex; align-items:center; gap:8px; padding:10px; border-radius:10px; cursor:pointer; border:2px solid var(--border); background:var(--bg-secondary);">
              <input type="radio" name="ts-abs-tipo" id="ts-tipo-ora" value="permesso_orario" style="width:15px;height:15px;">
              <div><div style="font-weight:700; font-size:11px;">⏳ Permessi Brevi</div><div style="font-size:9px; color:var(--text-secondary);">Singole ore (con debito)</div></div>
            </label>
            <label id="ts-tipo-stu-lbl" style="display:flex; align-items:center; gap:8px; padding:10px; border-radius:10px; cursor:pointer; border:2px solid var(--border); background:var(--bg-secondary);">
              <input type="radio" name="ts-abs-tipo" id="ts-tipo-stu" value="diritto_studio" style="width:15px;height:15px;">
              <div><div style="font-weight:700; font-size:11px;">🎓 Diritto Studio</div><div style="font-size:9px; color:var(--text-secondary);">150 ore</div></div>
            </label>
            <label id="ts-tipo-fer-lbl" style="display:flex; align-items:center; gap:8px; padding:10px; border-radius:10px; cursor:pointer; border:2px solid var(--border); background:var(--bg-secondary);">
              <input type="radio" name="ts-abs-tipo" id="ts-tipo-fer" value="ferie" style="width:15px;height:15px;">
              <div><div style="font-weight:700; font-size:11px;">🏝️ Ferie / Permessi</div><div style="font-size:9px; color:var(--text-secondary);">Max 6gg (Art.15 c.2)</div></div>
            </label>
            <label id="ts-tipo-usc-lbl" style="display:flex; align-items:center; gap:8px; padding:10px; border-radius:10px; cursor:pointer; border:2px solid var(--border); background:var(--bg-secondary);">
              <input type="radio" name="ts-abs-tipo" id="ts-tipo-usc" value="uscita_didattica" style="width:15px;height:15px;">
              <div><div style="font-weight:700; font-size:11px;">🚌 Uscita / Soggiorno</div></div>
            </label>
            <label id="ts-tipo-for-lbl" style="display:flex; align-items:center; gap:8px; padding:10px; border-radius:10px; cursor:pointer; border:2px solid var(--border); background:var(--bg-secondary);">
              <input type="radio" name="ts-abs-tipo" id="ts-tipo-for" value="formazione" style="width:15px;height:15px;">
              <div><div style="font-weight:700; font-size:11px;">📚 Formazione</div></div>
            </label>
            <label id="ts-tipo-con-lbl" style="display:flex; align-items:center; gap:8px; padding:10px; border-radius:10px; cursor:pointer; border:2px solid var(--border); background:var(--bg-secondary);">
              <input type="radio" name="ts-abs-tipo" id="ts-tipo-con" value="concorsi_esami" style="width:15px;height:15px;">
              <div><div style="font-weight:700; font-size:11px;">📝 Concorsi</div></div>
            </label>
            <label id="ts-tipo-mat-lbl" style="display:flex; align-items:center; gap:8px; padding:10px; border-radius:10px; cursor:pointer; border:2px solid var(--border); background:var(--bg-secondary);">
              <input type="radio" name="ts-abs-tipo" id="ts-tipo-mat" value="matrimonio" style="width:15px;height:15px;">
              <div><div style="font-weight:700; font-size:11px;">💍 Matrimonio</div></div>
            </label>
            <label id="ts-tipo-lut-lbl" style="display:flex; align-items:center; gap:8px; padding:10px; border-radius:10px; cursor:pointer; border:2px solid var(--border); background:var(--bg-secondary);">
              <input type="radio" name="ts-abs-tipo" id="ts-tipo-lut" value="lutto" style="width:15px;height:15px;">
              <div><div style="font-weight:700; font-size:11px;">🕊️ Lutto</div><div style="font-size:9px; color:var(--text-secondary);">3gg / evento</div></div>
            </label>
            <label id="ts-tipo-ass-lbl" style="display:flex; align-items:center; gap:8px; padding:10px; border-radius:10px; cursor:pointer; border:2px solid var(--border); background:var(--bg-secondary);">
              <input type="radio" name="ts-abs-tipo" id="ts-tipo-ass" value="assemblea" style="width:15px;height:15px;">
              <div><div style="font-weight:700; font-size:11px;">👥 Assemblea</div><div style="font-size:9px; color:var(--text-secondary);">Max 10h/anno</div></div>
            </label>
            <label id="ts-tipo-sin-lbl" style="display:flex; align-items:center; gap:8px; padding:10px; border-radius:10px; cursor:pointer; border:2px solid var(--border); background:var(--bg-secondary);">
              <input type="radio" name="ts-abs-tipo" id="ts-tipo-sin" value="permessi_sindacali" style="width:15px;height:15px;">
              <div><div style="font-weight:700; font-size:11px;">📢 Permesso Sindacale</div><div style="font-size:9px; color:var(--text-secondary);">RSU / Dirigenti</div></div>
            </label>
          </div>

          <!-- Promemoria Informativi Dinamici per Tipologia -->
          <div id="ts-giornaliero-disclaimer" class="alert alert-info" style="display:none; font-size:12px; margin-bottom:16px; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.3); border-radius:8px; padding:12px;">
            🚫 <strong>Promemoria Permessi Giornalieri (Art. 15 CCNL):</strong> Spettano fino a 3 giorni retribuiti all'anno per motivi personali o familiari documentati anche mediante autocertificazione, senza obbligo di recupero né di sostituzione. Possono essere fruite con sostituti concordati a costo zero (Art. 13 c. 9) oppure per motivi personali/familiari senza obbligo di sostituti (Art. 15 c. 2).
          </div>

          <div id="ts-altro-disclaimer" class="alert alert-info" style="display:none; font-size:12px; margin-bottom:16px; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.3); border-radius:8px; padding:12px;">
            📄 <strong>Promemoria Altro Permesso:</strong> Possono essere richiesti fino a un massimo di 3 all'anno (fruibili a giornata intera o a singole ore) e non sono soggetti a recupero. Per ulteriori informazioni chiedi al Referente.
          </div>

          <div id="ts-ferie-disclaimer" class="alert alert-info" style="display:none; font-size:12px; margin-bottom:16px; background:rgba(99,102,241,0.08); border:1px solid rgba(99,102,241,0.3); border-radius:8px; padding:12px;">
            🏝️ <strong>Promemoria Ferie (Art. 13 c. 9 e Art. 15 c. 2 CCNL):</strong> <em>"Per gli stessi motivi e con le stesse modalità sono fruiti i sei giorni di ferie durante i periodi di svolgimento delle attività didattiche di cui all'art. 13, comma 9, prescindendo dalle condizioni previste in tale comma."</em><br><br>Questo significa che, una volta esauriti i primi 3 giorni (o anche direttamente), i 6 giorni di ferie possono essere fruiti esattamente come permessi per motivi personali senza l'obbligo di trovare colleghi sostituti! In totale il docente può fruire fino a 9 giorni annui per motivi personali/familiari.
          </div>

          <div id="ts-malattia-disclaimer" class="alert alert-info" style="display:none; font-size:12px; margin-bottom:16px; background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.3); border-radius:8px; padding:12px;">
            ℹ️ <strong>Promemoria Malattia:</strong> Questa segnalazione serve per organizzare tempestivamente le sostituzioni e il servizio a scuola. Il certificato telematico medico o il numero di protocollo PUC va comunicato direttamente alla Segreteria del Personale secondo le consuete modalità. Sia a giornata intera che a singole ore non genera debito né obbligo di recupero.
          </div>

          <div id="ts-permesso-disclaimer" class="alert alert-info" style="display:none; font-size:12px; margin-bottom:16px; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.3); border-radius:8px; padding:12px;">
            ⏳ <strong>Promemoria Permessi Brevi (Art. 16 CCNL):</strong> Possono essere fruiti fino a un massimo di 2 ore al giorno, entro il limite complessivo del proprio orario settimanale di cattedra per anno scolastico (es. 18 ore). Le ore devono essere restituite mediante supplenze o interventi didattici entro 2 mesi lavorativi.
          </div>

          <div id="ts-studio-disclaimer" class="alert alert-info" style="display:none; font-size:12px; margin-bottom:16px; background:rgba(14,165,233,0.08); border:1px solid rgba(14,165,233,0.3); border-radius:8px; padding:12px;">
            🎓 <strong>Promemoria Diritto allo Studio (150 ore):</strong> Fruibile fino a 150 ore solari annue per la frequenza di corsi universitari, TFA sostegno, percorsi abilitanti o esami, previa formale concessione con decreto dell'Ambito Territoriale (USP/USR). È richiesta la successiva attestazione di frequenza/esame rilasciata dall'ateneo o ente formatore.
          </div>

          <div id="ts-assemblea-disclaimer" class="alert alert-info" style="display:none; font-size:12px; margin-bottom:16px; background:rgba(100,116,139,0.08); border:1px solid rgba(100,116,139,0.3); border-radius:8px; padding:12px;">
            👥 <strong>Promemoria Assemblee Sindacali (Art. 31 CCNL):</strong> Ciascun docente ha diritto a partecipare alle assemblee sindacali in orario di servizio fino a un massimo di 10 ore pro capite per anno scolastico (all'inizio o al termine delle lezioni), senza alcuna decurtazione stipendiale.
          </div>

          <div id="ts-sindacale-disclaimer" class="alert alert-info" style="display:none; font-size:12px; margin-bottom:16px; background:rgba(99,102,241,0.08); border:1px solid rgba(99,102,241,0.3); border-radius:8px; padding:12px;">
            📢 <strong>Promemoria Permesso Sindacale (CCNQ):</strong> Fino a 12 giorni annui per la partecipazione ad attività, riunioni o assemblee sindacali previste dagli accordi quadro. (Riservato esclusivamente ai componenti della RSU d'istituto o ai dirigenti sindacali territoriali accreditati).
          </div>

          <div id="ts-formazione-disclaimer" class="alert alert-info" style="display:none; font-size:12px; margin-bottom:16px; background:rgba(99,102,241,0.08); border:1px solid rgba(99,102,241,0.3); border-radius:8px; padding:12px;">
            📚 <strong>Promemoria Formazione (Art. 36 CCNL):</strong> Fino a 5 giorni annui con esonero dal servizio per la partecipazione ad attività di aggiornamento e formazione professionale accreditata. Non cumulabili se si è contemporaneamente docenti e formatori.
          </div>

          <div id="ts-lutto-disclaimer" class="alert alert-info" style="display:none; font-size:12px; margin-bottom:16px; background:rgba(107,114,128,0.08); border:1px solid rgba(107,114,128,0.3); border-radius:8px; padding:12px;">
            🕊️ <strong>Promemoria Lutto (Art. 15 c. 1 CCNL):</strong> 3 giorni continui per ogni singolo evento, in caso di lutto per coniuge, convivente more uxorio, parenti entro il secondo grado o affini di primo grado.
          </div>

          <div id="ts-concorsi-disclaimer" class="alert alert-info" style="display:none; font-size:12px; margin-bottom:16px; background:rgba(99,102,241,0.08); border:1px solid rgba(99,102,241,0.3); border-radius:8px; padding:12px;">
            📝 <strong>Promemoria Concorsi ed Esami (Art. 15 c. 1 CCNL):</strong> Fino a 8 giorni complessivi per anno scolastico per la partecipazione a concorsi pubblici o prove di esame, compresi gli eventuali giorni di viaggio necessari.
          </div>

          <div id="ts-matrimonio-disclaimer" class="alert alert-info" style="display:none; font-size:12px; margin-bottom:16px; background:rgba(236,72,153,0.08); border:1px solid rgba(236,72,153,0.3); border-radius:8px; padding:12px;">
            💍 <strong>Promemoria Congedo Matrimoniale (Art. 15 c. 3 CCNL):</strong> 15 giorni consecutivi di congedo retribuito in occasione del matrimonio, fruibili da una settimana prima a due mesi successivi all'evento.
          </div>

          <div id="ts-uscita-disclaimer" class="alert alert-info" style="display:none; font-size:12px; margin-bottom:16px; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.3); border-radius:8px; padding:12px;">
            🚌 <strong>Promemoria Uscite e Soggiorni Didattici:</strong> Indica il referente, i colleghi accompagnatori e le classi coinvolte. I docenti in orario nelle stesse ore ma non impegnati nell'uscita verranno registrati a disposizione per coprire le supplenze.
          </div>

          <div class="form-group">
            <label>Periodo (Dal... al...)</label>
            <div class="grid grid-cols-2 gap-8">
              <input type="date" id="abs-date-start" class="form-control" value="${todayISO()}" required>
              <input type="date" id="abs-date-end" class="form-control" value="${todayISO()}" min="${todayISO()}">
            </div>
          </div>

          <div id="extra-fields-wrapper">
             <div class="form-group" id="hours-wrapper" style="display:none">
               <label>Ore interessate</label>
               <select id="abs-hours" class="form-control" multiple></select>
             </div>
             <div class="form-group" id="classes-wrapper" style="display:none">
               <label>Classi accompagnate</label>
               <select id="abs-classes" class="form-control" multiple></select>
             </div>
             <div class="form-group" id="accompanists-wrapper" style="display:none">
               <label>Colleghi accompagnatori</label>
               <select id="abs-accompanists" class="form-control" multiple></select>
             </div>
             <div class="form-group" id="subs-wrapper" style="display:none">
               <label>Sostituti individuati (concordati per ora)</label>
               <div id="ts-ferie-subs-container" style="display:grid; gap:8px;"></div>
             </div>
          </div>
          
          <div class="form-group" id="reason-wrapper">
            <label>Motivazione (facoltativo)</label>
            <textarea id="abs-reason" class="form-control" rows="2" placeholder="Es. Motivi personali, Visita specialistica..."></textarea>
          </div>
          <button type="submit" class="btn btn-primary" style="width:100%; font-weight:700;">Invia Segnalazione</button>
        </form>
      </div>
    `;

    const form = container.querySelector('#ts-absence-form');
    const tipoMalEl = container.querySelector('#ts-tipo-mal');
    const tipoMalOreEl = container.querySelector('#ts-tipo-mal-ore');
    const tipoGenEl = container.querySelector('#ts-tipo-gen');
    const tipoAltEl = container.querySelector('#ts-tipo-alt');
    const tipoOraEl = container.querySelector('#ts-tipo-ora');
    const tipoStuEl = container.querySelector('#ts-tipo-stu');
    const tipoFerEl = container.querySelector('#ts-tipo-fer');
    const tipoUscEl = container.querySelector('#ts-tipo-usc');
    const tipoForEl = container.querySelector('#ts-tipo-for');
    const tipoConEl = container.querySelector('#ts-tipo-con');
    const tipoMatEl = container.querySelector('#ts-tipo-mat');
    const tipoLutEl = container.querySelector('#ts-tipo-lut');
    const tipoAssEl = container.querySelector('#ts-tipo-ass');
    const tipoSinEl = container.querySelector('#ts-tipo-sin');

    const updateTipoStyle = () => {
      const isMal = tipoMalEl?.checked;
      const isMalOre = tipoMalOreEl?.checked;
      const isGen = tipoGenEl?.checked;
      const isAlt = tipoAltEl?.checked;
      const isOra = tipoOraEl?.checked;
      const isStu = tipoStuEl?.checked;
      const isUsc = tipoUscEl?.checked;
      const isFer = tipoFerEl?.checked;
      const isFor = tipoForEl?.checked;
      const isCon = tipoConEl?.checked;
      const isMat = tipoMatEl?.checked;
      const isLut = tipoLutEl?.checked;
      const isAss = tipoAssEl?.checked;
      const isSin = tipoSinEl?.checked;
      
      const ids = ['ts-tipo-mal','ts-tipo-mal-ore','ts-tipo-gen','ts-tipo-alt','ts-tipo-ora','ts-tipo-stu','ts-tipo-fer','ts-tipo-usc','ts-tipo-for','ts-tipo-con','ts-tipo-mat','ts-tipo-lut','ts-tipo-ass','ts-tipo-sin'];
      ids.forEach(id => {
        const el = container.querySelector('#' + id);
        const lbl = container.querySelector('#' + id + '-lbl');
        if (el && lbl) {
          lbl.style.borderColor = el.checked ? 'var(--accent)' : 'var(--border)';
          lbl.style.background = el.checked ? 'var(--accent-light)' : 'var(--bg-secondary)';
        }
      });

      const setDisplay = (id, show) => {
        const el = container.querySelector('#' + id);
        if (el) el.style.display = show ? 'block' : 'none';
      };

      setDisplay('ts-giornaliero-disclaimer', isGen);
      setDisplay('ts-altro-disclaimer', isAlt);
      setDisplay('ts-ferie-disclaimer', isFer);
      setDisplay('ts-malattia-disclaimer', isMal || isMalOre);
      setDisplay('ts-permesso-disclaimer', isOra);
      setDisplay('ts-studio-disclaimer', isStu);
      setDisplay('ts-assemblea-disclaimer', isAss);
      setDisplay('ts-sindacale-disclaimer', isSin);
      setDisplay('ts-formazione-disclaimer', isFor);
      setDisplay('ts-lutto-disclaimer', isLut);
      setDisplay('ts-concorsi-disclaimer', isCon);
      setDisplay('ts-matrimonio-disclaimer', isMat);
      setDisplay('ts-uscita-disclaimer', isUsc);

      container.querySelector('#hours-wrapper').style.display = (isMalOre || isOra || isUsc || isAlt || isStu || isAss) ? 'block' : 'none';
      container.querySelector('#classes-wrapper').style.display = isUsc ? 'block' : 'none';
      container.querySelector('#accompanists-wrapper').style.display = isUsc ? 'block' : 'none';
      container.querySelector('#subs-wrapper').style.display = isFer ? 'block' : 'none';
      
      const hideReason = isMal || isMalOre || isFer || isUsc || isFor || isCon || isSin || isMat || isLut || isAss;
      container.querySelector('#reason-wrapper').style.display = hideReason ? 'none' : 'block';
    };

    const subsContainer = container.querySelector('#ts-ferie-subs-container');
    const updateFerieSubs = async () => {
      if (!tipoFerEl?.checked) return;
      const date = container.querySelector('#abs-date-start').value;
      if (!date) return;
      
      subsContainer.innerHTML = '<div style="padding:10px;text-align:center"><div class="spinner"></div></div>';
      try {
        const tid = _teacherId || 0;
        const res = await API.get(`/teachers/suggestions/ferie?teacher_id=${tid}&date=${date || ''}`);
        const suggestions = res && typeof res === 'object' ? res : {};
        const hours = Object.keys(suggestions).sort((a,b)=>a-b);
        if (!hours.length) {
          subsContainer.innerHTML = '<div class="alert alert-info" style="font-size:11px;">ℹ️ Nessuna ora di lezione per questo giorno.</div>';
          return;
        }
        subsContainer.innerHTML = hours.map(h => {
          const hourIdx = parseInt(h);
          const displayHour = hourIdx - 7; // Map 8-15 to 1-8
          const cand = suggestions[h] || [];
          return `
            <div class="ferie-slot-row" style="padding:10px 0; border-bottom:1px solid var(--border-light); display:flex; align-items:center; gap:12px;">
              <div style="font-weight:700; font-size:13px; color:var(--text-primary); width:60px;">${displayHour}ª ora:</div>
              <div style="flex:1;">
                <select class="form-control ts-ferie-sub-sel" data-hour="${h}" style="font-size:12px; height:34px; width:100%; border-radius:6px; border:1px solid var(--border);">
                  <option value="">-- Seleziona collega --</option>
                  <optgroup label="Disponibili in quest'ora">
                    ${cand.map(c => `<option value="${c.id}">${escHtml(c.name || 'Docente')} (${(c.type || 'N/D').toUpperCase()})</option>`).join('')}
                  </optgroup>
                  <optgroup label="Altri docenti">
                    ${(_allTeachers || []).filter(t => !cand.find(c => c.id == t.id)).map(t => `<option value="${t.id}">${escHtml(t.name)}</option>`).join('')}
                  </optgroup>
                </select>
              </div>
            </div>`;
        }).join('');
      } catch(e) { 
        console.error('Ferie Proposals Error:', e);
        subsContainer.innerHTML = '<div class="alert alert-danger" style="font-size:11px;">❌ Errore caricamento suggerimenti.</div>'; 
      }
    };

    [tipoMalEl, tipoMalOreEl, tipoGenEl, tipoAltEl, tipoOraEl, tipoStuEl, tipoUscEl, tipoFerEl, tipoForEl, tipoConEl, tipoMatEl, tipoLutEl, tipoAssEl, tipoSinEl].forEach(el => el?.addEventListener('change', () => {
      updateTipoStyle();
      if (tipoFerEl?.checked) updateFerieSubs();
    }));

    // Sincronizzazione Date
    const startEl = container.querySelector('#abs-date-start');
    const endEl = container.querySelector('#abs-date-end');
    if (startEl && endEl) {
      startEl.addEventListener('change', () => {
        if (!endEl.value || endEl.value < startEl.value) {
          endEl.value = startEl.value;
        }
        endEl.min = startEl.value;
        if (tipoFerEl?.checked) updateFerieSubs();
      });
    }

    // Init TomSelect
    let tsHours, tsClasses, tsAccompanists, _allTeachers = [];
    try {
      const hSel = container.querySelector('#abs-hours');
      for (let i = 1; i <= 8; i++) hSel.appendChild(new Option(`${i}ª Ora`, i));
      tsHours = new TomSelect(hSel, { plugins: ['remove_button'], create: false });

      const cSel = container.querySelector('#abs-classes');
      const classes = await API.get(`/settings/classes?year_id=${_yearId}`);
      classes.forEach(c => cSel.appendChild(new Option(c.name, c.id)));
      tsClasses = new TomSelect(cSel, { plugins: ['remove_button'], create: false });

      const accSel = container.querySelector('#abs-accompanists');
      const teachers = await API.get(`/teachers?year_id=${_yearId}`);
      _allTeachers = teachers.filter(t => t.id != _teacherId);
      _allTeachers.forEach(t => accSel.appendChild(new Option(t.name, t.id)));
      tsAccompanists = new TomSelect(accSel, { plugins: ['remove_button'], create: false });
    } catch(e) { console.error('TS Init error:', e); }

    container.querySelector('#abs-date-start').addEventListener('change', (e) => {
      const start = e.target.value;
      const endEl = container.querySelector('#abs-date-end');
      if (start && (!endEl.value || endEl.value < start)) endEl.value = start;
      if (tipoFerEl?.checked) updateFerieSubs();
    });
    container.querySelector('#abs-date-end').addEventListener('change', () => { 
      if (tipoFerEl?.checked) updateFerieSubs(); 
    });

    form.onsubmit = async (e) => {
      e.preventDefault();
      const rawType = container.querySelector('input[name="ts-abs-tipo"]:checked')?.value || 'assenza_giornaliera';
      const isMalOre = rawType === 'malattia_ore';
      const finalType = isMalOre ? 'malattia' : rawType;

      const payload = {
        school_year_id: _yearId,
        teacher_id: _teacherId,
        date: container.querySelector('#abs-date-start').value,
        date_end: container.querySelector('#abs-date-end').value,
        type: finalType,
        reason: container.querySelector('#abs-reason')?.value || '',
        status: 'pending'
      };

      if (isMalOre || payload.type === 'permesso_orario' || payload.type === 'uscita_didattica' || payload.type === 'diritto_studio' || payload.type === 'assemblea') {
        payload.hours = tsHours.getValue();
        if (!payload.hours.length && (isMalOre || payload.type === 'permesso_orario' || payload.type === 'uscita_didattica')) {
          return APP.toast('Seleziona le ore interessate', 'warning');
        }
      } else if (payload.type === 'altro_permesso' || payload.type === 'assenza_giornaliera') {
        const h = tsHours.getValue();
        if (h && h.length) payload.hours = h;
      }

      if (payload.type === 'ferie') {
        const subs = {};
        container.querySelectorAll('.ts-ferie-sub-sel').forEach(sel => {
          if (sel.value) subs[sel.dataset.hour] = parseInt(sel.value);
        });
        payload.additional_data = { substitutes_identified: subs };
        // Le ferie ex art 15 c 2 possono essere concesse anche senza sostituti se per motivi personali
      }
      try {
        await API.post('/absences', payload);
        APP.toast('Segnalazione inviata!', 'success');
        _tab = 'notifiche';
        render(container.closest('.view-container') || container.parentElement.parentElement, state);
      } catch(err) { APP.toast(err.message, 'error'); }
    };

    updateTipoStyle();
    if (tipoFerEl?.checked) updateFerieSubs();
  }
  async function loadMyNotifications(container) {
    const list = container.querySelector('#ts-notifications');
    if (!list) return;
    try {
      const notes = await API.get(`/notifications?teacher_id=${_teacherId}`);
      if (!notes.length) { list.innerHTML = '<div class="empty-state" style="padding:16px;">Nessuna notifica.</div>'; return; }
      list.innerHTML = notes.map(n => `
        <div style="padding:12px; border-bottom:1px solid var(--border); position:relative;">
          ${!n.read ? '<span style="position:absolute; left:0; top:18px; width:5px; height:5px; background:var(--accent); border-radius:50%;"></span>' : ''}
          <div style="font-weight:600; font-size:14px; margin-bottom:3px;">${escHtml(n.title)}</div>
          <div style="font-size:13px; color:var(--text-secondary);">${escHtml(n.message)}</div>
          <div style="font-size:11px; color:var(--text-muted); margin-top:6px; display:flex; justify-content:space-between;">
            <span>${new Date(n.created_at).toLocaleString('it-IT')}</span>
            ${!n.read ? `<a href="#" onclick="TeacherSelfServiceView.markRead(event,${n.id})" style="color:var(--accent); font-weight:600; text-decoration:none;">Segna come letta</a>` : ''}
          </div>
        </div>`).join('');
    } catch(e) { list.innerHTML = 'Errore caricamento notifiche.'; }
  }

  async function loadMyAssignments(container) {
    const list = container.querySelector('#ts-assignments');
    if (!list) return;
    try {
      const history = await API.get(`/substitutions/history?year_id=${_yearId}&teacher_id=${_teacherId}`);
      const mySubs = history.filter(s => s.substitute_teacher_id == _teacherId);
      if (!mySubs.length) { list.innerHTML = '<div class="empty-state" style="padding:16px;">Nessuna sostituzione assegnata.</div>'; return; }
      list.innerHTML = `<table class="table"><thead><tr><th>Data</th><th>Ora</th><th>Classe</th><th>Tipo</th><th>Firma / Risposta</th></tr></thead><tbody>
        ${mySubs.map(s => {
          let statusHtml = '';
          if (s.status === 'rejected') {
            statusHtml = `<span style="color:#ef4444; font-weight:bold; font-size:12px;">❌ Rifiutata</span>`;
          } else if (s.accepted) {
            statusHtml = `<span style="color:#16a34a; font-weight:bold;">✅ Firmata</span>`;
          } else {
            statusHtml = `
              <div style="display:flex; gap:6px; align-items:center;">
                <button class="btn btn-primary btn-sm" onclick="TeacherSelfServiceView.acceptAssignment(event,${s.id})">✍️ Firma</button>
                <button class="btn btn-ghost btn-sm text-danger" style="font-size:12px;" onclick="TeacherSelfServiceView.rejectAssignment(event,${s.id})">❌ Rifiuta</button>
              </div>
            `;
          }
          return `<tr>
            <td><strong>${fmtDate(s.date)}</strong></td>
            <td>${s.hour}ª</td>
            <td>${escHtml(s.class_name||'—')}</td>
            <td><span class="badge ${s.hours_counted?'badge-info':'badge-warning'}">${s.hours_counted?'Recupero':'Eccedente'}</span></td>
            <td>${statusHtml}</td>
          </tr>`;
        }).join('')}
      </tbody></table>`;
    } catch(e) { list.innerHTML = '<div class="empty-state">Errore caricamento sostituzioni.</div>'; }
  }

  // ─── TAB 2: IL MIO ORARIO ───────────────────────────────────────────────────

  async function renderOrario(container, state) {
    container.innerHTML = `
      <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" id="ts-show-personal">📋 Il Mio Orario Personale</button>
        <button class="btn btn-secondary btn-sm" id="ts-show-full">🏫 Orario Completo Scuola</button>
      </div>
      <div id="ts-orario-grid">
        <div class="loading-overlay"><div class="spinner"></div> Caricamento orario...</div>
      </div>
    `;
    const btnPersonal = container.querySelector('#ts-show-personal');
    const btnFull = container.querySelector('#ts-show-full');
    const grid = container.querySelector('#ts-orario-grid');

    btnPersonal.onclick = () => {
      loadPersonalSchedule(grid);
      btnPersonal.className = 'btn btn-primary btn-sm';
      btnFull.className = 'btn btn-secondary btn-sm';
    };
    btnFull.onclick = () => {
      loadFullSchedule(grid);
      btnFull.className = 'btn btn-primary btn-sm';
      btnPersonal.className = 'btn btn-secondary btn-sm';
    };
    await loadPersonalSchedule(grid);
  }

  async function loadPersonalSchedule(target) {
    target.innerHTML = '<div class="loading-overlay"><div class="spinner"></div></div>';
    try {
      // Re-fetch teacher to get latest lock status
      const teachers = await API.get(`/teachers?year_id=${_yearId}`);
      _teacher = teachers.find(t => t.id == _teacherId);
      
      // Verifica se l'orario provvisorio è attualmente in vigore
      let isProvvisorioActive = false;
      try {
        const periods = await API.get(`/schedule/periods?year_id=${_yearId}`);
        const todayStr = new Date().toISOString().slice(0, 10);
        if (periods?.provvisorio?.start_date && periods?.provvisorio?.end_date) {
          if (todayStr >= periods.provvisorio.start_date && todayStr <= periods.provvisorio.end_date) {
            isProvvisorioActive = true;
          }
        }
      } catch(e) { console.warn('Controllo periodo:', e); }

      const isLocked = _teacher?.availability_locked || isProvvisorioActive;

      const schedule = await API.get(`/schedule?year_id=${_yearId}`);
      const mySlots = schedule.filter(s => s.teacher_id == _teacherId);
      
      const allHours = [8,9,10,11,12,13,14,15];
      
      let statusHint = '';
      if (isProvvisorioActive) {
        statusHint = '<span style="color:#f59e0b; font-weight:600;">⏳ Orario Provvisorio in Vigore</span> (La compilazione di Ricevimenti, DIS ed ECC è disabilitata durante l\'orario provvisorio)';
      } else if (isLocked) {
        statusHint = '<span style="color:#16a34a; font-weight:600;">✅ Scelte Inviate e Protette</span> (Contatta la segreteria per modifiche)';
      } else {
        statusHint = '<span style="color:var(--accent); font-weight:600;">✏️ Fase di Compilazione</span>: Clicca sugli slot vuoti per indicare disponibilità o ricevimento';
      }

      let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
          <div>
            <h4 style="margin:0; font-size:14px;">📋 Il Mio Orario Personale</h4>
            <p style="margin:2px 0 0 0; font-size:11px; color:var(--text-secondary);">
              ${statusHint}
            </p>
          </div>
          ${(!isLocked && !isProvvisorioActive) ? `<button class="btn btn-primary btn-sm" id="ts-submit-availability" style="background:#16a34a; border-color:#16a34a; font-weight:700;">📤 Invia alla Segreteria</button>` : ''}
        </div>
        
        <div class="table-wrapper"><table style="border-collapse:collapse; width:100%; font-size:12px;">
        <thead><tr style="background:#0f172a">
          <th style="padding:8px; text-align:center; border:1px solid #334155; color:#94a3b8; font-size:10px;">Ora</th>
          ${DAYS.map(d => `<th style="padding:8px; border:1px solid #334155; color:#94a3b8; font-size:10px;">${DAY_LABELS[d]}</th>`).join('')}
        </tr></thead><tbody style="background:#1e293b">`;

      allHours.forEach(h => {
        html += `<tr><td style="font-weight:700; text-align:center; padding:7px; border:1px solid var(--border);">${h-7}ª</td>`;
        DAYS.forEach(d => {
          const slot = mySlots.find(s => s.day===d && s.hour===h);
          const val = slot?.raw_value || '';
          const type = slot?.slot_type || 'empty';
          
          let cellClass = '';
          let interactive = 'cursor:default;';
          let statusText = escHtml(val||'—');

          if (type === 'normal') {
            cellClass = 'ov-cell-normal';
          } else if (type === 'disponibile') {
            cellClass = 'ov-cell-dis';
            statusText = '⚡ DIS';
          } else if (type === 'eccedente') {
            cellClass = 'ov-cell-ecc';
            statusText = '💜 ECC';
          } else if (type === 'ricevimento') {
            cellClass = 'ov-cell-ricevimento'; // Need CSS for this
            statusText = '🤝 R';
          }

          if (!isLocked && type !== 'normal') {
            interactive = 'cursor:pointer; transition: transform 0.1s;';
          }
          
          html += `<td class="${cellClass} ts-slot" 
                      data-day="${d}" data-hour="${h}" data-type="${type}"
                      style="padding:7px; border:1px solid #1e293b; text-align:center; font-size:10px; font-weight:600; ${interactive}"
                      onmouseover="if(this.style.cursor==='pointer') this.style.transform='scale(1.05)';"
                      onmouseout="this.style.transform='scale(1)';"
                  >${statusText}</td>`;
        });
        html += '</tr>';
      });
      html += '</tbody></table></div>';
      
      // Legenda
      html += `
        <div style="margin-top:16px; display:flex; gap:12px; font-size:10px; color:var(--text-muted); flex-wrap:wrap;">
          <div style="display:flex; align-items:center; gap:4px;"><span style="display:inline-block; width:10px; height:10px; background:#1e293b; border:1px solid #334155; border-radius:3px;"></span> Libero</div>
          <div style="display:flex; align-items:center; gap:4px;"><span style="display:inline-block; width:10px; height:10px; background:var(--accent); border-radius:3px;"></span> Lezione</div>
          <div style="display:flex; align-items:center; gap:4px;"><span style="display:inline-block; width:10px; height:10px; background:#16a34a; border-radius:3px;"></span> Disponibile (DIS)</div>
          <div style="display:flex; align-items:center; gap:4px;"><span style="display:inline-block; width:10px; height:10px; background:#8b5cf6; border-radius:3px;"></span> Eccedente (ECC)</div>
          <div style="display:flex; align-items:center; gap:4px;"><span style="display:inline-block; width:10px; height:10px; background:#f59e0b; border-radius:3px;"></span> Ricevimento (R)</div>
        </div>
      `;

      target.innerHTML = html;

      // Wire clicks
      if (!isLocked) {
        target.querySelectorAll('.ts-slot').forEach(td => {
          td.onclick = async () => {
            const day = td.dataset.day;
            const hour = parseInt(td.dataset.hour);
            const type = td.dataset.type;
            if (type === 'normal') return;

            let newVal = '';
            if (type === 'empty' || type === 'asterisco') newVal = 'DIS';
            else if (type === 'disponibile') newVal = 'ECC';
            else if (type === 'eccedente') newVal = 'R';
            else newVal = ''; // back to empty

            try {
              await API.put('/schedule/slot', {
                teacher_id: _teacherId,
                day, hour,
                raw_value: newVal,
                school_year_id: _yearId
              });
              loadPersonalSchedule(target); // re-render
            } catch(e) { APP.toast(e.message, 'error'); }
          };
        });

        const submitBtn = target.querySelector('#ts-submit-availability');
        if (submitBtn) {
          submitBtn.onclick = async () => {
            if (await APP.confirm('Sei sicuro di voler inviare le tue disponibilità? Una volta inviate, non potrai più modificarle autonomamente.')) {
              try {
                await API.put(`/teachers/${_teacherId}/lock`);
                APP.toast('Disponibilità inviate con successo!', 'success');
                loadPersonalSchedule(target);
              } catch(e) { APP.toast(e.message, 'error'); }
            }
          };
        }
      }
    } catch(e) { 
      console.error(e);
      target.innerHTML = '<div class="empty-state">Errore caricamento orario.</div>'; 
    }
  }

  async function loadFullSchedule(target) {
    target.innerHTML = '<div class="loading-overlay"><div class="spinner"></div> Caricamento...</div>';
    try {
      const teachers = await API.get(`/teachers?year_id=${_yearId}`);
      const schedule = await API.get(`/schedule?year_id=${_yearId}`);
      const allHours = [8,9,10,11,12,13,14,15];

      let html = `<h4 style="margin-bottom:12px; font-size:14px; display:flex; align-items:center; gap:8px;">
          🏫 Orario Completo Scuola 
          <span class="badge badge-neutral" style="font-weight:400; font-size:11px;">Sola Lettura</span>
        </h4>
        <div class="ov-master-wrapper" style="max-height: 500px;">
          <table class="ov-master-table" style="min-width: 1000px;">
            <thead>
              <tr>
                <th class="sticky-col" style="min-width:150px">Docente</th>
                ${DAYS.map(d => `<th colspan="${(HOURS_BY_DAY[d]||allHours).length}" style="border-right:2px solid var(--border-thick)">${DAY_LABELS[d]}</th>`).join('')}
              </tr>
              <tr>
                <th class="sticky-col"></th>
                ${DAYS.map(d => (HOURS_BY_DAY[d]||allHours).map(h => `<th style="min-width:50px; font-size:9px">${h}ª</th>`).join('')).join('')}
              </tr>
            </thead>
            <tbody>`;

      teachers.forEach(t => {
        const isMe = t.id == _teacherId;
        html += `<tr>
          <td class="sticky-col" style="font-weight:600; ${isMe ? 'color:var(--accent-hover); background:var(--accent-light);' : ''}">${escHtml(t.name)}</td>`;
        
        DAYS.forEach(d => {
          const hours = HOURS_BY_DAY[d] || allHours;
          hours.forEach((h, idx) => {
            const slot = schedule.find(s => s.teacher_id == t.id && s.day == d && s.hour == h);
            const val = slot?.raw_value || '';
            const type = slot?.slot_type || 'empty';
            
            let cellStyle = 'font-size:10px; text-align:center;';
            if (isMe) cellStyle += 'background:rgba(99,102,241,0.05);';
            
            if (type === 'disponibile') cellStyle += 'background:var(--success-bg); color:var(--success-text); font-weight:700;';
            else if (type === 'eccedente') cellStyle += 'background:rgba(139,92,246,0.15); color:#a78bfa; font-weight:700;';
            else if (type === 'empty') cellStyle += 'color:var(--text-muted); opacity:0.3;';
      const isLastHour = idx === hours.length - 1;
      const borderRight = isLastHour ? 'border-right:2px solid var(--border-thick)' : '';

      html += `<td style="${cellStyle}; ${borderRight}">${escHtml(val||'—')}</td>`;
    });
  });
  html += '</tr>';
});
html += '</tbody></table></div>';
target.innerHTML = html;
} catch(e) { 
console.error(e);
target.innerHTML = '<div class="empty-state">Errore caricamento orario completo.</div>'; 
}
}

// ─── TAB 3: LE MIE ORE ─────────────────────────────────────────────────────

async function renderOre(container, state) {
  container.innerHTML = '<div class="loading-overlay"><div class="spinner"></div> Caricamento ore...</div>';
  try {
    const [history, absences] = await Promise.all([
      API.get(`/substitutions/history?year_id=${_yearId}&teacher_id=${_teacherId}`),
      API.get(`/absences?year_id=${_yearId}`)
    ]);

    const mySubs = (history || []).filter(s => s.substitute_teacher_id == _teacherId);
    const myAbsences = (absences || []).filter(a => a.teacher_id == _teacherId && a.status !== 'rejected');

    const initialSubs = parseInt(_teacher?.hours_subs) || 0;
    const initialTrips = parseInt(_teacher?.hours_trips) || 0;
    
    let shortPermitHours = 0;
    let altroPermessoCount = 0;
    const now = new Date();

    // Dettaglio assenze
    const registryItems = [];
    
    // 1. Debito Iniziale Supplenze
    if (initialSubs > 0) {
      registryItems.push({
        date: 'Inizio Anno',
        title: '🏛️ Debito Iniziale Supplenze',
        hours: initialSubs,
        deadline: 'Fine Anno Scolastico',
        isExpired: false,
        type: 'initial_subs'
      });
    }

    // 2. Debito Iniziale Uscite
    if (initialTrips > 0) {
      registryItems.push({
        date: 'Inizio Anno',
        title: '🚌 Debito Iniziale Uscite / Soggiorni',
        hours: initialTrips,
        deadline: 'Fine Anno Scolastico',
        isExpired: false,
        type: 'initial_trips'
      });
    }

    // 3. Permessi Brevi
    myAbsences.sort((a,b) => (a.date||'').localeCompare(b.date||'')).forEach(a => {
      const type = (a.type || '').toLowerCase();
      const hoursCount = a.hours_count ? parseInt(a.hours_count) : (a.hours && Array.isArray(a.hours) ? a.hours.length : 1);
      
      if (type === 'permesso_orario' || type === 'permit_hour' || type === 'permesso_breve' || type === 'permesso_ora') {
        shortPermitHours += hoursCount;
        const dAssenza = new Date(a.date);
        const deadline = new Date(dAssenza);
        deadline.setDate(deadline.getDate() + 60);
        const isExpired = deadline < now;
        registryItems.push({
          date: fmtDate(a.date),
          title: `⏳ Permesso Breve (${hoursCount}h)`,
          hours: hoursCount,
          deadline: `${fmtDate(deadline.toISOString().slice(0,10))} (2 mesi)`,
          isExpired: isExpired,
          type: 'permit_hour'
        });
      } else if (type === 'altro_permesso' || type === 'assenza_giornaliera' || type === 'motivi_personali') {
        altroPermessoCount++;
      }
    });

    let subsDone = 0;
    let tripsDone = 0;
    let eccedenti = 0;

    mySubs.forEach(s => {
      if (!s.hours_counted) {
        eccedenti++;
        return;
      }
      const isTrip = (s.type === 'trip' || (s.notes||'').toLowerCase().includes('uscita') || (s.notes||'').toLowerCase().includes('soggiorno'));
      if (isTrip) tripsDone++;
      else subsDone++;
    });

    const saldoSubs = initialSubs + shortPermitHours - subsDone;
    const saldoTrips = initialTrips - tripsDone;

    const rowsHtml = mySubs.map(s => {
      const isRec = !!s.hours_counted;
      return `<tr style="border-bottom:1px solid var(--border);">
        <td style="padding:7px 12px;"><strong>${fmtDate(s.date)}</strong></td>
        <td>${s.hour}ª</td>
        <td><span class="badge ${isRec?'badge-info':'badge-warning'}">${isRec?'Recupero Ore':'Ore Eccedenti / Straordinario'}</span></td>
        <td>${escHtml(s.class_name||'—')}</td>
        <td>${s.accepted ? '✅ Firmato' : '<span style="font-size:11px; color:var(--text-muted);">In attesa</span>'}</td>
      </tr>`;
    }).join('');

    container.innerHTML = `
      <div class="stats-grid" style="grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:14px; margin-bottom:20px;">
        <!-- Card 1: Debito Supplenze -->
        <div class="stat-card" style="background:#eff6ff; border:1px solid #dbeafe; padding:16px; border-radius:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:13px; font-weight:700; color:#1d4ed8;">📘 DEBITO SUPPLENZE</div>
            <span class="badge badge-info">${subsDone} h svolte</span>
          </div>
          <div style="font-size:26px; font-weight:800; color:${saldoSubs > 0 ? '#1d4ed8' : '#16a34a'}; margin:8px 0 4px 0;">
            ${saldoSubs > 0 ? saldoSubs + ' h' : (saldoSubs === 0 ? '0 h (In pari)' : '+' + Math.abs(saldoSubs) + ' h (Credito)')}
          </div>
          <div style="font-size:11px; color:var(--text-secondary); line-height:1.4;">
            Iniziale: <strong>${initialSubs}h</strong> | Permessi Brevi: <strong>${shortPermitHours}h</strong> | Svolte: <strong>${subsDone}h</strong>
          </div>
        </div>

        <!-- Card 2: Debito Uscite -->
        <div class="stat-card" style="background:#f0fdf4; border:1px solid #dcfce7; padding:16px; border-radius:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:13px; font-weight:700; color:#15803d;">🚌 DEBITO USCITE / SOGGIORNI</div>
            <span class="badge badge-success">${tripsDone} h svolte</span>
          </div>
          <div style="font-size:26px; font-weight:800; color:${saldoTrips > 0 ? '#15803d' : '#16a34a'}; margin:8px 0 4px 0;">
            ${saldoTrips > 0 ? saldoTrips + ' h' : '0 h (In pari)'}
          </div>
          <div style="font-size:11px; color:var(--text-secondary); line-height:1.4;">
            Debito Iniziale Uscite: <strong>${initialTrips}h</strong>
          </div>
        </div>

        <!-- Card 3: Altri Permessi -->
        <div class="stat-card" style="background:#fdf2f8; border:1px solid #fbcfe8; padding:16px; border-radius:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div style="font-size:13px; font-weight:700; color:#be185d;">📄 ALTRI PERMESSI</div>
            <span class="badge" style="background:#fce7f3; color:#be185d; border:1px solid #fbcfe8;">${altroPermessoCount} req</span>
          </div>
          <div style="font-size:26px; font-weight:800; color:#be185d; margin:8px 0 4px 0;">
            ${altroPermessoCount} / 3
          </div>
          <div style="font-size:11px; color:var(--text-secondary); line-height:1.4;">
            Permessi retribuiti fruiti (non a debito)
          </div>
        </div>
      </div>

      <!-- Registro Recuperi e Scadenze -->
      <div class="card mb-20" style="padding:0; overflow:hidden; border:1px solid var(--border)">
        <div style="padding:12px 20px; background:var(--bg-secondary); border-bottom:1px solid var(--border); font-weight:700; font-size:13px; display:flex; justify-content:space-between; align-items:center;">
          <span>📋 Registro Ore e Scadenze Recupero</span>
          <span style="font-weight:400; font-size:11px; color:var(--text-secondary);">Recupero permessi brevi entro 2 mesi (Art. 16 CCNL)</span>
        </div>
        <table style="width:100%; border-collapse:collapse; font-size:12px;">
          <thead>
            <tr style="background:var(--bg-secondary); font-size:10px; text-transform:uppercase; letter-spacing:0.5px">
              <th style="padding:10px 15px; text-align:left; border-bottom:2px solid var(--border)">Data</th>
              <th style="text-align:left; border-bottom:2px solid var(--border)">Causale</th>
              <th style="text-align:center; border-bottom:2px solid var(--border)">Ore</th>
              <th style="text-align:left; border-bottom:2px solid var(--border)">Termine Recupero</th>
              <th style="text-align:center; border-bottom:2px solid var(--border)">Stato</th>
            </tr>
          </thead>
          <tbody>
            ${registryItems.length ? registryItems.map(item => `
              <tr style="border-bottom:1px solid var(--border);">
                <td style="padding:8px 15px; font-weight:600;">${item.date}</td>
                <td>${item.title}</td>
                <td style="text-align:center; font-weight:700;">${item.hours} h</td>
                <td style="${item.isExpired ? 'color:var(--danger-text); font-weight:bold;' : ''}">${item.deadline}</td>
                <td style="text-align:center;">
                  ${item.isExempt 
                    ? '<span class="badge badge-success">✓ Esente</span>' 
                    : (item.isExpired 
                        ? '<span class="badge badge-danger">⚠️ Scaduto >60gg</span>' 
                        : '<span class="badge badge-info">In corso</span>')}
                </td>
              </tr>
            `).join('') : '<tr><td colspan="5" style="padding:16px; text-align:center; color:var(--text-muted);">Nessun debito o permesso registrato.</td></tr>'}
          </tbody>
        </table>
      </div>

      <!-- Storico Sostituzioni Svolte -->
      <div class="card" style="padding:0; overflow:hidden;">
        <div style="padding:12px 20px; background:var(--bg-secondary); border-bottom:1px solid var(--border); font-weight:700; font-size:13px; display:flex; justify-content:space-between; align-items:center;">
          <span>✍️ Storico Sostituzioni e Supplenze Effettuate</span>
          <span style="font-size:12px; color:var(--text-secondary)">Totale: ${mySubs.length} (Recuperi: ${subsDone+tripsDone}, Eccedenti: ${eccedenti})</span>
        </div>
        ${mySubs.length ? `<table style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead><tr style="background:var(--bg-secondary);">
            <th style="padding:7px 12px;">Giorno</th><th>Ora</th><th>Tipo</th><th>Classe</th><th>Firma</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>` : '<div class="empty-state" style="padding:24px;">Nessuna sostituzione o recupero effettuato.</div>'}
      </div>
    `;
  } catch(e) {
    console.error(e);
    container.innerHTML = '<div class="empty-state">Errore caricamento dati ore.</div>';
  }
}

// ─── TAB 4: ESPORTA ─────────────────────────────────────────────────────────

async function renderEsporta(container, state) {
  container.innerHTML = `
    <div class="card" style="padding:24px; max-width:600px;">
      <div style="font-size:15px; font-weight:700; margin-bottom:6px;">📄 Scegli cosa includere nel documento</div>
      <div style="font-size:13px; color:var(--text-secondary); margin-bottom:20px;">Seleziona le sezioni che vuoi esportare o stampare come PDF.</div>

      <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:24px;">
        ${[
          ['cb-notifiche', '🔔 Notifiche recenti'],
          ['cb-supplenze', '✍️ Sostituzioni assegnate e accettazioni'],
          ['cb-orario', '📅 Il mio orario personale'],
          ['cb-riepilogo', '📊 Riepilogo Debiti e Ore (Supplenze, Uscite, Visite Mediche)'],
          ['cb-storico', '📋 Storico completo sostituzioni/recuperi'],
        ].map(([id, label]) => `
          <label style="display:flex; align-items:center; gap:12px; padding:12px 16px; background:var(--bg-secondary); border-radius:8px; cursor:pointer; border:1px solid var(--border); transition:border-color 0.2s;">
            <input type="checkbox" id="${id}" checked style="width:18px; height:18px; cursor:pointer;">
            <span style="font-size:14px;">${label}</span>
          </label>`).join('')}
      </div>

      <div style="display:flex; gap:10px;">
        <button class="btn btn-ghost btn-sm" id="ts-sel-all-exp">✅ Seleziona Tutti</button>
        <button class="btn btn-ghost btn-sm" id="ts-sel-none-exp">☐ Deseleziona Tutti</button>
        <button class="btn btn-primary" id="ts-generate-doc" style="margin-left:auto;">🖨️ Genera Documento</button>
      </div>
    </div>
  `;

  container.querySelector('#ts-sel-all-exp').onclick = () => container.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked=true);
  container.querySelector('#ts-sel-none-exp').onclick = () => container.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked=false);
  container.querySelector('#ts-generate-doc').onclick = () => generateDocument(container);
}

async function generateDocument(container) {
  const sections = {
    notifiche: container.querySelector('#cb-notifiche')?.checked,
    supplenze: container.querySelector('#cb-supplenze')?.checked,
    orario: container.querySelector('#cb-orario')?.checked,
    riepilogo: container.querySelector('#cb-riepilogo')?.checked,
    storico: container.querySelector('#cb-storico')?.checked,
  };

  APP.toast('Generazione documento in corso…', 'info');
  try {
    const [history, schedule, absences] = await Promise.all([
      API.get(`/substitutions/history?year_id=${_yearId}&teacher_id=${_teacherId}`),
      API.get(`/schedule?year_id=${_yearId}`),
      API.get(`/absences?year_id=${_yearId}`)
    ]);

    const mySubs = (history || []).filter(s => s.substitute_teacher_id == _teacherId);
    const mySlots = (schedule || []).filter(s => s.teacher_id == _teacherId);
    const myAbsences = (absences || []).filter(a => a.teacher_id == _teacherId && a.status !== 'rejected');

    const initialSubs = parseInt(_teacher?.hours_subs) || 0;
    const initialTrips = parseInt(_teacher?.hours_trips) || 0;
    
    let shortPermitHours = 0;

    myAbsences.forEach(a => {
      const type = (a.type || '').toLowerCase();
      const hoursCount = a.hours_count ? parseInt(a.hours_count) : (a.hours && Array.isArray(a.hours) ? a.hours.length : 1);
      if (type === 'permesso_orario' || type === 'permit_hour' || type === 'permesso_breve') {
        shortPermitHours += hoursCount;
      }
    });

    const totalRec = mySubs.filter(s => s.hours_counted).length;
    const totalEcc = mySubs.filter(s => !s.hours_counted).length;
    const saldoSubs = initialSubs + shortPermitHours - totalRec;

    const allHours = [8,9,10,11,12,13,14,15];
    let body = '';

    if (sections.riepilogo) {
      body += `<h2>📊 Riepilogo Debiti e Ore</h2>
        <table><tr><th>Debito Iniziale Supplenze</th><th>Permessi Brevi Presi</th><th>Supplenze Recuperate</th><th>Saldo Residuo</th><th>Debito Uscite</th></tr>
        <tr><td>${initialSubs} h</td><td>${shortPermitHours} h</td><td>${totalRec} h</td><td><strong>${saldoSubs} h</strong></td><td>${initialTrips} h</td></tr></table>`;
    }
    if (sections.storico) {
      body += `<h2>📋 Storico Sostituzioni/Recuperi</h2>
        <table><tr><th>Giorno</th><th>Ora</th><th>Tipo</th><th>Classe</th><th>Firma</th></tr>
        ${mySubs.map(s => `<tr>
          <td>${fmtDate(s.date)}</td><td>${s.hour}ª</td>
          <td>${s.hours_counted?'Recupero Ore':'Ore Eccedenti / Straordinario'}</td>
          <td>${s.class_name||'—'}</td><td>${s.accepted?'✅':'—'}</td>
        </tr>`).join('')}</table>`;
    }
    if (sections.orario) {
      let schedHtml = `<h2>📅 Il Mio Orario</h2>
        <table><tr><th>Ora</th>${DAYS.map(d=>`<th>${DAY_LABELS[d]}</th>`).join('')}</tr>`;
      allHours.forEach(h => {
        schedHtml += `<tr><td>${h-7}ª</td>`;
        DAYS.forEach(d => {
          const slot = mySlots.find(s=>s.day===d&&s.hour===h);
          schedHtml += `<td>${slot?.raw_value||'—'}</td>`;
        });
        schedHtml += '</tr>';
      });
      schedHtml += '</table>';
      body += schedHtml;
    }
    if (sections.supplenze) {
      body += `<h2>✍️ Sostituzioni e Accettazioni</h2>
        <table><tr><th>Data</th><th>Ora</th><th>Classe</th><th>Tipo</th><th>Firmata</th></tr>
        ${mySubs.map(s=>`<tr>
          <td>${fmtDate(s.date)}</td><td>${s.hour}ª</td><td>${s.class_name||'—'}</td>
          <td>${s.hours_counted?'Recupero':'Eccedente'}</td><td>${s.accepted?'✅':'—'}</td>
        </tr>`).join('')}</table>`;
    }

    if (!body) { APP.toast('Seleziona almeno una sezione.', 'warning'); return; }

    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head>
      <meta charset="UTF-8"><title>Area Docente — ${_teacher?.name||''}</title>
      <style>
        body {font-family: Arial, sans-serif; font-size: 11px; padding: 20px; color: #0f172a;}
        h1 {font-size: 16px; margin-bottom: 4px;}
        h2 {font-size: 13px; margin: 20px 0 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px;}
        .meta {color: #64748b; font-size: 11px; margin-bottom: 20px;}
        table {width: 100%; border-collapse: collapse; margin-bottom: 12px;}
        th {background: #f1f5f9; padding: 5px 8px; text-align: left; font-size: 10px; border: 1px solid #cbd5e1;}
        td {padding: 5px 8px; border: 1px solid #e2e8f0; font-size: 11px;}
        @media print { @page { margin: 1cm; } }
      </style>
    </head><body>
      <h1>👤 La Mia Area Docente</h1>
      <div class="meta">${_teacher?.name||''} — ${_teacher?.subject||''} | Generato: ${new Date().toLocaleString('it-IT')}</div>
      ${body}
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  } catch(e) {
    APP.toast('Errore: ' + e.message, 'error');
  }
}

// ─── AZIONI GLOBALI ─────────────────────────────────────────────────────────

  async function markRead(e, id) {
    e.preventDefault();
    try {
      await API.post(`/notifications/${id}/read`);
      render(document.getElementById('content-area'), APP.getState());
    } catch(e) {}
  }

  async function acceptAssignment(e, id) {
    if (e) e.preventDefault();
    try {
      await API.post(`/substitutions/${id}/accept`);
      APP.toast('Sostituzione accettata con successo', 'success');
      render(document.getElementById('content-area'), APP.getState());
    } catch(e) { APP.toast(e.message, 'error'); }
  }

  async function rejectAssignment(e, id) {
    if (e) e.preventDefault();
    const ov = APP.modal({
      title: '❌ Rifiuta Sostituzione',
      body: `
        <p style="font-size:13px; color:var(--text-secondary); margin-bottom:12px;">
          Stai per rifiutare l'assegnazione di questa supplenza. L'amministrazione riceverà la segnalazione per riaprire la copertura.
        </p>
        <div class="form-group">
          <label style="font-weight:600; font-size:12px;">Motivazione del rifiuto (facoltativo)</label>
          <textarea id="rej-reason" class="form-control" rows="2" placeholder="Es. Impegno personale improrogabile fuori servizio, visita medica..."></textarea>
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" id="rej-cancel">Annulla</button>
        <button class="btn btn-danger" id="rej-confirm">Conferma Rifiuto</button>
      `,
      size: 'modal-sm'
    });

    ov.querySelector('#rej-cancel').onclick = () => ov.remove();
    ov.querySelector('#rej-confirm').onclick = async () => {
      const reason = ov.querySelector('#rej-reason').value.trim();
      try {
        await API.post(`/substitutions/${id}/reject`, { reason: reason || 'Non accettata dal docente' });
        ov.remove();
        APP.toast('Sostituzione rifiutata', 'info');
        render(document.getElementById('content-area'), APP.getState());
      } catch(err) { APP.toast(err.message, 'error'); }
    };
  }

  async function loadMyRequests(container) {
    const list = container.querySelector('#ts-my-requests');
    if (!list) return;
    try {
      const absences = await API.get(`/absences?year_id=${_yearId}`);
      const myAbsences = absences.filter(a => a.teacher_id == _teacherId);
      if (!myAbsences.length) { list.innerHTML = '<div class="empty-state" style="padding:16px;">Nessuna richiesta inviata.</div>'; return; }
      
      list.innerHTML = `<table class="table" style="font-size:13px;">
        <thead><tr><th>Data</th><th>Tipo</th><th>Stato</th><th>Azione</th></tr></thead>
        <tbody>
          ${myAbsences.map(a => {
            const isToRegularize = a.type === 'da_regolarizzare' || a.is_regularized === false;
            let badgeHtml = '';
            if (isToRegularize) {
              badgeHtml = `<span class="badge badge-warning" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a;">🟡 Da Regolarizzare</span>`;
            } else {
              badgeHtml = `<span class="badge ${a.status==='approved'?'badge-success':'badge-warning'}">${a.status==='approved'?'✅ Approvata':'⏳ In attesa'}</span>`;
            }
            return `
            <tr>
              <td><strong>${fmtDate(a.date)}</strong></td>
              <td>${a.type === 'uscita_didattica' ? '🚌 Uscita' : (isToRegularize ? '⚡ Assenza da Dettagliare' : '🚫 Assenza')}</td>
              <td>${badgeHtml}</td>
              <td style="display:flex; gap:6px; align-items:center;">
                ${isToRegularize ? `<button class="btn btn-primary btn-sm" style="font-size:11px; padding:3px 8px;" onclick="TeacherSelfServiceView.openRegularizeModal(${a.id})">✏️ Dettaglia</button>` : ''}
                <button class="btn btn-ghost btn-sm text-danger" title="Annulla richiesta" onclick="TeacherSelfServiceView.cancelRequest(event,${a.id})">Annulla</button>
              </td>
            </tr>
          `;
          }).join('')}
        </tbody>
      </table>`;
    } catch(e) { list.innerHTML = '<div class="empty-state">Errore caricamento richieste.</div>'; }
  }

  async function openRegularizeModal(absenceId) {
    const absences = await API.get(`/absences?year_id=${_yearId}`);
    const absence = absences.find(a => a.id == absenceId);
    if (!absence) return;

    const ov = APP.modal({
      title: '✏️ Completa Dettagli Assenza',
      body: `
        <p style="font-size:13px; color:var(--text-secondary); margin-bottom:12px;">
          Seleziona la causale definitiva per l'assenza del <strong>${fmtDate(absence.date)}</strong>:
        </p>
        <div class="form-group">
          <label style="font-weight:600; font-size:12px;">Tipo Assenza *</label>
          <select id="reg-abs-type" class="form-control">
            <option value="malattia">🤒 Malattia (Intera giornata)</option>
            <option value="altro_permesso">📄 Altro Permesso (Max 3gg/anno - non rec.)</option>
            <option value="permesso_orario">⏳ Permesso Breve (Singole ore da recuperare)</option>
            <option value="formazione">📚 Formazione / Aggiornamento</option>
            <option value="lutto">🕊️ Permesso per Lutto</option>
            <option value="motivi_personali">👨‍👩‍👧 Motivi Personali / Familiari</option>
          </select>
        </div>
        <div class="form-group">
          <label style="font-weight:600; font-size:12px;">Note / Specifiche (facoltativo)</label>
          <input type="text" id="reg-abs-notes" class="form-control" placeholder="Es. Visita specialistica, corso dipartimentale..." value="${escHtml(absence.reason === 'Assenza rapida da regolarizzare' ? '' : (absence.reason || ''))}">
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" id="reg-cancel">Annulla</button>
        <button class="btn btn-primary" id="reg-save">Salva Dettagli</button>
      `,
      size: 'modal-md'
    });

    ov.querySelector('#reg-cancel').onclick = () => ov.remove();
    ov.querySelector('#reg-save').onclick = async () => {
      const type = ov.querySelector('#reg-abs-type').value;
      const notes = ov.querySelector('#reg-abs-notes').value.trim();
      try {
        await API.put(`/absences/${absence.id}`, { type, reason: notes, is_regularized: true });
        ov.remove();
        APP.toast('Assenza regolarizzata con successo', 'success');
        render(document.getElementById('content-area'), APP.getState());
      } catch(err) { APP.toast(err.message, 'error'); }
    };
  }

  async function cancelRequest(e, id) {
    if (e) e.preventDefault();
    if (!await APP.confirm('Sei sicuro di voler annullare questa richiesta di assenza? Verrà rimossa dal registro.')) return;
    try {
      await API.del(`/absences/teacher-cancel/${id}`);
      APP.toast('Richiesta annullata correttamente', 'success');
      render(document.getElementById('content-area'), APP.getState());
    } catch(e) { APP.toast(e.message, 'error'); }
  }

  return { render, markRead, acceptAssignment, rejectAssignment, openRegularizeModal, cancelRequest };
})();
