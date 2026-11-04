// ══════════════════════════════════
// SCHEDULE VIEW — Orario Settimanale
// ══════════════════════════════════
var ScheduleView = (() => {
  const DAYS = ['LUNEDI','MARTEDI','MERCOLEDI','GIOVEDI','VENERDI'];
  const DAY_LABELS = { LUNEDI:'Lunedì', MARTEDI:'Martedì', MERCOLEDI:'Mercoledì', GIOVEDI:'Giovedì', VENERDI:'Venerdì' };
  const HOURS_BY_DAY = { LUNEDI:[8,9,10,11,12,13,14,15], MARTEDI:[8,9,10,11,12,13], MERCOLEDI:[8,9,10,11,12,13,14,15], GIOVEDI:[8,9,10,11,12,13,14,15], VENERDI:[8,9,10,11,12,13] };
  let _teachers=[], _schedule=[], _yearId=null, _selTeacherId=null;
  let _viewMode = 'completo'; // 'completo' | 'giorno' | 'docente'
  let _filterMode = 'tutto'; // 'tutto' | 'classi' | 'dis_ecc'
  let _selDay = 'LUNEDI';
  let _schedSelectedIds = new Set();

  async function render(container, state) {
    _yearId = state.yearId;
    if (!_yearId) { 
      container.innerHTML = `
        <div class="empty-state" style="padding:40px">
          <div class="icon" style="font-size:48px; margin-bottom:16px;">📅</div>
          <h3 style="margin-bottom:8px;">Orario non disponibile</h3>
          <p style="color:var(--text-secondary); max-width:400px; margin:0 auto 20px;">
            Per visualizzare o gestire l'orario scolastico, seleziona l'<strong>Anno Scolastico</strong> corretto dal menù in alto.
          </p>
          <div class="attention-hint" style="font-size:12px; color:var(--accent); font-weight:600;">
            ⬅️ Scegli l'anno qui
          </div>
        </div>`;
      return; 
    }
    container.innerHTML = `
      <div class="page-header" style="padding-bottom:12px; border-bottom:1px solid var(--border)">
        <div class="page-title">📅 Orario Scolastico</div>
      </div>
      <div class="toolbar" style="margin-top:20px; flex-wrap:wrap; gap:8px;">
        <div class="toolbar-left" style="flex-wrap:wrap; gap:8px;">
          <div class="search-box">
            <span class="s-icon">🔍</span>
            <input type="text" id="sched-search" placeholder="Cerca per Docente, Materia o Classe…"/>
          </div>
          <select class="filter-select" id="sched-sort">
            <option value="name_asc">Nome (A-Z)</option>
            <option value="name_desc">Nome (Z-A)</option>
            <option value="subject">Materia</option>
          </select>
          <div class="btn-group" style="background:var(--bg-card); padding:3px; border-radius:var(--radius); border:1px solid var(--border); display:inline-flex; gap:3px">
            <button class="btn btn-sm ${_viewMode==='completo'?'btn-primary':'btn-ghost'}" id="view-completo">📊 Vista Completa</button>
            <button class="btn btn-sm ${_viewMode==='giorno'?'btn-primary':'btn-ghost'}" id="view-giorno">📆 Per Giorno</button>
            <button class="btn btn-sm ${_viewMode==='docente'?'btn-primary':'btn-ghost'}" id="view-docente">👤 Per Docente</button>
          </div>
          <div class="btn-group" style="background:var(--bg-card); padding:3px; border-radius:var(--radius); border:1px solid var(--border); display:inline-flex; gap:3px; margin-left: 8px;">
            <button class="btn btn-sm ${_filterMode==='tutto'?'btn-primary':'btn-ghost'}" id="filter-tutto">👁️ Tutto</button>
            <button class="btn btn-sm ${_filterMode==='classi'?'btn-primary':'btn-ghost'}" id="filter-classi">📖 Solo Classi</button>
            <button class="btn btn-sm ${_filterMode==='dis_ecc'?'btn-primary':'btn-ghost'}" id="filter-dis-ecc">⚡ Dis/Ecc</button>
          </div>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-ghost" id="sched-export-btn">🖨️ Esporta / Stampa</button>
        </div>
      </div>
      <div id="sched-mode-controls" style="margin-top:12px;"></div>
      <div id="sched-master-area"></div>`;

    container.querySelector('#sched-search').oninput = debounce(() => loadMasterGrid());
    container.querySelector('#sched-sort').onchange = () => loadMasterGrid();
    container.querySelector('#sched-export-btn').onclick = () => exportCurrentView();
    container.querySelector('#view-completo').onclick = () => { _viewMode='completo'; render(container, state); };
    container.querySelector('#view-giorno').onclick = () => { _viewMode='giorno'; render(container, state); };
    container.querySelector('#view-docente').onclick = () => { _viewMode='docente'; render(container, state); };

    container.querySelector('#filter-tutto').onclick = () => { _filterMode='tutto'; render(container, state); };
    container.querySelector('#filter-classi').onclick = () => { _filterMode='classi'; render(container, state); };
    container.querySelector('#filter-dis-ecc').onclick = () => { _filterMode='dis_ecc'; render(container, state); };

    // Mode-specific controls
    const modeCtrl = container.querySelector('#sched-mode-controls');
    if (_viewMode === 'giorno') {
      modeCtrl.innerHTML = `
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;">
          ${DAYS.map(d => `<button class="btn btn-sm ${_selDay===d?'btn-primary':'btn-secondary'}" data-day="${d}">${DAY_LABELS[d]}</button>`).join('')}
        </div>`;
      modeCtrl.querySelectorAll('[data-day]').forEach(b => {
        b.onclick = () => { _selDay = b.dataset.day; loadMasterGrid(); 
          modeCtrl.querySelectorAll('[data-day]').forEach(x => x.classList.toggle('btn-primary', x.dataset.day===_selDay));
          modeCtrl.querySelectorAll('[data-day]').forEach(x => x.classList.toggle('btn-secondary', x.dataset.day!==_selDay));
        };
      });
    }

    loadMasterGrid();
  }

  function generateTeacherEmail(nomi, cognomi) {
    function clean(str) {
      return (str || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9]/g, '');
    }
    const cNomi = clean(nomi);
    const cCognomi = clean(cognomi);
    if (!cNomi || !cCognomi) return '';
    return `${cNomi}.${cCognomi}@padregemelli.net`;
  }

  function showImportModal(state, cb) {
    const body = `
      <div class="p-12" style="max-width:100%;">
        <p style="font-size:13px; margin-bottom:12px">
          Carica un file <strong>Excel (.xlsx, .xls)</strong> o <strong>CSV</strong> in formato <strong>Matrice</strong>.<br/>
          La prima riga contiene i <strong>GIORNI</strong>, la seconda le <strong>ORE</strong>.<br/>
          Colonne anagrafiche richieste: <strong>MATERIA</strong>, <strong>COGNOMI</strong>, <strong>NOMI</strong>.<br/>
          Usa <strong>DIS</strong> per disponibilità e <strong>ECC</strong> per eccedenze.
        </p>
        <div style="background:#1e293b; border:1px solid #334155; border-radius:6px; overflow-x:auto; -webkit-overflow-scrolling:touch; max-width:100%; margin-bottom:16px;">
          <table style="width:100%; min-width:420px; font-size:10px; text-align:center; border-collapse:collapse; color:#f8fafc;">
            <thead>
              <tr style="background:#0f172a; border-bottom:1px solid #334155;">
                <th style="padding:4px 8px; border-right:1px solid #334155;">MATERIA</th>
                <th style="padding:4px 8px; border-right:1px solid #334155;">COGNOMI</th>
                <th style="padding:4px 8px; border-right:1px solid #334155;">NOMI</th>
                <th colspan="2" style="padding:4px 8px; border-right:1px solid #334155;">LUNEDI</th>
              </tr>
              <tr style="background:#0f172a; border-bottom:1px solid #334155;">
                <th style="border-right:1px solid #334155;"></th>
                <th style="border-right:1px solid #334155;"></th>
                <th style="border-right:1px solid #334155;"></th>
                <th style="padding:4px; border-right:1px solid #334155; font-weight:400; color:#94a3b8;">8ª</th>
                <th style="padding:4px; font-weight:400; color:#94a3b8;">9ª</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="padding:4px 8px; text-align:left; color:#818cf8;">ARTE</td>
                <td style="padding:4px 8px; text-align:left; font-weight:700;">NERI</td>
                <td style="padding:4px 8px; text-align:left; font-weight:700;">ELENA</td>
                <td style="padding:4px; border-right:1px solid #334155;">1D</td>
                <td style="padding:4px; color:#4ade80; font-weight:700;">DIS</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="import-dropzone" id="dropzone" style="border: 2px dashed var(--border); padding: 24px 16px; text-align: center; border-radius: 8px; cursor: pointer; background: var(--bg-secondary)">
          <div style="font-size:32px; margin-bottom:8px">📄</div>
          <div>Trascina il file qui o clicca per selezionare</div>
          <input type="file" id="file-input" accept=".xlsx,.xls,.csv" style="display:none">
        </div>
        <div style="display:flex; justify-content:center; gap:8px; margin-top:16px; flex-wrap:wrap;">
          <button class="btn btn-ghost btn-sm" onclick="ScheduleView.downloadTemplate()">📥 Scarica Template</button>
          <button class="btn btn-ghost btn-sm" style="color:#ef4444;" onclick="ImportExportView.clearSchedule('${state.yearId}')">🗑️ Svuota e Ricomincia</button>
        </div>
        <div id="import-status" style="margin-top:12px; font-size:12px"></div>
      </div>
    `;
    const ov = APP.modal({ title: 'Importa Orario Docenti', body, footer: `<button class="btn btn-ghost" id="m-imp-close">Chiudi</button>` });
    const dz = ov.querySelector('#dropzone');
    const fi = ov.querySelector('#file-input');
    const status = ov.querySelector('#import-status');
    dz.onclick = () => fi.click();
    fi.onchange = (e) => handleFile(e.target.files[0], state, status, cb);
    ov.querySelector('#m-imp-close').onclick = () => ov.remove();
  }

  async function handleFile(file, state, statusEl, cb) {
    if (!file) return;
    statusEl.innerHTML = '<div class="spinner"></div> Elaborazione in corso...';
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        if (rows.length < 3) throw new Error('Il file deve avere almeno 3 righe (Giorno, Ora, Dati).');

        const teachers = await API.get(`/teachers?year_id=${state.yearId}`);
        const headerDays = rows[0] || [];
        const headerHours = rows[1] || [];
        let count = 0;

        // Rileva se il file ha 3 colonne anagrafiche (MATERIA, COGNOMI, NOMI) o 2 (MATERIA, DOCENTE)
        const col2DayStr = String(headerDays[2] || '').trim().toUpperCase();
        const col2HourStr = String(headerHours[2] || '').trim();
        const isCol2Hour = !isNaN(parseInt(col2HourStr)) || DAYS.includes(col2DayStr);
        const startHourCol = isCol2Hour ? 2 : 3;

        // Mappa delle colonne: colIdx -> { day, hour }
        const colMap = {};
        let lastDay = '';
        for (let c = startHourCol; c < headerHours.length; c++) {
          const d = String(headerDays[c] || '').trim().toUpperCase();
          if (d) lastDay = d;
          const hStr = String(headerHours[c] || '').trim();
          const hour = parseInt(hStr);
          if (lastDay && !isNaN(hour)) {
            colMap[c] = { day: lastDay, hour };
          }
        }

        // Processa righe dati (da Row 2 in poi)
        for (let r = 2; r < rows.length; r++) {
          const row = rows[r];
          if (!row || row.length < 2) continue;
          
          const materia = String(row[0] || '').trim().toUpperCase();
          let teacherName = '';
          let email = '';

          if (startHourCol === 3) {
            // Formato standard nuovo con colonne separate: COGNOMI (col 1), NOMI (col 2)
            const cognomi = String(row[1] || '').trim().toUpperCase();
            const nomi = String(row[2] || '').trim().toUpperCase();
            if (!cognomi && !nomi) continue;
            teacherName = `${cognomi} ${nomi}`.trim();
            email = generateTeacherEmail(nomi, cognomi);
          } else {
            // Retrocompatibilità formato classico: DOCENTE (col 1)
            teacherName = String(row[1] || '').trim().toUpperCase();
            if (!teacherName) continue;
          }

          let teacher = teachers.find(t => t.name === teacherName || (email && t.email && t.email.toLowerCase() === email.toLowerCase()));
          const teacherPayload = { 
            name: teacherName, 
            subject: materia, 
            email: email || (teacher ? (teacher.email || '') : ''), 
            school_year_id: state.yearId, 
            is_available: true 
          };

          if (!teacher) {
            teacher = await API.post('/teachers', teacherPayload);
            teachers.push(teacher);
          } else {
            const needsUpdate = (materia && (teacher.subject || '').toUpperCase() !== materia) ||
                                (email && (!teacher.email || teacher.email.toLowerCase() !== email.toLowerCase()));
            if (needsUpdate) {
              teacher = await API.put(`/teachers/${teacher.id}`, { ...teacher, ...teacherPayload });
              const idx = teachers.findIndex(tx => tx.id === teacher.id);
              if (idx !== -1) teachers[idx] = teacher;
            }
          }

          // Salva i singoli slot
          for (const colIdx in colMap) {
            const { day, hour } = colMap[colIdx];
            const val = String(row[colIdx] || '').trim();
            if (val !== undefined && val !== 'undefined') {
              await API.put('/schedule/slot', { teacher_id: teacher.id, day, hour, raw_value: val, school_year_id: state.yearId });
              count++;
            }
          }
        }

        statusEl.innerHTML = `<span class="text-success">✅ Importazione completata! ${count} slot aggiornati.</span>`;
        if (cb) cb();
      } catch (err) {
        statusEl.innerHTML = `<span class="text-danger">❌ Errore: ${err.message}</span>`;
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function downloadTemplate() {
    // Genera un file Excel (.xlsx) ad alta fedeltà con Cognomi, Nomi e orario istituzionale
    const days = ['LUNEDI', 'MARTEDI', 'MERCOLEDI', 'GIOVEDI', 'VENERDI'];
    const data = [
      ['MATERIA', 'COGNOMI', 'NOMI'], // Riga 1: Intestazioni / Giorni
      ['', '', ''],                   // Riga 2: Ore
      ['ESEMPIO MATERIA', 'ROSSI BIANCHI', 'MARIA GRAZIA'] // Riga 3: Esempio
    ];

    days.forEach(d => {
      const hours = HOURS_BY_DAY[d] || [8,9,10,11,12,13,14,15];
      hours.forEach((h, idx) => {
        data[0].push(idx === 0 ? d : ''); // Il nome del giorno appare solo alla prima ora
        data[1].push(h + 'ª');
        data[2].push(idx === 0 ? '1A' : ''); // Suggerimento nel sample
      });
    });

    try {
      const ws = XLSX.utils.aoa_to_sheet(data);
      // Impostiamo larghezza colonne minima per leggibilità
      ws['!cols'] = [{ wch: 18 }, { wch: 22 }, { wch: 20 }]; 
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template Orario");
      XLSX.writeFile(wb, "template_orario_istituto.xlsx");
      APP.toast('Template Excel generato con successo', 'success');
    } catch(e) {
      console.error('Errore generazione Excel:', e);
      // Fallback CSV se XLSX fallisce per qualche motivo
      const csv = data.map(r => r.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'template_orario_istituto.csv';
      a.click();
    }
  }

  async function loadMasterGrid() {
    const area = document.getElementById('sched-master-area');
    if (!area) return;
    area.innerHTML = '<div class="loading-overlay"><div class="spinner"></div> Caricamento orario completo...</div>';
    try {
      _teachers = await API.get(`/teachers?year_id=${_yearId}`);
      _schedule = await API.get(`/schedule?year_id=${_yearId}`);
      
      const q = (document.getElementById('sched-search')?.value||'').toLowerCase();
      const sort = document.getElementById('sched-sort')?.value;
      
      let filtered = _teachers.filter(t => {
        return t.name.toLowerCase().includes(q) || 
               (t.subject||'').toLowerCase().includes(q) || 
               (t.assigned_classes||'').toLowerCase().includes(q);
      });

      if (sort === 'name_asc') filtered.sort((a,b)=>a.name.localeCompare(b.name));
      else if (sort === 'name_desc') filtered.sort((a,b)=>b.name.localeCompare(a.name));
      else if (sort === 'subject') filtered.sort((a,b)=>(a.subject||'').localeCompare(b.subject||''));

      if (_viewMode === 'giorno') {
        area.innerHTML = renderDayTable(filtered, _selDay);
      } else if (_viewMode === 'docente') {
        area.innerHTML = renderDocenteSelector(filtered);
        // Wire checkboxes
        const selAll = area.querySelector('#sched-sel-all');
        if (selAll) {
          selAll.onchange = () => {
            if (selAll.checked) filtered.forEach(t => _schedSelectedIds.add(t.id));
            else _schedSelectedIds.clear();
            area.querySelectorAll('.sched-cb').forEach(cb => {
              cb.checked = _schedSelectedIds.has(parseInt(cb.dataset.id));
            });
          };
        }
        area.querySelectorAll('.sched-cb').forEach(cb => {
          cb.onchange = () => {
            const id = parseInt(cb.dataset.id);
            if (cb.checked) _schedSelectedIds.add(id); else _schedSelectedIds.delete(id);
          };
        });
        area.querySelector('#sched-show-btn')?.addEventListener('click', () => {
          const sel = filtered.filter(t => _schedSelectedIds.has(t.id));
          if (!sel.length) { APP.toast('Seleziona almeno un docente','warning'); return; }
          area.querySelector('#sched-docente-grid').innerHTML = renderMasterTable(sel);
        });
      } else {
        area.innerHTML = renderMasterTable(filtered);
      }

      area.querySelectorAll('.schedule-cell').forEach(cell => {
        cell.onclick = () => {
          if (!APP.isAdmin()) return;
          _selTeacherId = cell.dataset.tid;
          editCell(cell);
        };
      });
    } catch(e) { APP.toast(e.message,'error'); }
  }

  function renderDayTable(teachers, day) {
    const hours = HOURS_BY_DAY[day] || [8,9,10,11,12,13];
    let html = `<h3 style="margin:12px 0 8px; font-size:15px;">${DAY_LABELS[day]}</h3>
      <div class="table-wrapper" style="border:1px solid #334155;"><table class="ov-master-table">
        <thead style="background:#0f172a"><tr>
          <th style="min-width:60px; color:#94a3b8; font-size:10px; text-align:center;">Ora</th>
          ${teachers.map(t => `<th style="min-width:100px; color:#94a3b8; font-size:10px; font-weight:700;">${escHtml(t.name.split(' ')[0])}</th>`).join('')}
        </tr></thead>
        <tbody style="background:#1e293b">`;
    hours.forEach(h => {
      html += `<tr><td style="font-weight:700; text-align:center;">${h-7}ª</td>`;
      teachers.forEach(t => {
        const slot = _schedule.find(s => s.teacher_id==t.id && s.day===day && s.hour===h);
        const val = slot?.raw_value || '';
        const type = slot?.slot_type || 'empty';
        let cellClass = 'ov-cell-normal';
        let showText = true;
        
        if (type==='disponibile') { cellClass='ov-cell-dis'; if(_filterMode==='classi') showText=false; }
        else if (type==='eccedente') { cellClass='ov-cell-ecc'; if(_filterMode==='classi') showText=false; }
        else if (type==='empty') { cellClass=''; showText=false; }
        else { if(_filterMode==='dis_ecc') showText=false; }
        
        if(!showText) cellClass = '';
        html += `<td class="${cellClass}" style="text-align:center; font-size:11px; border:1px solid #1e293b;">${showText ? escHtml(val||'—') : ''}</td>`;
      });
      html += `</tr>`;
    });
    html += `</tbody></table></div>`;
    return html;
  }

  function renderDocenteSelector(teachers) {
    return `
      <div class="card" style="padding:16px 20px; margin-bottom:12px;">
        <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px; flex-wrap:wrap;">
          <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
            <input type="checkbox" id="sched-sel-all" style="width:16px;height:16px;"> <strong>Seleziona Tutti</strong>
          </label>
          <button class="btn btn-primary btn-sm" id="sched-show-btn">Mostra Orario Selezionati</button>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px,1fr)); gap:8px;">
          ${teachers.map(t => `
            <label style="display:flex; align-items:center; gap:8px; padding:6px 10px; background:var(--bg-secondary); border-radius:6px; cursor:pointer; border:1px solid var(--border);">
              <input type="checkbox" class="sched-cb" data-id="${t.id}" ${_schedSelectedIds.has(t.id)?'checked':''} style="width:15px;height:15px;">
              <span style="font-size:13px;">${escHtml(t.name)}</span>
              <span style="font-size:11px; color:var(--text-secondary); margin-left:auto;">${escHtml(t.subject||'')}</span>
            </label>`).join('')}
        </div>
      </div>
      <div id="sched-docente-grid"></div>
    `;
  }

  function exportCurrentView() {
    let table = document.querySelector('.ov-master-table');
    if (!table) { APP.toast('Nessuna griglia da esportare. Genera prima la vista.', 'warning'); return; }
    const VIEW_TITLE = 'Orario Scolastico';
    const win = window.open('','_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>${VIEW_TITLE}</title>
      <style>body{font-family:Arial,sans-serif;font-size:8px;padding:10px}
      table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:3px;text-align:center}
      th{background:#f3f4f6}.sticky-col,.sticky-col-2{text-align:left;font-weight:bold}
      h1{font-size:14px;margin-bottom:8px;}
      @media print{@page{size:A3 landscape;margin:1cm}}</style></head><body>
      <h1>${VIEW_TITLE}</h1>${table.outerHTML}
      <script>window.onload=()=>{window.print();}<\/script></body></html>`);
    win.document.close();
  }

  function renderMasterTable(teachers) {
    if (!teachers.length) return '<div class="empty-state">Nessun docente trovato con questi filtri</div>';

    const allHours = [8,9,10,11,12,13,14,15];
    
    let html = `
      <div class="ov-master-wrapper" style="max-height:calc(100vh - 220px)">
        <table class="ov-master-table">
          <thead>
            <tr>
              <th class="sticky-col" style="min-width:120px; text-align:left;">MATERIA</th>
              <th class="sticky-col-2" style="min-width:150px; text-align:left;">DOCENTE</th>
              ${DAYS.map(d => `<th colspan="${HOURS_BY_DAY[d].length}" style="border-right:2px solid var(--border-thick); text-align:center;">${d}</th>`).join('')}
            </tr>
            <tr>
              <th class="sticky-col"></th>
              <th class="sticky-col-2"></th>
              ${DAYS.map(d => HOURS_BY_DAY[d].map(h => `<th style="min-width:50px; font-size:9px">${h}ª</th>`).join('')).join('')}
            </tr>
          </thead>
          <tbody>
    `;

    teachers.forEach(t => {
      html += `<tr>
        <td class="sticky-col" style="font-weight:700; color:var(--accent-hover)">${escHtml((t.subject||'—').toUpperCase())}</td>
        <td class="sticky-col-2" style="font-weight:600">${escHtml(t.name.toUpperCase())}</td>`;
      
      DAYS.forEach(d => {
        const slots = _schedule.filter(s => s.teacher_id == t.id && s.day == d);
        HOURS_BY_DAY[d].forEach((h, idx) => {
          const slot = slots.find(s => s.hour == h);
          const val = slot?.raw_value || '';
          const type = slot?.slot_type || 'empty';
          
          let cellClass = 'ov-cell-normal';
          let showText = true;
          if (type === 'disponibile') { cellClass = 'ov-cell-dis'; if(_filterMode==='classi') showText=false; }
          else if (type === 'eccedente') { cellClass = 'ov-cell-ecc'; if(_filterMode==='classi') showText=false; }
          else if (type === 'empty') { cellClass = ''; showText=false; }
          else { if(_filterMode==='dis_ecc') showText=false; }
          
          if (!showText) cellClass = '';

          const isLastHour = idx === HOURS_BY_DAY[d].length - 1;
          const borderRight = isLastHour ? 'border-right:2px solid var(--border-thick)' : '';

          html += `
            <td class="schedule-cell ${cellClass}" 
                data-tid="${t.id}" data-day="${d}" data-hour="${h}"
                style="${borderRight}; cursor:pointer;">
              ${showText ? escHtml(val||'') : ''}
            </td>`;
        });
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    return html;
  }

  function editCell(cell) {
    if (!APP.isAdmin()) return;
    const day  = cell.dataset.day;
    const hour = parseInt(cell.dataset.hour);
    const tid  = cell.dataset.tid;
    const teacher = _teachers.find(t => t.id == tid);
    const current = cell.textContent.trim();
    
    const ov = APP.modal({
      title: `Modifica: ${teacher.name} - ${DAY_LABELS[day]} ${hour}:00`,
      body: `
        <div class="form-group"><label>Valore</label><input type="text" id="cell-val" value="${escHtml(current)}" placeholder="Classe, DIS, R, *" autofocus/></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${['DIS','ECC','R','*',''].map(v=>`<button class="btn btn-secondary btn-sm" onclick="document.getElementById('cell-val').value='${v}'">${v||'Svuota'}</button>`).join('')}
        </div>`,
      footer: `<button class="btn btn-secondary" id="ce-cancel">Annulla</button><button class="btn btn-primary" id="ce-save">Salva</button>`
    });
    ov.querySelector('#ce-cancel').onclick = () => ov.remove();
    ov.querySelector('#ce-save').onclick = async () => {
      const raw = ov.querySelector('#cell-val').value.trim();
      try {
        await API.put('/schedule/slot', { teacher_id: tid, day, hour, raw_value: raw, school_year_id: _yearId });
        ov.remove(); loadMasterGrid(); APP.toast('Slot aggiornato','success');
      } catch(e) { APP.toast(e.message,'error'); }
    };
  }



  function exportFullPdf() {
    const table = document.querySelector('.ov-master-table');
    if (!table) return;
    const win = window.open('','_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Orario Settimanale Docenti</title>
      <style>body{font-family:Arial,sans-serif;font-size:8px;padding:10px}
      table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:2px;text-align:center}
      th{background:#f3f4f6}.sticky-col{text-align:left;font-weight:bold}
      @media print{@page{size:A3 landscape;margin:1cm}}</style></head><body>
      <h1>Orario Settimanale Docenti</h1>
      ${table.outerHTML}
      <script>window.onload=()=>{window.print(); window.close();}<\/script></body></html>`);
    win.document.close();
  }

  return { render, downloadTemplate, showImportModal, openExportModal: exportCurrentView, exportFullPdf };
})();
