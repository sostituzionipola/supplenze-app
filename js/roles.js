/**
 * roles.js - Gestione Ruoli & Permessi per I.C. Padre A. Gemelli
 * Permette ai gestori e tecnici di visualizzare tutti i docenti e assegnare/revocare
 * il ruolo di Gestore Supplenze (Admin) o Semplice Utente (Docente).
 */
var RolesView = (() => {
  let _teachers = [];
  let _users = [];
  let _yearId = null;

  async function render(container, state) {
    const user = state.user;
    const isAdmin = user?.role === 'admin' || user?.role === 'admin_master';
    _yearId = state.yearId;

    if (!isAdmin) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">🔒</div>
          <h3>Accesso non autorizzato</h3>
          <p>La gestione dei ruoli è riservata ai Gestori Supplenze e agli Amministratori di sistema.</p>
        </div>`;
      return;
    }

    container.innerHTML = `
      <div class="page-header" style="margin-bottom:20px;">
        <div class="flex justify-between items-center" style="flex-wrap:wrap; gap:12px;">
          <div>
            <h1 class="page-title" style="font-size:22px; font-weight:800; display:flex; align-items:center; gap:10px;">
              🛡️ Ruoli & Permessi Docenti
            </h1>
            <p class="page-subtitle" style="color:var(--text-secondary); font-size:13px; margin-top:4px;">
              Assegna a qualsiasi docente il ruolo di Gestore Supplenze (accesso completo) o Semplice Utente (Docente)
            </p>
          </div>
          <div>
            <button class="btn btn-secondary btn-sm" onclick="RolesView.reload()">
              🔄 Aggiorna Elenco
            </button>
          </div>
        </div>
      </div>

      <!-- STATS BOX -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:24px;">
        <div class="card" style="padding:16px 20px; display:flex; align-items:center; gap:16px;">
          <div style="font-size:32px;">👥</div>
          <div>
            <div style="font-size:12px; color:var(--text-secondary); text-transform:uppercase; font-weight:700;">Docenti Censiti</div>
            <div id="stat-total-teachers" style="font-size:24px; font-weight:800; color:var(--text-primary);">—</div>
          </div>
        </div>
        <div class="card" style="padding:16px 20px; display:flex; align-items:center; gap:16px; border-left:4px solid var(--accent, #2563eb);">
          <div style="font-size:32px;">🔑</div>
          <div>
            <div style="font-size:12px; color:var(--text-secondary); text-transform:uppercase; font-weight:700;">Gestori Supplenze (Admin)</div>
            <div id="stat-total-admins" style="font-size:24px; font-weight:800; color:var(--accent, #2563eb);">—</div>
          </div>
        </div>
        <div class="card" style="padding:16px 20px; display:flex; align-items:center; gap:16px;">
          <div style="font-size:32px;">👨‍🏫</div>
          <div>
            <div style="font-size:12px; color:var(--text-secondary); text-transform:uppercase; font-weight:700;">Semplici Utenti (Docenti)</div>
            <div id="stat-total-users" style="font-size:24px; font-weight:800; color:var(--text-secondary);">—</div>
          </div>
        </div>
      </div>

      <!-- MAIN CARD -->
      <div class="card">
        <!-- FILTRI & RICERCA -->
        <div style="padding:16px 20px; background:var(--bg-secondary); border-bottom:1px solid var(--border); display:flex; gap:14px; flex-wrap:wrap; align-items:center;">
          <div style="flex:1; min-width:240px;">
            <input type="text" id="roles-search-input" class="form-control" placeholder="🔍 Cerca per nome, cognome o email istituzionale..." style="font-size:13px; height:38px;">
          </div>
          <div style="min-width:200px;">
            <select id="roles-filter-role" class="form-control" style="font-size:13px; height:38px;">
              <option value="all">Tutti i ruoli</option>
              <option value="admin">🔑 Solo Gestori Supplenze (Admin)</option>
              <option value="teacher">👨‍🏫 Solo Semplici Utenti (Docenti)</option>
            </select>
          </div>
        </div>

        <!-- TABLE -->
        <div class="table-wrapper" style="min-height:300px;">
          <div id="roles-table-container">
            <div class="loading-overlay"><div class="spinner"></div> Caricamento docenti e ruoli...</div>
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
      const [teachers, users] = await Promise.all([
        API.get('/teachers' + (yearId ? `?year_id=${yearId}` : '')).catch(() => []),
        API.get('/settings/users').catch(() => [])
      ]);

      _teachers = teachers || [];
      _users = users || [];

      renderTable();
    } catch (e) {
      const container = document.getElementById('roles-table-container');
      if (container) {
        container.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h3>Errore caricamento dati</h3><p>${e.message}</p></div>`;
      }
      APP.toast('Errore caricamento docenti: ' + e.message, 'error');
    }
  }

  function getTeacherRole(teacher) {
    // 1. Cerca utente associato nel DB users per teacher_id o per email
    const userByTeacherId = _users.find(u => u.teacher_id === teacher.id);
    if (userByTeacherId) return userByTeacherId.role;

    if (teacher.email) {
      const userByEmail = _users.find(u => u.email && u.email.toLowerCase() === teacher.email.toLowerCase());
      if (userByEmail) return userByEmail.role;
    }

    // 2. Se non ha ancora creato l'account, controlla il campo role o is_admin sul docente
    if (teacher.role === 'admin' || teacher.is_admin === true) return 'admin';
    return 'teacher';
  }

  function getTeacherUser(teacher) {
    return _users.find(u => u.teacher_id === teacher.id) ||
           (teacher.email ? _users.find(u => u.email && u.email.toLowerCase() === teacher.email.toLowerCase()) : null);
  }

  function renderTable() {
    const tableContainer = document.getElementById('roles-table-container');
    if (!tableContainer) return;

    const searchInput = document.getElementById('roles-search-input');
    const filterRole = document.getElementById('roles-filter-role');
    const query = (searchInput?.value || '').toLowerCase().trim();
    const roleFilter = filterRole?.value || 'all';

    // Calcolo statistiche
    let adminCount = 0;
    let teacherCount = 0;

    _teachers.forEach(t => {
      const r = getTeacherRole(t);
      if (r === 'admin' || r === 'admin_master') adminCount++;
      else teacherCount++;
    });

    const statTotal = document.getElementById('stat-total-teachers');
    const statAdmins = document.getElementById('stat-total-admins');
    const statUsers = document.getElementById('stat-total-users');
    if (statTotal) statTotal.textContent = _teachers.length;
    if (statAdmins) statAdmins.textContent = adminCount;
    if (statUsers) statUsers.textContent = teacherCount;

    // Filtro lista
    const filtered = _teachers.filter(t => {
      const role = getTeacherRole(t);
      const name = (t.name || '').toLowerCase();
      const email = (t.email || '').toLowerCase();

      const matchesSearch = !query || name.includes(query) || email.includes(query);
      let matchesRole = true;
      if (roleFilter === 'admin') matchesRole = (role === 'admin' || role === 'admin_master');
      if (roleFilter === 'teacher') matchesRole = (role !== 'admin' && role !== 'admin_master');

      return matchesSearch && matchesRole;
    });

    if (!filtered.length) {
      tableContainer.innerHTML = `
        <div class="empty-state" style="padding:40px 20px;">
          <div class="icon">🔍</div>
          <h3>Nessun docente trovato</h3>
          <p style="color:var(--text-secondary); font-size:13px;">Prova a modificare i filtri o la ricerca.</p>
        </div>`;
      return;
    }

    tableContainer.innerHTML = `
      <table style="width:100%; border-collapse:collapse; font-size:13px;">
        <thead>
          <tr style="background:var(--bg-secondary); border-bottom:2px solid var(--border); text-align:left;">
            <th style="padding:12px 16px;">Docente</th>
            <th style="padding:12px 16px;">Email Istituzionale</th>
            <th style="padding:12px 16px; width:180px;">Ruolo Attuale</th>
            <th style="padding:12px 16px; width:220px; text-align:right;">Azione Ruolo</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(t => {
            const currentRole = getTeacherRole(t);
            const isManager = currentRole === 'admin';
            const isMaster = currentRole === 'admin_master';
            const userObj = getTeacherUser(t);

            let roleBadge = '';
            if (isMaster) {
              roleBadge = `<span class="badge badge-warning" style="font-weight:700;">👑 Admin Master</span>`;
            } else if (isManager) {
              roleBadge = `<span class="badge badge-danger" style="font-weight:700;">🔑 Gestore Supplenze</span>`;
            } else {
              roleBadge = `<span class="badge badge-neutral" style="font-weight:600;">👨‍🏫 Docente</span>`;
            }

            return `
              <tr style="border-bottom:1px solid var(--border); transition:background 0.15s ease;">
                <td style="padding:12px 16px;">
                  <strong style="color:var(--text-primary); font-size:14px;">${escHtml(t.name || 'Senza Nome')}</strong>
                  ${userObj ? `<span style="font-size:11px; color:var(--text-secondary); margin-left:6px;">(@${escHtml(userObj.username)})</span>` : ''}
                </td>
                <td style="padding:12px 16px; color:var(--text-secondary);">
                  ${t.email ? `<span>✉️ ${escHtml(t.email)}</span>` : '<span style="color:var(--text-muted); font-style:italic;">Nessuna email registrata</span>'}
                </td>
                <td style="padding:12px 16px;">
                  ${roleBadge}
                </td>
                <td style="padding:12px 16px; text-align:right;">
                  ${isMaster ? `
                    <span style="font-size:11px; color:var(--text-muted); font-style:italic;">Ruolo protetto di sistema</span>
                  ` : isManager ? `
                    <button class="btn btn-secondary btn-sm" onclick="RolesView.toggleRole(${t.id}, 'teacher')" title="Rendi Semplice Utente">
                      ⬇️ Imposta come Docente
                    </button>
                  ` : `
                    <button class="btn btn-primary btn-sm" onclick="RolesView.toggleRole(${t.id}, 'admin')" title="Rendi Gestore Supplenze">
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

    if (searchInput) {
      searchInput.addEventListener('input', () => renderTable());
    }
    if (filterRole) {
      filterRole.addEventListener('change', () => renderTable());
    }
  }

  async function toggleRole(teacherId, targetRole) {
    const teacher = _teachers.find(t => t.id === teacherId);
    if (!teacher) return;

    const actionText = targetRole === 'admin' 
      ? `Promuovere "${teacher.name}" a GESTORE SUPPLENZE (accesso completo)?`
      : `Reimpostare "${teacher.name}" come SEMPLICE UTENTE (Docente)?`;

    if (!await APP.confirm(actionText)) return;

    try {
      // 1. Aggiorna record Docente
      await API.put(`/teachers/${teacherId}`, { role: targetRole, is_admin: targetRole === 'admin' });
      teacher.role = targetRole;
      teacher.is_admin = (targetRole === 'admin');

      // 2. Se esiste un account utente associato, aggiorna anche la tabella users
      let existingUser = getTeacherUser(teacher);
      if (existingUser) {
        await API.put(`/settings/users/${existingUser.id}`, { role: targetRole });
        existingUser.role = targetRole;
      } else if (teacher.email) {
        // Se non esiste ancora ma abbiamo l'email, creiamo in anticipo l'utente così quando accede è subito gestore
        const newUsername = teacher.email.split('@')[0];
        const created = await API.post('/settings/users', {
          username: newUsername,
          email: teacher.email,
          role: targetRole,
          teacher_id: teacher.id
        }).catch(() => null);
        if (created) _users.push(created);
      }

      APP.toast(`Ruolo aggiornato per ${teacher.name}`, 'success');
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
