// ══════════════════════════════════
// REPORTS VIEW — Storico & Statistiche
// ══════════════════════════════════
var ReportsView = (() => {
  let _yearId, _teachers=[];

  async function render(container, state) {
    _yearId = state.yearId;
    if (!_yearId) { 
      container.innerHTML = `
        <div class="empty-state" style="padding:40px">
          <div class="icon" style="font-size:48px; margin-bottom:16px;">📈</div>
          <h3 style="margin-bottom:8px;">Report non disponibili</h3>
          <p style="color:var(--text-secondary); max-width:400px; margin:0 auto 20px;">
            I dati statistici e lo storico sono filtrati per anno. Per iniziare, seleziona un <strong>Anno Scolastico</strong> in alto.
          </p>
          <div class="attention-hint" style="font-size:12px; color:var(--accent); font-weight:600;">
            ⬅️ Scegli Anno qui
          </div>
        </div>`;
      return; 
    }

    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
    const today = todayISO();

    container.innerHTML = `
      <div class="page-header" style="padding-bottom:12px; border-bottom:1px solid var(--border)">
        <div class="page-title">📈 Report & Storico</div>
      </div>
      <div class="toolbar" style="margin-top:20px">
        <div class="toolbar-left">
          <input type="date" class="date-input" id="rep-from" value="${firstOfMonth}"/>
          <span style="color:var(--text-secondary)">→</span>
          <input type="date" class="date-input" id="rep-to" value="${today}"/>
          <div class="search-box">
             <span class="s-icon">🔍</span>
             <input type="text" id="rep-search" placeholder="Cerca nello storico…"/>
          </div>
          <select class="filter-select" id="rep-sort">
            <option value="date_desc">Più recenti</option>
            <option value="date_asc">Meno recenti</option>
            <option value="name_asc">Nome Docente (A-Z)</option>
          </select>
        </div>
        <div class="toolbar-right">
          <button class="btn btn-primary" id="rep-load-btn">🔄 Aggiorna</button>
        </div>
      </div>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px">
        <div class="card" id="rep-reasons-card">
          <div class="card-header">
            <div class="card-title">📊 Ripartizione Motivi Assenza</div>
            <button class="btn btn-ghost btn-sm" onclick="ReportsView.exportSection('rep-reasons-card', 'Motivi_Assenza')">📥 PDF</button>
          </div>
          <div id="rep-reasons-list" style="padding:20px"></div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr;gap:20px;margin-bottom:24px">
        <div class="card" id="rep-extra-card">
          <div class="card-header">
            <div class="card-title">🚀 Relazione Straordinari</div>
            <button class="btn btn-ghost btn-sm" onclick="ReportsView.exportSection('rep-extra-card', 'Relazione_Straordinari')">📥 PDF</button>
          </div>
          <div id="rep-extra-list" style="padding:20px"></div>
        </div>
      </div>

      <div class="card" id="rep-history-card" style="margin-bottom:24px">
        <div class="card-header">
          <div class="card-title">📋 Storico Sostituzioni Corrente</div>
          <button class="btn btn-ghost btn-sm" onclick="ReportsView.exportSection('rep-history-card', 'Storico_Sostituzioni')">📥 PDF</button>
        </div>
        <div id="rep-table-wrap" style="max-height:400px; overflow:auto"></div>
      </div>
`;

    try {
      _teachers = await API.get(`/teachers?year_id=${_yearId}`);
    } catch(e) {}

    container.querySelector('#rep-load-btn').onclick = () => loadReport();
    container.querySelector('#rep-search').oninput = debounce(() => renderHistoryTable());
    container.querySelector('#rep-sort').onchange = () => renderHistoryTable();
    loadReport();
  }

  async function loadReport() {
    const from = document.getElementById('rep-from')?.value;
    const to   = document.getElementById('rep-to')?.value;
    if (!from||!to) return;

    const wrap = document.getElementById('rep-table-wrap');
    if (wrap) wrap.innerHTML = '<div class="loading-overlay"><div class="spinner"></div></div>';

    try {
      let url = `/substitutions/history?year_id=${_yearId}&from=${from}&to=${to}`;
      _history = await API.get(url);
      const absences = await API.get(`/absences?year_id=${_yearId}`);
      
      renderReasons(absences);
      loadExtraChart();
      renderHistoryTable();
    } catch(e) { APP.toast(e.message,'error'); if (wrap) wrap.innerHTML = ''; }
  }

  let _history = [];

  function renderHistoryTable() {
    const wrap = document.getElementById('rep-table-wrap');
    if (!wrap) return;

    const q = (document.getElementById('rep-search')?.value||'').toLowerCase();
    const sort = document.getElementById('rep-sort')?.value;

    let filtered = _history.filter(h => {
      return (h.absent_teacher_name||'').toLowerCase().includes(q) ||
             (h.substitute_teacher_name||'').toLowerCase().includes(q) ||
             (h.class_name||'').toLowerCase().includes(q);
    });

    if (sort === 'date_desc') filtered.sort((a,b) => b.date.localeCompare(a.date) || b.hour - a.hour);
    else if (sort === 'date_asc') filtered.sort((a,b) => a.date.localeCompare(b.date) || a.hour - b.hour);
    else if (sort === 'name_asc') filtered.sort((a,b) => (a.substitute_teacher_name||'').localeCompare(b.substitute_teacher_name||''));

    if (!filtered.length) {
      wrap.innerHTML = '<div class="empty-state" style="padding:24px"><div class="icon">📋</div><h3>Nessun risultato trovato</h3></div>';
      return;
    }

    wrap.innerHTML = `<div style="overflow-x:auto"><table>
      <thead><tr><th>Data</th><th>Giorno</th><th>Ora</th><th>Classe</th><th>Titolare</th><th>Supplente</th><th>Stato</th><th>Azioni</th></tr></thead>
      <tbody>${filtered.map(h=>`
        <tr>
          <td>${fmtDate(h.date)}</td>
          <td style="color:var(--text-secondary)">${getDayName(h.date)}</td>
          <td><span class="hour-badge">${h.hour}</span></td>
          <td><strong>${escHtml(h.class_name||'—')}</strong></td>
          <td>${escHtml(h.absent_teacher_name||'—')}</td>
          <td>${h.substitute_teacher_name?`<strong>${escHtml(h.substitute_teacher_name)}</strong>`:'<span class="badge badge-danger">Non coperta</span>'}</td>
          <td style="text-align:center">
            ${h.status === 'rejected' 
              ? `<span class="badge badge-danger" title="${escHtml(h.reject_reason || 'Rifiutata')}">❌ Rifiutata</span>` 
              : (h.hours_counted ? '<span class="badge badge-success">✓ Recupero</span>' : '<span class="badge badge-neutral">Eccedente</span>')}
          </td>
          <td style="text-align:center">
            <button class="btn btn-danger btn-sm" style="padding: 4px 8px; font-size: 11px;" onclick="ReportsView.deleteHist('${h.id}')" title="Elimina e ripristina ore">Elimina</button>
          </td>
        </tr>`).join('')}
      </tbody></table></div>`;
  }

  async function deleteHist(id) {
    if (!confirm('Sei sicuro di voler eliminare questa assegnazione? Verrà rimossa dallo storico e le ore verranno ripristinate nell\'anagrafica del supplente.')) return;
    try {
      await API.del(`/substitutions/${id}`);
      APP.toast('Assegnazione eliminata e storico aggiornato', 'success');
      loadReport(); // Reload the report table
    } catch(e) {
      APP.toast('Errore: ' + e.message, 'error');
    }
  }

  function renderReasons(absences) {
    const listEl = document.getElementById('rep-reasons-list');
    const totalDays = absences.length;
    if (!totalDays) { listEl.innerHTML = '<div class="empty-state">Nessun dato assenze</div>'; return; }

    const map = {};
    absences.forEach(a => {
      const r = (a.reason || 'Senza motivo').trim().toUpperCase();
      map[r] = (map[r]||0) + 1;
    });

    const sorted = Object.entries(map).sort((a,b)=>b[1]-a[1]);
    listEl.innerHTML = sorted.map(([r, count]) => {
      const perc = Math.round((count/totalDays)*100);
      return `
        <div style="margin-bottom:12px">
          <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px">
            <strong>${escHtml(r)}</strong>
            <span style="color:var(--text-secondary)">${count} (${perc}%)</span>
          </div>
          <div style="background:var(--bg-hover); height:8px; border-radius:4px; overflow:hidden">
            <div style="background:var(--accent); height:100%; width:${perc}%"></div>
          </div>
        </div>`;
    }).join('');
  }

  async function loadExtraChart() {
    const el = document.getElementById('rep-extra-list');
    if (!el) return;
    try {
      const [teachers, history, absences] = await Promise.all([
        API.get(`/teachers?year_id=${_yearId}`),
        API.get(`/substitutions/history?year_id=${_yearId}`),
        API.get(`/absences?year_id=${_yearId}`)
      ]);
      
      const extraList = teachers.map(t => {
        const done = history.filter(h => h.substitute_teacher_id == t.id && h.hours_counted).length;
        const initialSubs = parseInt(t.hours_subs) || 0;
        
        let shortPermitHours = 0;

        (absences || []).filter(a => a.teacher_id == t.id && a.status !== 'rejected').forEach(a => {
          const type = (a.type || '').toLowerCase();
          const hoursCount = a.hours_count ? parseInt(a.hours_count) : (a.hours && Array.isArray(a.hours) ? a.hours.length : 1);
          if (type === 'permesso_orario' || type === 'permit_hour' || type === 'permesso_breve') {
            shortPermitHours += hoursCount;
          }
        });

        const totalDebt = initialSubs + shortPermitHours;
        const extra = Math.max(0, done - totalDebt);
        return { ...t, extra, done, totalDebt, initialSubs };
      }).filter(t => t.extra > 0).sort((a,b) => b.extra - a.extra);

      el.innerHTML = extraList.length ? extraList.map(t=>`
        <div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
            <span>${escHtml(t.name)}</span><span class="text-success" style="font-weight:700">+${t.extra}h Straord.</span>
          </div>
          <div style="font-size:10px; color:var(--text-secondary); margin-bottom:4px">Totale effettuate: ${t.done}h (Debito complessivo: ${t.totalDebt}h)</div>
          <div style="background:var(--bg-hover);border-radius:4px;height:6px;overflow:hidden">
            <div style="background:var(--success-text);height:100%;width:${Math.min(100, t.extra*10)}%;border-radius:4px;transition:width .3s"></div>
          </div>
        </div>`).join('') : '<div class="empty-state" style="padding:16px"><div class="icon">🚀</div><p>Nessuno straordinario ancora maturato</p></div>';
    } catch(e) {}
  }

  function exportPDF() {
    const from = document.getElementById('rep-from')?.value;
    const to   = document.getElementById('rep-to')?.value;
    const win = window.open('','_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>Report Completo</title>
      <style>body{font-family:Arial,sans-serif;font-size:11px;color:#000;padding:20px}
      h1{font-size:20px;margin-bottom:4px}h2{font-size:14px;color:#555;font-weight:normal;margin-bottom:24px}
      .card{border:1px solid #eee;margin-bottom:30px;padding:20px;page-break-inside:avoid}
      .card-title{font-size:16px;font-weight:bold;margin-bottom:12px;border-bottom:1px solid #eee;padding-bottom:8px}
      table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;text-align:left}
      th{background:#f3f4f6} button{display:none}</style></head><body>
      <h1>Report Annuale Sostituzioni</h1><h2>Periodo: ${fmtDate(from)} — ${fmtDate(to)}</h2>
      ${Array.from(document.querySelectorAll('.card')).map(c => `<div class="card">${c.innerHTML}</div>`).join('')}
      <script>window.onload=()=>{window.print();window.close();}<\/script></body></html>`);
    win.document.close();
  }

  function exportSection(id, title) {
    const el = document.getElementById(id);
    if (!el) return;
    const win = window.open('','_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;color:#000}
      .card{border:1px solid #eee;padding:30px}
      .card-title{font-size:24px;font-weight:bold;margin-bottom:20px;border-bottom:2px solid #eee;padding-bottom:10px}
      table{width:100%;border-collapse:collapse} th,td{border:1px solid #ddd;padding:10px;text-align:left} th{background:#f9f9f9}
      button{display:none} .loading-overlay { display: none; }
      </style></head><body>
      <div class="card">${el.innerHTML}</div>
      <p style="margin-top:20px;color:#999;font-size:12px">Documento generato il ${new Date().toLocaleString('it-IT')}</p>
      <script>window.onload=()=>{window.print();window.close();}<\/script></body></html>`);
    win.document.close();
  }

  return { render, exportSection, deleteHist };
})();
