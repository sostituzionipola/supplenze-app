/**
 * ORGANIGRAMMA.JS
 * Visualizzazione e gestione del documento Organigramma di Istituto.
 * Accessibile a tutti i docenti in sola lettura.
 * Caricamento riservato agli amministratori.
 */
var OrganigrammaView = (() => {
  let _docData = null;

  async function loadData() {
    try {
      if (typeof firebase !== 'undefined' && firebase.firestore) {
        const snap = await firebase.firestore().collection('system').doc('organigramma').get();
        if (snap.exists) {
          _docData = snap.data();
          return _docData;
        }
      }
    } catch(e) {
      console.warn('[ORGANIGRAMMA] Errore lettura cloud, verifico locale:', e);
    }
    const local = localStorage.getItem('sg_organigramma');
    if (local) {
      try { _docData = JSON.parse(local); } catch(e) {}
    }
    return _docData;
  }

  async function saveData(data) {
    _docData = data;
    localStorage.setItem('sg_organigramma', JSON.stringify(data));
    try {
      if (typeof firebase !== 'undefined' && firebase.firestore) {
        await firebase.firestore().collection('system').doc('organigramma').set(data);
      }
    } catch(e) {
      console.error('[ORGANIGRAMMA] Errore salvataggio cloud:', e);
      throw e;
    }
  }

  async function render(container, state) {
    container.innerHTML = '<div class="loading-overlay"><div class="spinner"></div> Caricamento Organigramma...</div>';
    await loadData();
    const isAdmin = state.user?.role === 'admin' || state.user?.role === 'admin_master';

    let html = `
      <div class="page-header" style="margin-bottom:20px; padding-bottom:12px; border-bottom:1px solid var(--border)">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <div class="page-title">🏛️ Organigramma di Istituto</div>
            <p style="font-size:13px; color:var(--text-secondary); margin-top:4px;">
              Consulta l'organigramma ufficiale, le commissioni e le figure di riferimento dell'I.C. "Padre A. Gemelli".
            </p>
          </div>
          ${_docData?.url ? `
            <div style="display:flex; gap:8px;">
              <a href="${_docData.url}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
                ↗️ Apri a Schermo Intero
              </a>
              <a href="${_docData.url}" download="${_docData.filename || 'organigramma.pdf'}" class="btn btn-primary btn-sm" style="text-decoration:none; display:inline-flex; align-items:center; gap:6px;">
                📥 Scarica PDF
              </a>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    // Sezione Upload per Amministratori
    if (isAdmin) {
      html += `
        <div class="card mb-20" style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; margin-bottom:20px;">
          <div class="card-header" style="background:var(--bg-secondary); padding:12px 16px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
            <div style="font-weight:700; font-size:13px; color:var(--accent);">⚙️ Gestione Organigramma (Riservato Admin)</div>
            ${_docData ? `<span style="font-size:11px; color:var(--text-secondary)">Ultimo aggiornamento: ${_docData.updated_at ? new Date(_docData.updated_at).toLocaleDateString('it-IT') : 'N/D'}</span>` : ''}
          </div>
          <div class="card-body" style="padding:16px;">
            <div style="display:flex; gap:12px; flex-wrap:wrap; align-items:center;">
              <div style="flex:1; min-width:240px;">
                <input type="file" id="org-file-input" accept="application/pdf" style="display:none" />
                <button class="btn btn-secondary btn-sm" id="org-upload-btn" style="display:inline-flex; align-items:center; gap:6px;">
                  📁 Seleziona File PDF da caricare
                </button>
                <span id="org-file-name" style="font-size:12px; color:var(--text-secondary); margin-left:8px;">
                  ${_docData?.filename ? `File attuale: <strong>${_docData.filename}</strong>` : 'Nessun file selezionato'}
                </span>
              </div>
              ${_docData ? `
                <button class="btn btn-ghost btn-sm" id="org-delete-btn" style="color:var(--danger); border:1px solid var(--danger);">
                  🗑️ Rimuovi Organigramma
                </button>
              ` : ''}
            </div>
            <div id="org-upload-status" style="margin-top:8px; font-size:12px;"></div>
          </div>
        </div>
      `;
    }

    // Sezione Visualizzazione PDF per tutti
    if (_docData?.url) {
      html += `
        <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
          <iframe src="${_docData.url}" style="width:100%; height:75vh; border:none; display:block;" title="Organigramma"></iframe>
        </div>
      `;
    } else {
      html += `
        <div class="empty-state" style="padding:60px 20px; text-align:center; background:var(--bg-card); border:1px dashed var(--border); border-radius:8px;">
          <div style="font-size:48px; margin-bottom:16px;">🏛️</div>
          <h3 style="margin-bottom:8px;">Organigramma non ancora disponibile</h3>
          <p style="color:var(--text-secondary); max-width:440px; margin:0 auto;">
            ${isAdmin ? 'Carica il file PDF dell\'organigramma di istituto utilizzando il pannello qui sopra per renderlo consultabile a tutti i docenti.' : 'Il documento dell\'organigramma per il plesso non è stato ancora caricato dagli amministratori.'}
          </p>
        </div>
      `;
    }

    container.innerHTML = html;

    // Gestori eventi Admin
    if (isAdmin) {
      const fi = container.querySelector('#org-file-input');
      const ub = container.querySelector('#org-upload-btn');
      const del = container.querySelector('#org-delete-btn');
      const status = container.querySelector('#org-upload-status');
      const fn = container.querySelector('#org-file-name');

      if (ub && fi) ub.onclick = () => fi.click();

      if (fi) {
        fi.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          if (file.type !== 'application/pdf') {
            APP.toast('Il file deve essere in formato PDF', 'error');
            return;
          }
          if (file.size > 2 * 1024 * 1024) {
            APP.toast('Il file supera la dimensione massima consentita di 2MB', 'error');
            return;
          }

          if (status) status.innerHTML = '<span class="text-info"><div class="spinner"></div> Caricamento e salvataggio in corso...</span>';

          const reader = new FileReader();
          reader.onload = async (ev) => {
            try {
              const base64Url = ev.target.result;
              await saveData({
                url: base64Url,
                filename: file.name,
                updated_at: new Date().toISOString()
              });
              APP.toast('Organigramma salvato con successo!', 'success');
              render(container, state);
            } catch(err) {
              if (status) status.innerHTML = `<span class="text-danger">Errore salvataggio: ${err.message}</span>`;
            }
          };
          reader.readAsDataURL(file);
        };
      }

      if (del) {
        del.onclick = async () => {
          if (await APP.confirm('Sei sicuro di voler rimuovere l\'organigramma attuale?')) {
            try {
              await saveData(null);
              APP.toast('Organigramma rimosso', 'success');
              render(container, state);
            } catch(err) {
              APP.toast('Errore: ' + err.message, 'error');
            }
          }
        };
      }
    }
  }

  return { render };
})();
