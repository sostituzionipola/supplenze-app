/**
 * roles.js - Gestione Ruoli & Permessi per I.C. Padre A. Gemelli
 * Layout completamente responsive:
 * - Desktop: tabella fluida centrata
 * - Mobile: schede/card native touch-friendly a larghezza piena (niente tabelle schiacciate o confinate a scorrimento)
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
      <style>
        .roles-container {
          width: 100%;
          max-width: 1080px;
          margin: 0 auto;
          padding: 0 4px 40px;
        }
        .roles-desktop-view {
          display: block;
        }
        .roles-mobile-view {
          display: none;
        }
        @media (max-width: 768px) {
          .roles-container {
            padding: 0 0 30px;
          }
          .roles-desktop-view {
            display: none !important;
          }
          .roles-mobile-view {
            display: flex !important;
            flex-direction: column;
            gap: 12px;
          }
          .roles-stats-grid {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
          .roles-filters-bar {
            flex-direction: column !important;
            align-items: stretch !important;
            padding: 12px !important;
          }
        }
      </style>

      <div class="roles-container">
        <!-- HEADER -->
        <div class="page-header" style="margin-bottom:16px;">
          <div class="flex justify-between items-center" style="flex-wrap:wrap; gap:10px;">
            <div>
              <h1 class="page-title" style="font-size:20px; font-weight:800; display:flex; align-items:center; gap:8px;">
                🛡️ Ruoli & Permessi Utenti
              </h1>
              <p class="page-subtitle" style="color:var(--text-secondary); font-size:12.5px; margin-top:2px;">
                Assegna o revoca i permessi tra Semplice Utente (Docente) e Gestore Supplenze
              </p>
            </div>
            <div>
              <button class="btn btn-secondary btn-sm" onclick="RolesView.reload()" style="display:inline-flex; align-items:center; gap:6px; font-size:12px;">
                🔄 Aggiorna
              </button>
            </div>
          </div>
        </div>

        <!-- STATS CARDS -->
        <div class="roles-stats-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px; margin-bottom:16px;">
          <div class="card" style="padding:14px 16px; display:flex; align-items:center; gap:14px;">
            <div style="font-size:28px;">👥</div>
            <div>
              <div style="font-size:11px; color:var(--text-secondary); text-transform:uppercase; font-weight:700;">Totale Utenti & Docenti</div>
              <div id="stat-total-teachers" style="font-size:22px; font-weight:800; color:var(--text-primary);">—</div>
            </div>
          </div>
          <div class="card" style="padding:14px 16px; display:flex; align-items:center; gap:14px; border-left:4px solid #ef4444;">
            <div style="font-size:28px;">🔑</div>
            <div>
              <div style="font-size:11px; color:var(--text-secondary); text-transform:uppercase; font-weight:700;">Gestori Supplenze (Admin)</div>
              <div id="stat-total-admins" style="font-size:22px; font-weight:800; color:#ef4444;">—</div>
            </div>
          </div>
          <div class="card" style="padding:14px 16px; display:flex; align-items:center; gap:14px; border-left:4px solid var(--accent, #2563eb);">
            <div style="font-size:28px;">👨‍🏫</div>
            <div>
              <div style="font-size:11px; color:var(--text-secondary); text-transform:uppercase; font-weight:700;">Semplici Utenti (Docenti)</div>
              <div id="stat-total-users" style="font-size:22px; font-weight:800; color:var(--text-primary);">—</div>
            </div>
          </div>
        </div>

        <!-- MAIN CONTAINER -->
        <div class="card" style="padding:0; overflow:hidden;">
          <!-- FILTRI & RICERCA -->
          <div class="roles-filters-bar" style="padding:14px 16px; background:var(--bg-secondary); border-bottom:1px solid var(--border); display:flex; gap:10px; align-items:center;">
            <div style="flex:1; min-width:220px;">
              <input type="text" id="roles-search-input" class="form-control" placeholder="🔍 Cerca nome, email o username..." style="font-size:13px; height:36px;">
            </div>
            <div style="min-width:180px;">
              <select id="roles-filter-role" class="form-control" style="font-size:13px; height:36px;">
                <option value="all">Tutti i ruoli</option>
                <option value="admin">🔑 Solo Gestori Supplenze</option>
                <option value="teacher">👨‍🏫 Solo Semplici Utenti</option>
              </select>
            </div>
          </div>

          <!-- CONTENITORE DATI (Desktop + Mobile) -->
          <div id="roles-data-container" style="padding:12px;">
            <div class="loading-overlay" style="padding:40px; text-align:center;"><div class="spinner"></div> Caricamento utenti e ruoli...</div>
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
      const [teachersCurrentYear, allUsers] = await Promise.all([
        API.get('/teachers' + (yearId ? `?year_id=${yearId}` : '')).catch(() => []),
        API.get('/settings/users').catch(() => [])
      ]);

      const teachers = teachersCurrentYear || [];
      const users = allUsers || [];

      const map = new Map();

      // 1. Inserisci docenti censiti
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

      // 2. Unisci utenti da tabella users
      users.forEach(u => {
        let matched = null;
        if (u.teacher_id) {
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
      renderData();
    } catch (e) {
      const container = document.getElementById('roles-data-container');
      if (container) {
        container.innerHTML = `<div class="empty-state" style="padding:40px; text-align:center;"><div class="icon">⚠️</div><h3>Errore caricamento dati</h3><p>${e.message}</p></div>`;
      }
      APP.toast('Errore caricamento ruoli: ' + e.message, 'error');
    }
  }

  function renderData() {
    const dataContainer = document.getElementById('roles-data-container');
    if (!dataContainer) return;

    const searchInput = document.getElementById('roles-search-input');
    const filterRole = document.getElementById('roles-filter-role');
    const query = (searchInput?.value || '').toLowerCase().trim();
    const roleFilter = filterRole?.value || 'all';

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
      dataContainer.innerHTML = `
        <div class="empty-state" style="padding:40px 20px; text-align:center;">
          <div class="icon" style="font-size:32px; margin-bottom:6px;">🔍</div>
          <h3 style="margin:0 0 4px 0; font-size:15px;">Nessun utente trovato</h3>
          <p style="color:var(--text-secondary); font-size:12.5px; margin:0;">Modifica i filtri o la ricerca.</p>
        </div>`;
      return;
    }

    // Helper per Badge
    const getBadgeHtml = (item) => {
      if (item.role === 'admin_master') {
        return `<span class="badge badge-warning" style="font-weight:700; padding:4px 8px; font-size:11px;">👑 Admin Master</span>`;
      }
      if (item.role === 'admin') {
        return `<span class="badge badge-danger" style="font-weight:700; padding:4px 8px; font-size:11px;">🔑 Gestore Supplenze</span>`;
      }
      return `<span class="badge badge-neutral" style="font-weight:600; padding:4px 8px; font-size:11px;">👨‍🏫 Docente</span>`;
    };

    // Helper per Bottone Azione
    const getActionBtnHtml = (item, isMobile = false) => {
      const isMaster = item.role === 'admin_master';
      const isManager = item.role === 'admin';
      const idParam = `'${escHtml(item.email || item.username)}', ${item.teacherId || 'null'}`;
      const widthStyle = isMobile ? 'width:100%; justify-content:center; padding:8px 12px;' : 'padding:6px 12px;';

      if (isMaster) {
        return `<span style="font-size:11px; color:var(--text-muted); font-style:italic;">Ruolo protetto</span>`;
      }
      if (isManager) {
        return `
          <button class="btn btn-secondary btn-sm" onclick="RolesView.toggleRole(${idParam}, 'teacher')" style="${widthStyle} font-size:12px; font-weight:600;" title="Riporta a Docente">
            ↩️ Revoca Gestore (Rendi Docente)
          </button>`;
      }
      return `
        <button class="btn btn-primary btn-sm" onclick="RolesView.toggleRole(${idParam}, 'admin')" style="${widthStyle} font-size:12px; font-weight:600;" title="Promuovi a Gestore">
          ⬆️ Promuovi a Gestore Supplenze
        </button>`;
    };

    // 1. VERSIONE DESKTOP (Tabella fluida)
    const desktopHtml = `
      <div class="roles-desktop-view">
        <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
          <thead>
            <tr style="border-bottom:2px solid var(--border); color:var(--text-secondary); font-size:12px; text-transform:uppercase;">
              <th style="padding:10px 14px;">Utente / Docente</th>
              <th style="padding:10px 14px;">Email Istituzionale</th>
              <th style="padding:10px 14px; width:170px; text-align:center;">Ruolo Attuale</th>
              <th style="padding:10px 14px; width:260px; text-align:right;">Azione</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((item, idx) => `
              <tr style="border-bottom:1px solid var(--border); background:${idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)'};">
                <td style="padding:12px 14px;">
                  <strong style="color:var(--text-primary); font-size:13.5px;">${escHtml(item.name)}</strong>
                  ${item.username && item.username !== item.name ? `<div style="font-size:11px; color:var(--text-secondary);">@${escHtml(item.username)}</div>` : ''}
                </td>
                <td style="padding:12px 14px; color:var(--text-secondary);">
                  ${item.email ? `<span>✉️ ${escHtml(item.email)}</span>` : '<span style="color:var(--text-muted); font-style:italic;">—</span>'}
                </td>
                <td style="padding:12px 14px; text-align:center;">
                  ${getBadgeHtml(item)}
                </td>
                <td style="padding:12px 14px; text-align:right;">
                  ${getActionBtnHtml(item, false)}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    // 2. VERSIONE MOBILE (Card native touch-friendly a tutta larghezza)
    const mobileHtml = `
      <div class="roles-mobile-view">
        ${filtered.map(item => `
          <div style="background:var(--bg-secondary); border:1px solid var(--border); border-radius:10px; padding:12px 14px; display:flex; flex-direction:column; gap:10px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
              <div>
                <div style="font-weight:700; font-size:14px; color:var(--text-primary);">${escHtml(item.name)}</div>
                ${item.username && item.username !== item.name ? `<div style="font-size:11px; color:var(--text-secondary); margin-top:1px;">@${escHtml(item.username)}</div>` : ''}
              </div>
              <div style="flex-shrink:0;">
                ${getBadgeHtml(item)}
              </div>
            </div>

            <div style="font-size:12px; color:var(--text-secondary); word-break:break-all;">
              ${item.email ? `✉️ ${escHtml(item.email)}` : '<span style="color:var(--text-muted); font-style:italic;">Nessuna email registrata</span>'}
            </div>

            <div style="margin-top:2px;">
              ${getActionBtnHtml(item, true)}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    dataContainer.innerHTML = desktopHtml + mobileHtml;
  }

  function setupListeners() {
    const searchInput = document.getElementById('roles-search-input');
    const filterRole = document.getElementById('roles-filter-role');

    if (searchInput) searchInput.addEventListener('input', () => renderData());
    if (filterRole) filterRole.addEventListener('change', () => renderData());
  }

  async function toggleRole(identifier, teacherId, targetRole) {
    const item = _unifiedItems.find(x => (x.email && x.email === identifier) || (x.username && x.username === identifier) || (teacherId && x.teacherId === teacherId));
    if (!item) return;

    const actionText = targetRole === 'admin'
      ? `Promuovere "${item.name}" a GESTORE SUPPLENZE?\nAvrà accesso completo alla gestione di assenze e orari.`
      : `Reimpostare "${item.name}" come SEMPLICE UTENTE (Docente)?\nI permessi di amministrazione verranno revocati.`;

    if (!await APP.confirm(actionText)) return;

    try {
      if (item.teacherId) {
        await API.put(`/teachers/${item.teacherId}`, { role: targetRole, is_admin: targetRole === 'admin' }).catch(() => {});
      }

      if (item.userObj && item.userObj.id) {
        await API.put(`/settings/users/${item.userObj.id}`, { role: targetRole });
        item.userObj.role = targetRole;
      } else if (item.email) {
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
      renderData();
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
