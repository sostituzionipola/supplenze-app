// ══════════════════════════════════
// TEACHERS VIEW
// ══════════════════════════════════
var TeachersView = (() => {
  let _teachers = [], _filtered = [], _yearId = null, _currentTab = 'anagrafica';
  let _periodFrom = '', _periodTo = '', _state = null;
  let _selectedIds = new Set();

  async function render(container, state) {
    _state = state;
    _yearId = state.yearId;
    if (!_yearId) { 
      container.innerHTML = `
        <div class="empty-state" style="padding:40px">
          <div class="icon" style="font-size:48px; margin-bottom:16px;">🔍</div>
          <h3 style="margin-bottom:8px;">Anno Scolastico non selezionato</h3>
          <p style="color:var(--text-secondary); max-width:400px; margin:0 auto 20px;">
            Per caricare i docenti, seleziona l'anno scolastico dal menù <strong>"Scegli Anno"</strong> in alto a sinistra.
          </p>
          <div class="attention-hint" style="font-size:12px; color:var(--accent); font-weight:600;">
            ⬅️ Guarda qui in alto
          </div>
        </div>`; 
      return; 
    }
    
    container.innerHTML = `
      <div class="page-header" style="padding-bottom:12px; border-bottom:1px solid var(--border)">
        <div class="page-title">👨‍🏫 Gestione Docenti</div>
      </div>

      <div class="toolbar" style="margin-top:20px; flex-wrap:wrap; gap:8px;">
        <div class="toolbar-left" style="flex-wrap:wrap; gap:8px;">
          <div class="search-box">
            <span class="s-icon">🔍</span>
            <input type="text" id="teacher-search" placeholder="Cerca per Nome, Materia o Classe…"/>
          </div>
          <select class="filter-select" id="teacher-sort">
            <option value="name_asc">Nome (A-Z)</option>
            <option value="name_desc">Nome (Z-A)</option>
            <option value="subject">Materia</option>
            <option value="debt">Ore da Recuperare (↓)</option>
          </select>
          <div style="display:flex; align-items:center; gap:6px; font-size:13px;">
            <label style="color:var(--text-secondary); white-space:nowrap;">Periodo:</label>
            <input type="date" id="period-from" class="form-control" value="${_periodFrom}" style="padding:5px 8px; width:140px;" placeholder="Dal">
            <span style="color:var(--text-muted)">→</span>
            <input type="date" id="period-to" class="form-control" value="${_periodTo}" style="padding:5px 8px; width:140px;" placeholder="Al">
            <button class="btn btn-ghost btn-sm" id="period-clear-btn" title="Azzera periodo">✕</button>
          </div>
        </div>
        <div class="toolbar-right" style="flex-wrap:wrap; gap:8px;">
          <button class="btn btn-ghost" id="export-all-btn" title="Stampa/esporta storico completo di tutti i docenti">🖨️ Stampa / Esporta Tutto</button>
          <button class="btn btn-primary" id="add-teacher-btn">👤 + Aggiungi Docente</button>
        </div>
      </div>

      <div class="btn-group mb-24" style="background:var(--bg-card); padding:4px; border-radius:var(--radius); border:1px solid var(--border); display:flex; flex-wrap:wrap; gap:4px">
        <button class="btn btn-sm ${_currentTab === 'anagrafica' ? 'btn-primary' : 'btn-ghost'}" id="tab-anagrafica">Anagrafica Docenti</button>
        <button class="btn btn-sm ${_currentTab === 'rec_subs' ? 'btn-primary' : 'btn-ghost'}" id="tab-rec-subs">Recupero Ore Supplenze</button>
        <button class="btn btn-sm ${_currentTab === 'rec_trips' ? 'btn-primary' : 'btn-ghost'}" id="tab-rec-trips">Recupero Uscite/Soggiorni</button>
        <button class="btn btn-sm ${_currentTab === 'ore_eccedenti' ? 'btn-primary' : 'btn-ghost'}" id="tab-ore-eccedenti">Ore Eccedenti / Straordinario</button>
        <button class="btn btn-sm ${_currentTab === 'assenze' ? 'btn-primary' : 'btn-ghost'}" id="tab-assenze">Motivi Assenze</button>
      </div>

      <div id="teachers-view-content"></div>
    `;

    container.querySelector('#tab-anagrafica').onclick = () => { _currentTab = 'anagrafica'; render(container, state); };
    container.querySelector('#tab-rec-subs').onclick = () => { _currentTab = 'rec_subs'; render(container, state); };
    container.querySelector('#tab-rec-trips').onclick = () => { _currentTab = 'rec_trips'; render(container, state); };
    container.querySelector('#tab-ore-eccedenti').onclick = () => { _currentTab = 'ore_eccedenti'; render(container, state); };
    container.querySelector('#tab-assenze').onclick = () => { _currentTab = 'assenze'; render(container, state); };

    container.querySelector('#add-teacher-btn').onclick = () => openModal(null);
    container.querySelector('#export-all-btn').onclick = () => openExportModal();

    const searchInput = container.querySelector('#teacher-search');
    const sortSelect = container.querySelector('#teacher-sort');
    const periodFrom = container.querySelector('#period-from');
    const periodTo = container.querySelector('#period-to');
    const periodClear = container.querySelector('#period-clear-btn');

    searchInput.oninput = debounce(applyFilter);
    sortSelect.onchange = applyFilter;
    periodFrom.onchange = (e) => { _periodFrom = e.target.value; applyTabContent(); };
    periodTo.onchange = (e) => { _periodTo = e.target.value; applyTabContent(); };
    periodClear.onclick = () => { _periodFrom = ''; _periodTo = ''; periodFrom.value = ''; periodTo.value = ''; applyTabContent(); };

    if (_teachers.length === 0) {
      await load();
    } else {
      applyFilter();
      applyTabContent();
    }
  }

  function applyTabContent() {
    const contentArea = document.getElementById('teachers-view-content');
    if (!contentArea) return;
    const state = { yearId: _yearId };
    if (_currentTab === 'anagrafica') renderAnagrafica(contentArea, state);
    else if (_currentTab === 'rec_subs') renderRecuperi(contentArea, state, 'subs');
    else if (_currentTab === 'ore_eccedenti') renderOreEccedenti(contentArea, state);
    else if (_currentTab === 'assenze') renderMotiviAssenze(contentArea, state);
    else renderRecuperi(contentArea, state, 'trips');
  }

  async function renderAnagrafica(container, state) {
    container.innerHTML = `
      <div class="table-wrapper">
        <table id="teachers-table">
          <thead><tr>
            <th style="width:36px; text-align:center">
              <input type="checkbox" id="select-all-cb" title="Seleziona tutti" style="cursor:pointer; width:16px; height:16px;">
            </th>
            <th>Docente</th>
            <th>Contratto</th>
            <th>Materia</th>
            <th>Classi</th>
            <th style="width:200px; text-align:center">Ore da recuperare<br/>(supplenze + uscite)</th>
            <th>Stato</th>
            <th style="width:80px; text-align:center">Storico</th>
            <th style="width:90px">Azioni</th>
          </tr></thead>
          <tbody id="teachers-tbody"></tbody>
        </table>
      </div>`;
    renderTable();
    // Wire up select-all checkbox
    const allCb = container.querySelector('#select-all-cb');
    if (allCb) {
      allCb.checked = _filtered.length > 0 && _filtered.every(t => _selectedIds.has(t.id));
      allCb.onchange = () => {
        if (allCb.checked) _filtered.forEach(t => _selectedIds.add(t.id));
        else _filtered.forEach(t => _selectedIds.delete(t.id));
        renderTable();
        updateExportCount();
      };
    }
  }

  async function load() {
    try {
      _teachers = await API.get(`/teachers?year_id=${_yearId}`);
      applyFilter();
      applyTabContent();
    } catch(e) { APP.toast(e.message, 'error'); }
  }

  function applyFilter() {
    const q = (document.getElementById('teacher-search')?.value||'').toLowerCase();
    const sort = document.getElementById('teacher-sort')?.value;
    
    _filtered = _teachers.filter(t => {
      const nameMatch = t.name.toLowerCase().includes(q);
      const subjectMatch = (t.subject||'').toLowerCase().includes(q);
      const classesMatch = (t.assigned_classes||'').toLowerCase().includes(q);
      return nameMatch || subjectMatch || classesMatch;
    });

    if (sort === 'name_asc') _filtered.sort((a,b)=>a.name.localeCompare(b.name));
    else if (sort === 'name_desc') _filtered.sort((a,b)=>b.name.localeCompare(a.name));
    else if (sort === 'subject') _filtered.sort((a,b)=>(a.subject||'').localeCompare(b.subject||''));
    else if (sort === 'debt') _filtered.sort((a,b)=>(b.hours_subs+b.hours_trips) - (a.hours_subs+a.hours_trips));

    if (_currentTab === 'anagrafica') {
      renderTable();
    } else {
      applyTabContent();
    }
  }

  function updateExportCount() {
    const btn = document.getElementById('export-all-btn');
    if (!btn) return;
    const n = _selectedIds.size;
    btn.textContent = n > 0 ? `🖨️ Esporta Selezionati (${n})` : '🖨️ Stampa / Esporta Tutto';
  }

  function renderTable() {
    const tbody = document.getElementById('teachers-tbody');
    if (!tbody) return;
    if (!_filtered.length) {
      tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state" style="padding:24px"><div class="icon">👨‍🏫</div><h3>Nessun docente trovato</h3></div></td></tr>';
      return;
    }
    tbody.innerHTML = _filtered.map(t => {
      const totalDebt = (t.hours_subs||0) + (t.hours_trips||0);
      const isChecked = _selectedIds.has(t.id);
      return `
        <tr class="${isChecked ? 'selected-row' : ''}">
          <td style="text-align:center">
            <input type="checkbox" class="teacher-cb" data-id="${t.id}" ${isChecked ? 'checked' : ''} style="cursor:pointer; width:16px; height:16px;">
          </td>
          <td>
            <strong>${escHtml(t.name)}</strong>
            ${t.availability_locked ? '<span title="Disponibilità Inviate (Bloccate)" style="cursor:help; margin-left:4px;">🔒</span>' : ''}
          </td>
          <td><span class="badge ${t.type === 'long_term' ? 'badge-info' : 'badge-neutral'}" style="font-size:10px;">${t.type === 'long_term' ? 'Tempo Determinato' : 'Tempo Indeterminato'}</span></td>
          <td><span style="font-size:12px; color:var(--text-secondary)">${escHtml(t.subject||'—')}</span></td>
          <td><span class="chip" style="font-size:11px">${escHtml(t.assigned_classes||'—')}</span></td>
          <td style="text-align:center">
             <span class="hours-cnt ${totalDebt > 0 ? 'positive' : 'zero'}" style="font-size:15px; font-weight:800">${totalDebt} ore</span>
          </td>
          <td>
            <span class="badge ${t.is_available ? 'badge-success' : 'badge-neutral'}" style="cursor:pointer" onclick="TeachersView.toggleAvail(${t.id})">
              ${t.is_available ? '✓ Disponibile' : '✗ Occupato'}
            </span>
          </td>
          <td style="text-align:center">
            <button class="btn btn-secondary btn-sm" onclick="TeachersView.openHistoryPopup(${t.id})" title="Storico individuale">📊 Vedi</button>
          </td>
          <td>
            <button class="btn btn-ghost btn-sm" onclick="TeachersView.openModal(${t.id})" title="Modifica">✏️</button>
            ${t.availability_locked ? `<button class="btn btn-ghost btn-sm" onclick="TeachersView.unlockAvail(${t.id})" title="Sblocca scelta disponibilità docente" style="color:var(--accent)">🔓</button>` : ''}
            <button class="btn btn-ghost btn-sm" onclick="TeachersView.deleteTeacher(${t.id})" title="Elimina">🗑️</button>
          </td>
        </tr>`;
    }).join('');

    // Wire checkboxes after DOM insert
    tbody.querySelectorAll('.teacher-cb').forEach(cb => {
      cb.onchange = () => {
        const id = parseInt(cb.dataset.id);
        if (cb.checked) _selectedIds.add(id); else _selectedIds.delete(id);
        cb.closest('tr').classList.toggle('selected-row', cb.checked);
        // Update select-all state
        const allCb = document.getElementById('select-all-cb');
        if (allCb) allCb.checked = _filtered.every(t => _selectedIds.has(t.id));
        updateExportCount();
      };
    });
  }

  async function unlockAvail(tid) {
    if (!await APP.confirm('Sei sicuro di voler sbloccare la scelta delle disponibilità per questo docente? Potrà modificare di nuovo i suoi slot DIS/ECC/R.')) return;
    try {
      await API.put(`/teachers/${tid}/unlock`);
      APP.toast('Disponibilità sbloccate', 'success');
      load();
    } catch(e) { APP.toast(e.message, 'error'); }
  }

  async function openHistoryPopup(teacherId) {
    const teacher = _teachers.find(t => t.id == teacherId);
    if (!teacher) return;

    const from = _periodFrom || '2000-01-01';
    const to = _periodTo || '2099-12-31';

    const allHistory = await API.get(`/substitutions/history?year_id=${_yearId}&teacher_id=${teacherId}&from=${from}&to=${to}`);
    const mySubs = allHistory.filter(s => s.substitute_teacher_id == teacherId);

    const totalRec = mySubs.filter(s => s.hours_counted).length;
    const totalEcc = mySubs.filter(s => !s.hours_counted).length;

    const buildTable = (rows, emptyMsg) => rows.length ? `
      <table style="width:100%; border-collapse:collapse; font-size:13px; margin-top:8px;">
        <thead><tr style="background:#f1f5f9; color:#0f172a;">
          <th style="padding:7px 10px;">Giorno</th><th>Ora</th><th>Tipo</th><th>Classe</th><th>Presa Visione</th>
        </tr></thead>
        <tbody>
          ${rows.map(s => {
            const isRec = !!s.hours_counted;
            return `<tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:6px 10px;"><strong>${fmtDate(s.date)}</strong></td>
              <td>${s.hour}ª</td>
              <td><span style="background:${isRec ? '#dbeafe' : '#fef9c3'}; color:${isRec ? '#1d4ed8' : '#92400e'}; padding:2px 6px; border-radius:4px; font-size:11px;">${isRec ? 'Recupero Ore' : 'Ore Eccedenti / Straordinario'}</span></td>
              <td>${escHtml(s.class_name || '—')}</td>
              <td>${s.accepted ? '✅' : '<span style="color:#94a3b8; font-size:11px;">—</span>'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>` : `<div style="padding:16px; color:#94a3b8; font-size:13px;">${emptyMsg}</div>`;

    const popupBody = `
      <div style="display:flex; gap:12px; margin-bottom:20px; flex-wrap:wrap;">
        <div style="flex:1; min-width:120px; background:#dbeafe; padding:12px 16px; border-radius:8px; text-align:center;"><div style="font-size:22px; font-weight:800; color:#1d4ed8;">${totalRec}</div><div style="font-size:12px; color:#1e40af;">Ore Recuperate</div></div>
        <div style="flex:1; min-width:120px; background:#fef9c3; padding:12px 16px; border-radius:8px; text-align:center;"><div style="font-size:22px; font-weight:800; color:#92400e;">${totalEcc}</div><div style="font-size:12px; color:#78350f;">Ore Eccedenti</div></div>
        <div style="flex:1; min-width:120px; background:#f0fdf4; padding:12px 16px; border-radius:8px; text-align:center;"><div style="font-size:22px; font-weight:800; color:#16a34a;">${(teacher.hours_subs||0)+(teacher.hours_trips||0)}</div><div style="font-size:12px; color:#15803d;">Ore Residue da Recuperare</div></div>
      </div>
      <div id="popup-section-rec">
        <div style="font-weight:700; font-size:13px; margin-bottom:4px; color:#1d4ed8;">📘 Recuperi Effettuati</div>
        ${buildTable(mySubs.filter(s => s.hours_counted), 'Nessun recupero registrato.')}
      </div>
      <div id="popup-section-ecc" style="margin-top:16px;">
        <div style="font-weight:700; font-size:13px; margin-bottom:4px; color:#92400e;">⚡ Ore Eccedenti / Straordinario</div>
        ${buildTable(mySubs.filter(s => !s.hours_counted), 'Nessuna ora eccedente registrata.')}
      </div>
    `;

    const ov = APP.modal({
      title: `📊 Storico — ${escHtml(teacher.name)}`,
      size: 'modal-lg',
      body: popupBody,
      footer: `
        <button class="btn btn-ghost" id="popup-close">Chiudi</button>
        <button class="btn btn-secondary" onclick="window.print()" id="popup-print">🖨️ Stampa/PDF</button>
      `
    });
    ov.querySelector('#popup-close').onclick = () => ov.remove();
  }

  async function adjustHours(id, delta, type) {
    try {
      const t = await API.patch(`/teachers/${id}/hours`, { delta, type });
      const idx = _teachers.findIndex(x => x.id === id);
      if (idx !== -1) _teachers[idx] = t;
      applyFilter();
    } catch(e) { APP.toast(e.message, 'error'); }
  }

  async function toggleAvail(id) {
    const t = _teachers.find(x => x.id === id);
    if (!t) return;
    try {
      const updated = await API.put(`/teachers/${id}`, { ...t, is_available: !t.is_available });
      const idx = _teachers.findIndex(x => x.id === id);
      if (idx !== -1) _teachers[idx] = updated;
      applyFilter();
    } catch(e) { APP.toast(e.message, 'error'); }
  }

  async function openModal(id = null, forceType = null) {
    const isEdit = !!id;
    const t = isEdit ? _teachers.find(x => x.id == id) : { type: forceType || 'ordinario' };
    
    // Preparazione lista titolari per eventuale nomina
    const titolari = _teachers.filter(tx => tx.type !== 'long_term' && tx.id !== id);

    const ov = APP.modal({
      title: isEdit ? 'Modifica Docente' : '➕ Aggiungi Nuovo Docente',
      body: `
        <div id="m-content-dati">
          <div class="form-group"><label>Nome e Cognome *</label><input type="text" id="m-name" value="${escHtml(isEdit ? t.name : '')}" placeholder="MARIO ROSSI"/></div>
          <div class="form-group"><label>Email (opzionale per TI, consigliata per TD)</label><input type="email" id="m-email" value="${escHtml(isEdit ? t.email : '')}" placeholder="mario.rossi@scuola.it"/></div>
          <div class="form-group">
            <label>Inquadramento Docente</label>
            <select id="m-type" class="form-control">
              <option value="ordinario" ${t.type === 'ordinario' ? 'selected' : ''}>Tempo Indeterminato (TI)</option>
              <option value="long_term" ${t.type === 'long_term' ? 'selected' : ''}>Tempo Determinato (TD / Supplente)</option>
            </select>
          </div>

          <div id="m-td-extension" style="display: ${t.type === 'long_term' ? 'block' : 'none'}; margin-top:16px; padding:16px; background:var(--bg-secondary); border:1px dashed var(--border); border-radius:8px;">
            <div style="font-weight:700; font-size:13px; margin-bottom:12px; color:var(--accent);">🔗 Configurazione Nomina (Sostituzione)</div>
            <div class="form-group">
              <label>Docente Titolare Sostituito *</label>
              <select id="m-replaced-id" class="form-control">
                <option value="">-- Seleziona Titolare --</option>
                ${titolari.map(tx => `<option value="${tx.id}">${escHtml(tx.name)}</option>`).join('')}
              </select>
            </div>
            <div class="grid grid-cols-2 gap-12">
              <div class="form-group"><label>Inizio Nomina</label><input type="date" id="m-start-date" class="form-control"></div>
              <div class="form-group"><label>Fine Nomina</label><input type="date" id="m-end-date" class="form-control"></div>
            </div>
            <div class="form-group" style="margin-top:10px;">
              <label>Copertura Oraria Nomina</label>
              <select id="m-lt-coverage" class="form-control">
                <option value="full">Intera cattedra (tutte le ore del titolare)</option>
                <option value="partial">Spezzone / Solo ore specifiche</option>
              </select>
            </div>
            <div id="m-lt-hours-box" style="display:none; margin-top:8px; padding:10px; background:var(--bg-primary); border-radius:6px; border:1px solid var(--border);">
              <label style="font-size:11px; text-transform:none; margin-bottom:6px;">Seleziona le ore assegnate (1ª - 8ª):</label>
              <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:6px;">
                ${[1,2,3,4,5,6,7,8].map(h => `
                  <label style="display:flex; align-items:center; gap:6px; font-size:11px; cursor:pointer;">
                    <input type="checkbox" class="m-lt-hour-cb" value="${h+7}"> ${h}ª ora
                  </label>
                `).join('')}
              </div>
            </div>
            <p style="font-size:10px; color:var(--text-secondary); margin-top:8px; margin-bottom:0;">Il supplente verrà suggerito automaticamente per le ore del titolare nel periodo indicato.</p>
          </div>

          <div class="grid grid-cols-2 gap-12 mt-16">
            <div class="form-group"><label>Materia</label><input type="text" id="m-subject" value="${escHtml(isEdit ? t.subject : '')}" placeholder="ITALIANO, MATEMATICA..."/></div>
            <div class="form-group"><label>Classi Assegnate</label><input type="text" id="m-classes" value="${escHtml(isEdit ? t.assigned_classes : '')}" placeholder="1A, 2B, 3C..."/></div>
          </div>
          <div class="form-group">
            <label>Ore Settimanali Cattedra / Contratto *</label>
            <input type="number" id="m-weekly-hours" value="${isEdit ? (t.weekly_hours || 18) : 18}" min="1" max="40"/>
            <small style="color:var(--text-secondary)">Standard secondaria: 18h | Primaria: 24h | Oppure spezzone orario (es. 6, 9, 10, 12). Definisce il tetto annuo dei permessi brevi (Art. 16 CCNL).</small>
          </div>
          <div class="grid grid-cols-2 gap-12">
            <div class="form-group">
              <label>Debito Iniziale Supplenze (ore)</label>
              <input type="number" id="m-hours-subs" value="${isEdit ? (t.hours_subs || 0) : 0}" min="0"/>
              <small style="color:var(--text-secondary)">Valido per tutto l'anno scolastico.</small>
            </div>
            <div class="form-group">
              <label>Debito Iniziale Uscite / Soggiorni (ore)</label>
              <input type="number" id="m-hours-trips" value="${isEdit ? (t.hours_trips || 0) : 0}" min="0"/>
              <small style="color:var(--text-secondary)">Valido per tutto l'anno scolastico.</small>
            </div>
          </div>
          <div class="form-group"><label>Note</label><textarea id="m-notes">${escHtml(isEdit ? t.notes : '')}</textarea></div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="m-cancel">Annulla</button><button class="btn btn-primary" id="m-save">Salva Docente</button>`,
      size: 'modal-md'
    });

    const mType = ov.querySelector('#m-type');
    const tdExt = ov.querySelector('#m-td-extension');
    const covSel = ov.querySelector('#m-lt-coverage');
    const covBox = ov.querySelector('#m-lt-hours-box');

    mType.addEventListener('change', (e) => {
       tdExt.style.display = e.target.value === 'long_term' ? 'block' : 'none';
    });
    covSel?.addEventListener('change', (e) => {
      if (covBox) covBox.style.display = e.target.value === 'partial' ? 'block' : 'none';
    });

    ov.querySelector('#m-save').onclick = async () => {
      const name = ov.querySelector('#m-name').value.trim();
      if (!name) { APP.toast('Nome obbligatorio', 'error'); return; }
      
      const type = ov.querySelector('#m-type').value;
      const replacedId = parseInt(ov.querySelector('#m-replaced-id').value);
      const startDate = ov.querySelector('#m-start-date').value;
      const endDate = ov.querySelector('#m-end-date').value;

      if (type === 'long_term' && !isEdit) {
         if (!replacedId || !startDate || !endDate) {
            APP.toast('Per i docenti TD è necessario configurare la nomina (titolare e date).', 'warning');
            return;
         }
      }

      const weeklyHours = parseInt(ov.querySelector('#m-weekly-hours').value) || 18;
      const hoursSubs = parseInt(ov.querySelector('#m-hours-subs').value) || 0;
      const hoursTrips = parseInt(ov.querySelector('#m-hours-trips').value) || 0;

      const payload = { 
        name: name.toUpperCase(), 
        email: ov.querySelector('#m-email').value.trim().toLowerCase(),
        type: type,
        weekly_hours: weeklyHours,
        subject: ov.querySelector('#m-subject').value.trim().toUpperCase(),
        assigned_classes: ov.querySelector('#m-classes').value.trim().toUpperCase(),
        hours_subs: hoursSubs, 
        hours_trips: hoursTrips, 
        is_available: true, 
        notes: ov.querySelector('#m-notes').value, 
        school_year_id: _yearId 
      };

      try {
        let savedTeacher;
        if (isEdit) { 
          savedTeacher = await API.put(`/teachers/${t.id}`, payload); 
          _teachers = _teachers.map(x => x.id === t.id ? savedTeacher : x); 
        } else { 
          savedTeacher = await API.post('/teachers', payload); 
          _teachers.push(savedTeacher); 
          
          // Se è TD, creiamo anche la nomina
          if (type === 'long_term' && replacedId) {
            let ltHours = [];
            if (ov.querySelector('#m-lt-coverage')?.value === 'partial') {
              ltHours = Array.from(ov.querySelectorAll('.m-lt-hour-cb:checked')).map(cb => parseInt(cb.value));
            }
            await API.post('/long-term-assignments', {
              substitute_id: savedTeacher.id,
              replaced_id: replacedId,
              start_date: startDate,
              end_date: endDate,
              hours: ltHours
            });
            APP.toast('Docente e Nomina creati con successo', 'success');
          }
        }
        
        ov.remove(); applyFilter(); 
        if (! (type === 'long_term' && !isEdit)) APP.toast('Docente salvato', 'success');
      } catch(e) { APP.toast(e.message, 'error'); }
    };
  }

  async function deleteTeacher(id) {
    const t = _teachers.find(x => x.id === id);
    if (!await APP.confirm(`Eliminare ${t?.name}? Questa azione è irreversibile.`)) return;
    try {
      await API.del(`/teachers/${id}`);
      _teachers = _teachers.filter(x => x.id !== id);
      applyFilter(); APP.toast('Docente eliminato', 'success');
    } catch(e) { APP.toast(e.message, 'error'); }
  }

  async function renderRecuperi(container, state, subType = 'subs') {
    container.innerHTML = `<div class="loading-overlay"><div class="spinner"></div> Caricamento riepilogo ${subType === 'subs' ? 'supplenze' : 'uscite/soggiorni'}...</div>`;
    try {
      const [history, absences] = await Promise.all([
        API.get(`/substitutions/history?year_id=${_yearId}&from=2000-01-01&to=2099-12-31`),
        API.get(`/absences?year_id=${_yearId}`)
      ]);
      
      const teacherStats = {};
      const now = new Date();

      _filtered.forEach(t => {
        teacherStats[t.id] = {
          id: t.id,
          name: t.name,
          subject: t.subject,
          weekly_hours: t.weekly_hours || 18,
          initial_subs: parseInt(t.hours_subs) || 0,
          initial_trips: parseInt(t.hours_trips) || 0,
          short_permits_hours: 0,
          altro_permesso_count: 0,
          subs_done: 0,
          trips_done: 0,
          rejected_subs_count: 0,
          expired_permits_hours: 0
        };
      });

      // Calcola assenze per docente (Permessi brevi e altri permessi)
      const tAbsences = {};
      (absences || []).forEach(a => {
        if (!a.teacher_id || !teacherStats[a.teacher_id]) return;
        if (a.status === 'rejected') return;
        if (!tAbsences[a.teacher_id]) tAbsences[a.teacher_id] = [];
        tAbsences[a.teacher_id].push(a);
      });

      Object.keys(tAbsences).forEach(tid => {
        const stats = teacherStats[tid];
        const list = tAbsences[tid].sort((a,b) => (a.date||'').localeCompare(b.date||''));
        
        list.forEach(a => {
          const type = (a.type || '').toLowerCase();
          const hoursCount = a.hours_count ? parseInt(a.hours_count) : (a.hours && Array.isArray(a.hours) ? a.hours.length : 1);
          
          if (type === 'permit_hour' || type === 'permesso_breve' || type === 'permesso_ora' || type === 'permesso_orario') {
            stats.short_permits_hours += hoursCount;
            if (a.date) {
              const diffDays = Math.floor((now - new Date(a.date)) / (1000 * 60 * 60 * 24));
              if (diffDays > 60) stats.expired_permits_hours += hoursCount;
            }
          } else if (type === 'altro_permesso' || type === 'assenza_giornaliera' || type === 'motivi_personali') {
            stats.altro_permesso_count++;
          }
        });
      });

      (history || []).forEach(h => {
        const tid = h.substitute_teacher_id;
        if (!tid || !teacherStats[tid]) return;
        if (h.status === 'rejected') {
          teacherStats[tid].rejected_subs_count++;
          return;
        }
        if (!h.hours_counted) return;
        const isTrip = (h.type === 'trip' || h.notes?.toLowerCase().includes('uscita') || h.notes?.toLowerCase().includes('soggiorno'));
        if (isTrip) teacherStats[tid].trips_done++;
        else teacherStats[tid].subs_done++;
      });

      const renderSubsTable = () => `
        <div class="card mb-24" id="rec-supplenze" style="padding:0; overflow:hidden">
          <div class="card-header" style="padding:16px 20px; background:var(--bg-secondary); border-bottom:1px solid var(--border)">
            <div class="card-title">📊 Recupero Ore Supplenze (Debito Iniziale & Permessi)</div>
            <div class="flex gap-8">
              <button class="btn btn-ghost btn-sm" onclick="TeachersView.exportSection('rec-supplenze', 'Recupero_Supplenze', 'pdf')">📥 PDF</button>
              <button class="btn btn-ghost btn-sm" onclick="TeachersView.exportSection('rec-supplenze', 'Recupero_Supplenze', 'excel')">📥 Excel</button>
            </div>
          </div>
          <div class="table-wrapper">
            <table style="width:100%; border-collapse: collapse; font-size:12px">
              <thead>
                <tr style="background:var(--bg-secondary)">
                  <th style="padding:10px 14px; text-align:left;">Docente</th>
                  <th style="text-align:left;">Materia</th>
                  <th style="text-align:center;">Cattedra</th>
                  <th style="text-align:center;">Debito Iniziale</th>
                  <th style="text-align:center;">Permessi Brevi</th>
                  <th style="text-align:center;">Altri Permessi (Max 3)</th>
                  <th style="text-align:center; color:var(--success-text);">Supplenze Svolte</th>
                  <th style="text-align:center; color:var(--danger-text, #ef4444);">Rifiuti</th>
                  <th style="text-align:center; font-weight:700;">SALDO RESIDUO</th>
                  <th style="text-align:center;">Stato Scadenze</th>
                </tr>
              </thead>
              <tbody>
                ${Object.values(teacherStats).sort((a,b)=>a.name.localeCompare(b.name)).map(s => {
                  const saldo = s.initial_subs + s.short_permits_hours - s.subs_done;
                  const hasExpired = s.expired_permits_hours > s.subs_done;
                  return `
                  <tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:8px 14px; font-weight:600;">${escHtml(s.name)}</td>
                    <td style="color:var(--text-secondary);">${escHtml(s.subject||'—')}</td>
                    <td style="text-align:center;"><span class="badge badge-neutral">${s.weekly_hours}h</span></td>
                    <td style="text-align:center; font-weight:600;">${s.initial_subs} h</td>
                    <td style="text-align:center;">${s.short_permits_hours} h</td>
                    <td style="text-align:center;">${s.altro_permesso_count} / 3 <span style="font-size:10px; color:var(--text-secondary)">(non rec.)</span></td>
                    <td style="text-align:center; font-weight:700; color:var(--success-text);">${s.subs_done} h</td>
                    <td style="text-align:center; font-weight:600; color:${s.rejected_subs_count > 0 ? '#ef4444' : 'var(--text-muted)'};">${s.rejected_subs_count > 0 ? `${s.rejected_subs_count} ❌` : '—'}</td>
                    <td style="text-align:center; font-weight:800; font-size:13px; color:${saldo > 0 ? 'var(--warning-text, #d97706)' : 'var(--success-text, #16a34a)'}">${saldo > 0 ? saldo + ' h' : (saldo === 0 ? '0 h' : '+' + Math.abs(saldo) + ' h (Credito)')}</td>
                    <td style="text-align:center;">
                      ${hasExpired 
                        ? `<span class="badge badge-danger" title="Permessi presi da oltre 60 giorni non ancora coperti">⚠️ Oltre 2 mesi</span>` 
                        : (saldo <= 0 ? `<span class="badge badge-success">✓ In pari</span>` : `<span class="badge badge-info">🟢 In regola</span>`)}
                    </td>
                  </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>`;

      const renderTripsTable = () => `
        <div class="card mb-24" id="rec-uscite" style="padding:0; overflow:hidden">
          <div class="card-header" style="padding:16px 20px; background:var(--bg-secondary); border-bottom:1px solid var(--border)">
            <div class="card-title">🚌 Recupero Ore Uscite Didattiche / Soggiorni</div>
            <div class="flex gap-8">
              <button class="btn btn-ghost btn-sm" onclick="TeachersView.exportSection('rec-uscite', 'Recupero_Uscite', 'pdf')">📥 PDF</button>
              <button class="btn btn-ghost btn-sm" onclick="TeachersView.exportSection('rec-uscite', 'Recupero_Uscite', 'excel')">📥 Excel</button>
            </div>
          </div>
          <div class="table-wrapper">
            <table style="width:100%; border-collapse: collapse; font-size:12px">
              <thead>
                <tr style="background:var(--bg-secondary)">
                  <th style="padding:10px 14px; text-align:left;">Docente</th>
                  <th style="text-align:left;">Materia</th>
                  <th style="text-align:center;">Debito Iniziale Uscite</th>
                  <th style="text-align:center; color:var(--success-text);">Uscite/Soggiorni Svolti</th>
                  <th style="text-align:center; font-weight:700;">SALDO RESIDUO USCITE</th>
                </tr>
              </thead>
              <tbody>
                ${Object.values(teacherStats).sort((a,b)=>a.name.localeCompare(b.name)).map(s => {
                  const saldoU = s.initial_trips - s.trips_done;
                  return `
                  <tr style="border-bottom:1px solid var(--border)">
                    <td style="padding:8px 14px; font-weight:600;">${escHtml(s.name)}</td>
                    <td style="color:var(--text-secondary);">${escHtml(s.subject||'—')}</td>
                    <td style="text-align:center; font-weight:600;">${s.initial_trips} h</td>
                    <td style="text-align:center; font-weight:700; color:var(--success-text);">${s.trips_done} h</td>
                    <td style="text-align:center; font-weight:800; font-size:13px; color:${saldoU > 0 ? '#d97706' : '#16a34a'}">${saldoU > 0 ? saldoU + ' h' : '0 h (In pari)'}</td>
                  </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>`;

      container.innerHTML = `
        ${subType === 'subs' ? renderSubsTable() : renderTripsTable()}
      `;
    } catch(e) { APP.toast(e.message, 'error'); }
  }

  let _historyFrom = '';
  let _historyTo = '';

  async function renderIndividualHistory(container, state) {
    // Usa direttamente _filtered dal search globale sopra — niente select ridondante!
    container.innerHTML = `
      <div class="card mb-16" style="padding: 16px 20px;">
        <div class="flex gap-16 items-end flex-wrap">
          <div class="form-group" style="margin:0; min-width:160px;">
            <label style="font-size:12px; margin-bottom:4px;">Dal</label>
            <input type="date" id="th-from" class="form-control" value="${_historyFrom}" style="padding:6px 10px;">
          </div>
          <div class="form-group" style="margin:0; min-width:160px;">
            <label style="font-size:12px; margin-bottom:4px;">Al</label>
            <input type="date" id="th-to" class="form-control" value="${_historyTo}" style="padding:6px 10px;">
          </div>
          <button class="btn btn-primary btn-sm" id="th-apply-filter">Applica</button>
          <button class="btn btn-ghost btn-sm" id="th-clear-filter">Azzera</button>
          <span style="font-size:12px; color:var(--text-secondary); margin-left:auto;">
            📌 Risultati per: <strong>${_filtered.length} docente${_filtered.length !== 1 ? 'i' : ''}</strong> filtrati dalla barra di ricerca
          </span>
        </div>
      </div>
      <div id="th-results">
        <div class="loading-overlay"><div class="spinner"></div> Caricamento storico...</div>
      </div>
    `;

    container.querySelector('#th-apply-filter').onclick = () => {
      _historyFrom = container.querySelector('#th-from').value;
      _historyTo = container.querySelector('#th-to').value;
      loadAllHistoryStats(container.querySelector('#th-results'));
    };
    container.querySelector('#th-clear-filter').onclick = () => {
      _historyFrom = ''; _historyTo = '';
      container.querySelector('#th-from').value = '';
      container.querySelector('#th-to').value = '';
      loadAllHistoryStats(container.querySelector('#th-results'));
    };

    await loadAllHistoryStats(container.querySelector('#th-results'));
  }

  async function loadAllHistoryStats(target) {
    if (!_filtered.length) {
      target.innerHTML = '<div class="empty-state">Nessun docente corrisponde alla ricerca. Usa la barra in alto per filtrare.</div>';
      return;
    }
    target.innerHTML = '<div class="loading-overlay"><div class="spinner"></div> Caricamento...</div>';
    try {
      let url = `/substitutions/history?year_id=${_yearId}&from=${_historyFrom || '2000-01-01'}&to=${_historyTo || '2099-12-31'}`;
      const history = await API.get(url);

      const filteredIds = new Set(_filtered.map(t => t.id));

      // Raggruppa per docente
      const byTeacher = {};
      _filtered.forEach(t => { byTeacher[t.id] = { teacher: t, subs: [] }; });

      history.forEach(s => {
        if (s.substitute_teacher_id && filteredIds.has(s.substitute_teacher_id)) {
          byTeacher[s.substitute_teacher_id]?.subs.push(s);
        }
      });

      const sections = Object.values(byTeacher).filter(x => x.subs.length > 0);

      if (!sections.length) {
        target.innerHTML = '<div class="empty-state">Nessuna supplenza trovata per i docenti selezionati nel periodo indicato.</div>';
        return;
      }

      let html = '';
      sections.forEach(({ teacher, subs }) => {
        const totalRec = subs.filter(s => s.hours_counted).length;
        const totalEcc = subs.filter(s => !s.hours_counted).length;

        html += `
          <div class="card mb-16" style="padding:0; overflow:hidden;">
            <div style="padding:12px 20px; background:var(--bg-secondary); border-bottom:1px solid var(--border); display:flex; align-items:center; gap:16px; flex-wrap:wrap;">
              <span style="font-weight:700; font-size:15px;">${escHtml(teacher.name)}</span>
              <span style="color:var(--text-secondary); font-size:12px;">${escHtml(teacher.subject || '')}</span>
              <span class="badge badge-info" style="margin-left:auto;">Recuperate: ${totalRec}</span>
              <span class="badge badge-warning">Eccedenti: ${totalEcc}</span>
            </div>
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
              <thead>
                <tr style="background:var(--bg-secondary);">
                  <th style="padding:8px 12px;">Giorno</th>
                  <th>Ora</th>
                  <th>Tipo</th>
                  <th>Classe</th>
                  <th>Presa Visione</th>
                </tr>
              </thead>
              <tbody>
                ${subs.map(s => {
                  const isRec = !!s.hours_counted;
                  return `<tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:7px 12px;"><strong>${fmtDate(s.date)}</strong></td>
                    <td>${s.hour}ª</td>
                    <td><span class="badge ${isRec ? 'badge-info' : 'badge-warning'}">${isRec ? 'Recupero Ore' : 'Ore Eccedenti / Straordinario'}</span></td>
                    <td>${escHtml(s.class_name || '—')}</td>
                    <td>${s.accepted ? '✅ Firmato' : '<span style="color:var(--text-muted); font-size:11px;">In attesa</span>'}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
      });

      target.innerHTML = html;
    } catch(e) {
      target.innerHTML = '<div class="empty-state">Errore caricamento storico</div>';
    }
  }


  function exportSection(id, filename, format) {
    const el = document.getElementById(id);
    if (!el) return;
    const table = el.querySelector('table');
    if (!table) return;

    if (format === 'excel') {
      const wb = XLSX.utils.table_to_book(table);
      XLSX.writeFile(wb, `${filename}.xlsx`);
    } else {
      const win = window.open('', '_blank');
      win.document.write(`<html><head><title>${filename}</title><style>
        body{font-family:sans-serif;padding:20px}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #ccc;padding:8px;text-align:left;font-size:10px}
        th{background:#f0f0f0}
      </style></head><body><h1>${filename.replace(/_/g,' ')}</h1>${table.outerHTML}</body></html>`);
      win.document.close();
      win.print();
    }
  }

  function openImportModal(isDebtOnly = false) {
    const ov = APP.modal({
      title: isDebtOnly ? '⚖️ Importa Ore da Recuperare' : '👥 Importa Anagrafica Docenti',
      body: `
        <div class="p-12">
          <p style="font-size:13px; color:var(--text-secondary); margin-bottom:12px">
            Carica un file <strong>Excel (.xlsx, .xls)</strong> o <strong>CSV</strong>. <br/>
            ${isDebtOnly ? 'Le colonne richieste sono il <strong>Nome e Cognome</strong> (colonna 1) e il <strong>Totale ore</strong> da recuperare (colonna 2).' : 'Il sistema riconoscerà automaticamente Nome, Materia ed Email.'}
          </p>
          
          <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:6px; padding:12px; margin-bottom:16px;">
            <div style="font-size:10px; color:var(--accent); font-weight:700; text-transform:uppercase; margin-bottom:6px;">💡 Esempio Formato</div>
            <table style="width:100%; font-size:11px; text-align:left; border-collapse:collapse;">
              <thead><tr style="border-bottom:1px solid var(--border);">
                <th>Docente</th>
                ${isDebtOnly ? '<th>Ore Totali</th>' : '<th>Materia</th><th>Email</th>'}
              </tr></thead>
              <tbody>
                <tr>
                  <td>ROSSI MARIO</td>
                  ${isDebtOnly ? '<td>14</td>' : '<td>MATEMATICA</td><td>m.rossi@...</td>'}
                </tr>
                <tr>
                  <td>BIANCHI ANNA</td>
                  ${isDebtOnly ? '<td>8</td>' : '<td>LETTERE</td><td>a.bianchi@...</td>'}
                </tr>
              </tbody>
            </table>
          </div>

          <p style="font-size:12px; color:var(--text-secondary); margin-bottom:16px">
            ${isDebtOnly ? 'Il sistema divide il debito tra Supplenze e Uscite. Le classi verranno dedotte dall\'orario esistente.' : 'In caso di nomi duplicati, i dati verranno aggiornati invece di creare nuovi docenti.'}
          </p>

          <div class="import-dropzone" id="dz-teachers" style="border: 2px dashed var(--border); padding: 30px; text-align: center; border-radius: 8px; cursor: pointer; background: var(--bg-secondary)">
            <div style="font-size:24px; margin-bottom:8px">📄</div>
            <div style="font-size:13px;">Seleziona o trascina il file qui</div>
            <input type="file" id="modal-file-input" accept=".xlsx, .xls, .csv" style="display:none" />
          </div>
          
          <div id="import-status-t" style="margin-top:12px; font-size:12px"></div>
        </div>
      `,
      footer: `<button class="btn btn-secondary" id="m-imp-cancel">Annulla</button><button class="btn btn-primary" id="m-imp-start">Avvia Importazione</button>`
    });
    
    const dz = ov.querySelector('#dz-teachers');
    const fi = ov.querySelector('#modal-file-input');
    dz.onclick = () => fi.click();

    ov.querySelector('#m-imp-cancel').onclick = () => ov.remove();
    ov.querySelector('#m-imp-start').onclick = () => {
      const file = fi.files[0];
      if (!file) { APP.toast('Seleziona prima un file.', 'error'); return; }
      handleImport(file, ov);
    };
  }

  async function handleImport(file, modalNode) {
    if (!file) return;
    try {
      APP.toast('Caricamento in corso...', 'info');
      // Recupera orario caricato per incrociare le classi
      const scheduleSlots = await API.get(`/schedule?year_id=${_yearId}`);

      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      
      let count = 0;
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row[0]) continue;
        
        let name = '';
        let rawTotal = 0;
        let subject = '';
        let classes = '';

        if (row.length >= 3 && !isNaN(parseInt(row[2])) && isNaN(parseInt(row[1]))) {
          // Formato template a 3 colonne: COGNOMI, NOMI, ORE
          name = `${String(row[0]).trim()} ${String(row[1]).trim()}`.toUpperCase();
          rawTotal = parseInt(row[2]) || 0;
          subject = row[3] ? String(row[3]).trim().toUpperCase() : '';
          classes = row[4] ? String(row[4]).trim().toUpperCase() : '';
        } else {
          name = String(row[0]).trim().toUpperCase();
          rawTotal = parseInt(row[1]) || 0;
          subject = row[2] ? String(row[2]).trim().toUpperCase() : '';
          classes = row[3] ? String(row[3]).trim().toUpperCase() : '';
        }
        
        // Divisione logica
        const hours_subs = Math.floor(rawTotal / 2);
        const hours_trips = Math.ceil(rawTotal / 2); // Il dispari va in eccesso alle uscite

        const existing = _teachers.find(t => {
          const tn = (t.name || '').toUpperCase().trim();
          return tn === name || 
                 (row[1] && tn === `${String(row[1]).trim()} ${String(row[0]).trim()}`.toUpperCase());
        });
        if (existing) {
          // Incrocio su schedule!
          const mySlots = scheduleSlots.filter(s => s.teacher_id === existing.id && s.slot_type === 'normal');
          if (mySlots.length > 0) {
            const sc = new Set(mySlots.map(s => s.raw_value.replace(/[*]/g,'').trim()));
            classes = Array.from(sc).filter(Boolean).join(', ');
          }

          const payload = { 
             ...existing, 
             subject: subject || existing.subject, 
             assigned_classes: classes || existing.assigned_classes, 
             hours_subs, 
             hours_trips 
          };
          const u = await API.put(`/teachers/${existing.id}`, payload);
          _teachers = _teachers.map(x => x.id === existing.id ? u : x);
        } else {
          // Se stiamo creando il docente NON può avere orario
          const payload = { name, subject, assigned_classes: classes, hours_subs, hours_trips, is_available: 1, notes: '', school_year_id: _yearId };
          const u = await API.post('/teachers', payload);
          _teachers.push(u);
        }
        count++;
      }
      applyFilter();
      if (modalNode) modalNode.remove();
      APP.toast(`Importati/Aggiornati ${count} docenti con ore da recuperare assegnate.`, 'success');
    } catch(e) {
      APP.toast('Errore durante l\'importazione: ' + e.message, 'error');
    }
  }

  async function renderOreEccedenti(container, state) {
    container.innerHTML = '<div class="loading-overlay"><div class="spinner"></div> Caricamento ore eccedenti...</div>';
    try {
      const from = _periodFrom || '2000-01-01';
      const to = _periodTo || '2099-12-31';
      const history = await API.get(`/substitutions/history?year_id=${_yearId}&from=${from}&to=${to}`);

      const filteredIds = new Set(_filtered.map(t => t.id));
      // Only eccedenti (not counted = no debt recovery)
      const eccedenti = history.filter(s => !s.hours_counted && s.substitute_teacher_id && filteredIds.has(s.substitute_teacher_id));

      if (!eccedenti.length) {
        container.innerHTML = '<div class="empty-state">Nessuna ora eccedente/straordinario trovata per il periodo selezionato.</div>';
        return;
      }

      // Group by teacher
      const byTeacher = {};
      _filtered.forEach(t => { byTeacher[t.id] = { teacher: t, rows: [] }; });
      eccedenti.forEach(s => { byTeacher[s.substitute_teacher_id]?.rows.push(s); });

      let html = `
        <div style="display:flex; justify-content:flex-end; margin-bottom:12px;">
          <button class="btn btn-secondary btn-sm" onclick="window.print()">🖨️ Stampa / Esporta PDF</button>
        </div>
      `;

      Object.values(byTeacher).filter(x => x.rows.length).forEach(({ teacher, rows }) => {
        html += `
          <div class="card mb-16" style="padding:0; overflow:hidden;">
            <div style="padding:10px 16px; background:var(--bg-secondary); border-bottom:1px solid var(--border); display:flex; align-items:center; gap:12px;">
              <span style="font-weight:700;">${escHtml(teacher.name)}</span>
              <span style="color:var(--text-secondary); font-size:12px;">${escHtml(teacher.subject||'')}</span>
              <span class="badge badge-warning" style="margin-left:auto;">⚡ ${rows.length} ore eccedenti</span>
            </div>
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
              <thead>
                <tr style="background:var(--bg-secondary);">
                  <th style="padding:7px 12px;">Giorno</th><th>Ora</th><th>Classe Coperta</th><th>Presa Visione</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map(s => `
                  <tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:6px 12px;"><strong>${fmtDate(s.date)}</strong></td>
                    <td>${s.hour}ª</td>
                    <td>${escHtml(s.class_name || '—')}</td>
                    <td>${s.accepted ? '✅ Firmato' : '<span style="color:var(--text-muted); font-size:11px;">—</span>'}</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        `;
      });

      container.innerHTML = html;
    } catch(e) {
      container.innerHTML = '<div class="empty-state">Errore caricamento dati</div>';
    }
  }

  function openExportModal() {
    const n = _selectedIds.size;
    const targetLabel = n > 0 ? `${n} docenti selezionati` : `tutti i ${_filtered.length} docenti filtrati`;
    const ov = APP.modal({
      title: '📄 Esporta Storico Docenti',
      body: `
        <div style="font-size:13px; color:var(--text-secondary); margin-bottom:20px;">
          Scegli cosa includere nel documento per <strong>${targetLabel}</strong>.
        </div>
        <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px;">
          ${[
            ['exp-anagrafica','👨‍🏫 Anagrafica docenti (nome, materia, cattedra, debito)'],
            ['exp-rec-subs','📊 Recupero ore supplenze (Debito Iniziale & Permessi)'],
            ['exp-rec-trips','🚌 Recupero uscite didattiche / soggiorni'],
            ['exp-eccedenti','⚡ Ore Eccedenti / Straordinario'],
            ['exp-storico','📋 Storico completo supplenze e recuperi'],
            ['exp-assenze','🚫 Motivi assenze per docente'],
          ].map(([id,label]) => `
            <label style="display:flex; align-items:center; gap:12px; padding:12px 16px; background:var(--bg-secondary); border-radius:8px; cursor:pointer; border:1px solid var(--border);">
              <input type="checkbox" id="${id}" checked style="width:18px; height:18px; cursor:pointer;">
              <span style="font-size:14px;">${label}</span>
            </label>`).join('')}
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" id="exp-sel-all">✅ Seleziona Tutti</button>
          <button class="btn btn-ghost btn-sm" id="exp-sel-none">☐ Deseleziona Tutti</button>
        </div>
      `,
      footer: `<button class="btn btn-ghost" id="exp-cancel">Annulla</button><button class="btn btn-primary" id="exp-go">🖨️ Genera Documento</button>`
    });
    ov.querySelector('#exp-cancel').onclick = () => ov.remove();
    ov.querySelector('#exp-sel-all').onclick = () => ov.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked=true);
    ov.querySelector('#exp-sel-none').onclick = () => ov.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked=false);
    ov.querySelector('#exp-go').onclick = () => {
      const sections = {
        anagrafica: ov.querySelector('#exp-anagrafica')?.checked,
        rec_subs: ov.querySelector('#exp-rec-subs')?.checked,
        rec_trips: ov.querySelector('#exp-rec-trips')?.checked,
        eccedenti: ov.querySelector('#exp-eccedenti')?.checked,
        storico: ov.querySelector('#exp-storico')?.checked,
        assenze: ov.querySelector('#exp-assenze')?.checked,
      };
      ov.remove();
      exportAll(sections);
    };
  }

  async function renderMotiviAssenze(container, state) {
    container.innerHTML = '<div class="loading-overlay"><div class="spinner"></div> Caricamento assenze...</div>';
    try {
      const db = await API.get('/debug/db');
      const filteredIds = new Set(_filtered.map(t => t.id));
      const absences = (db.absences || []).filter(a => filteredIds.has(a.teacher_id) && a.school_year_id == _yearId);

      if (!absences.length) {
        container.innerHTML = '<div class="empty-state">Nessuna assenza registrata per i docenti selezionati.</div>';
        return;
      }

      // Group by teacher
      const byTeacher = {};
      _filtered.forEach(t => { byTeacher[t.id] = { teacher: t, rows: [] }; });
      absences.forEach(a => { if (byTeacher[a.teacher_id]) byTeacher[a.teacher_id].rows.push(a); });

      let html = '';
      Object.values(byTeacher).filter(x => x.rows.length).forEach(({ teacher, rows }) => {
        html += `
          <div class="card mb-16" style="padding:0; overflow:hidden;">
            <div style="padding:10px 16px; background:var(--bg-secondary); border-bottom:1px solid var(--border); display:flex; align-items:center; gap:12px;">
              <span style="font-weight:700;">${escHtml(teacher.name)}</span>
              <span style="color:var(--text-secondary); font-size:12px;">${escHtml(teacher.subject||'')}</span>
              <span class="badge badge-warning" style="margin-left:auto;">🚫 ${rows.length} assenza/e</span>
            </div>
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
              <thead><tr style="background:var(--bg-secondary);">
                <th style="padding:7px 12px;">Data</th><th>Tipo</th><th>Motivo</th><th>Stato</th>
              </tr></thead>
              <tbody>
                ${rows.sort((a,b)=>b.date.localeCompare(a.date)).map(a => `
                  <tr style="border-bottom:1px solid var(--border);">
                    <td style="padding:6px 12px;"><strong>${fmtDate(a.date)}</strong>${a.date_end?` → ${fmtDate(a.date_end)}`:''}</td>
                    <td><span class="badge ${a.type==='full'||a.type==='assenza_giornaliera'?'badge-danger':'badge-info'}">${a.type==='full'||a.type==='assenza_giornaliera'?'Giornaliera':'Permesso Orario'}</span></td>
                    <td>${escHtml(a.reason||'—')}</td>
                    <td><span class="badge ${a.status==='approved'?'badge-success':'badge-warning'}">${a.status==='approved'?'Approvata':'In attesa'}</span></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>`;
      });

      container.innerHTML = html;
    } catch(e) {
      container.innerHTML = '<div class="empty-state">Errore caricamento dati assenze.</div>';
    }
  }

  async function exportAll(sections = {}) {
    APP.toast('Generazione documento completo in corso…', 'info');
    const from = _periodFrom || '2000-01-01';
    const to = _periodTo || '2099-12-31';
    const periodLabel = _periodFrom || _periodTo
      ? `Periodo: ${_periodFrom ? fmtDate(_periodFrom) : 'inizio'} → ${_periodTo ? fmtDate(_periodTo) : 'oggi'}`
      : 'Periodo: intero anno scolastico';

    // Use selected teachers if any, otherwise all filtered
    const targetTeachers = _selectedIds.size > 0
      ? _filtered.filter(t => _selectedIds.has(t.id))
      : _filtered;

    try {
      const history = await API.get(`/substitutions/history?year_id=${_yearId}&from=${from}&to=${to}`);
      const filteredIds = new Set(_filtered.map(t => t.id));

      // ── Build per-teacher section ──
      const byTeacher = {};
      targetTeachers.forEach(t => { byTeacher[t.id] = { teacher: t, subs: [] }; });
      const targetIds = new Set(targetTeachers.map(t => t.id));
      history.forEach(s => {
        if (s.substitute_teacher_id && targetIds.has(s.substitute_teacher_id)) {
          byTeacher[s.substitute_teacher_id]?.subs.push(s);
        }
      });

      const teacherSections = Object.values(byTeacher).map(({ teacher, subs }) => {
        const totalRec = subs.filter(s => s.hours_counted).length;
        const totalEcc = subs.filter(s => !s.hours_counted).length;
        const totalDebt = (teacher.hours_subs || 0) + (teacher.hours_trips || 0);

        const rows = subs.map(s => {
          const isRec = !!s.hours_counted;
          return `<tr>
            <td>${fmtDate(s.date)}</td>
            <td>${s.hour}ª</td>
            <td style="background:${isRec ? '#dbeafe' : '#fef9c3'}; color:${isRec ? '#1d4ed8' : '#92400e'}; padding:2px 6px;">${isRec ? 'Recupero Ore' : 'Eccedente/Straordinario'}</td>
            <td>${s.class_name || '—'}</td>
            <td>${s.accepted ? '✅' : '—'}</td>
          </tr>`;
        }).join('');

        return `
          <div class="teacher-block">
            <div class="teacher-header">
              <span class="tname">${teacher.name}</span>
              <span class="tsubj">${teacher.subject || ''}</span>
              <span class="tbadge blue">Recuperate: ${totalRec}</span>
              <span class="tbadge yellow">Eccedenti: ${totalEcc}</span>
              <span class="tbadge green">Ore residue da recuperare: ${totalDebt}</span>
            </div>
            ${subs.length ? `<table>
              <thead><tr><th>Giorno</th><th>Ora</th><th>Tipo</th><th>Classe</th><th>Firma</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>` : '<p class="empty-note">Nessuna supplenza registrata nel periodo.</p>'}
          </div>`;
      }).join('');

      const win = window.open('', '_blank');
      win.document.write(`<!DOCTYPE html><html><head>
        <meta charset="UTF-8">
        <title>Storico Completo Docenti</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 11px; padding: 20px; color: #0f172a; }
          h1 { font-size: 16px; font-weight: 800; margin-bottom: 4px; }
          .meta { font-size: 11px; color: #64748b; margin-bottom: 20px; }
          .teacher-block { margin-bottom: 24px; page-break-inside: avoid; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
          .teacher-header { display: flex; align-items: center; gap: 12px; padding: 8px 12px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; flex-wrap: wrap; }
          .tname { font-weight: 700; font-size: 13px; }
          .tsubj { color: #64748b; font-size: 11px; flex: 1; }
          .tbadge { padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 600; }
          .tbadge.blue { background: #dbeafe; color: #1d4ed8; }
          .tbadge.yellow { background: #fef9c3; color: #92400e; }
          .tbadge.green { background: #dcfce7; color: #15803d; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #f1f5f9; padding: 5px 8px; text-align: left; border-bottom: 1px solid #cbd5e1; }
          td { padding: 5px 8px; border-bottom: 1px solid #f1f5f9; }
          tr:last-child td { border-bottom: none; }
          .empty-note { padding: 10px 12px; color: #94a3b8; font-size: 11px; }
          @media print { body { padding: 10px; } }
        </style>
      </head><body>
        <h1>📋 Storico Completo — Gestione Docenti</h1>
        <div class="meta">${periodLabel} &nbsp;|&nbsp; ${_filtered.length} docenti</div>
        ${teacherSections || '<p>Nessun dato disponibile.</p>'}
      </body></html>`);
      win.document.close();
      setTimeout(() => win.print(), 500);
    } catch(e) {
      APP.toast('Errore durante la generazione: ' + e.message, 'error');
    }
  }

  async function renderLongTermInside(container) {
    try {
      const [teachers, items] = await Promise.all([
        API.get(`/teachers?year_id=${_yearId}`),
        API.get('/long-term-assignments')
      ]);

      container.innerHTML = `
        <div style="margin-bottom:16px; font-size:12px; border:1px solid var(--border); border-radius:8px; padding:12px; background:var(--bg-primary)">
          <strong>Nuova Nomina:</strong>
          <p style="font-size:10px; color:var(--text-secondary); margin-bottom:10px;">Il supplente erediterà l'orario del titolare per il periodo scelto.</p>
          <div class="grid grid-cols-2 gap-8 mt-8">
            <div class="form-group"><label>Nome Supplente *</label>
              <input type="text" id="lt-sub-name" class="form-control" placeholder="ES: BIANCHI LUIGI">
            </div>
            <div class="form-group"><label>Docente Sostituito *</label>
              <select id="lt-replaced" class="form-control">
                <option value="">-- Seleziona --</option>
                ${teachers.filter(tx=>tx.type!=='long_term').map(t=>`<option value="${t.id}">${escHtml(t.name)}</option>`).join('')}
              </select></div>
          </div>
          <div class="grid grid-cols-2 gap-8">
            <div class="form-group"><label>Dal</label><input type="date" id="lt-from" class="form-control"></div>
            <div class="form-group"><label>Al</label><input type="date" id="lt-to" class="form-control"></div>
          </div>
          <div class="form-group mt-8">
            <label>Copertura Oraria Nomina</label>
            <select id="lt-coverage" class="form-control">
              <option value="full">Intera cattedra (tutte le ore del titolare)</option>
              <option value="partial">Spezzone / Solo ore specifiche</option>
            </select>
          </div>
          <div id="lt-hours-box" style="display:none; margin-top:8px; margin-bottom:12px; padding:10px; background:var(--bg-secondary); border-radius:6px; border:1px solid var(--border);">
            <label style="font-size:11px; text-transform:none; margin-bottom:6px;">Seleziona le ore assegnate (1ª - 8ª):</label>
            <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:6px;">
              ${[1,2,3,4,5,6,7,8].map(h => `
                <label style="display:flex; align-items:center; gap:6px; font-size:11px; cursor:pointer;">
                  <input type="checkbox" class="lt-hour-cb" value="${h+7}"> ${h}ª ora
                </label>
              `).join('')}
            </div>
          </div>
          <button class="btn btn-primary btn-sm" id="lt-add-btn" style="width:100%">Crea Nomina</button>
        </div>

        <strong>Nomine Attive:</strong>
        <div class="table-wrapper" style="max-height:220px; overflow-y:auto; margin-top:8px">
          <table style="font-size:11px">
            <thead><tr><th>Supplente</th><th>Sostituisce</th><th>Periodo</th><th>Copertura</th><th></th></tr></thead>
            <tbody>
              ${items.map(it => {
                const sub = teachers.find(t=>t.id==it.substitute_id);
                const rep = teachers.find(t=>t.id==it.replaced_id);
                const covLabel = (it.hours && it.hours.length)
                  ? it.hours.map(h => (h > 7 ? h - 7 : h) + 'ª').join(', ')
                  : '<span class="badge badge-neutral" style="font-size:10px;">Intera cattedra</span>';
                return `<tr>
                  <td>${escHtml(sub?.name||'?')}</td>
                  <td>${escHtml(rep?.name||'?')}</td>
                  <td>${fmtDate(it.start_date)} - ${fmtDate(it.end_date)}</td>
                  <td>${covLabel}</td>
                  <td><button class="btn btn-ghost btn-sm" onclick="TeachersView.deleteLongTerm('${it.id}', true)">🗑️</button></td>
                </tr>`;
              }).join('')}
              ${items.length===0?'<tr><td colspan="5" style="text-align:center">Nessun supplente nominato</td></tr>':''}
            </tbody>
          </table>
        </div>

      `;

      container.querySelector('#lt-coverage')?.addEventListener('change', (e) => {
        const box = container.querySelector('#lt-hours-box');
        if (box) box.style.display = e.target.value === 'partial' ? 'block' : 'none';
      });

      container.querySelector('#lt-add-btn').onclick = async () => {
        const subName = container.querySelector('#lt-sub-name').value.trim().toUpperCase();
        const replacedId = parseInt(container.querySelector('#lt-replaced').value);
        const startDate = container.querySelector('#lt-from').value;
        const endDate = container.querySelector('#lt-to').value;

        if (!subName || !replacedId || !startDate || !endDate) {
          APP.toast('Compila tutti i campi', 'warning'); return;
        }

        let assignedHours = [];
        if (container.querySelector('#lt-coverage')?.value === 'partial') {
          assignedHours = Array.from(container.querySelectorAll('.lt-hour-cb:checked')).map(cb => parseInt(cb.value));
          if (!assignedHours.length) {
            APP.toast('Seleziona almeno un\'ora per lo spezzone', 'warning');
            return;
          }
        }

        try {
          // 1. Find or Create Teacher
          let sub = teachers.find(t => t.name.toUpperCase() === subName);
          if (!sub) {
            // Confirm creation? For now, auto-create as requested
            sub = await API.post('/teachers', {
              name: subName,
              type: 'long_term',
              school_year_id: _yearId,
              is_available: true
            });
            APP.toast(`Nuovo supplente ${subName} creato in anagrafica`, 'info');
          }

          // 2. Create Assignment
          await API.post('/long-term-assignments', {
            substitute_id: sub.id,
            replaced_id: replacedId,
            start_date: startDate,
            end_date: endDate,
            hours: assignedHours
          });

          APP.toast('Nomina creata correttamente', 'success');
          renderLongTermInside(container);
        } catch(e) { APP.toast(e.message, 'error'); }
      };

    } catch(e) { container.innerHTML = `<div class="text-danger">Errore: ${e.message}</div>`; }
  }

  async function deleteLongTerm(id, refresh = false) {
    if (confirm('Confermi la rimozione?')) {
      await API.delete(`/long-term-assignments/${id}`);
      APP.toast('Nomina rimossa', 'success');
      if (refresh) {
        const cont = document.getElementById('m-long-term-container');
        if (cont) renderLongTermInside(cont);
      }
    }
  }

  function downloadDebtTemplate() {
    const data = [
      ['COGNOMI', 'NOMI', 'ORE_DA_RECUPERARE'],
      ['ROSSI BIANCHI', 'MARIA GRAZIA', 14],
      ['VERDI', 'GIUSEPPE', 8]
    ];
    try {
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [{ wch: 22 }, { wch: 20 }, { wch: 20 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template Debiti");
      XLSX.writeFile(wb, "template_debiti_orari.xlsx");
      APP.toast('Template Debiti Orari scaricato', 'success');
    } catch(e) {
      console.error(e);
      const csv = data.map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'template_debiti_orari.csv';
      a.click();
    }
  }

  function downloadTeacherTemplate() {
    const data = [
      ['MATERIA', 'COGNOMI', 'NOMI', 'EMAIL'],
      ['LETTERE', 'ROSSI BIANCHI', 'MARIA GRAZIA', 'mariagrazia.rossibianchi@padregemelli.net'],
      ['MATEMATICA', 'VERDI', 'GIUSEPPE', 'giuseppe.verdi@padregemelli.net']
    ];
    try {
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws['!cols'] = [{ wch: 18 }, { wch: 22 }, { wch: 20 }, { wch: 35 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template Docenti");
      XLSX.writeFile(wb, "template_anagrafica_docenti.xlsx");
      APP.toast('Template Anagrafica Docenti scaricato', 'success');
    } catch(e) {
      console.error(e);
      const csv = data.map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'template_anagrafica_docenti.csv';
      a.click();
    }
  }

  return { render, openModal, openHistoryPopup, exportAll, openExportModal, openImportModal, downloadDebtTemplate, downloadTeacherTemplate, adjustHours, toggleAvail, deleteTeacher, renderRecuperi, exportSection, handleImport, deleteLongTerm };
})();
