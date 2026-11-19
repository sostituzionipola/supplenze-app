/**
 * roles.js - Gestione Ruoli & Permessi per I.C. Padre A. Gemelli
 * Mostra l'elenco completo di TUTTI i docenti e utenti registrati,
 * consentendo di promuovere a Gestore Supplenze (Admin) e di retrocedere
 * a Semplice Utente (Docente) in qualsiasi momento con un click.
 */
var RolesView = (() => {
  let _unifiedItems = [];
  let _yearId = null;

  async function render(container, state) {
    const user = state.user;
    const isAdmin = user?.role === 'admin' || user?.role === 'admin_master';
    _yearId = state.yearId;

    if (!isAdmin) {
      container.innerHTML = `
        <div class="empty-state" style="max-width:600px; margin:40px auto; text-align:center;">
          <div class="icon" style="font-size:48px;">🔒</div>
          <h3>Accesso non autorizzato</h3>
          <p style="color:var(--text-secondary);">La gestione dei ruoli è riservata ai Gestori Supplenze e agli Amministratori di sistema.</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div style="max-width:1100px; margin:0 auto; padding:0 12px 40px;">
        <!-- HEADER -->
        <div class="page-header" style="margin-bottom:20px;">
          <div class="flex justify-between items-center" style="flex-wrap:wrap; gap:12px;">
            <div>
              <h1 class="page-title" style="font-size:22px; font-weight:800; display:flex; align-items:center; gap:10px;">
                🛡️ Ruoli & Permessi Utenti
              </h1>
              <p class="page-subtitle" style="color:var(--text-secondary); font-size:13px; margin-top:4px;">
                Assegna o revoca i permessi: passa da Semplice Utente a Gestore Supplenze (e viceversa) con un click
              </p>
            </div>
            <div>
              <button class="btn btn-secondary btn-sm" onclick="RolesView.reload()" style="display:inline-flex; align-items:center; gap:6px;">
                🔄 Aggiorna Elenco
              </button>
            </div>
          </div>
        </div>

        <!-- STATS CARDS -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:24px;">
          <div class="card" style="padding:16px 20px; display:flex; align-items:center; gap:16px;">
            <div style="font-size:32px;">👥</div>
            <div>
              <div style="font-size:11px; color:var(--text-secondary); text-transform:uppercase; font-weight:700; letter-spacing:0.5px;">Totale Utenti & Docenti</div>
              <div id="stat-total-teachers" style="font-size:24px; font-weight:800; color:var(--text-primary);">—</div>
            </div>
          </div>
          <div class="card" style="padding:16px 20px; display:flex; align-items:center; gap:16px; border-left:4px solid #ef4444;">
            <div style="font-size:32px;">🔑</div>
            <div>
              <div style="font-size:11px; color:var(--text-secondary); text-transform:uppercase; font-weight:700; letter-spacing:0.5px;">Gestori Supplenze (Admin)</div>
              <div id="stat-total-admins" style="font-size:24px; font-weight:800; color:#ef4444;">—</div>
            </div>
          </div>
          <div class="card" style="padding:16px 20px; display:flex; align-items:center; gap:16px; border-left:4px solid var(--accent, #2563eb);">
            <div style="font-size:32px;">👨‍🏫</div>
            <div>
              <div style="font-size:11px; color:var(--text-secondary); text-transform:uppercase; font-weight:700; letter-spacing:0.5px;">Semplici Utenti (Docenti)</div>
              <div id="stat-total-users" style="font-size:24px; font-weight:800; color:var(--text-primary);">—</div>
            </div>
          </div>
        </div>

        <!-- MAIN CARD TABELLA -->
        <div class="card" style="overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.04);">
          <!-- BARRA RICERCA & FILTRI -->
          <div style="padding:16px 20px; background:var(--bg-secondary); border-bottom:1px solid var(--border); display:flex; gap:14px; flex-wrap:wrap; align-items:center; justify-content:space-between;">
            <div style="flex:1; min-width:260px;">
              <input type="text" id="roles-search-input" class="form-control" placeholder="🔍 Cerca per nome, cognome, email o username..." style="font-size:13px; height:38px;">
            </div>
            <div style="min-width:200px;">
              <select id="roles-filter-role" class="form-control" style="font-size:13px; height:38px;">
                <option value="all">Tutti i ruoli</option>
                <option value="admin">🔑 Solo Gestori Supplenze (Admin)</option>
                <option value="teacher">👨‍🏫 Solo Semplici Utenti (Docenti)</option>
              </select>
            </div>
          </div>

          <!-- CONTENITORE TABELLA -->
          <div class="table-wrapper" style="min-height:280px; overflow-x:auto;">
            <div id="roles-table-container">
              <div class="loading-overlay" style="padding:40px; text-align:center;"><div class="spinner"></div> Caricamento utenti e ruoli...</div>
            </div>
          </div>
        </div>
      </div>
    `;

    await loadData();
    setupListeners();
  }

  async function loadData() {
    try {
      const yearId = _yearId || APP.getState().yearId;
      // Recuperiamo TUTTI i docenti (con e senza filtro anno per non perderne nessuno) e TUTTI gli utenti
      const [teachersCurrentYear, allUsers] = await Promise.all([
        API.get('/teachers' + (yearId ? `?year_id=${yearId}` : '')).catch(() => []),
        API.get('/settings/users').catch(() => [])
      ]);

      const teachers = teachersCurrentYear || [];
      const users = allUsers || [];

      // Mappatura unificata: docenti + utenti puri
      const map = new Map();

      // 1. Inserisci tutti i docenti censiti
      teachers.forEach(t => {
        const key = t.email ? t.email.toLowerCase().trim() : `teacher_${t.id}`;
        map.set(key, {
          type: 'teacher',
          teacherId: t.id,
          name: t.name || 'Docente senza nome',
          email: t.email || '',
          username: t.email ? t.email.split('@')[0] : '',
          role: t.role || (t.is_admin ? 'admin' : 'teacher'),
          userObj: null,
          teacherObj: t
        });
      });

      // 2. Associa o inserisci gli utenti dalla tabella 'users'
      users.forEach(u => {
        let matched = null;
        if (u.teacher_id) {
          // Trova per teacher_id
          for (let item of map.values()) {
            if (item.teacherId === u.teacher_id) { matched = item; break; }
          }
        }
        if (!matched && u.email) {
          const key = u.email.toLowerCase().trim();
          if (map.has(key)) matched = map.get(key);
        }

        if (matched) {
          matched.userObj = u;
          matched.role = u.role || matched.role;
          if (u.username) matched.username = u.username;
        } else {
          // Utente di sistema non ancora associato ad un docente (es. admin master, segreteria, account speciali)
          const key = u.email ? u.email.toLowerCase().trim() : `user_${u.id}`;
          map.set(key, {
            type: 'user_only',
            teacherId: u.teacher_id || null,
            name: u.name || u.username || 'Utente di Sistema',
            email: u.email || '',
            username: u.username || '',
            role: u.role || 'teacher',
            userObj: u,
            teacherObj: null
          });
        }
      });

      _unifiedItems = Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
      renderTable();
    } catch (e) {
      const container = document.getElementById('roles-table-container');
      if (container) {
        container.innerHTML = `<div class="empty-state" style="padding:40px; text-align:center;"><div class="icon">⚠️</div><h3>Errore caricamento dati</h3><p>${e.message}</p></div>`;
      }
      APP.toast('Errore caricamento ruoli: ' + e.message, 'error');
    }
  }

  function renderTable() {
    const tableContainer = document.getElementById('roles-table-container');
    if (!tableContainer) return;

    const searchInput = document.getElementById('roles-search-input');
    const filterRole = document.getElementById('roles-filter-role');
    const query = (searchInput?.value || '').toLowerCase().trim();
    const roleFilter = filterRole?.value || 'all';

    // Calcolo contatori statistici
    let adminCount = 0;
    let userCount = 0;

    _unifiedItems.forEach(item => {
      const r = item.role;
      if (r === 'admin' || r === 'admin_master') adminCount++;
      else userCount++;
    });

    const statTotal = document.getElementById('stat-total-teachers');
    const statAdmins = document.getElementById('stat-total-admins');
    const statUsers = document.getElementById('stat-total-users');
    if (statTotal) statTotal.textContent = _unifiedItems.length;
    if (statAdmins) statAdmins.textContent = adminCount;
    if (statUsers) statUsers.textContent = userCount;

    // Filtro elementi
    const filtered = _unifiedItems.filter(item => {
      const name = (item.name || '').toLowerCase();
      const email = (item.email || '').toLowerCase();
      const username = (item.username || '').toLowerCase();
      const role = item.role || 'teacher';

      const matchesSearch = !query || name.includes(query) || email.includes(query) || username.includes(query);
      let matchesRole = true;
      if (roleFilter === 'admin') matchesRole = (role === 'admin' || role === 'admin_master');
      if (roleFilter === 'teacher') matchesRole = (role !== 'admin' && role !== 'admin_master');

      return matchesSearch && matchesRole;
    });

    if (!filtered.length) {
      tableContainer.innerHTML = `
        <div class="empty-state" style="padding:48px 20px; text-align:center;">
          <div class="icon" style="font-size:36px; margin-bottom:8px;">🔍</div>
          <h3 style="margin:0 0 4px 0;">Nessun utente trovato</h3>
          <p style="color:var(--text-secondary); font-size:13px; margin:0;">Prova a modificare i termini di ricerca o il filtro ruoli.</p>
        </div>`;
      return;
    }

    tableContainer.innerHTML = `
      <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
        <thead>
          <tr style="background:var(--bg-secondary); border-bottom:2px solid var(--border);">
            <th style="padding:14px 18px; font-weight:700;">Nome & Cognome / Utente</th>
            <th style="padding:14px 18px; font-weight:700;">Email Istituzionale</th>
            <th style="padding:14px 18px; font-weight:700; width:190px; text-align:center;">Ruolo Attuale</th>
            <th style="padding:14px 18px; font-weight:700; width:260px; text-align:right;">Azione (Modifica Ruolo)</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map((item, idx) => {
            const isMaster = item.role === 'admin_master';
            const isManager = item.role === 'admin';

            let roleBadge = '';
            if (isMaster) {
              roleBadge = `<span class="badge badge-warning" style="font-weight:700; padding:4px 10px; font-size:12px;">👑 Admin Master</span>`;
            } else if (isManager) {
              roleBadge = `<span class="badge badge-danger" style="font-weight:700; padding:4px 10px; font-size:12px;">🔑 Gestore Supplenze</span>`;
            } else {
              roleBadge = `<span class="badge badge-neutral" style="font-weight:600; padding:4px 10px; font-size:12px;">👨‍🏫 Docente</span>`;
            }

            return `
              <tr style="border-bottom:1px solid var(--border); background:${idx % 2 === 0 ? 'var(--bg-card)' : 'rgba(0,0,0,0.015)'};">
                <td style="padding:12px 18px;">
                  <div style="font-weight:700; color:var(--text-primary); font-size:14px;">${escHtml(item.name)}</div>
                  ${item.username && item.username !== item.name ? `<div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">username: @${escHtml(item.username)}</div>` : ''}
                </td>
                <td style="padding:12px 18px; color:var(--text-secondary);">
                  ${item.email ? `<span style="font-family:monospace; font-size:12px;">✉️ ${escHtml(item.email)}</span>` : '<span style="color:var(--text-muted); font-style:italic;">Nessuna email registrata</span>'}
                </td>
                <td style="padding:12px 18px; text-align:center;">
                  ${roleBadge}
                </td>
                <td style="padding:12px 18px; text-align:right;">
                  ${isMaster ? `
                    <span style="font-size:11px; color:var(--text-muted); font-style:italic;">Ruolo protetto di sistema</span>
                  ` : isManager ? `
                    <button class="btn btn-secondary btn-sm" onclick="RolesView.toggleRole('${escHtml(item.email || item.username)}', ${item.teacherId || 'null'}, 'teacher')" style="font-size:12px; font-weight:600; padding:6px 12px; color:var(--text-primary);" title="Riporta a Docente">
                      ↩️ Revoca Gestore (Rendi Docente)
                    </button>
                  ` : `
                    <button class="btn btn-primary btn-sm" onclick="RolesView.toggleRole('${escHtml(item.email || item.username)}', ${item.teacherId || 'null'}, 'admin')" style="font-size:12px; font-weight:600; padding:6px 12px;" title="Promuovi a Gestore">
                      ⬆️ Promuovi a Gestore Supplenze
                    </button>
                  `}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  function setupListeners() {
    const searchInput = document.getElementById('roles-search-input');
    const filterRole = document.getElementById('roles-filter-role');

    if (searchInput) searchInput.addEventListener('input', () => renderTable());
    if (filterRole) filterRole.addEventListener('change', () => renderTable());
  }

  async function toggleRole(identifier, teacherId, targetRole) {
    const item = _unifiedItems.find(x => (x.email && x.email === identifier) || (x.username && x.username === identifier) || (teacherId && x.teacherId === teacherId));
    if (!item) return;

    const actionText = targetRole === 'admin'
      ? `Promuovere "${item.name}" a GESTORE SUPPLENZE?\nAvrà accesso completo alla gestione di assenze e orari.`
      : `Reimpostare "${item.name}" come SEMPLICE UTENTE (Docente)?\nI permessi di amministrazione verranno revocati.`;

    if (!await APP.confirm(actionText)) return;

    try {
      // 1. Se esiste un record Docente, aggiorna role e is_admin
      if (item.teacherId) {
        await API.put(`/teachers/${item.teacherId}`, { role: targetRole, is_admin: targetRole === 'admin' }).catch(() => {});
      }

      // 2. Se esiste un record Utente, aggiorna role
      if (item.userObj && item.userObj.id) {
        await API.put(`/settings/users/${item.userObj.id}`, { role: targetRole });
        item.userObj.role = targetRole;
      } else if (item.email) {
        // Se non ha ancora creato l'account ma abbiamo l'email, creiamo il record utente così è già pronto
        const newUsername = item.email.split('@')[0];
        const created = await API.post('/settings/users', {
          username: newUsername,
          email: item.email,
          role: targetRole,
          teacher_id: item.teacherId || null
        }).catch(() => null);
        if (created) item.userObj = created;
      }

      item.role = targetRole;
      APP.toast(`Ruolo aggiornato per ${item.name}`, 'success');
      renderTable();
    } catch (e) {
      APP.toast('Errore durante l\'aggiornamento del ruolo: ' + e.message, 'error');
    }
  }

  return {
    render,
    reload: loadData,
    toggleRole
  };
})();
