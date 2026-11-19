var SettingsView = (() => {
  let _activeTab = 'years';
  let _yearId = null;

  async function render(container, state) {
    _yearId = state.yearId;
    const user = state.user;
    const isAdminMaster = user?.role === 'admin_master';
    
    if (user?.role === 'teacher') {
      container.innerHTML='<div class="empty-state"><div class="icon">🔒</div><h3>Accesso non autorizzato</h3></div>'; return;
    }
    
    // Available tabs based on role (la gestione ruoli è ora centralizzata in Amministrazione -> Ruoli & Permessi)
    const allTabs = ['years','classes','log','testmode','password'];
    const visibleTabs = isAdminMaster ? allTabs : allTabs.filter(t => t !== 'log');
    
    container.innerHTML = `
      <div class="page-header"><div class="page-title">⚙️ Impostazioni</div><div class="page-subtitle">Anni scolastici, classi e configurazione sistema</div></div>
      <div style="display:flex;gap:4px;margin-bottom:20px;background:var(--bg-secondary);padding:4px;border-radius:var(--radius);width:fit-content;overflow-x:auto;max-width:100%">
        ${visibleTabs.map(t=>`
          <button class="btn ${_activeTab===t?'btn-primary':'btn-ghost'} btn-sm" style="border-radius:6px; white-space:nowrap" onclick="SettingsView.setTab('${t}')" id="tab-${t}">
            ${{years:'🗓 Anni',classes:'🏫 Classi',log:'📜 Log Sistema',testmode:'🧪 Modalità Test',password:'🔐 Password'}[t]}
          </button>`).join('')}
      </div>
      <div id="settings-content"></div>`;
    // Reset to 'years' if on 'log' tab but not admin_master
    if (_activeTab === 'log' && !isAdminMaster) _activeTab = 'years';
    loadTab();
  }

  function setTab(tab) {
    _activeTab = tab;
    document.querySelectorAll('[id^="tab-"]').forEach(b => {
      b.className = `btn btn-ghost btn-sm`;
      b.style.borderRadius='6px';
    });
    const active = document.getElementById('tab-'+tab);
    if (active) { active.className='btn btn-primary btn-sm'; active.style.borderRadius='6px'; }
    loadTab();
  }

  function loadTab() {
    const content = document.getElementById('settings-content');
    if (!content) return;
    const fns = { years: loadYears, classes: loadClasses, users: loadUsers, log: loadActivityLog, testmode: loadTestMode, password: renderPasswordChange };
    (fns[_activeTab]||loadYears)(content);
  }

  async function loadActivityLog(el) {
    el.innerHTML='<div class="loading-overlay"><div class="spinner"></div> Caricamento log...</div>';
    try {
      const logs = (await API.get('/settings/log')) || [];
      
      el.innerHTML = `
        <div class="card" style="max-width:1200px; margin:0 auto;">
          <div class="card-header" style="flex-wrap:wrap; gap:12px; justify-content:space-between; align-items:center;">
            <div>
              <div class="card-title">📜 Log Attività &amp; Accessi</div>
              <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">Monitoraggio in tempo reale degli accessi e delle operazioni degli utenti</div>
            </div>
            <div id="log-count-badge" class="badge badge-neutral" style="font-size:11px;">
              ${logs.length} eventi
            </div>
          </div>
          
          <div style="padding:14px 16px; background:var(--bg-secondary); border-bottom:1px solid var(--border); display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
            <div style="flex:1; min-width:220px;">
              <input type="text" id="log-search-input" class="form-control" placeholder="🔍 Cerca per docente, azione o dettaglio..." style="font-size:12px; height:36px;">
            </div>
            <div style="min-width:160px;">
              <select id="log-filter-type" class="form-control" style="font-size:12px; height:36px;">
                <option value="all">Tutte le azioni</option>
                <option value="login">🔑 Solo Accessi / Login</option>
                <option value="sub">📋 Sostituzioni &amp; Assegnazioni</option>
                <option value="absence">🚫 Assenze &amp; Uscite</option>
                <option value="system">⚙️ Modifiche Sistema</option>
              </select>
            </div>
            <div style="min-width:140px;">
              <select id="log-filter-date" class="form-control" style="font-size:12px; height:36px;">
                <option value="all">Tutte le date</option>
                <option value="today">Oggi</option>
                <option value="7days">Ultimi 7 giorni</option>
                <option value="30days">Ultimi 30 giorni</option>
              </select>
            </div>
          </div>

          <div class="table-wrapper" style="max-height:480px; overflow-y:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:12px;">
              <thead style="position:sticky; top:0; background:var(--bg-secondary); z-index:10; border-bottom:2px solid var(--border);">
                <tr>
                  <th style="padding:10px 14px; text-align:left; width:150px;">Data/Ora</th>
                  <th style="text-align:left; width:160px;">Utente</th>
                  <th style="text-align:left; width:140px;">Azione</th>
                  <th style="text-align:left;">Dettaglio</th>
                </tr>
              </thead>
              <tbody id="log-table-body">
                <!-- popolato dinamicamente -->
              </tbody>
            </table>
          </div>
        </div>`;

      const searchInput = el.querySelector('#log-search-input');
      const filterType = el.querySelector('#log-filter-type');
      const filterDate = el.querySelector('#log-filter-date');
      const tableBody = el.querySelector('#log-table-body');
      const countBadge = el.querySelector('#log-count-badge');

      const renderRows = () => {
        const query = (searchInput.value || '').toLowerCase().trim();
        const typeVal = filterType.value;
        const dateVal = filterDate.value;
        const now = new Date();

        const filtered = logs.filter(l => {
          // Filtro testo
          const matchText = !query || 
            (l.username || '').toLowerCase().includes(query) ||
            (l.action || '').toLowerCase().includes(query) ||
            (l.detail || '').toLowerCase().includes(query);

          if (!matchText) return false;

          // Filtro tipo azione
          const act = (l.action || '').toLowerCase();
          if (typeVal === 'login' && !act.includes('login') && !act.includes('auth')) return false;
          if (typeVal === 'sub' && !act.includes('sub') && !act.includes('sostituz') && !act.includes('assign')) return false;
          if (typeVal === 'absence' && !act.includes('abs') && !act.includes('assenz') && !act.includes('trip') && !act.includes('uscita')) return false;
          if (typeVal === 'system' && (act.includes('login') || act.includes('sub') || act.includes('abs'))) return false;

          // Filtro data
          if (dateVal !== 'all' && l.timestamp) {
            const logDate = new Date(l.timestamp);
            const diffDays = (now - logDate) / (1000 * 60 * 60 * 24);
            if (dateVal === 'today' && logDate.toDateString() !== now.toDateString()) return false;
            if (dateVal === '7days' && diffDays > 7) return false;
            if (dateVal === '30days' && diffDays > 30) return false;
          }

          return true;
        });

        countBadge.textContent = `${filtered.length} di ${logs.length} eventi`;

        if (!filtered.length) {
          tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:32px; color:var(--text-muted); font-style:italic;">Nessun log corrisponde ai criteri di ricerca</td></tr>`;
          return;
        }

        tableBody.innerHTML = filtered.map(l => {
          const act = (l.action || '').toUpperCase();
          let badgeClass = 'badge-neutral';
          if (act.includes('LOGIN') || act.includes('AUTH')) badgeClass = 'badge-info';
          else if (act.includes('DELETE') || act.includes('REMOVE') || act.includes('REJECT')) badgeClass = 'badge-danger';
          else if (act.includes('ADD') || act.includes('CREATE') || act.includes('ASSIGN')) badgeClass = 'badge-success';
          else if (act.includes('UPDATE') || act.includes('EDIT')) badgeClass = 'badge-warning';

          return `
            <tr style="border-bottom:1px solid var(--border);">
              <td style="padding:8px 14px; font-size:11px; white-space:nowrap; color:var(--text-secondary);">${new Date(l.timestamp).toLocaleString('it-IT')}</td>
              <td style="font-weight:700; color:var(--text-primary);">${escHtml(l.username)}</td>
              <td><span class="badge ${badgeClass}" style="font-size:10px; font-weight:600;">${escHtml(l.action)}</span></td>
              <td style="color:var(--text-secondary); line-height:1.4;">${escHtml(l.detail)}</td>
            </tr>
          `;
        }).join('');
      };

      searchInput.addEventListener('input', renderRows);
      filterType.addEventListener('change', renderRows);
      filterDate.addEventListener('change', renderRows);

      renderRows();

    } catch(e) { APP.toast(e.message, 'error'); }
  }

  // ── ANNI SCOLASTICI ──
  async function loadYears(container) {
    const el = document.getElementById('settings-content');
    el.innerHTML='<div class="loading-overlay"><div class="spinner"></div></div>';
    try {
      const years = await API.get('/settings/years');
      const isAdminMaster = APP.getState().user?.role === 'admin_master';
      el.innerHTML = `
        <div class="card" style="max-width:900px; margin:0 auto;">
          <div class="card-header" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
            <div class="card-title">Anni Scolastici</div>
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              ${isAdminMaster ? `
                <button class="btn btn-secondary btn-sm" id="reset-db-btn" style="justify-content:center;">🗑 Ripristina Esempi</button>
                <button class="btn btn-accent btn-sm" id="seed-test-btn" style="justify-content:center;">🧪 Carica Dati Test</button>
              ` : ''}
              <button class="btn btn-primary btn-sm" id="add-year-btn" style="justify-content:center;">+ Nuovo Anno</button>
            </div>
          </div>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style="text-align:left;">Anno</th>
                  <th style="text-align:center;">Inizio</th>
                  <th style="text-align:center;">Fine</th>
                  <th style="text-align:center;">Stato</th>
                  <th style="text-align:center;">Azioni</th>
                </tr>
              </thead>
              <tbody>${years.map(y=>{
                return `
                <tr>
                  <td style="text-align:left;"><strong>${escHtml(y.name)}</strong></td>
                  <td style="text-align:center;">${fmtDate(y.start_date)}</td>
                  <td style="text-align:center;">${fmtDate(y.end_date)}</td>
                  <td style="text-align:center;">${y.is_active?'<span class="badge badge-success">✓ Attivo</span>':'<span class="badge badge-neutral">Inattivo</span>'}</td>
                  <td style="text-align:center;">
                    <div style="display:inline-flex; gap:6px; align-items:center; justify-content:center;">
                      ${!y.is_active?`<button class="btn btn-success btn-sm" onclick="SettingsView.activateYear(${y.id})">Attiva</button>`:''}
                      <button class="btn btn-ghost btn-sm" onclick="SettingsView.deleteYear(${y.id})" title="Elimina anno">🗑️</button>
                    </div>
                  </td>
                </tr>`;
              }).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
      el.querySelector('#add-year-btn').onclick = openYearModal;
      el.querySelector('#seed-test-btn')?.addEventListener('click', async () => {
        if (await APP.confirm('Caricare lo scenario di simulazione (15 docenti, classi e orari) per l\'anno selezionato?')) {
          const targetYearId = _yearId || APP.getState().yearId;
          const res = await SeedData.run(targetYearId);
          APP.toast(res.message, 'success');
          loadTab();
        }
      });
      el.querySelector('#reset-db-btn')?.addEventListener('click', async () => {
        if (await APP.confirm('ATTENZIONE: Questo cancellerà tutti i tuoi dati attuali e caricherà i docenti di esempio. Procedere?')) {
          await API.post('/settings/reset');
        }
      });
    } catch(e) { APP.toast(e.message,'error'); }
  }

  function openYearModal() {
    const ov = APP.modal({
      title: 'Nuovo Anno Scolastico',
      body: `
        <div class="form-group"><label>Nome *</label><input type="text" id="y-name" placeholder="es. 2025/2026"/></div>
        <div class="form-group"><label>Data inizio *</label><input type="date" id="y-start"/></div>
        <div class="form-group"><label>Data fine *</label><input type="date" id="y-end"/></div>`,
      footer: `<button class="btn btn-secondary" id="y-cancel">Annulla</button><button class="btn btn-primary" id="y-save">Crea Anno</button>`
    });
    ov.querySelector('#y-cancel').onclick = () => ov.remove();
    ov.querySelector('#y-save').onclick = async () => {
      const name=ov.querySelector('#y-name').value.trim(), start=ov.querySelector('#y-start').value, end=ov.querySelector('#y-end').value;
      if (!name||!start||!end) { APP.toast('Compila tutti i campi','error'); return; }
      try { await API.post('/settings/years',{name,start_date:start,end_date:end}); ov.remove(); await APP.loadYears(); setTab('years'); APP.toast('Anno creato','success'); }
      catch(e) { APP.toast(e.message,'error'); }
    };
  }

  async function activateYear(id) {
    try { await API.put(`/settings/years/${id}/activate`); await APP.loadYears(); setTab('years'); APP.toast('Anno attivato','success'); }
    catch(e) { APP.toast(e.message,'error'); }
  }

  async function deleteYear(id) {
    if (!await APP.confirm('Eliminare questo anno? Tutti i dati associati saranno eliminati.')) return;
    try { await API.del(`/settings/years/${id}`); await APP.loadYears(); setTab('years'); APP.toast('Anno eliminato','success'); }
    catch(e) { APP.toast(e.message,'error'); }
  }

  // ── CLASSI ──
  async function loadClasses(container) {
    const yearId = APP.getState().yearId;
    const el = document.getElementById('settings-content');
    if (!yearId) { el.innerHTML='<div class="empty-state"><h3>Seleziona un anno scolastico</h3></div>'; return; }
    el.innerHTML='<div class="loading-overlay"><div class="spinner"></div></div>';
    try {
      const classes = await API.get(`/settings/classes?year_id=${yearId}`);
      el.innerHTML = `
        <div class="card" style="max-width:900px; margin:0 auto;">
          <div class="card-header">
            <div><div class="card-title">Classi (${classes.length})</div></div>
            <div style="display:flex;gap:8px">
              <button class="btn btn-secondary btn-sm" id="bulk-class-btn">+ Aggiungi Più Classi</button>
              <button class="btn btn-primary btn-sm" id="add-class-btn">+ Aggiungi Classe</button>
            </div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px;padding:4px 0">
            ${classes.map(c=>`
              <span class="badge badge-neutral" style="font-size:13px;padding:6px 12px">
                ${escHtml(c.name)}
                <span style="cursor:pointer;margin-left:6px;color:var(--danger-text)" onclick="SettingsView.deleteClass(${c.id},'${escHtml(c.name)}')">✕</span>
              </span>`).join('')}
            ${!classes.length?'<div class="empty-state" style="padding:16px;width:100%"><p>Nessuna classe configurata</p></div>':''}
          </div>
        </div>`;
      el.querySelector('#add-class-btn').onclick = () => openClassModal(yearId);
      el.querySelector('#bulk-class-btn').onclick = () => openBulkClassModal(yearId);
    } catch(e) { APP.toast(e.message,'error'); }
  }

  function openClassModal(yearId) {
    const ov = APP.modal({
      title: 'Aggiungi Classe',
      body: `<div class="form-group"><label>Nome classe *</label><input type="text" id="cls-name" placeholder="es. 2A" autofocus/></div>`,
      footer: `<button class="btn btn-secondary" id="cls-cancel">Annulla</button><button class="btn btn-primary" id="cls-save">Aggiungi</button>`
    });
    ov.querySelector('#cls-cancel').onclick = () => ov.remove();
    ov.querySelector('#cls-save').onclick = async () => {
      const name = ov.querySelector('#cls-name').value.trim();
      if (!name) { APP.toast('Nome obbligatorio','error'); return; }
      try { await API.post('/settings/classes',{name,school_year_id:yearId}); ov.remove(); setTab('classes'); APP.toast('Classe aggiunta','success'); }
      catch(e) { APP.toast(e.message,'error'); }
    };
  }

  function openBulkClassModal(yearId) {
    const ov = APP.modal({
      title: 'Aggiungi Più Classi',
      body: `<div class="form-group"><label>Nomi classi (uno per riga)</label><textarea id="bulk-names" style="height:150px" placeholder="1A\n1B\n2A\n2B\n3A\n3B"></textarea></div>`,
      footer: `<button class="btn btn-secondary" id="bk-cancel">Annulla</button><button class="btn btn-primary" id="bk-save">Aggiungi Tutte</button>`
    });
    ov.querySelector('#bk-cancel').onclick = () => ov.remove();
    ov.querySelector('#bk-save').onclick = async () => {
      const names = ov.querySelector('#bulk-names').value.split('\n').map(s=>s.trim()).filter(Boolean);
      if (!names.length) { APP.toast('Inserisci almeno un nome','error'); return; }
      try { await API.post('/settings/classes/bulk',{names,school_year_id:yearId}); ov.remove(); setTab('classes'); APP.toast(`${names.length} classi aggiunte`,'success'); }
      catch(e) { APP.toast(e.message,'error'); }
    };
  }

  async function deleteClass(id, name) {
    if (!await APP.confirm(`Eliminare la classe ${name}?`)) return;
    try { await API.del(`/settings/classes/${id}`); setTab('classes'); APP.toast('Classe eliminata','success'); }
    catch(e) { APP.toast(e.message,'error'); }
  }

  async function loadUsers() {
    const el = document.getElementById('settings-content');
    const state = APP.getState();
    const isAdminMaster = state.user?.role === 'admin_master';
    
    el.innerHTML='<div class="loading-overlay"><div class="spinner"></div></div>';
    try {
      const [users, teachers] = await Promise.all([API.get('/settings/users'), API.get(`/teachers?year_id=${APP.getState().yearId}`)]);
      const ROLES = { admin_master: '👑 Admin Master', admin:'Amministratore', secretary:'Segreteria', director:'Dirigente', teacher:'Docente' };
      const ROLE_BADGES = { admin_master:'badge-warning', admin:'badge-danger', director:'badge-accent', secretary:'badge-warning', teacher:'badge-neutral' };
      el.innerHTML = `
        <div class="card" style="max-width:1200px; margin:0 auto;">
          <div class="card-header"><div class="card-title">Utenti (${users.length})</div>${isAdminMaster ? '<button class="btn btn-primary btn-sm" id="add-user-btn">+ Nuovo Utente</button>' : ''}</div>
          <div class="table-wrapper"><table>
            <thead><tr><th>Username</th><th>Ruolo</th><th>Docente collegato</th><th>Creato il</th>${isAdminMaster ? '<th>Azioni</th>' : ''}</tr></thead>
            <tbody>${users.map(u=>`
              <tr>
                <td><strong>${escHtml(u.username)}</strong></td>
                <td><span class="badge ${ROLE_BADGES[u.role]||'badge-neutral'}">${ROLES[u.role]||u.role}</span></td>
                <td>${u.teacher_id?escHtml(teachers.find(t=>t.id===u.teacher_id)?.name||'—'):'—'}</td>
                <td style="color:var(--text-secondary);font-size:12px">${fmtDate(u.created_at?.slice(0,10))}</td>
                ${isAdminMaster ? `<td style="display:flex;gap:4px">
                  <button class="btn btn-ghost btn-sm" onclick="SettingsView.openUserModal(${u.id})">✏️</button>
                  <button class="btn btn-ghost btn-sm" onclick="SettingsView.deleteUser(${u.id},'${escHtml(u.username)}')">🗑️</button>
                </td>` : '<td></td>'}
              </tr>`).join('')}
            </tbody></table></div>
        </div>`;
      if (isAdminMaster) el.querySelector('#add-user-btn')?.addEventListener('click', () => openUserModal(null));
    } catch(e) { APP.toast(e.message,'error'); }
  }

  async function openUserModal(userId) {
    const teachers = await API.get(`/teachers?year_id=${APP.getState().yearId}`).catch(()=>[]);
    let user = null;
    if (userId) { const users = await API.get('/settings/users').catch(()=>[]); user = users.find(u=>u.id===userId); }
    const ov = APP.modal({
      title: user ? 'Modifica Utente' : 'Nuovo Utente',
      body: `
        <div class="form-group"><label>Username *</label><input type="text" id="u-username" value="${escHtml(user?.username||'')}" ${user?'readonly':''}  placeholder="username"/></div>
        <div class="form-group"><label>Password ${user?'(lascia vuoto per non cambiare)':'*'}</label><input type="password" id="u-password" placeholder="min 6 caratteri"/></div>
        <div class="form-group"><label>Ruolo *</label>
          <select id="u-role" data-no-tomselect="1">
            <option value="admin_master" ${user?.role==='admin_master'?'selected':''}>👑 Admin Master (accesso completo)</option>
            <option value="admin" ${user?.role==='admin'?'selected':''}>🔑 Amministratore</option>
            <option value="director" ${user?.role==='director'?'selected':''}>🏫 Dirigente</option>
            <option value="secretary" ${user?.role==='secretary'?'selected':''}>📋 Segreteria</option>
            <option value="teacher" ${user?.role==='teacher'?'selected':''}>👨‍🏫 Docente</option>
          </select>
        </div>
        <div class="form-group"><label>Docente collegato (opzionale)</label>
          <select id="u-teacher" data-no-tomselect="1"><option value="">— Nessuno —</option>${teachers.map(t=>`<option value="${t.id}" ${user?.teacher_id===t.id?'selected':''}>${escHtml(t.name)}</option>`).join('')}</select>
        </div>`,
      footer: `<button class="btn btn-secondary" id="u-cancel">Annulla</button><button class="btn btn-primary" id="u-save">Salva</button>`
    });
    ov.querySelector('#u-cancel').onclick = () => ov.remove();
    ov.querySelector('#u-save').onclick = async () => {
      const payload = {
        username: ov.querySelector('#u-username').value.trim(),
        password: ov.querySelector('#u-password').value,
        role: ov.querySelector('#u-role').value,
        teacher_id: ov.querySelector('#u-teacher').value ? parseInt(ov.querySelector('#u-teacher').value) : null
      };
      if (!user && !payload.password) { APP.toast('Password obbligatoria','error'); return; }
      try {
        if (user) await API.put(`/settings/users/${user.id}`, payload); else await API.post('/settings/users', payload);
        ov.remove(); setTab('users'); APP.toast('Utente salvato','success');
      } catch(e) { APP.toast(e.message,'error'); }
    };
  }

  async function deleteUser(id, username) {
    if (!await APP.confirm(`Eliminare l'utente "${username}"?`)) return;
    try { await API.del(`/settings/users/${id}`); setTab('users'); APP.toast('Utente eliminato','success'); }
    catch(e) { APP.toast(e.message,'error'); }
  }

  // ── MODALITA TEST / SIMULAZIONE ──
  async function loadTestMode(el) {
    const simActive = APP.isSimulationMode();
    el.innerHTML = `
      <div class="card" style="max-width:720px; margin:0 auto;">
        <div class="card-header" style="justify-content:space-between; align-items:center;">
          <div>
            <div class="card-title">🧪 Modalità Test / Simulazione</div>
            <div style="font-size:12px; color:var(--text-secondary); margin-top:2px;">Ambiente dimostrativo per sperimentare la gestione delle sostituzioni</div>
          </div>
          <span class="badge ${simActive ? 'badge-warning' : 'badge-neutral'}" style="font-size:12px; padding:6px 12px; font-weight:700;">
            ${simActive ? '● Test Attivo' : '○ Disattivata'}
          </span>
        </div>

        <div style="padding:16px 0; font-size:13px; line-height:1.6; color:var(--text-secondary);">
          <p style="margin-bottom:12px;">
            La <strong>Modalità Simulazione (Sandbox)</strong> ti consente di provare tutte le funzioni del gestionale in totale sicurezza con uno scenario dimostrativo completo:
          </p>
          <ul style="padding-left:20px; margin-bottom:16px;">
            <li><strong>Isolamento Locale Protetto</strong>: La simulazione è attiva solo su questo computer/browser. <strong>I dati reali e gli altri PC non vengono toccati né interrotti</strong>.</li>
            <li><strong>Gestione Sostituzioni completa</strong>: Assegna docenti in compresenza, a disposizione, eccedenti e oltre 5 ore.</li>
            <li><strong>Assenze &amp; Permessi</strong>: Registra nuove assenze rapide, permessi orari o uscite didattiche.</li>
            <li><strong>Flussi Docenti &amp; Report</strong>: Testa l'accettazione, il rifiuto con motivazione e i report annuali per il Dirigente.</li>
          </ul>

          <div style="background:var(--bg-secondary); border:1px solid var(--border); border-radius:8px; padding:12px 16px; margin-bottom:20px;">
            <div style="font-weight:700; color:var(--text-primary); margin-bottom:4px;">Stato attuale sessione:</div>
            <div>${simActive ? 'La <strong>Modalità Simulazione è ATTIVA</strong> su questo browser. Stai operando sui dati di prova temporanei.' : 'La <strong>Modalità Simulazione è DISATTIVA</strong>. Stai operando sui dati reali di produzione.'}</div>
          </div>

          <div style="display:flex; gap:12px; align-items:center;">
            ${!simActive ? `
              <button class="btn btn-primary btn-lg" id="btn-activate-testmode" style="font-size:13px;">
                <span>⚡</span> Entra in Modalità Simulazione
              </button>
            ` : `
              <button class="btn btn-danger btn-lg" id="btn-deactivate-testmode" style="font-size:13px;">
                <span>✕</span> Esci dalla Modalità Simulazione
              </button>
            `}
          </div>
        </div>
      </div>
    `;

    el.querySelector('#btn-activate-testmode')?.addEventListener('click', async () => {
      await APP.toggleSimulationMode(true);
      loadTestMode(el);
    });

    el.querySelector('#btn-deactivate-testmode')?.addEventListener('click', async () => {
      await APP.toggleSimulationMode(false);
      loadTestMode(el);
    });
  }

  // ── CAMBIO PASSWORD ──
  function renderPasswordChange() {
    const el = document.getElementById('settings-content');
    el.innerHTML = `
      <div class="card" style="max-width:420px; margin:0 auto;">
        <div class="card-header"><div class="card-title">🔐 Cambia Password</div></div>
        <div class="form-group"><label>Password attuale *</label><input type="password" id="pw-current"/></div>
        <div class="form-group"><label>Nuova password *</label><input type="password" id="pw-new"/></div>
        <div class="form-group"><label>Conferma nuova password *</label><input type="password" id="pw-confirm"/></div>
        <button class="btn btn-primary" id="pw-save-btn">Aggiorna Password</button>
      </div>`;
    el.querySelector('#pw-save-btn').onclick = async () => {
      const cur = el.querySelector('#pw-current').value;
      const nw  = el.querySelector('#pw-new').value;
      const conf= el.querySelector('#pw-confirm').value;
      if (!cur||!nw) { APP.toast('Compila tutti i campi','error'); return; }
      if (nw !== conf) { APP.toast('Le password non coincidono','error'); return; }
      if (nw.length < 6) { APP.toast('La password deve avere almeno 6 caratteri','error'); return; }
      try { await API.post('/auth/change-password',{currentPassword:cur,newPassword:nw}); APP.toast('Password aggiornata con successo','success'); el.querySelector('#pw-current').value=el.querySelector('#pw-new').value=el.querySelector('#pw-confirm').value=''; }
      catch(e) { APP.toast(e.message,'error'); }
    };
  }

  return { render, setTab, activateYear, deleteYear, deleteClass, openUserModal, deleteUser, loadTestMode };
})();
