/**
 * OPERATIONAL_REGISTRY.JS
 * Unified view with columnar layout: Ora, Classe, Assente, and categorized substitutes.
 * Structure: Fixed 5 rows per hour (more if needed).
 */
var OperationalRegistryView = (() => {
  function getDefaultDate() {
    const d = new Date();
    if (d.getDay() === 0) d.setDate(d.getDate() + 1); // Domenica -> Lunedì
    return d.toISOString().slice(0, 10);
  }

  let _currentDate = getDefaultDate();
  let _isWeekly = false, _state = null;
  let activeLT = [];

  async function render(container, state) {
    _state = state;
    const pre = localStorage.getItem('registry_preselected_date');
    if (pre) {
      _currentDate = pre;
      localStorage.removeItem('registry_preselected_date');
    }

    if (!state.yearId) {
      container.innerHTML = `
        <div class="empty-state" style="padding:40px">
          <div class="icon" style="font-size:48px; margin-bottom:16px;">📋</div>
          <h3 style="margin-bottom:8px;">Registro non disponibile</h3>
          <p style="color:var(--text-secondary); max-width:400px; margin:0 auto 20px;">
            Per caricare il registro operativo, seleziona l'<strong>Anno Scolastico</strong> attivo dal selettore in alto.
          </p>
          <div class="attention-hint" style="font-size:12px; color:var(--accent); font-weight:600;">
            ⬅️ Scegli Anno qui
          </div>
        </div>`;
      return;
    }

    // Teachers can only VIEW the registry (no edit controls)
    const isReadOnly = state.user?.role === 'teacher';

    container.innerHTML = `
      <div class="page-header registry-header-sticky" style="position: sticky; top: -16px; z-index: 100; background: var(--bg-primary); padding-top: 16px; padding-bottom:12px; border-bottom: 1px solid var(--border); margin-top: -24px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px">
          <div class="page-title" style="font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">📋 Registro Operativo${isReadOnly ? ' <span style="font-size:12px; font-weight:400; color:var(--accent); margin-left:8px;">(sola lettura)</span>' : ''}</div>
          
          <div class="registry-toolbar" style="display: flex; gap: 8px; align-items: center;">
            <!-- Date Selector Compact -->
            <div class="date-navigator" style="background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 12px; padding: 2px; display: flex; align-items: center; gap: 2px;">
              <div class="nav-btn" id="reg-prev-day" style="width:28px; height:28px; background:transparent; border:none; color:var(--text-primary); cursor:pointer">◀</div>
              <div style="padding: 0 4px; display: flex; flex-direction: column; align-items: center; min-width:70px;">
                <input type="date" id="reg-date-selector" value="${_currentDate}" style="border:none; background:transparent; font-weight:700; font-family:inherit; padding:0; margin:0; cursor:pointer; color:var(--text-primary); outline:none; font-size:12px; text-align:center; width:90px;"/>
              </div>
              <div class="nav-btn" id="reg-next-day" style="width:28px; height:28px; background:transparent; border:none; color:var(--text-primary); cursor:pointer">▶</div>
            </div>

            ${!isReadOnly ? `
            <!-- Admin Primary Actions (Desktop & Mobile) -->
            <button class="btn btn-secondary btn-sm" id="reg-email-all-out" style="border-radius:10px; height:34px; padding:0 12px">🔔 <span class="hide-mobile">Notifica Docenti</span></button>
            <button class="btn btn-primary btn-sm" id="reg-add-absence" style="border-radius:10px; height:34px; padding:0 12px"><span>+</span> <span class="hide-mobile">Nuova Sostituzione</span></button>
            
            <!-- More Actions Dropdown -->
            <div class="more-actions-wrapper">
              <button class="btn btn-secondary btn-sm" id="reg-more-btn" style="width:34px; height:34px; padding:0; font-size:20px; border-radius:10px;">⋮</button>
              <div class="dropdown-menu" id="reg-more-menu" style="right:0; top:42px;">
                <button class="dropdown-item" id="reg-print-btn-drop">🖨️ Stampa Registro</button>
                <button class="dropdown-item" id="reg-share-btn-drop">🖼️ Esporta Immagine</button>
                <button class="dropdown-item" id="reg-excel-btn-drop">📊 Esporta Excel</button>
                <div class="dropdown-divider"></div>
                <button class="dropdown-item text-danger" id="reg-del-absence-tool" style="color:var(--danger-text)">❌ Elimina Assenza...</button>
                <button class="dropdown-item text-danger" id="reg-clear-all" style="color:var(--danger-text)">🗑️ Svuota Tutto</button>
              </div>
            </div>
            ` : `
            <button class="btn btn-secondary btn-sm" id="reg-print-btn" style="border-radius:10px; height:34px;">🖨️ <span class="hide-mobile">Stampa</span></button>
            `}
          </div>
        </div>
      </div>
      <div id="reg-stats-bar" style="margin-top:16px;"></div>
      <div id="reg-table-container" style="margin-top:16px">
        <div class="loading-overlay"><div class="spinner"></div> Caricamento registro operativo...</div>
      </div>
    `;

    // Navigation logic
    const updateHeaderDate = (newDate) => {
      _currentDate = newDate;
      const selector = container.querySelector('#reg-date-selector');
      if (selector) selector.value = _currentDate;
      loadAndRender(container, state);
    };

    container.querySelector('#reg-prev-day').onclick = () => {
      const d = new Date(_currentDate + 'T12:00:00');
      d.setDate(d.getDate() - 1);
      updateHeaderDate(d.toISOString().slice(0, 10));
    };
    container.querySelector('#reg-next-day').onclick = () => {
      const d = new Date(_currentDate + 'T12:00:00');
      d.setDate(d.getDate() + 1);
      updateHeaderDate(d.toISOString().slice(0, 10));
    };
    container.querySelector('#reg-date-selector').onchange = (e) => {
      _currentDate = e.target.value;
      loadAndRender(container, state);
    };

    // Wire buttons (only if not read-only)
    container.querySelector('#reg-print-btn')?.addEventListener('click', () => window.print());
    container.querySelector('#reg-print-btn-drop')?.addEventListener('click', () => { window.print(); container.querySelector('#reg-more-menu').classList.remove('show'); });

    if (!isReadOnly) {
      // Toggle More Actions
      const moreBtn = container.querySelector('#reg-more-btn');
      const moreMenu = container.querySelector('#reg-more-menu');
      moreBtn.onclick = (e) => {
        e.stopPropagation();
        moreMenu.classList.toggle('show');
      };
      document.addEventListener('click', () => moreMenu.classList.remove('show'), { once: false });

      container.querySelector('#reg-add-absence')?.addEventListener('click', () => showAddAbsenceModal(state, () => loadAndRender(container, state)));
      container.querySelector('#reg-share-btn-drop')?.addEventListener('click', () => { shareRegistry(container); moreMenu.classList.remove('show'); });
      container.querySelector('#reg-excel-btn-drop')?.addEventListener('click', () => { exportToExcel(container); moreMenu.classList.remove('show'); });
      container.querySelector('#reg-email-all')?.addEventListener('click', () => { emailAll(state); moreMenu.classList.remove('show'); });
      container.querySelector('#reg-email-all-out')?.addEventListener('click', () => { emailAll(state); });
      container.querySelector('#reg-del-absence-tool')?.addEventListener('click', () => { openDeleteAbsenceModal(state, () => loadAndRender(container, state)); moreMenu.classList.remove('show'); });
      container.querySelector('#reg-clear-all')?.addEventListener('click', async () => {
        moreMenu.classList.remove('show');
        if (await APP.confirm(`Sei sicuro di voler svuotare TUTTO il registro per il giorno ${fmtDate(_currentDate)}? Questa azione non è reversibile.`)) {
          await API.delete(`/substitutions/daily?date=${_currentDate}&year_id=${state.yearId}`);
          APP.toast('Registro svuotato', 'success');
          loadAndRender(container, state);
        }
      });
    }

    loadAndRender(container, state, isReadOnly);
  }

  async function loadAndRender(container, state, isReadOnly = false) {
    const target = container.querySelector('#reg-table-container');
    if (!target) return;
    
    let dates = [_currentDate];
    // subtitle is gone as requested

    try {
      // Fetch all data needed for all selected dates
      const allData = await Promise.all(dates.map(d => API.get(`/substitutions/daily?date=${d}&year_id=${state.yearId}`)));
      const ltData = await API.get('/long-term-assignments');
      activeLT = (ltData || []).filter(lt => _currentDate >= lt.start_date && _currentDate <= lt.end_date);
      const hours = [8, 9, 10, 11, 12, 13, 14, 15]; // Use real hour numbers to match Engine

      // ── Stats bar ──
      const daily = allData[0];
      const allTeachers = await API.get(`/teachers?year_id=${state.yearId}`);
      const absentTeacherIds = new Set((daily.absences || []).map(a => a.teacher_id));
      const presentCount = allTeachers.filter(t => !absentTeacherIds.has(t.id)).length;
      const absentCount = absentTeacherIds.size;
      const slots = daily.slots || [];
      const isCovered = s => s.existing_substitutions?.some(sub => sub.substitute_teacher_id && sub.status !== 'rejected');
      const uncovered = slots.filter(s => !isCovered(s)).length;
      const covered = slots.filter(s => isCovered(s)).length;

      const statsBar = container.querySelector('#reg-stats-bar');
      if (statsBar) {
        const stats = await API.get(`/teachers/suggestions/stats?teacher_id=${allTeachers[0]?.id}&year_id=${state.yearId}`);
        statsBar.innerHTML = `
          <div class="stats-grid" style="grid-template-columns:repeat(4,1fr); margin:0 0 4px 0;">
            <div class="stat-card accent"><div class="stat-value">${presentCount}</div><div class="stat-label">Docenti Presenti</div></div>
            <div class="stat-card warning"><div class="stat-value">${absentCount}</div><div class="stat-label">Docenti Assenti</div></div>
            <div class="stat-card danger"><div class="stat-value">${uncovered}</div><div class="stat-label">Slot da Coprire</div></div>
            <div class="stat-card info"><div class="stat-value">${covered}</div><div class="stat-label">Sostituzioni Assegnate</div></div>
          </div>`;
      }

      let isSunday = new Date(_currentDate + 'T12:00:00').getDay() === 0;

      let html = `
        ${isSunday ? `
        <div class="alert" style="background:var(--accent-light); border:1px solid var(--accent); border-radius:10px; padding:12px 16px; margin-bottom:14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div style="font-size:13px; color:var(--text-primary);">
            📅 <strong>Domenica (${fmtDate(_currentDate)})</strong> — Giorno festivo: nessuna lezione prevista da orario scolastico.
          </div>
          <button class="btn btn-sm btn-primary" id="reg-goto-monday-btn" style="font-size:12px; padding:6px 12px; border-radius:6px; font-weight:600;">➡️ Passa a Lunedì</button>
        </div>` : ''}
        <div id="print-export-container">
          <div class="print-only-heading" style="display:none; text-align:center; font-size: 16px; margin-bottom: 16px; color:#000;">
             <strong style="font-size:20px;">Registro Operativo Sostituzioni</strong><br/>
             Data: <strong>${fmtDate(_currentDate)}</strong>
          </div>
          <div style="max-height: calc(100vh - 270px); overflow-y: auto; overflow-x: auto;">
          <table class="reg-columnar-table" style="width:100%; border-collapse: separate; border-spacing: 0; min-width: 1100px;">
            <thead style="position: sticky; top: 0; z-index: 90;">
              <tr>
                <th style="width:5%; background: var(--bg-card); border-bottom: 2px solid var(--border-thick); border-right: 1px solid var(--border); box-shadow: 0 2px 4px rgba(0,0,0,0.05);">Ora</th>
                <th style="width:20%; background: var(--bg-card); border-bottom: 2px solid var(--border-thick); border-right: 1px solid var(--border); box-shadow: 0 2px 4px rgba(0,0,0,0.05);">Docente Assente</th>
                <th style="width:5%; background: var(--bg-card); border-bottom: 2px solid var(--border-thick); border-right: 1px solid var(--border); box-shadow: 0 2px 4px rgba(0,0,0,0.05);">Classe</th>
                <th style="width:14%; background: var(--bg-secondary); border-bottom: 2px solid var(--border-thick); border-right: 1px solid var(--border); box-shadow: 0 2px 4px rgba(0,0,0,0.05);">In Compresenza</th>
                <th style="width:14%; background: var(--bg-secondary); border-bottom: 2px solid var(--border-thick); border-right: 1px solid var(--border); box-shadow: 0 2px 4px rgba(0,0,0,0.05);">Compres. Altre Sez.</th>
                <th style="width:14%; background: var(--bg-secondary); border-bottom: 2px solid var(--border-thick); border-right: 1px solid var(--border); box-shadow: 0 2px 4px rgba(0,0,0,0.05);">A Disposizione</th>
                <th style="width:12%; background: var(--bg-secondary); border-bottom: 2px solid var(--border-thick); border-right: 1px solid var(--border); box-shadow: 0 2px 4px rgba(0,0,0,0.05);">Eccedenti/Str.</th>
                <th style="width:10%; background: var(--bg-secondary); border-bottom: 2px solid var(--border-thick); border-right: 1px solid var(--border); box-shadow: 0 2px 4px rgba(0,0,0,0.05);">Oltre 5 Ore</th>
                <th style="width:6%; background: var(--bg-card); border-bottom: 2px solid var(--border-thick); text-align:center; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">Firma</th>
              </tr>
            </thead>
            <tbody>
      `;

      dates.forEach((date, dateIdx) => {
        const slots = allData[dateIdx].slots || [];
        
        if (_isWeekly) {
          html += `<tr class="reg-day-header"><td colspan="7"><strong>${getDayName(date).toUpperCase()}</strong> - ${fmtDate(date)}</td></tr>`;
        }

        hours.forEach(h => {
          const hourSlots = slots.filter(s => s.hour == h);
          const numRows = Math.max(5, hourSlots.length);

          // Calculate coverage ratio for badge
          const totalSlots = hourSlots.length;
          const coveredSlots = hourSlots.filter(s => s.existing_substitutions?.length > 0).length;

          for (let i = 0; i < numRows; i++) {
            const slot = hourSlots[i];
            const existing = slot?.existing_substitutions || [];
            
            const isFirstOfBlock = (i === 0);
            const hourLabel = h - 7;

            // Hour badge: show only number
            let hourBadgeHtml = isFirstOfBlock ? `<span class="hour-badge-large">${hourLabel}ª</span>` : '';

            html += `
              <tr class="${slot ? 'reg-row-absence' : 'reg-row-empty'} ${isFirstOfBlock ? 'reg-row-start-block' : ''} ${(hourLabel % 2 !== 0) ? 'hour-band-odd' : 'hour-band-even'}">
                <td style="border-right: 2px solid var(--border-thick); border-bottom: 2px solid var(--border-thick); text-align:center; vertical-align:middle;">${hourBadgeHtml}</td>
                ${slot ? `
                <td style="border-right: 4px solid var(--accent); border-bottom: 2px solid var(--border-thick);">
                  <div class="flex items-center justify-between gap-8">
                     <span style="font-weight:700; font-size:13px;">${escHtml(slot.absent_teacher_name)}</span>
                     ${!isReadOnly ? `<button class="btn btn-ghost btn-sm text-danger" style="font-size:14px; padding:0; font-weight:bold;" title="Elimina riga" 
                       onclick="OperationalRegistryView.deleteEntry('${slot.type}', '${slot.absence_record_id || ''}', ${slot.absent_teacher_id}, ${slot.hour}, ${slot.class_id})">✕</button>` : ''}
                  </div>
                </td>
                  <td style="border-right: 2px solid var(--border-thick); border-bottom: 2px solid var(--border-thick);">${escHtml(slot.class_name)}</td>
                  <td style="border-right: 2px solid var(--border-thick); border-bottom: 2px solid var(--border-thick);">${renderSubCell(slot, existing, 'compresenza', isReadOnly, daily.absences, activeLT)}</td>
                  <td style="border-right: 2px solid var(--border-thick); border-bottom: 2px solid var(--border-thick);">${renderSubCell(slot, existing, 'compresenza_altre', isReadOnly, daily.absences, activeLT)}</td>
                  <td style="border-right: 2px solid var(--border-thick); border-bottom: 2px solid var(--border-thick);">${renderSubCell(slot, existing, 'disposizione', isReadOnly, daily.absences, activeLT)}</td>
                  <td style="border-right: 2px solid var(--border-thick); border-bottom: 2px solid var(--border-thick);">${renderSubCell(slot, existing, 'eccedente', isReadOnly, daily.absences, activeLT)}</td>
                  <td style="border-right: 2px solid var(--border-thick); border-bottom: 2px solid var(--border-thick);">${renderSubCell(slot, existing, 'oltre5ore', isReadOnly, daily.absences, activeLT)}</td>
                  <td style="border-bottom: 2px solid var(--border-thick); text-align:center;">${renderAccepted(existing)}</td>
                ` : `
                  <td style="border-right: 2px solid var(--border-thick); border-bottom: 2px solid var(--border-thick);"></td>
                  <td style="border-right: 2px solid var(--border-thick); border-bottom: 2px solid var(--border-thick);"></td>
                  <td style="border-right: 2px solid var(--border-thick); border-bottom: 2px solid var(--border-thick);"></td>
                  <td style="border-right: 2px solid var(--border-thick); border-bottom: 2px solid var(--border-thick);"></td>
                  <td style="border-right: 2px solid var(--border-thick); border-bottom: 2px solid var(--border-thick);"></td>
                  <td style="border-right: 2px solid var(--border-thick); border-bottom: 2px solid var(--border-thick);"></td>
                  <td style="border-right: 2px solid var(--border-thick); border-bottom: 2px solid var(--border-thick);"></td>
                  <td style="border-bottom: 2px solid var(--border-thick);"></td>
                `}
              </tr>
            `;
          }
        });
      });

      html += `
            </tbody>
          </table>
        </div>
      </div>
      `;
      target.innerHTML = html;

      target.querySelector('#reg-goto-monday-btn')?.addEventListener('click', () => {
        const d = new Date(_currentDate + 'T12:00:00');
        d.setDate(d.getDate() + 1);
        _currentDate = d.toISOString().slice(0, 10);
        const selector = container.querySelector('#reg-date-selector');
        if (selector) selector.value = _currentDate;
        loadAndRender(container, state, isReadOnly);
      });

      // Init TomSelect on all registry cell selects (must be after DOM injection)
      initRegistryCells(target, state);

    } catch (e) {
      console.error(e);
      target.innerHTML = `<div class="empty-state">❌ Errore: ${e.message}</div>`;
    }
  }

  // ── Registry cell state: track TomSelect instances to avoid re-init ──
  const _tsInstances = {};

  function renderSubCell(slot, existing, role, isReadOnly = false, dailyAbsences = [], activeLT = []) {
    const assigned = existing.filter(s => s.sub_role === role);
    const candidates = slot.candidates?.[role] || [];
    const cellId = `ts-cell-${slot.absent_teacher_id}-${slot.hour}-${slot.class_id}-${role}`;

    if (isReadOnly) {
      // Read-only: just show assigned names as chips
      if (!assigned.length) return '<span style="font-size:11px; color:var(--text-muted); font-style:italic;">—</span>';
      return assigned.map(s => {
        const isR = s.notes === 'ricevimento' || (s.sub_role === 'disposizione' && _state?.allSchedule?.find(sl => sl.teacher_id == s.substitute_teacher_id && sl.hour == slot.hour && sl.day == getDayOfWeek(_currentDate))?.slot_type === 'ricevimento');
        return `<span class="chip">${escHtml(s.substitute_teacher_name || '—')}${isR ? ' <b style="color:var(--danger)"> (R)</b>' : ''}</span>`;
      }).join(' ');
    }

    // Build options: all candidates + already assigned (in case not in candidates list)
    const allOptions = new Map();
    assigned.forEach(s => allOptions.set(String(s.substitute_teacher_id), s.substitute_teacher_name));
    candidates.forEach(c => {
      const t = c.teacher || c;
      if (t?.id) allOptions.set(String(t.id), t.name);
    });

    const selectedValues = assigned.map(s => String(s.substitute_teacher_id));

    const optionsHtml = [...allOptions.entries()].map(([id, name]) => {
      const candidate = candidates.find(c => String(c.id) === id);
      
      // Controllo suggerimento docente (Ferie)
      const absRef = dailyAbsences.find(x => x.id == slot.absence_record_id);
      const lt = activeLT.find(l => l.replaced_id == slot.absent_teacher_id && ((l.hours||[]).length === 0 || l.hours.includes(slot.hour)));
      const isSuggested = (absRef?.substitutes_identified && absRef.substitutes_identified[slot.hour] == id) || (lt && lt.substitute_id == id);

      const isR = candidate?.isRicevimento;
      const rLabel = isR ? ' <b style="color:var(--danger)"> (R)</b>' : '';

      let label = candidate && candidate.statusText ? `${name} [${candidate.statusText}]` : name;
      label += rLabel;
      if (isSuggested) label = `⭐ SUGGERITO: ${label}`;

      return `<option value="${id}" ${selectedValues.includes(id) ? 'selected' : ''}>${label}</option>`;
    }).join('');

    return `
      <select id="${cellId}" multiple data-no-tomselect="1" data-slot='${JSON.stringify({
        hour: slot.hour, class_id: slot.class_id, absent_teacher_id: slot.absent_teacher_id
      }).replace(/'/g, "&#39;")}' data-role="${role}" data-existing='${JSON.stringify(assigned.map(s=>({id:s.id, tid:s.substitute_teacher_id}))).replace(/'/g,"&#39;")}' style="width:100%;">
        ${optionsHtml}
      </select>
    `;
  }

  function initRegistryCells(container, state) {
    container.querySelectorAll('select[data-no-tomselect]').forEach(sel => {
      if (sel.tomselect) return;
      const role = sel.dataset.role;
      const slotData = JSON.parse(sel.dataset.slot || '{}');
      const existingData = JSON.parse(sel.dataset.existing || '[]');
      const subMap = {};
      existingData.forEach(e => { subMap[String(e.tid)] = e.id; });

      const ts = new TomSelect(sel, {
        create: false,
        plugins: ['remove_button'],
        placeholder: 'Aggiungi docente…',
        sortField: { field: '$order' },
        onItemAdd: async (value) => {
          try {
            const payload = {
              date: _currentDate,
              hour: slotData.hour,
              class_id: slotData.class_id,
              absent_teacher_id: slotData.absent_teacher_id,
              substitute_teacher_id: parseInt(value),
              sub_role: role,
              school_year_id: state.yearId,
              created_by: state.user?.id
            };
            const newSub = await API.post('/substitutions/assign', payload);
            subMap[String(value)] = newSub.id;
            APP.toast('Docente assegnato alla sostituzione!', 'success');
          } catch(e) { APP.toast(e.message, 'error'); ts.removeItem(value, true); }
        },
        onItemRemove: async (value) => {
          const subId = subMap[String(value)];
          if (!subId) return;
          try {
            await API.del(`/substitutions/${subId}`);
            delete subMap[String(value)];
          } catch(e) { APP.toast(e.message, 'error'); }
        }
      });
      _tsInstances[sel.id] = ts;
    });
  }

  function renderAccepted(existing) {
    if (!existing || existing.length === 0) return '';
    const hasRejected = existing.some(e => e.status === 'rejected');
    if (hasRejected) {
      const rej = existing.find(e => e.status === 'rejected');
      const reasonTip = rej?.reject_reason ? `Motivo: ${escHtml(rej.reject_reason)}` : 'Rifiutata dal docente';
      return `<div style="text-align:center; color: #ef4444; font-weight:bold; font-size:12px; cursor:help;" title="${reasonTip}">❌ Rifiutata</div>`;
    }
    const allAccepted = existing.every(e => e.accepted);
    if (allAccepted) {
      return `<div style="text-align:center; color: #16a34a; font-weight:bold; font-size:14px;">✔</div>`;
    } else {
      return `<div style="text-align:center; color: var(--text-muted); font-size:11px;">In attesa</div>`;
    }
  }

  async function quickAbsence(date, hour) {
    _currentDate = date;
    showAddAbsenceModal(APP.getState(), () => {
      loadAndRender(document.getElementById('app')?.querySelector('.main-content') || document.body, APP.getState());
    }, hour);
  }

  async function addAssignment(select, slot, role) {
    const substituteId = select.value ? parseInt(select.value) : null;
    if (!substituteId) return;

    try {
      const payload = {
        date: _currentDate, hour: slot.hour, class_id: slot.class_id,
        absent_teacher_id: slot.absent_teacher_id, substitute_teacher_id: substituteId,
        sub_role: role, school_year_id: APP.getState().yearId,
        created_by: APP.getState().user?.id
      };
      await API.post('/substitutions/assign', payload);

      APP.toast('Assegnato e notifica inviata!', 'success');
      loadAndRender(document.getElementById('content-area'), APP.getState());
    } catch(e) { APP.toast(e.message, 'error'); }
  }

  async function removeAssignment(subId) {
    if (!await APP.confirm('Rimuovere assegnazione?')) return;
    try {
      await API.del(`/substitutions/${subId}`);
      loadAndRender(document.getElementById('content-area'), APP.getState());
    } catch(e) { APP.toast(e.message, 'error'); }
  }

  async function showAddAbsenceModal(state, cb, fixedHour=null) {
    const yearId = state.yearId || (await API.get('/settings/years')).find(y=>y.is_active)?.id || 1;
    const [teachers, classes] = await Promise.all([
      API.get(`/teachers?year_id=${yearId}`),
      API.get(`/settings/classes?year_id=${yearId}`)
    ]);

    const hourOptions = [8,9,10,11,12,13,14,15].map(h =>
      `<option value="${h}">${h-7}ª ora (${h}:00)</option>`).join('');

    const body = `
      <div style="padding:10px 14px; background:rgba(99,102,241,0.08); border-radius:10px; border-left:4px solid var(--accent); font-size:12px; color:var(--text-secondary); margin-bottom:16px;">
        💡 <strong>Modalità Rapida o Dettagliata</strong>: Puoi inserire un'assenza rapida da regolarizzare in seguito, oppure scegliere subito la tipologia specifica (Uscite, Ferie, Permessi, ecc.). È possibile selezionare più docenti contemporaneamente.
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:20px;">
        <label id="tipo-rapido-lbl" style="display:flex; align-items:center; gap:10px; padding:14px 16px; border-radius:10px; cursor:pointer; border:2px solid var(--accent); background:var(--accent-light);">
          <input type="radio" name="abs-tipo" id="tipo-rapido" value="da_regolarizzare" checked style="width:16px;height:16px;">
          <div><div style="font-weight:700; font-size:13px;">⚡ Assenza Rapida</div><div style="font-size:11px; color:var(--text-secondary);">Da regolarizzare dopo (Giorno intero)</div></div>
        </label>
        <label id="tipo-malattia-lbl" style="display:flex; align-items:center; gap:10px; padding:14px 16px; border-radius:10px; cursor:pointer; border:2px solid var(--border); background:var(--bg-secondary);">
          <input type="radio" name="abs-tipo" id="tipo-malattia" value="malattia" style="width:16px;height:16px;">
          <div><div style="font-weight:700; font-size:13px;">🤒 Malattia</div><div style="font-size:11px; color:var(--text-secondary);">Giorno intero (Certificato)</div></div>
        </label>
        <label id="tipo-altro-lbl" style="display:flex; align-items:center; gap:10px; padding:14px 16px; border-radius:10px; cursor:pointer; border:2px solid var(--border); background:var(--bg-secondary);">
          <input type="radio" name="abs-tipo" id="tipo-altro" value="altro_permesso" style="width:16px;height:16px;">
          <div><div style="font-weight:700; font-size:13px;">📄 Altro Permesso</div><div style="font-size:11px; color:var(--text-secondary);">Max 3gg/anno (Non rec.)</div></div>
        </label>
        <label id="tipo-orario-lbl" style="display:flex; align-items:center; gap:10px; padding:14px 16px; border-radius:10px; cursor:pointer; border:2px solid var(--border); background:var(--bg-secondary);">
          <input type="radio" name="abs-tipo" id="tipo-orario" value="permesso_orario" style="width:16px;height:16px;">
          <div><div style="font-weight:700; font-size:13px;">⏳ Permesso Breve</div><div style="font-size:11px; color:var(--text-secondary);">Singole ore (Da rec.)</div></div>
        </label>
        <label id="tipo-uscita-lbl" style="display:flex; align-items:center; gap:10px; padding:14px 16px; border-radius:10px; cursor:pointer; border:2px solid var(--border); background:var(--bg-secondary);">
          <input type="radio" name="abs-tipo" id="tipo-uscita" value="uscita" style="width:16px;height:16px;">
          <div><div style="font-weight:700; font-size:13px;">🚌 Uscita / Soggiorno</div></div>
        </label>
        <label id="tipo-ferie-lbl" style="display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:10px; cursor:pointer; border:2px solid var(--border); background:var(--bg-secondary);">
          <input type="radio" name="abs-tipo" id="tipo-ferie" value="ferie" style="width:16px;height:16px;">
          <div><div style="font-weight:700; font-size:12px;">🏝️ Ferie</div><div style="font-size:10px; color:var(--text-secondary);">Sostituti concordati</div></div>
        </label>
        <label id="tipo-formazione-lbl" style="display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:10px; cursor:pointer; border:2px solid var(--border); background:var(--bg-secondary);">
          <input type="radio" name="abs-tipo" id="tipo-formazione" value="formazione" style="width:16px;height:16px;">
          <div><div style="font-weight:700; font-size:12px;">📚 Formazione</div><div style="font-size:10px; color:var(--text-secondary);">Esonero servizio</div></div>
        </label>
        <label id="tipo-concorsi-lbl" style="display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:10px; cursor:pointer; border:2px solid var(--border); background:var(--bg-secondary);">
          <input type="radio" name="abs-tipo" id="tipo-concorsi" value="concorsi_esami" style="width:16px;height:16px;">
          <div><div style="font-weight:700; font-size:12px;">📝 Concorsi</div><div style="font-size:10px; color:var(--text-secondary);">Fino a 8gg</div></div>
        </label>
        <label id="tipo-matrimonio-lbl" style="display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:10px; cursor:pointer; border:2px solid var(--border); background:var(--bg-secondary);">
          <input type="radio" name="abs-tipo" id="tipo-matrimonio" value="matrimonio" style="width:16px;height:16px;">
          <div><div style="font-weight:700; font-size:12px;">💍 Matrimonio</div></div>
        </label>
        <label id="tipo-lutto-lbl" style="display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:10px; cursor:pointer; border:2px solid var(--border); background:var(--bg-secondary);">
          <input type="radio" name="abs-tipo" id="tipo-lutto" value="lutto" style="width:16px;height:16px;">
          <div><div style="font-weight:700; font-size:12px;">🕊️ Lutto</div><div style="font-size:10px; color:var(--text-secondary);">3gg / evento</div></div>
        </label>
        <label id="tipo-sindacali-lbl" style="display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:10px; cursor:pointer; border:2px solid var(--border); background:var(--bg-secondary);">
          <input type="radio" name="abs-tipo" id="tipo-sindacali" value="permessi_sindacali" style="width:16px;height:16px;">
          <div><div style="font-weight:700; font-size:12px;">📢 Permesso Sindacale</div><div style="font-size:10px; color:var(--text-secondary);">fino a 12 giorni/anno</div></div>
        </label>
        <label id="tipo-assemblea-lbl" style="display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:10px; cursor:pointer; border:2px solid var(--border); background:var(--bg-secondary); grid-column:span 2;">
          <input type="radio" name="abs-tipo" id="tipo-assemblea" value="assemblea" style="width:16px;height:16px;">
          <div><div style="font-weight:700; font-size:12px;">👥 Assemblea</div><div style="font-size:10px; color:var(--text-secondary);">fino a 10 ore annue</div></div>
        </label>
      </div>

      <div id="section-generica">
        <div class="form-group"><label>Docente Assente (anche più di uno)</label>
          <select id="m-abs-teacher" class="form-control" multiple>
            ${teachers.map(t => `<option value="${t.id}">${escHtml(t.name)}</option>`).join('')}
          </select></div>
      </div>

      <div id="section-uscita" style="display:none;">
        <div class="form-group"><label>Docente Referente</label>
          <select id="m-trip-lead" class="form-control">
            <option value="">-- Seleziona referente --</option>
            ${teachers.map(t => `<option value="${t.id}">${escHtml(t.name)}</option>`).join('')}
          </select></div>
        <div class="form-group"><label>Colleghi accompagnatori</label>
          <select id="m-trip-companions" class="form-control" multiple>
            ${teachers.map(t => `<option value="${t.id}">${escHtml(t.name)}</option>`).join('')}
          </select></div>
        <div class="form-group"><label>Classi coinvolte nell'uscita</label>
          <select id="m-trip-classes" class="form-control" multiple>
            ${classes.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('')}
          </select></div>
        <div style="padding:10px 14px; background:rgba(99,102,241,0.08); border-radius:8px; border-left:3px solid var(--accent); font-size:12px; color:var(--text-secondary); margin-bottom:12px;">
          💡 I docenti in servizio nelle stesse ore ma <em>non</em> sull'uscita verranno segnati <strong>a disposizione</strong>.
        </div>
      </div>

      <div id="section-ferie" style="display:none;"></div>

      <div id="section-hours" style="display:${fixedHour?'block':'none'}; margin-bottom:16px; padding:12px; background:var(--bg-secondary); border-radius:10px; border:1px solid var(--border);">
        <div style="font-weight:700; font-size:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
          <span>⏰ Seleziona Ore di Assenza:</span>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-select-all-hours" style="font-size:11px; padding:2px 8px;">Tutte le ore</button>
        </div>
        <div id="hours-checkboxes-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(130px, 1fr)); gap:8px;">
          <!-- Caricato dinamicamente in base all'orario del docente -->
        </div>
        <div class="grid grid-cols-2 gap-12" id="hours-fallback-selects" style="margin-top:10px; display:none;">
          <div class="form-group" style="margin:0"><label style="font-size:11px">Dalla ora</label><select id="m-abs-hour-start" class="form-control" style="font-size:12px">${hourOptions}</select></div>
          <div class="form-group" style="margin:0"><label style="font-size:11px">Alla ora</label><select id="m-abs-hour-end" class="form-control" style="font-size:12px"><option value="">-- Solo questa --</option>${hourOptions}</select></div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-12">
        <div class="form-group"><label>Dal giorno</label><input type="date" id="m-abs-start" class="form-control" value="${_currentDate}" required></div>
        <div class="form-group"><label>Al giorno</label><input type="date" id="m-abs-end" class="form-control" value="${_currentDate}" min="${_currentDate}"></div>
      </div>

      <div class="form-group" id="m-abs-reason-wrapper"><label>Motivazione / Note (facoltativo)</label><textarea id="m-abs-reason" class="form-control" rows="2" placeholder="Es. Motivi personali, visita medica, da regolarizzare..."></textarea></div>
    `;

    const ov = APP.modal({
      title: 'Nuova Assenza',
      size: 'modal-lg',
      body,
      footer: `<button class="btn btn-ghost" id="m-abs-cancel">Annulla</button><button class="btn btn-primary" id="m-abs-save">✅ Salva</button>`
    });

    const tipoRapido = ov.querySelector('#tipo-rapido');
    const tipoMalattia = ov.querySelector('#tipo-malattia');
    const tipoAltro = ov.querySelector('#tipo-altro');
    const tipoOrario = ov.querySelector('#tipo-orario');
    const tipoUscita = ov.querySelector('#tipo-uscita');
    const tipoFerie = ov.querySelector('#tipo-ferie');
    const tipoFormazione = ov.querySelector('#tipo-formazione');
    const tipoConcorsi = ov.querySelector('#tipo-concorsi');
    const tipoMatrimonio = ov.querySelector('#tipo-matrimonio');
    const tipoLutto = ov.querySelector('#tipo-lutto');
    const tipoSindacali = ov.querySelector('#tipo-sindacali');
    const tipoAssemblea = ov.querySelector('#tipo-assemblea');

    const rapLbl = ov.querySelector('#tipo-rapido-lbl');
    const malLbl = ov.querySelector('#tipo-malattia-lbl');
    const altLbl = ov.querySelector('#tipo-altro-lbl');
    const oraLbl = ov.querySelector('#tipo-orario-lbl');
    const uscLbl = ov.querySelector('#tipo-uscita-lbl');
    const ferLbl = ov.querySelector('#tipo-ferie-lbl');
    const forLbl = ov.querySelector('#tipo-formazione-lbl');
    const conLbl = ov.querySelector('#tipo-concorsi-lbl');
    const matLbl = ov.querySelector('#tipo-matrimonio-lbl');
    const lutLbl = ov.querySelector('#tipo-lutto-lbl');
    const sinLbl = ov.querySelector('#tipo-sindacali-lbl');
    const assLbl = ov.querySelector('#tipo-assemblea-lbl');

    const updateHoursGrid = async () => {
      const grid = ov.querySelector('#hours-checkboxes-grid');
      const fallback = ov.querySelector('#hours-fallback-selects');
      if (!grid) return;

      const ts = ov.querySelector('#m-abs-teacher')?.tomselect;
      const tIds = ts ? ts.getValue() : [];
      const dateVal = ov.querySelector('#m-abs-start')?.value || _currentDate;
      const dayNames = {0:'DOMENICA',1:'LUNEDI',2:'MARTEDI',3:'MERCOLEDI',4:'GIOVEDI',5:'VENERDI',6:'SABATO'};
      const dayName = dayNames[new Date(dateVal + 'T12:00:00').getDay()];

      if (!tIds || tIds.length === 0 || tIds.length > 1) {
        // Multipli o nessuno: mostra ore generiche
        fallback.style.display = 'grid';
        grid.innerHTML = '';
        return;
      }

      fallback.style.display = 'none';
      const teacherId = tIds[0];
      const allSchedule = Engine.getSchedule ? Engine.getSchedule(yearId, teacherId, dayName) : [];
      const classesList = classes || [];

      if (!allSchedule.length) {
        grid.innerHTML = `<div style="grid-column:1/-1; font-size:11px; color:var(--text-muted); font-style:italic;">Nessuna ora programmata per ${dayName}. Usa i selettori sottostanti:</div>`;
        fallback.style.display = 'grid';
        return;
      }

      const hoursHtml = allSchedule.map(s => {
        const h = s.hour;
        const cls = classesList.find(c => c.id == s.class_id);
        const clsName = cls ? cls.name : (s.slot_type === 'disponibile' ? 'DISP.' : (s.slot_type === 'ricevimento' ? 'RIC.' : '—'));
        const isChecked = fixedHour ? (h === fixedHour) : true;
        return `
          <label style="display:flex; align-items:center; gap:8px; padding:6px 10px; background:var(--bg-primary); border:1px solid var(--border); border-radius:8px; cursor:pointer; font-size:12px;">
            <input type="checkbox" class="m-hour-check" value="${h}" ${isChecked ? 'checked' : ''} style="width:15px; height:15px;">
            <div>
              <strong>${h-7}ª ora</strong> <span style="font-size:10px; color:var(--text-secondary)">(${h}:00)</span>
              <div style="font-size:11px; color:var(--accent); font-weight:600;">${clsName}</div>
            </div>
          </label>
        `;
      }).join('');

      grid.innerHTML = hoursHtml;
    };

    ov.querySelector('#btn-select-all-hours')?.addEventListener('click', () => {
      const checks = ov.querySelectorAll('.m-hour-check');
      const anyUnchecked = Array.from(checks).some(c => !c.checked);
      checks.forEach(c => c.checked = anyUnchecked);
    });

    const updateTipo = () => {
      const isRap = tipoRapido?.checked;
      const isMal = tipoMalattia?.checked;
      const isAlt = tipoAltro?.checked;
      const isOra = tipoOrario?.checked;
      const isUsc = tipoUscita?.checked;
      const isFer = tipoFerie?.checked;
      const isFor = tipoFormazione?.checked;
      const isCon = tipoConcorsi?.checked;
      const isMat = tipoMatrimonio?.checked;
      const isLut = tipoLutto?.checked;
      const isSin = tipoSindacali?.checked;
      const isAss = tipoAssemblea?.checked;
      
      rapLbl.style.borderColor = isRap ? 'var(--accent)' : 'var(--border)';
      rapLbl.style.background  = isRap ? 'var(--accent-light)' : 'var(--bg-secondary)';
      if (malLbl) {
        malLbl.style.borderColor = isMal ? 'var(--accent)' : 'var(--border)';
        malLbl.style.background  = isMal ? 'var(--accent-light)' : 'var(--bg-secondary)';
      }
      if (altLbl) {
        altLbl.style.borderColor = isAlt ? 'var(--accent)' : 'var(--border)';
        altLbl.style.background  = isAlt ? 'var(--accent-light)' : 'var(--bg-secondary)';
      }
      oraLbl.style.borderColor = isOra ? 'var(--accent)' : 'var(--border)';
      oraLbl.style.background  = isOra ? 'var(--accent-light)' : 'var(--bg-secondary)';
      uscLbl.style.borderColor = isUsc ? 'var(--accent)' : 'var(--border)';
      uscLbl.style.background  = isUsc ? 'var(--accent-light)' : 'var(--bg-secondary)';
      ferLbl.style.borderColor = isFer ? 'var(--accent)' : 'var(--border)';
      ferLbl.style.background  = isFer ? 'var(--accent-light)' : 'var(--bg-secondary)';
      forLbl.style.borderColor = isFor ? 'var(--accent)' : 'var(--border)';
      forLbl.style.background  = isFor ? 'var(--accent-light)' : 'var(--bg-secondary)';
      conLbl.style.borderColor = isCon ? 'var(--accent)' : 'var(--border)';
      conLbl.style.background  = isCon ? 'var(--accent-light)' : 'var(--bg-secondary)';
      matLbl.style.borderColor = isMat ? 'var(--accent)' : 'var(--border)';
      matLbl.style.background  = isMat ? 'var(--accent-light)' : 'var(--bg-secondary)';
      lutLbl.style.borderColor = isLut ? 'var(--accent)' : 'var(--border)';
      lutLbl.style.background  = isLut ? 'var(--accent-light)' : 'var(--bg-secondary)';
      sinLbl.style.borderColor = isSin ? 'var(--accent)' : 'var(--border)';
      sinLbl.style.background  = isSin ? 'var(--accent-light)' : 'var(--bg-secondary)';
      assLbl.style.borderColor = isAss ? 'var(--accent)' : 'var(--border)';
      assLbl.style.background  = isAss ? 'var(--accent-light)' : 'var(--bg-secondary)';

      ov.querySelector('#section-generica').style.display = isUsc ? 'none' : 'block';
      ov.querySelector('#section-uscita').style.display   = isUsc ? 'block' : 'none';
      ov.querySelector('#section-ferie').style.display    = 'none';
      ov.querySelector('#section-hours').style.display    = isOra ? 'block' : 'none';

      if (isOra) updateHoursGrid();

      const hideReason = isFer || isFor || isCon || isSin || isAss || isUsc || isMat;
      ov.querySelector('#m-abs-reason-wrapper').style.display = hideReason ? 'none' : 'block';
    };

    tipoRapido.onchange = updateTipo;
    if (tipoMalattia) tipoMalattia.onchange = updateTipo;
    if (tipoAltro) tipoAltro.onchange = updateTipo;
    tipoOrario.onchange = updateTipo;
    tipoUscita.onchange = updateTipo;
    tipoFerie.onchange = updateTipo;
    tipoFormazione.onchange = updateTipo;
    tipoConcorsi.onchange = updateTipo;
    tipoMatrimonio.onchange = updateTipo;
    tipoLutto.onchange = updateTipo;
    tipoSindacali.onchange = updateTipo;
    tipoAssemblea.onchange = updateTipo;

    if (fixedHour) ov.querySelector('#m-abs-hour-start').value = fixedHour;
    
    // Sincronizzazione Date
    const startEl = ov.querySelector('#m-abs-start');
    const endEl = ov.querySelector('#m-abs-end');
    startEl.addEventListener('change', () => {
      if (!endEl.value || endEl.value < startEl.value) {
        endEl.value = startEl.value;
      }
      endEl.min = startEl.value;
    });

    // Gestione dinamica sostituti rimossa per il Registro Operativo (Gestione via tabella)

    ov.querySelector('#m-abs-cancel').onclick = () => ov.remove();

    // Inizializza TomSelect per Docenti e Classi (CON PROTEZIONE CRASH)
    const initTS = () => {
      try {
        const tsOptions = {
          plugins: ['remove_button'],
          create: true,
          createFilter: (input) => input.length >= 2,
          render: {
            option_create: (data, escape) => `<div class="create">➕ Aggiungi nuovo docente: <strong>${escape(data.input)}</strong></div>`
          }
        };
        const elAbsT = ov.querySelector('#m-abs-teacher');
        const elTripL = ov.querySelector('#m-trip-lead');
        const elTripC = ov.querySelector('#m-trip-companions');
        const elTripCl = ov.querySelector('#m-trip-classes');
        
        if (elAbsT) new TomSelect(elAbsT, tsOptions);
        if (elTripL) new TomSelect(elTripL, { create: false });
        if (elTripC) new TomSelect(elTripC, tsOptions);
        if (elTripCl) new TomSelect(elTripCl, { plugins: ['remove_button'], create: false });
      } catch(e) { console.warn('TomSelect error', e); }
    };
    // Esegui dopo un piccolo delay per assicurare che il DOM sia pronto
    setTimeout(initTS, 50);

    ov.querySelector('#m-abs-save').onclick = async () => {
      const isUscita = tipoUscita.checked;
      const isFerie = tipoFerie.checked;
      const dateStart = ov.querySelector('#m-abs-start').value;
      const dateEnd = ov.querySelector('#m-abs-end').value || dateStart;
      const hourStart = ov.querySelector('#m-abs-hour-start').value;
      const hourEnd = ov.querySelector('#m-abs-hour-end').value;
      const reason = ov.querySelector('#m-abs-reason').value;
      const hours = [];
      if (hourStart) { const s=parseInt(hourStart); const e=hourEnd?parseInt(hourEnd):s; for(let h=s;h<=e;h++) hours.push(h); }

      // Helper per assicurare che il docente esista
      const ensureTeacher = async (val) => {
        if (isNaN(parseInt(val))) {
          const newT = await API.post('/teachers', { name: val.toUpperCase(), subject: 'DA DEFINIRE', school_year_id: state.yearId, is_available: true });
          return newT.id;
        }
        return parseInt(val);
      };

      try {
        if (isUscita) {
          const leadId = parseInt(ov.querySelector('#m-trip-lead').value);
          const companionsTs = ov.querySelector('#m-trip-companions').tomselect;
          const companionIds = companionsTs ? companionsTs.getValue().map(v => parseInt(v)).filter(v => !isNaN(v)) : [];
          const classesTs = ov.querySelector('#m-trip-classes').tomselect;
          const classIds = classesTs ? classesTs.getValue().map(v => parseInt(v)).filter(v => !isNaN(v)) : [];

          if (!leadId || !classIds.length) { APP.toast('Seleziona il referente e almeno una classe', 'error'); return; }
          
          const allTeamIds = [leadId, ...companionIds];
          const leadName = teachers.find(t => t.id == leadId)?.name || 'Docente';

          // 1. Crea uscita didattica
          await API.post('/trips', {
            lead_teacher_id: leadId,
            extra_teacher_ids: companionIds,
            class_ids: classIds,
            hours: hours.length ? hours : [8,9,10,11,12,13],
            date: dateStart, date_end: dateEnd, school_year_id: state.yearId
          });

          // 2. Crea assenze per TUTTO il team
          const absRequests = allTeamIds.map((tid, idx) => {
            return API.post('/absences', {
              teacher_id: tid,
              school_year_id: state.yearId,
              date: dateStart,
              date_end: dateEnd !== dateStart ? dateEnd : null,
              hours: hours.length ? hours : null,
              type: 'uscita_didattica',
              reason: idx === 0 ? '' : `Accompagnatore per uscita (Referente: ${leadName})`,
              status: 'approved',
              created_by: APP.getState().user?.id
            });
          });
          await Promise.all(absRequests);

          // Segnala altri docenti in servizio come a disposizione (esclusi gli accompagnatori)
          if (hours.length) {
            const schedule = await API.get(`/schedule?year_id=${state.yearId}`);
            const dayNames = {0:'DOMENICA',1:'LUNEDI',2:'MARTEDI',3:'MERCOLEDI',4:'GIOVEDI',5:'VENERDI',6:'SABATO'};
            const day = dayNames[new Date(dateStart+'T12:00:00').getDay()];
            const tripSet = new Set(allTeamIds);
            const available = new Set();
            schedule.forEach(s => {
              if (s.day===day && hours.includes(s.hour) && !tripSet.has(s.teacher_id) && s.slot_type==='normal') {
                available.add(s.teacher_id);
              }
            });
            for(const tid of available) {
              await API.put('/schedule/slot', { teacher_id: tid, day, hour: hours[0], raw_value: 'DIS', slot_type: 'disponibile', school_year_id: state.yearId });
            }
            const msg = allTeamIds.length > 1
              ? `Uscita con ${allTeamIds.length} docenti registrata. ${available.size} docenti segnati a disposizione.`
              : `Uscita registrata. ${available.size} docenti segnati a disposizione.`;
            APP.toast(msg, 'success');
          } else { APP.toast('Uscita didattica registrata.', 'success'); }
        } else {
          let tIds = [];
          const ts = ov.querySelector('#m-abs-teacher').tomselect;
          const tRaw = ts ? ts.getValue() : [];
          if (tRaw.length === 0) { APP.toast('Seleziona almeno un docente', 'error'); return; }

          tIds = await Promise.all(tRaw.map(v => ensureTeacher(v)));
          
          let selectedHours = [];
          if (tipoOrario.checked) {
            const checkedBoxes = Array.from(ov.querySelectorAll('.m-hour-check:checked')).map(c => parseInt(c.value));
            if (checkedBoxes.length > 0) {
              selectedHours = checkedBoxes;
            } else if (hours.length > 0) {
              selectedHours = hours;
            }
          }

          const isRapido = tipoRapido.checked;
          const absType = isRapido ? 'da_regolarizzare' : (tipoMalattia?.checked ? 'malattia' : (tipoAltro?.checked ? 'altro_permesso' : (tipoOrario?.checked ? 'permesso_orario' : (isFerie ? 'ferie' : (tipoFormazione.checked ? 'formazione' : (tipoConcorsi.checked ? 'concorsi_esami' : (tipoMatrimonio.checked ? 'matrimonio' : (tipoLutto.checked ? 'lutto' : (tipoSindacali.checked ? 'permessi_sindacali' : (tipoAssemblea.checked ? 'assemblea' : 'altro_permesso'))))))))));
          
          const payload = {
            teacher_id: tIds,
            school_year_id: state.yearId,
            date: dateStart,
            date_end: dateEnd !== dateStart ? dateEnd : null,
            hours: selectedHours.length ? selectedHours : null,
            type: absType,
            reason: reason || (isRapido ? 'Assenza rapida da regolarizzare' : ''),
            is_regularized: !isRapido,
            status: 'approved',
            created_by: APP.getState().user?.id
          };
          
          if (isFerie) {
            const subsMap = {};
            ov.querySelectorAll('.m-ferie-sub-sel').forEach(sel => {
              if (sel.value) subsMap[sel.dataset.hour] = parseInt(sel.value);
            });
            payload.substitutes_identified = subsMap;
          }

          await API.post('/absences', payload);
          APP.toast(isRapido ? '⚡ Assenza rapida registrata (da regolarizzare)' : (isFerie ? 'Record ferie creato' : 'Assenza registrata'), 'success');
        }
        ov.remove(); cb();
      } catch(e) { APP.toast(e.message, 'error'); }
    };
  }

  async function emailAll(state) {
     try {
       const count = await API.post('/notifications/bulk', { date: _currentDate, year_id: state.yearId, creatorId: state.user?.id });
       APP.toast(`Inviate ${count} notifiche con successo.`, 'success');
     } catch(e) {
       APP.toast(e.message, 'error');
     }
  }

  async function shareRegistry(container) {
    const tableDiv = container.querySelector('.reg-columnar-table');
    if (!tableDiv) { return APP.toast('Nessuna tabella da condividere', 'warning'); }
    if (typeof html2canvas === 'undefined') { return APP.toast('Libreria in caricamento. Riprova.', 'warning'); }

    APP.toast('Generazione schermata in corso...', 'info');
    document.documentElement.classList.add('print-mode');

    try {
      const canvas = await html2canvas(tableDiv, {
        scale: 2,
        backgroundColor: '#ffffff', // Bianco per allinearsi al layout carta A4
        logging: false
      });
      canvas.toBlob(async (blob) => {
        const file = new File([blob], `Registro_${_currentDate}.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: 'Registro Sostituzioni',
              files: [file]
            });
            return;
          } catch (e) { console.warn('Share annullato', e); }
        }
        
        // Fallback
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Registro_${_currentDate}.png`;
        a.click();
        URL.revokeObjectURL(url);
        APP.toast('Schermata scaricata con successo!', 'success');
      }, 'image/png');
    } catch(e) {
      APP.toast('Errore: ' + e.message, 'error');
    } finally {
      document.documentElement.classList.remove('print-mode');
    }
  }

  async function exportToExcel(container) {
    const table = container.querySelector('.reg-columnar-table');
    if (!table) return APP.toast('Nessuna tabella da esportare', 'warning');

    try {
      APP.toast('Generazione file Excel...', 'info');
      const wb = XLSX.utils.table_to_book(table, { raw: true });
      XLSX.writeFile(wb, `Registro_Operativo_${_currentDate}.xlsx`);
      APP.toast('File Excel scaricato con successo!', 'success');
    } catch (e) {
      APP.toast('Errore esportazione Excel: ' + e.message, 'error');
    }
  }

  function setPageDate(date) {
    _currentDate = date;
  }

  async function openDeleteAbsenceModal(state, callback) {
    try {
      const absences = await API.get(`/absences?date=${_currentDate}&year_id=${state.yearId}`);
      if (!absences || absences.length === 0) {
        APP.toast('Nessuna assenza registrata per oggi', 'info');
        return;
      }

      const ov = APP.modal({
        title: `🗑️ Rimuovi Assenze (${fmtDate(_currentDate)})`,
        body: `
          <p style="margin-bottom:12px; font-size:13px; color:var(--text-secondary);">Seleziona i docenti che desideri rimuovere dall'elenco degli assenti:</p>
          <div style="max-height:300px; overflow-y:auto; border:1px solid var(--border); border-radius:8px;">
            ${absences.map(a => `
              <label style="display:flex; align-items:center; gap:12px; padding:10px 14px; border-bottom:1px solid var(--border); cursor:pointer; background:var(--bg-primary);">
                <input type="checkbox" class="abs-check" value="${a.id}" style="width:18px; height:18px;">
                <div>
                  <div style="font-weight:700; font-size:13px;">${escHtml(a.teacher_name)}</div>
                  <div style="font-size:11px; color:var(--text-secondary);">${a.type === 'uscita_didattica' ? '🚌 Uscita' : '🚫 Assenza'}</div>
                </div>
              </label>
            `).join('')}
          </div>
        `,
        footer: `
          <button class="btn btn-secondary" id="del-abs-cancel">Annulla</button>
          <button class="btn btn-danger" id="del-abs-confirm">Conferma Rimozione</button>
        `,
        size: 'modal-md'
      });

      ov.querySelector('#del-abs-cancel').onclick = () => ov.remove();
      ov.querySelector('#del-abs-confirm').onclick = async () => {
        const checked = Array.from(ov.querySelectorAll('.abs-check:checked')).map(cb => cb.value);
        if (checked.length === 0) {
          APP.toast('Nessun docente selezionato', 'warning');
          return;
        }

        if (await APP.confirm(`Confermi la rimozione di ${checked.length} record di assenza?`)) {
          const btn = ov.querySelector('#del-abs-confirm');
          btn.disabled = true; btn.textContent = 'Rimozione...';
          try {
            await Promise.all(checked.map(id => API.del(`/absences/${id}`)));
            ov.remove();
            APP.toast('Assenze rimosse con successo', 'success');
            if (callback) callback();
          } catch(e) { APP.toast(e.message, 'error'); btn.disabled = false; btn.textContent = 'Conferma Rimozione'; }
        }
      };
    } catch(e) { APP.toast(e.message, 'error'); }
  }

  async function deleteEntry(type, absenceId, teacherId, hour, classId) {
    if (await APP.confirm('Sei sicuro di voler eliminare questa voce?')) {
      try {
        const data = await API.get(`/substitutions/daily?date=${_currentDate}&year_id=${_state.yearId}`);
        const targets = (data.substitutions || []).filter(s => s.absent_teacher_id == teacherId && s.hour == hour && s.class_id == classId);
        if (targets.length) {
          await Promise.all(targets.map(t => API.delete(`/substitutions/${t.id}`)));
          APP.toast('Voce rimossa', 'success');
        } else {
          APP.toast('Nessuna sostituzione trovata per questa ora', 'info');
        }
        loadAndRender(document.getElementById('content-area'), _state);
      } catch(e) { APP.toast(e.message, 'error'); }
    }
  }

  return { render, quickAbsence, shareRegistry, exportToExcel, setPageDate, deleteEntry };
})();
