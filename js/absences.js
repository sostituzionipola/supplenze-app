// ══════════════════════════════════
// ABSENCES VIEW — Assenze & Uscite Didattiche
// ══════════════════════════════════
var AbsencesView = (() => {
  let _date, _yearId, _teachers=[], _classes=[], _activeTab='daily';

  async function render(container, state) {
    _yearId = state.yearId;
    _date = todayISO();
    if (!_yearId) { container.innerHTML='<div class="empty-state"><h3>Seleziona un anno scolastico</h3></div>'; return; }

    const allAbsences = await API.get(`/absences?year_id=${_yearId}`);
    const unregCount = allAbsences.filter(a => a.type === 'da_regolarizzare' || a.is_regularized === false).length;

    container.innerHTML = `
      <div class="page-header"><div class="page-title">🚫 Assenze &amp; Uscite Didattiche</div><div class="page-subtitle">Gestisci le assenze, le uscite e regolarizza le assenze rapide</div></div>
      
      <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
        <button class="btn ${_activeTab==='daily'?'btn-primary':'btn-secondary'} btn-sm" id="tab-btn-daily">📅 Assenze del Giorno</button>
        <button class="btn ${_activeTab==='unreg'?'btn-primary':'btn-secondary'} btn-sm" id="tab-btn-unreg" style="position:relative;">
          ⚠️ Da Regolarizzare ${unregCount > 0 ? `<span class="badge badge-warning" style="margin-left:6px; background:#fef3c7; color:#92400e; font-weight:700;">${unregCount}</span>` : ''}
        </button>
      </div>

      <div id="abs-main-view">
        <div class="loading-overlay"><div class="spinner"></div> Caricamento...</div>
      </div>`;

    try {
      [_teachers, _classes] = await Promise.all([
        API.get(`/teachers?year_id=${_yearId}`),
        API.get(`/settings/classes?year_id=${_yearId}`)
      ]);
    } catch(e) { APP.toast(e.message,'error'); }

    container.querySelector('#tab-btn-daily').onclick = () => {
      _activeTab = 'daily';
      render(container, state);
    };
    container.querySelector('#tab-btn-unreg').onclick = () => {
      _activeTab = 'unreg';
      render(container, state);
    };

    if (_activeTab === 'daily') {
      renderDailyView(container);
    } else {
      renderUnregularizedView(container);
    }
  }

  async function renderDailyView(container) {
    const mainView = container.querySelector('#abs-main-view');
    if (!mainView) return;

    mainView.innerHTML = `
      <div class="toolbar">
        <div class="toolbar-left">
          <div class="btn-group" style="margin-right:12px">
            <button class="btn btn-sm btn-ghost" id="abs-prev-day" title="Giorno precedente">◀</button>
            <button class="btn btn-sm btn-ghost" id="abs-next-day" title="Giorno successivo">▶</button>
          </div>
          <input type="date" class="date-input" id="abs-date" value="${_date}"/>
          <span id="abs-day-label" style="color:var(--text-secondary);font-size:13px"></span>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-danger" id="add-absence-btn">+ Aggiungi Assenza</button>
          <button class="btn btn-primary" id="add-trip-btn">🚌 Aggiungi Uscita</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px" id="abs-content">
        <div class="loading-overlay"><div class="spinner"></div></div>
      </div>
    `;

    mainView.querySelector('#abs-date').onchange = e => { _date=e.target.value; updateDayLabel(); loadData(); };
    mainView.querySelector('#abs-prev-day').onclick = () => {
      const d = new Date(_date + 'T12:00:00');
      d.setDate(d.getDate() - 1);
      _date = d.toISOString().slice(0, 10);
      mainView.querySelector('#abs-date').value = _date;
      updateDayLabel(); loadData();
    };
    mainView.querySelector('#abs-next-day').onclick = () => {
      const d = new Date(_date + 'T12:00:00');
      d.setDate(d.getDate() + 1);
      _date = d.toISOString().slice(0, 10);
      mainView.querySelector('#abs-date').value = _date;
      updateDayLabel(); loadData();
    };
    mainView.querySelector('#add-absence-btn').onclick = () => openAbsenceModal();
    mainView.querySelector('#add-trip-btn').onclick = () => openTripModal();
    updateDayLabel();
    await loadData();
  }

  async function renderUnregularizedView(container) {
    const mainView = container.querySelector('#abs-main-view');
    if (!mainView) return;

    try {
      const absences = await API.get(`/absences?year_id=${_yearId}`);
      const unreg = absences.filter(a => a.type === 'da_regolarizzare' || a.is_regularized === false);

      if (!unreg.length) {
        mainView.innerHTML = `
          <div class="empty-state" style="padding:48px;">
            <div class="icon" style="font-size:48px; margin-bottom:12px;">🎉</div>
            <h3 style="margin-bottom:8px;">Tutto Regolarizzato!</h3>
            <p style="color:var(--text-secondary); max-width:400px; margin:0 auto;">Non ci sono assenze rapide in sospeso da regolarizzare per l'anno scolastico attivo.</p>
          </div>
        `;
        return;
      }

      // Raggruppamento per docente e giorni consecutivi
      const groupedByTeacher = {};
      unreg.forEach(a => {
        if (!groupedByTeacher[a.teacher_id]) groupedByTeacher[a.teacher_id] = [];
        groupedByTeacher[a.teacher_id].push(a);
      });

      const cardGroups = [];
      Object.entries(groupedByTeacher).forEach(([tid, list]) => {
        list.sort((a,b) => a.date.localeCompare(b.date));
        
        let currentGroup = [list[0]];
        for (let i = 1; i < list.length; i++) {
          const prev = new Date(list[i-1].date + 'T12:00:00');
          const curr = new Date(list[i].date + 'T12:00:00');
          const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));

          // Considera contigui se diff è 1 o se è a cavallo di weekend (es. venerdì-lunedì = 3 giorni)
          if (diffDays === 1 || (diffDays <= 3 && (prev.getDay() === 5 || prev.getDay() === 6))) {
            currentGroup.push(list[i]);
          } else {
            cardGroups.push({ teacher_id: tid, teacher_name: currentGroup[0].teacher_name, items: currentGroup });
            currentGroup = [list[i]];
          }
        }
        if (currentGroup.length) {
          cardGroups.push({ teacher_id: tid, teacher_name: currentGroup[0].teacher_name, items: currentGroup });
        }
      });

      mainView.innerHTML = `
        <div style="background:var(--bg-secondary); border:1px solid var(--border); border-radius:12px; padding:16px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <strong style="font-size:14px;">Elenco Assenze da Regolarizzare (${unreg.length} assenze totali in ${cardGroups.length} gruppi)</strong>
            <div style="font-size:12px; color:var(--text-secondary);">Seleziona una o più voci per regolarizzarle contemporaneamente con causale formale.</div>
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            <label style="display:flex; align-items:center; gap:6px; font-size:12px; cursor:pointer; font-weight:600;">
              <input type="checkbox" id="unreg-select-all" style="width:16px; height:16px;"> Seleziona Tutte
            </label>
            <button class="btn btn-primary btn-sm" id="unreg-bulk-btn" disabled>✏️ Regolarizza Selezionate (0)</button>
          </div>
        </div>

        <div class="unreg-list" style="display:flex; flex-direction:column; gap:10px;">
          ${cardGroups.map((g, gIdx) => {
            const isRange = g.items.length > 1;
            const startDate = g.items[0].date;
            const endDate = g.items[g.items.length - 1].date;
            const itemIds = g.items.map(i => i.id).join(',');
            const totalHours = g.items.reduce((acc, curr) => acc + (curr.hours?.length || 1), 0);

            return `
              <div class="card" style="padding:14px 18px; display:flex; justify-content:space-between; align-items:center; background:var(--bg-primary); border-left:4px solid #f59e0b; border-radius:12px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                <div style="display:flex; align-items:center; gap:14px;">
                  <input type="checkbox" class="unreg-check" data-ids="${itemIds}" style="width:18px; height:18px; cursor:pointer;">
                  <div>
                    <div style="font-weight:700; font-size:14px; display:flex; align-items:center; gap:8px;">
                      👤 ${escHtml(g.teacher_name)}
                      <span class="badge badge-warning" style="font-size:10px; background:#fef3c7; color:#92400e; border:1px solid #fde68a;">🟡 Da Regolarizzare</span>
                    </div>
                    <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">
                      📅 <strong>${isRange ? `${fmtDate(startDate)} → ${fmtDate(endDate)} (${g.items.length} gg consecutivi)` : fmtDate(startDate)}</strong>
                      • <span style="color:var(--text-primary); font-weight:600;">${g.items[0].hours?.length ? `Ore: ${g.items[0].hours.map(h=>h+'ª').join(', ')}` : 'Intera Giornata'}</span>
                      ${g.items[0].reason ? ` • <em style="color:var(--text-muted);">${escHtml(g.items[0].reason)}</em>` : ''}
                    </div>
                  </div>
                </div>
                <div>
                  <button class="btn btn-secondary btn-sm" onclick="AbsencesView.openBatchRegularizeModal('${itemIds}', '${escHtml(g.teacher_name)}', '${isRange ? `${fmtDate(startDate)} - ${fmtDate(endDate)}` : fmtDate(startDate)}')">✏️ Regolarizza</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      // Gestione selezione checkbox
      const bulkBtn = mainView.querySelector('#unreg-bulk-btn');
      const selectAll = mainView.querySelector('#unreg-select-all');
      const checks = mainView.querySelectorAll('.unreg-check');

      const updateBulkState = () => {
        const selected = Array.from(checks).filter(c => c.checked);
        let totalCount = 0;
        selected.forEach(c => { totalCount += c.dataset.ids.split(',').length; });
        bulkBtn.disabled = selected.length === 0;
        bulkBtn.textContent = `✏️ Regolarizza Selezionate (${totalCount})`;
      };

      checks.forEach(c => c.onchange = updateBulkState);
      selectAll.onchange = (e) => {
        checks.forEach(c => c.checked = e.target.checked);
        updateBulkState();
      };

      bulkBtn.onclick = () => {
        const selected = Array.from(checks).filter(c => c.checked);
        const allIds = selected.flatMap(c => c.dataset.ids.split(',')).filter(Boolean);
        if (allIds.length === 0) return;
        openBatchRegularizeModal(allIds.join(','), `${selected.length} gruppi`, `${allIds.length} assenze`);
      };

    } catch(e) {
      mainView.innerHTML = `<div class="empty-state">Errore: ${e.message}</div>`;
    }
  }

  function openBatchRegularizeModal(idsStr, teacherLabel, datesLabel) {
    const ids = idsStr.split(',').filter(Boolean);
    if (!ids.length) return;

    const ov = APP.modal({
      title: '✏️ Regolarizzazione Massiva Assenze',
      body: `
        <div style="padding:10px 14px; background:rgba(99,102,241,0.08); border-radius:10px; border-left:4px solid var(--accent); font-size:12px; color:var(--text-secondary); margin-bottom:16px;">
          Stai per regolarizzare <strong>${ids.length} record di assenza</strong> per: <strong>${escHtml(teacherLabel)}</strong> (${datesLabel}).
        </div>
        <div class="form-group">
          <label style="font-weight:600; font-size:12px;">Tipo Assenza Definitivo *</label>
          <select id="bulk-abs-type" class="form-control">
            <option value="malattia">🤒 Malattia (Intera giornata)</option>
            <option value="altro_permesso">📄 Altro Permesso (Max 3gg/anno - non rec.)</option>
            <option value="permesso_orario">⏳ Permesso Breve (Singole ore da recuperare)</option>
            <option value="formazione">📚 Formazione / Aggiornamento</option>
            <option value="lutto">🕊️ Permesso per Lutto</option>
            <option value="motivi_personali">👨‍👩‍👧 Motivi Personali / Familiari</option>
            <option value="permessi_sindacali">📢 Permessi Sindacali</option>
            <option value="assemblea">👥 Assemblea</option>
            <option value="concorsi_esami">📝 Concorsi / Esami</option>
            <option value="matrimonio">💍 Matrimonio</option>
          </select>
        </div>
        <div class="form-group">
          <label style="font-weight:600; font-size:12px;">Note / Specifiche (facoltativo)</label>
          <input type="text" id="bulk-abs-notes" class="form-control" placeholder="Es. Comunicazione interna, visita specialistica...">
        </div>
      `,
      footer: `
        <button class="btn btn-ghost" id="bulk-cancel">Annulla</button>
        <button class="btn btn-primary" id="bulk-save">✅ Salva e Regolarizza</button>
      `,
      size: 'modal-md'
    });

    ov.querySelector('#bulk-cancel').onclick = () => ov.remove();
    ov.querySelector('#bulk-save').onclick = async () => {
      const type = ov.querySelector('#bulk-abs-type').value;
      const notes = ov.querySelector('#bulk-abs-notes').value.trim();
      try {
        await API.post('/absences/batch-update', {
          ids,
          updates: { type, reason: notes, is_regularized: true }
        });
        ov.remove();
        APP.toast(`Regolarizzate ${ids.length} assenze con successo!`, 'success');
        render(document.getElementById('content-area'), APP.getState());
      } catch(err) { APP.toast(err.message, 'error'); }
    };
  }

  function renderAbsences(list) {
    if (!list.length) return '<div class="empty-state" style="padding:24px"><div class="icon">✅</div><div style="font-weight:600">Nessuna assenza</div><div style="font-size:12px;color:var(--text-secondary)">Tutti i docenti sono presenti</div></div>';
    return `<div class="abs-list" style="padding:12px; display:flex; flex-direction:column; gap:8px">
      ${list.map(a => `
        <div class="abs-item" style="display:flex; align-items:center; justify-content:space-between; padding:12px; border-radius:10px; background:var(--bg-secondary); border:1px solid var(--border); ${a.status === 'pending' ? 'border-left:4px solid var(--warning-text)' : ''}">
          <div style="flex:1">
            <div style="font-weight:700; font-size:14px; margin-bottom:2px">${escHtml(a.teacher_name)}</div>
            <div style="font-size:12px; color:var(--text-secondary); display:flex; align-items:center; gap:6px">
              ${a.reason ? `<span title="Motivo">${escHtml(a.reason)}</span>` : '<span style="font-style:italic">Nessun motivo specificato</span>'}
              <span class="badge ${a.status === 'approved' ? 'badge-success' : 'badge-warning'}" style="font-size:10px; padding:2px 6px">
                ${a.status === 'approved' ? 'Approvata' : 'In attesa'}
              </span>
            </div>
          </div>
          <div style="display:flex; gap:6px">
            <button class="btn btn-ghost btn-sm" onclick="APP.printAbsence(${JSON.stringify(a).replace(/"/g, '&quot;')})" style="width:32px; height:32px; padding:0; border-radius:8px" title="Stampa">🖨️</button>
            ${a.status === 'pending' ? `<button class="btn btn-success btn-sm" onclick="AbsencesView.approveAbsence(${a.id})" style="width:32px; height:32px; padding:0; border-radius:8px">✅</button>` : ''}
            <button class="btn btn-ghost btn-sm text-danger" onclick="AbsencesView.deleteAbsence(${a.id})" style="width:32px; height:32px; padding:0; border-radius:8px">🗑️</button>
          </div>
        </div>`).join('')}
    </div>`;
  }

  function renderTrips(list) {
    if (!list.length) return '<div class="empty-state" style="padding:24px"><div class="icon">🏘️</div><div style="font-weight:600">Nessuna uscita</div><div style="font-size:12px;color:var(--text-secondary)">Non ci sono classi fuori sede</div></div>';
    return `<div class="trip-list" style="padding:12px; display:flex; flex-direction:column; gap:10px">
      ${list.map(t => `
        <div class="trip-card" style="background:var(--bg-secondary); border:1px solid var(--border); border-radius:12px; padding:12px; border-left:4px solid var(--accent)">
          <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:8px">
            <div style="font-weight:800; font-size:14px; color:var(--accent)">🚌 Classi: ${t.classes.map(c=>c.name).join(', ')}</div>
            <div style="display:flex; gap:4px">
              <button class="btn btn-ghost btn-sm" onclick="AbsencesView.openTripModal(${t.id})" style="width:28px; height:28px; padding:0">✏️</button>
              <button class="btn btn-ghost btn-sm text-danger" onclick="AbsencesView.deleteTrip(${t.id})" style="width:28px; height:28px; padding:0">🗑️</button>
            </div>
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px">
            <div style="font-size:11px; color:var(--text-secondary)">Docente: <strong style="color:var(--text-primary)">${escHtml(t.lead_teacher_name)}</strong></div>
            <div style="font-size:11px; color:var(--text-secondary)">Ore: <strong style="color:var(--text-primary)">${t.hours.map(h => h + 'ª').join(', ')}</strong></div>
            ${t.companions.length ? `<div style="font-size:11px; color:var(--text-secondary); grid-column:span 2">Accompagnatori: <strong style="color:var(--text-primary)">${t.companions.map(c=>c.name.split(' ')[0]).join(', ')}</strong></div>` : ''}
          </div>
          ${t.notes ? `<div style="font-size:11px; color:var(--text-secondary); margin-top:6px; padding-top:6px; border-top:1px dashed var(--border)">Nota: ${escHtml(t.notes)}</div>` : ''}
        </div>`).join('')}
    </div>`;
  }

  function openAbsenceModal() {
    const ov = APP.modal({
      title: 'Registra Assenza',
      body: `
        <div class="form-group"><label>Docente *</label>
          <select id="ab-teacher" placeholder="Cerca docente..."><option value="">– Seleziona –</option>${_teachers.map(t=>`<option value="${t.id}">${escHtml(t.name)}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Tipo Assenza *</label>
          <select id="ab-type" class="form-control">
            <option value="malattia">🤒 Malattia (Intera giornata)</option>
            <option value="altro_permesso">📄 Altro Permesso (Max 3gg/anno - non rec.)</option>
            <option value="permesso_orario">⏳ Permessi Brevi (Singole ore da rec.)</option>
            <option value="ferie">🏝️ Ferie</option>
            <option value="formazione">📚 Formazione</option>
            <option value="permessi_sindacali">📢 Permessi Sindacali</option>
            <option value="assemblea">👥 Assemblea</option>
            <option value="concorsi_esami">📝 Concorsi / Esami</option>
            <option value="matrimonio">💍 Matrimonio</option>
            <option value="lutto">🕊️ Permesso per Lutto (3gg per evento)</option>
          </select>
        </div>
        <div class="form-group"><label>Motivo</label><input type="text" id="ab-reason" placeholder="Dettagli aggiuntivi..."/></div>`,

      footer: `<button class="btn btn-secondary" id="ab-cancel">Annulla</button><button class="btn btn-danger" id="ab-save">Registra Assenza</button>`
    });
    
    // TomSelect initialization (Enabled create: true to allow typing names)
    const tsTeacher = new TomSelect(ov.querySelector('#ab-teacher'), { 
      plugins: ['remove_button'], 
      create: true,
      createFilter: (input) => input.length >= 2,
      render: {
        option_create: (data, escape) => `<div class="create">➕ Aggiungi nuovo docente: <strong>${escape(data.input)}</strong></div>`
      }
    });

    ov.querySelector('#ab-cancel').onclick = () => ov.remove();
    ov.querySelector('#ab-save').onclick = async () => {
      let tid = tsTeacher.getValue();
      if (!tid) { APP.toast('Seleziona o scrivi un docente','error'); return; }

      // Se tid non è un numero, è un nuovo nome: creiamo il docente al volo
      if (isNaN(parseInt(tid))) {
        try {
          const newT = await API.post('/teachers', { 
            name: tid.toUpperCase(),
            subject: 'DA DEFINIRE',
            school_year_id: _yearId,
            is_available: true
          });
          tid = newT.id;
          _teachers.push(newT); // Aggiorna lista locale
        } catch(e) { APP.toast('Errore creazione docente: ' + e.message, 'error'); return; }
      }

      try {
        await API.post('/absences', { 
          date: _date, 
          teacher_id: parseInt(tid), 
          type: ov.querySelector('#ab-type').value,
          reason: ov.querySelector('#ab-reason').value, 
          school_year_id: _yearId 
        });
        ov.remove(); loadData(); APP.toast('Assenza registrata','success');
      } catch(e) { APP.toast(e.message,'error'); }
    };
  }

  async function deleteAbsence(id) {
    if (!await APP.confirm('Eliminare questa assenza?')) return;
    try { await API.del(`/absences/${id}`); loadData(); APP.toast('Assenza eliminata','success'); }
    catch(e) { APP.toast(e.message,'error'); }
  }

  async function approveAbsence(id) {
    try {
      await API.patch(`/absences/${id}/status`, { status: 'approved' });
      loadData();
      APP.toast('Assenza approvata','success');
    } catch(e) { APP.toast(e.message,'error'); }
  }

  function openTripModal(tripId) {
    const t = tripId ? null : null; // Logic to load trip if editing skipped for brevity or should be implemented
    
    const ov = APP.modal({
      title: tripId ? 'Modifica Uscita Didattica' : '🚌 Nuova Uscita Didattica',
      size : 'modal-lg',
      body : `
        <div class="form-group"><label>Docente Referente *</label>
          <select id="tr-lead" placeholder="Cerca referente..."><option value="">– Seleziona –</option>${_teachers.map(t=>`<option value="${t.id}">${escHtml(t.name)}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Classi coinvolte *</label>
          <select id="tr-classes" multiple placeholder="Seleziona classi...">${_classes.map(c=>`<option value="${c.id}">${escHtml(c.name)}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Ore coinvolte *</label>
          <div id="tr-hours-wrap" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">
            ${[8,9,10,11,12,13,14,15].map(h=>`
              <label class="hour-chip" style="display:flex;align-items:center;gap:6px;cursor:pointer;background:var(--bg-secondary);padding:6px 10px;border-radius:8px;border:1px solid var(--border);font-size:12px;font-weight:600">
                <input type="checkbox" value="${h}" style="width:auto; cursor:pointer"/> ${h-7}ª ora
              </label>`).join('')}
          </div>
        </div>
        <div class="form-group"><label>Docenti Accompagnatori</label>
          <select id="tr-companions" multiple placeholder="Cerca accompagnatori...">${_teachers.map(t=>`<option value="${t.id}">${escHtml(t.name)}</option>`).join('')}</select>
        </div>
        <div class="form-group"><label>Note</label><textarea id="tr-notes" placeholder="Dettagli dell'uscita..."></textarea></div>`,
      footer: `<button class="btn btn-secondary" id="tr-cancel">Annulla</button><button class="btn btn-primary" id="tr-save">Salva Uscita</button>`
    });

    const tsConfig = {
      plugins: ['remove_button'],
      create: true,
      createFilter: (input) => input.length >= 2,
      render: {
        option_create: (data, escape) => `<div class="create">➕ Aggiungi nuovo docente: <strong>${escape(data.input)}</strong></div>`
      }
    };

    const tsLead = new TomSelect(ov.querySelector('#tr-lead'), tsConfig);
    const tsClasses = new TomSelect(ov.querySelector('#tr-classes'), { plugins: ['remove_button'], create: false });
    const tsComp = new TomSelect(ov.querySelector('#tr-companions'), tsConfig);

    // If editing, populate (simplified)
    if (tripId) {
       // Note: in a real app, we'd fetch the trip before opening or pass it. 
       // For now, I'll assume trip data is available if needed.
    }

    ov.querySelector('#tr-save').onclick = async () => {
      let leadId = tsLead.getValue();
      const classIds = tsClasses.getValue().map(id => parseInt(id));
      const hours = [...ov.querySelectorAll('#tr-hours-wrap input:checked')].map(i=>parseInt(i.value));
      const companionIds = tsComp.getValue();
      const notes = ov.querySelector('#tr-notes').value;

      if (!leadId||!classIds.length||!hours.length) { APP.toast('Compila tutti i campi obbligatori','error'); return; }

      // Helper per creare docenti se sono stringhe (nomi digitati)
      const ensureTeacher = async (val) => {
        if (isNaN(parseInt(val))) {
          const newT = await API.post('/teachers', { name: val.toUpperCase(), subject: 'DA DEFINIRE', school_year_id: _yearId, is_available: true });
          _teachers.push(newT);
          return newT.id;
        }
        return parseInt(val);
      };

      try {
        const finalLeadId = await ensureTeacher(leadId);
        const finalCompIds = await Promise.all(companionIds.map(id => ensureTeacher(id)));

        const payload = { 
          date: _date, 
          lead_teacher_id: finalLeadId, 
          class_ids: classIds, 
          hours, 
          companion_teacher_ids: finalCompIds, 
          notes, 
          school_year_id: _yearId 
        };

        if (tripId) await API.put(`/trips/${tripId}`, payload); 
        else await API.post('/trips', payload);

        ov.remove(); loadData(); APP.toast('Uscita salvata','success');
      } catch(e) { APP.toast(e.message,'error'); }
    };
  }

  async function deleteTrip(id) {
    if (!await APP.confirm('Eliminare questa uscita didattica?')) return;
    try { await API.del(`/trips/${id}`); loadData(); APP.toast('Uscita eliminata','success'); }
    catch(e) { APP.toast(e.message,'error'); }
  }

  return { render, openAbsenceModal, deleteAbsence, approveAbsence, openTripModal, deleteTrip };
})();
