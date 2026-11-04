/**
 * DAILY_OVERVIEW.JS
 * Griglia master giornaliera per vedere lo stato di tutta la scuola.
 */
var DailyOverviewView = (() => {
  let _currentDate = todayISO();

  async function render(container, state) {
    if (!state.yearId) {
      container.innerHTML = '<div class="empty-state"><div class="icon">⚠️</div><h3>Nessun anno scolastico attivo</h3><p>Vai in Impostazioni per configurarne uno.</p></div>';
      return;
    }

    container.innerHTML = `
      <div class="page-header">
        <div class="flex justify-between items-center">
          <div>
            <div class="page-title">Prospetto Giornaliero</div>
            <div class="page-subtitle" id="daily-ov-subtitle">Caricamento...</div>
          </div>
          <div class="toolbar-right flex gap-8 items-center">
            <div class="btn-group" style="margin-right:12px">
              <button class="btn btn-sm btn-ghost" id="prev-day" title="Giorno precedente">◀</button>
              <button class="btn btn-sm btn-ghost" id="next-day" title="Giorno successivo">▶</button>
            </div>
            <button class="btn btn-danger btn-sm" id="add-absence-btn" style="margin-right:12px">
              <span>+</span> Assenza
            </button>
            <label style="margin:0; font-size:11px; color:var(--text-secondary)">Data:</label>
            <input type="date" class="date-input" id="ov-date-selector" value="${_currentDate}">
          </div>
        </div>
      </div>
      
      <div class="card" style="padding:0; overflow:hidden">
        <div id="ov-grid-container">
          <div class="loading-overlay"><div class="spinner"></div> Generazione prospetto...</div>
        </div>
      </div>

      <div class="mt-16 flex gap-12" style="font-size:11px; flex-wrap:wrap">
        <div class="flex items-center gap-4"><span style="width:12px; height:12px; background:var(--bg-secondary); border:1px solid var(--border); border-radius:3px"></span> Lezione</div>
        <div class="flex items-center gap-4"><span style="width:12px; height:12px; background:var(--success-bg); border:1px solid var(--success); border-radius:3px"></span> A disposizione</div>
        <div class="flex items-center gap-4"><span style="width:12px; height:12px; background:var(--danger-bg); border:1px solid var(--danger); border-radius:3px"></span> Assente</div>
        <div class="flex items-center gap-4"><span style="width:12px; height:12px; background:var(--warning-bg); border:1px solid var(--warning); border-radius:3px"></span> DA COPRIRE (Approvato)</div>
        <div class="flex items-center gap-4"><span style="width:12px; height:12px; background:var(--bg-secondary); border:1px dashed var(--warning); border-radius:3px"></span> DA COPRIRE (In attesa)</div>
        <div class="flex items-center gap-4"><span style="width:12px; height:12px; background:var(--accent-light); border:1px solid var(--accent); border-radius:3px"></span> Supplenza</div>
        <div class="flex items-center gap-4"><span style="width:12px; height:12px; background:var(--info-bg); border:1px solid var(--info-text); border-radius:3px"></span> Gita/Uscita</div>
      </div>
    `;

    const input = container.querySelector('#ov-date-selector');
    input.onchange = (e) => {
      _currentDate = e.target.value;
      loadAndRenderGrid(container, state);
    };

    container.querySelector('#prev-day').onclick = () => {
      const d = new Date(_currentDate + 'T12:00:00');
      d.setDate(d.getDate() - 1);
      _currentDate = d.toISOString().slice(0, 10);
      input.value = _currentDate;
      loadAndRenderGrid(container, state);
    };
    container.querySelector('#next-day').onclick = () => {
      const d = new Date(_currentDate + 'T12:00:00');
      d.setDate(d.getDate() + 1);
      _currentDate = d.toISOString().slice(0, 10);
      input.value = _currentDate;
      loadAndRenderGrid(container, state);
    };
    
    container.querySelector('#add-absence-btn').onclick = () => showAddAbsenceModal(state, () => loadAndRenderGrid(container, state));

    loadAndRenderGrid(container, state);
  }

  async function showAddAbsenceModal(state, cb) {
    const teachers = await API.get(`/teachers?year_id=${state.yearId}`);
    const body = `
      <form id="modal-abs-form">
        <div class="form-group">
          <label>Docente</label>
          <select id="m-abs-teacher" class="form-control" required>
            ${teachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
          </select>
        </div>
        <div class="grid grid-cols-2 gap-12">
          <div class="form-group">
            <label>Dal</label>
            <input type="date" id="m-abs-start" class="form-control" value="${todayISO()}" required>
          </div>
          <div class="form-group">
            <label>Al (opzionale)</label>
            <input type="date" id="m-abs-end" class="form-control">
          </div>
        </div>
        <div class="form-group">
          <label>Motivo / Note</label>
          <input type="text" id="m-abs-reason" class="form-control" placeholder="es. Malattia, Gita...">
        </div>
      </form>
    `;

    const ov = APP.modal({
      title: 'Nuova Assenza',
      body,
      footer: `<button class="btn btn-ghost" id="m-abs-cancel">Annulla</button><button class="btn btn-primary" id="m-abs-save">Salva</button>`
    });

    ov.querySelector('#m-abs-cancel').onclick = () => ov.remove();
    ov.querySelector('#m-abs-save').onclick = async () => {
      const data = {
        teacher_id: ov.querySelector('#m-abs-teacher').value,
        date: ov.querySelector('#m-abs-start').value,
        date_end: ov.querySelector('#m-abs-end').value || null,
        reason: ov.querySelector('#m-abs-reason').value,
        school_year_id: state.yearId
      };
      try {
        await API.post('/absences', data);
        APP.toast('Assenza registrata', 'success');
        ov.remove();
        cb();
        // Redirect to substitutions for the first day to show work needed
        APP.navigate('substitutions'); 
      } catch(e) { APP.toast(e.message, 'error'); }
    };
  }

  async function loadAndRenderGrid(container, state) {
    const gridTarget = container.querySelector('#ov-grid-container');
    const subtitle = container.querySelector('#daily-ov-subtitle');
    
    if (state._isWeekly) {
       renderWeeklyGrid(gridTarget, subtitle, state);
       return;
    }
    
    try {
      const [teachers, schedule, absences, trips, substitutions, periods] = await Promise.all([
        API.get(`/teachers?year_id=${state.yearId}`),
        API.get(`/schedule?year_id=${state.yearId}&date=${_currentDate}`),
        API.get(`/absences?year_id=${state.yearId}&date=${_currentDate}`),
        API.get(`/trips?year_id=${state.yearId}&date=${_currentDate}`),
        API.get(`/substitutions/history?year_id=${state.yearId}&from=${_currentDate}&to=${_currentDate}`),
        API.get(`/schedule/periods?year_id=${state.yearId}`)
      ]);

      let isProvvisorio = false;
      if (periods?.provvisorio?.start_date && periods?.provvisorio?.end_date) {
        if (_currentDate >= periods.provvisorio.start_date && _currentDate <= periods.provvisorio.end_date) {
          isProvvisorio = true;
        }
      }
      const typeBadge = isProvvisorio
        ? `<span class="badge" style="background:#fef3c7; color:#92400e; border:1px solid #fde68a; font-weight:700; margin-left:8px; padding:2px 8px; border-radius:6px; font-size:11px;">⏳ Orario Provvisorio</span>`
        : `<span class="badge" style="background:#e0e7ff; color:#3730a3; border:1px solid #c7d2fe; font-weight:700; margin-left:8px; padding:2px 8px; border-radius:6px; font-size:11px;">📅 Orario Definitivo</span>`;

      subtitle.innerHTML = `${getDayName(_currentDate)}, ${fmtDate(_currentDate)} ${typeBadge}`;

      const dayName = getDayName(_currentDate).toUpperCase();
      // Ore standard della scuola
      const hours = [8, 9, 10, 11, 12, 13, 14, 15]; 

      if (teachers.length === 0) {
        gridTarget.innerHTML = '<div class="empty-state">Nessun docente configurato per questo anno.</div>';
        return;
      }

      let html = `
        <div class="ov-master-wrapper">
          <table class="ov-master-table">
            <thead>
              <tr>
                <th class="sticky-col">Docente</th>
                ${hours.map(h => `<th>${h < 13 ? h : h-12}${h < 12 ? ':00' : h === 12 ? ':00' : ':00'}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
      `;

      teachers.forEach(t => {
        html += `<tr><td class="sticky-col"><strong>${escHtml(t.name)}</strong></td>`;
        
        hours.forEach(h => {
          const cellData = getCellData(t, h, dayName, schedule, absences, trips, substitutions);
          html += `<td class="${cellData.class}" title="${cellData.title}">${cellData.content}</td>`;
        });

        html += `</tr>`;
      });

      html += `</tbody></table></div>`;
      gridTarget.innerHTML = html;

    } catch (e) {
      console.error(e);
      gridTarget.innerHTML = `<div class="empty-state">❌ Errore: ${e.message}</div>`;
    }
  }

  function getCellData(teacher, hour, day, schedule, absences, trips, substitutions) {
    // 1. Il docente è assente?
    const absence = absences.find(a => a.teacher_id == teacher.id);
    const isApproved = absence && absence.status === 'approved';
    const isPending = absence && absence.status === 'pending';
    
    // 2. Il docente è in gita (come accompagnatore)?
    const onTrip = trips.find(tr => tr.lead_teacher_id == teacher.id || (tr.companion_ids||[]).includes(teacher.id));
    const isOnTripNow = onTrip && onTrip.hours.includes(hour);

    // 3. Slot orario normale
    const slot = schedule.find(s => s.teacher_id == teacher.id && s.day == day && s.hour == hour);

    // 4. Supplenza assegnata a questo docente?
    const subAsSubstitute = substitutions.find(s => s.substitute_teacher_id == teacher.id && s.hour == hour);
    
    // 5. Supplenza per questo docente (lui è assente, qualcun altro copre)?
    const subForHim = substitutions.find(s => s.absent_teacher_id == teacher.id && s.hour == hour);

    // LOGICA DI PRIORITÀ
    if (absence) {
      if (subForHim) return { class: 'ov-cell-substituted', content: escHtml(subForHim.class_name), title: `Sostituito da ${subForHim.substitute_teacher_name}` };
      if (slot && slot.slot_type === 'normal') {
          if (isApproved) return { class: 'ov-cell-hole', content: 'DA COPRIRE', title: `Assente - Classe ${escHtml(slot.raw_value)}` };
          return { class: 'ov-cell-pending', content: 'IN ATTESA', title: `Assenza da approvare - Classe ${escHtml(slot.raw_value)}` };
      }
      return { class: isApproved ? 'ov-cell-absent' : 'ov-cell-pending', content: isApproved ? 'ASSENTE' : 'PENDENTE', title: isApproved ? 'Assente' : 'In attesa di approvazione' };
    }

    if (isOnTripNow) {
       return { class: 'ov-cell-trip', content: 'GITA', title: 'Accompagna una classe' };
    }

    if (subAsSubstitute) {
       return { class: 'ov-cell-substituting', content: escHtml(subAsSubstitute.class_name), title: `Supplenza per ${subAsSubstitute.absent_teacher_name}` };
    }

    if (slot) {
      if (slot.slot_type === 'normal') {
          // Controlla se la sua classe è in gita (quindi lui è libero ma non accompagnatore)
          const classInTrip = trips.find(tr => (tr.class_ids||[]).includes(slot.class_id) && tr.hours.includes(hour));
          if (classInTrip) return { class: 'ov-cell-freed', content: 'LIBERO', title: `Classe ${escHtml(slot.raw_value)} in gita` };
          
          return { class: 'ov-cell-normal', content: escHtml(slot.raw_value), title: 'Lezione ordinaria' };
      }
      if (slot.slot_type === 'disponibile') return { class: 'ov-cell-available', content: 'DISP', title: 'Disposizione' };
      if (slot.slot_type === 'ricevimento') return { class: 'ov-cell-ricevimento', content: 'R', title: 'Ricevimento' };
      if (slot.slot_type === 'asterisco') return { class: 'ov-cell-asterisco', content: '*', title: 'Altro impegno' };
    }

    return { class: '', content: '—', title: 'Ora buca' };
  }

  return { render };
})();
