/**
 * IMPORT_EXPORT.JS
 * Unified administrative dashboard for data import, export, templates,
 * organigramma management and maintenance danger zone.
 */
var ImportExportView = (() => {
  let _container = null, _state = null;

  function fmtDate(d) {
    if (!d) return '';
    const parts = d.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : d;
  }

  async function render(container, state) {
    _container = container;
    _state = state;
    if (!state.yearId) {
      container.innerHTML = `
        <div class="empty-state" style="padding:40px">
          <div class="icon" style="font-size:48px; margin-bottom:16px;">📥</div>
          <h3 style="margin-bottom:8px;">Importazione Dati Sospesa</h3>
          <p style="color:var(--text-secondary); max-width:400px; margin:0 auto 20px;">
            Per importare o esportare dati, devi prima selezionare un <strong>Anno Scolastico</strong> attivo dal selettore in alto.
          </p>
          <div class="attention-hint" style="font-size:12px; color:var(--accent); font-weight:600;">
            ⬅️ Seleziona Anno qui sopra
          </div>
        </div>`;
      return;
    }

    // Carica stato organigramma e periodi orario
    let orgData = null;
    let periods = { provvisorio: { start_date: '', end_date: '' }, definitivo: { start_date: '', end_date: '' } };
    try {
      if (typeof OrganigrammaView !== 'undefined' && OrganigrammaView.loadData) {
        orgData = await OrganigrammaView.loadData();
      }
    } catch(e) { console.warn('Errore lettura organigramma:', e); }

    try {
      periods = await API.get(`/schedule/periods?year_id=${state.yearId}`);
      if (!periods) periods = { provvisorio: { start_date: '', end_date: '' }, definitivo: { start_date: '', end_date: '' } };
    } catch(e) { console.warn('Errore lettura periodi orario:', e); }

    const provLabel = (periods.provvisorio?.start_date && periods.provvisorio?.end_date)
      ? `📅 Dal ${fmtDate(periods.provvisorio.start_date)} al ${fmtDate(periods.provvisorio.end_date)}`
      : '⚠️ Vigenza non impostata';

    const defLabel = (periods.definitivo?.start_date && periods.definitivo?.end_date)
      ? `📅 Dal ${fmtDate(periods.definitivo.start_date)} al ${fmtDate(periods.definitivo.end_date)}`
      : '⚠️ Vigenza non impostata';

    container.innerHTML = `
      <div class="page-header" style="margin-bottom:20px; padding-bottom:12px; border-bottom:1px solid var(--border)">
        <div class="page-title">📥 Importa ed Esporta Dati</div>
        <p style="font-size:13px; color:var(--text-secondary); margin-top:4px;">
          Gestione centralizzata per il caricamento, la sincronizzazione e la manutenzione dei dati di istituto.
        </p>
      </div>

      <div class="card mb-24" style="background:var(--bg-secondary); border-left:4px solid var(--accent); padding:14px 18px; margin-bottom:24px;">
        <div style="font-size:13px; line-height:1.6;">
          💡 <strong>Regole di caricamento:</strong> Si consiglia di scaricare e seguire i template ufficiali (.xlsx o .csv). Se i file non rispettano l'esatta intestazione delle colonne e il formato predefinito, i dati non verranno caricati correttamente e verranno respinti dal sistema.
        </div>
      </div>

      <div class="grid grid-cols-1 md-grid-cols-2 lg-grid-cols-3 gap-24">
        <!-- 1. ORARIO PROVVISORIO -->
        <div class="card import_card" style="display:flex; flex-direction:column; border:1px solid var(--border-light); background:var(--bg-card);">
          <div class="card-header" style="background:var(--bg-secondary); border-bottom:1px solid var(--border)">
            <h3 class="card-title">⏳ Orario Provvisorio</h3>
          </div>
          <div class="card-body" style="flex:1; padding:20px; display:flex; flex-direction:column;">
            <p style="font-size:12px; line-height:1.5; color:var(--text-secondary); margin-bottom:12px;">
              Carica l'orario provvisorio settimanale con il relativo periodo di vigenza. Durante questo periodo i docenti non possono inserire ore extra (R, DIS, ECC).
            </p>
            <div style="font-size:11px; padding:6px 10px; border-radius:6px; background:var(--bg-secondary); border:1px solid var(--border); margin-bottom:16px; color:var(--text-primary); font-weight:600;">
              ${provLabel}
            </div>
            <div style="margin-top:auto; display:flex; flex-direction:column; gap:8px;">
              <button class="btn btn-primary" id="btn-imp-sched-prov" style="width:100%; justify-content:center; gap:8px;">
                📥 Importa Orario Provvisorio
              </button>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-secondary btn-sm" id="btn-tmpl-sched-prov" style="flex:1; justify-content:center;">
                  📄 Template (.xlsx)
                </button>
                <button class="btn btn-secondary btn-sm" id="btn-exp-sched-prov" style="flex:1; justify-content:center;">
                  📤 Esporta
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. ORARIO DEFINITIVO -->
        <div class="card import_card" style="display:flex; flex-direction:column; border:1px solid var(--border-light); background:var(--bg-card);">
          <div class="card-header" style="background:var(--bg-secondary); border-bottom:1px solid var(--border)">
            <h3 class="card-title">📅 Orario Definitivo</h3>
          </div>
          <div class="card-body" style="flex:1; padding:20px; display:flex; flex-direction:column;">
            <p style="font-size:12px; line-height:1.5; color:var(--text-secondary); margin-bottom:12px;">
              Carica l'orario definitivo dell'istituto con il rispettivo periodo. Abilita la facoltà dei docenti di inserire e gestire disponibilità, ricevimenti ed eccedenze.
            </p>
            <div style="font-size:11px; padding:6px 10px; border-radius:6px; background:var(--bg-secondary); border:1px solid var(--border); margin-bottom:16px; color:var(--text-primary); font-weight:600;">
              ${defLabel}
            </div>
            <div style="margin-top:auto; display:flex; flex-direction:column; gap:8px;">
              <button class="btn btn-primary" id="btn-imp-sched-def" style="width:100%; justify-content:center; gap:8px;">
                📥 Importa Orario Definitivo
              </button>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-secondary btn-sm" id="btn-tmpl-sched-def" style="flex:1; justify-content:center;">
                  📄 Template (.xlsx)
                </button>
                <button class="btn btn-secondary btn-sm" id="btn-exp-sched-def" style="flex:1; justify-content:center;">
                  📤 Esporta
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. ORE DA RECUPERARE / DEBITO (Subito dopo/sotto orario definitivo) -->
        <div class="card import_card" style="display:flex; flex-direction:column; border:1px solid var(--border-light); background:var(--bg-card);">
          <div class="card-header" style="background:var(--bg-secondary); border-bottom:1px solid var(--border)">
            <h3 class="card-title">📊 Ore da Recuperare / Debito</h3>
          </div>
          <div class="card-body" style="flex:1; padding:20px; display:flex; flex-direction:column;">
            <p style="font-size:12px; line-height:1.5; color:var(--text-secondary); margin-bottom:16px;">
              Carica e aggiorna i saldi iniziali del debito orario docenti per l'anno scolastico in corso.
            </p>
            <div style="margin-top:auto; display:flex; flex-direction:column; gap:8px;">
              <button class="btn btn-primary" id="btn-imp-debt" style="width:100%; justify-content:center; gap:8px;">
                ⚖️ Importa Debiti
              </button>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-secondary btn-sm" id="btn-tmpl-debt" style="flex:1; justify-content:center;">
                  📄 Template Debiti (.xlsx)
                </button>
                <button class="btn btn-secondary btn-sm" id="btn-exp-debt" style="flex:1; justify-content:center;">
                  📤 Esporta Debiti
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. ORE DI RICEVIMENTO (R) -->
        <div class="card import_card" style="display:flex; flex-direction:column; border:1px solid var(--border-light); background:var(--bg-card);">
          <div class="card-header" style="background:var(--bg-secondary); border-bottom:1px solid var(--border)">
            <h3 class="card-title">🤝 Ore di Ricevimento (R)</h3>
          </div>
          <div class="card-body" style="flex:1; padding:20px; display:flex; flex-direction:column;">
            <p style="font-size:12px; line-height:1.5; color:var(--text-secondary); margin-bottom:16px;">
              Carica le ore dedicate al ricevimento famiglie (R) dei docenti su base settimanale.
            </p>
            <div style="margin-top:auto; display:flex; flex-direction:column; gap:8px;">
              <button class="btn btn-primary" id="btn-imp-ricevimento" style="width:100%; justify-content:center; gap:8px;">
                📥 Importa Ricevimenti
              </button>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-secondary btn-sm" id="btn-tmpl-ricevimento" style="flex:1; justify-content:center;">
                  📄 Template R (.xlsx)
                </button>
                <button class="btn btn-secondary btn-sm" id="btn-exp-ricevimento" style="flex:1; justify-content:center;">
                  📤 Esporta Ricevimenti
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 5. DISPONIBILITÀ (DIS) -->
        <div class="card import_card" style="display:flex; flex-direction:column; border:1px solid var(--border-light); background:var(--bg-card);">
          <div class="card-header" style="background:var(--bg-secondary); border-bottom:1px solid var(--border)">
            <h3 class="card-title">⚡ Disponibilità (DIS)</h3>
          </div>
          <div class="card-body" style="flex:1; padding:20px; display:flex; flex-direction:column;">
            <p style="font-size:12px; line-height:1.5; color:var(--text-secondary); margin-bottom:16px;">
              Carica le ore a disposizione dei docenti per supplenze e recuperi orari (DIS).
            </p>
            <div style="margin-top:auto; display:flex; flex-direction:column; gap:8px;">
              <button class="btn btn-primary" id="btn-imp-dis" style="width:100%; justify-content:center; gap:8px;">
                📥 Importa Disponibilità (DIS)
              </button>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-secondary btn-sm" id="btn-tmpl-dis" style="flex:1; justify-content:center;">
                  📄 Template DIS (.xlsx)
                </button>
                <button class="btn btn-secondary btn-sm" id="btn-exp-dis" style="flex:1; justify-content:center;">
                  📤 Esporta DIS
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 6. ORE ECCEDENTI (ECC) -->
        <div class="card import_card" style="display:flex; flex-direction:column; border:1px solid var(--border-light); background:var(--bg-card);">
          <div class="card-header" style="background:var(--bg-secondary); border-bottom:1px solid var(--border)">
            <h3 class="card-title">💜 Ore Eccedenti (ECC)</h3>
          </div>
          <div class="card-body" style="flex:1; padding:20px; display:flex; flex-direction:column;">
            <p style="font-size:12px; line-height:1.5; color:var(--text-secondary); margin-bottom:16px;">
              Carica le ore settimanali eccedenti l'orario cattedra deliberate per l'organico (ECC).
            </p>
            <div style="margin-top:auto; display:flex; flex-direction:column; gap:8px;">
              <button class="btn btn-primary" id="btn-imp-ecc" style="width:100%; justify-content:center; gap:8px;">
                📥 Importa Ore Eccedenti (ECC)
              </button>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-secondary btn-sm" id="btn-tmpl-ecc" style="flex:1; justify-content:center;">
                  📄 Template ECC (.xlsx)
                </button>
                <button class="btn btn-secondary btn-sm" id="btn-exp-ecc" style="flex:1; justify-content:center;">
                  📤 Esporta ECC
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 7. ORGANIGRAMMA DI ISTITUTO -->
        <div class="card import_card" style="display:flex; flex-direction:column; border:1px solid var(--border-light); background:var(--bg-card);">
          <div class="card-header" style="background:var(--bg-secondary); border-bottom:1px solid var(--border)">
            <h3 class="card-title">🏛️ Organigramma di Istituto</h3>
          </div>
          <div class="card-body" style="flex:1; padding:20px; display:flex; flex-direction:column;">
            <p style="font-size:12px; line-height:1.5; color:var(--text-secondary); margin-bottom:12px;">
              Carica il documento PDF ufficiale con commissioni, coordinatori e figure di riferimento del plesso.
            </p>
            <div style="margin-bottom:16px; font-size:12px; padding:8px 12px; border-radius:6px; background:var(--bg-secondary); border:1px solid var(--border);">
              ${orgData?.filename ? `
                <div style="color:var(--text-primary); font-weight:600; display:flex; align-items:center; gap:6px;">
                  📄 ${escHtml(orgData.filename)}
                </div>
                <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">
                  Aggiornato: ${orgData.updated_at ? new Date(orgData.updated_at).toLocaleDateString('it-IT') : 'N/D'}
                </div>
              ` : `
                <div style="color:var(--text-secondary); font-style:italic;">
                  ⚠️ Nessun organigramma attualmente caricato
                </div>
              `}
            </div>

            <input type="file" id="org-import-file-input" accept="application/pdf" style="display:none" />
            <div style="margin-top:auto; display:flex; flex-direction:column; gap:8px;">
              <button class="btn btn-primary" id="btn-upload-organigramma" style="width:100%; justify-content:center; gap:8px;">
                📥 ${orgData?.filename ? 'Sostituisci PDF' : 'Carica PDF Organigramma'}
              </button>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-secondary btn-sm" id="btn-view-organigramma" style="flex:1; justify-content:center;" ${!orgData?.url ? 'disabled' : ''}>
                  👁️ Visualizza
                </button>
                <button class="btn btn-ghost btn-sm" id="btn-del-organigramma" style="flex:1; justify-content:center; color:var(--danger); border:1px solid var(--danger);" ${!orgData?.url ? 'disabled' : ''}>
                  🗑️ Rimuovi
                </button>
              </div>
            </div>
            <div id="org-import-status" style="margin-top:8px; font-size:12px;"></div>
          </div>
        </div>

        <!-- 8. ANAGRAFICA DOCENTI -->
        <div class="card import_card" style="display:flex; flex-direction:column; border:1px solid var(--border-light); background:var(--bg-card);">
          <div class="card-header" style="background:var(--bg-secondary); border-bottom:1px solid var(--border)">
            <h3 class="card-title">👨‍🏫 Anagrafica Docenti</h3>
          </div>
          <div class="card-body" style="flex:1; padding:20px; display:flex; flex-direction:column;">
            <p style="font-size:12px; line-height:1.5; color:var(--text-secondary); margin-bottom:16px;">
              Elenco docenti, materie e account istituzionali sincronizzati con l'orario scolastico.
            </p>
            <div style="margin-top:auto; display:flex; flex-direction:column; gap:8px;">
              <button class="btn btn-primary" id="btn-view-teachers" style="width:100%; justify-content:center; gap:8px;">
                👁️ Consulta Anagrafica
              </button>
              <div style="display:flex; gap:8px;">
                <button class="btn btn-secondary btn-sm" id="btn-tmpl-teachers" style="flex:1; justify-content:center;">
                  📄 Template Docenti (.xlsx)
                </button>
                <button class="btn btn-secondary btn-sm" id="btn-exp-teachers" style="flex:1; justify-content:center;">
                  📤 Esporta Anagrafica
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ZONA PERICOLOSA (DANGER ZONE) - NESSUN RESET CUMULATIVO -->
      <div class="card mt-24" style="margin-top:32px; border:2px solid #ef4444; background:rgba(239, 68, 68, 0.04); border-radius:8px;">
        <div class="card-header" style="background:rgba(239, 68, 68, 0.1); border-bottom:1px solid rgba(239, 68, 68, 0.2); padding:14px 20px;">
          <h3 class="card-title" style="color:#ef4444; font-size:15px; display:flex; align-items:center; gap:8px;">
            ⚠️ Zona Pericolosa — Manutenzione & Reset Dati Orario
          </h3>
        </div>
        <div class="card-body" style="padding:20px;">
          <p style="font-size:13px; color:var(--text-secondary); margin-bottom:18px; line-height:1.6;">
            Le seguenti operazioni eliminano irreversibilmente gli slot orari memorizzati per l'<strong>Anno Scolastico attivo</strong>.<br/>
            <span style="color:var(--text-primary); font-weight:600;">Nota di sicurezza:</span> L'anagrafica, i profili e le email dei docenti <strong>NON</strong> vengono cancellati, garantendo la continuità degli account.
          </p>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
            <button class="btn btn-ghost" id="btn-danger-clear-prov" style="color:#ffffff; background:#dc2626; border:1px solid #b91c1c; justify-content:center; padding:10px 14px; font-weight:600;">
              🗑️ Svuota Orario Provvisorio
            </button>
            <button class="btn btn-ghost" id="btn-danger-clear-def" style="color:#ffffff; background:#b91c1c; border:1px solid #991b1b; justify-content:center; padding:10px 14px; font-weight:600;">
              🗑️ Svuota Orario Definitivo
            </button>
            <button class="btn btn-ghost" id="btn-danger-clear-r" style="color:#dc2626; border:1px solid #dc2626; justify-content:center; padding:10px 14px;">
              🗑️ Svuota solo Ricevimenti (R)
            </button>
            <button class="btn btn-ghost" id="btn-danger-clear-dis" style="color:#dc2626; border:1px solid #dc2626; justify-content:center; padding:10px 14px;">
              🗑️ Svuota solo Disponibilità (DIS)
            </button>
            <button class="btn btn-ghost" id="btn-danger-clear-ecc" style="color:#dc2626; border:1px solid #dc2626; justify-content:center; padding:10px 14px;">
              🗑️ Svuota solo Eccedenze (ECC)
            </button>
          </div>
        </div>
      </div>
    `;

    // ── GESTORI ORARIO PROVVISORIO ──
    container.querySelector('#btn-imp-sched-prov').onclick = () => {
      ScheduleView.showImportModal(state, () => {
        APP.toast('Orario provvisorio aggiornato con successo', 'success');
        render(container, state);
      }, 'orario', 'provvisorio');
    };

    container.querySelector('#btn-tmpl-sched-prov').onclick = () => {
      ScheduleView.downloadTemplate('orario');
    };

    container.querySelector('#btn-exp-sched-prov').onclick = () => {
      ScheduleView.exportScheduleMatrix('provvisorio', state.yearId);
    };

    // ── GESTORI ORARIO DEFINITIVO ──
    container.querySelector('#btn-imp-sched-def').onclick = () => {
      ScheduleView.showImportModal(state, () => {
        APP.toast('Orario definitivo aggiornato con successo', 'success');
        render(container, state);
      }, 'orario', 'definitivo');
    };

    container.querySelector('#btn-tmpl-sched-def').onclick = () => {
      ScheduleView.downloadTemplate('orario');
    };

    container.querySelector('#btn-exp-sched-def').onclick = () => {
      ScheduleView.exportScheduleMatrix('definitivo', state.yearId);
    };

    // ── GESTORI DEBITI ──
    container.querySelector('#btn-imp-debt').onclick = () => {
      TeachersView.openImportModal(true);
    };

    container.querySelector('#btn-tmpl-debt').onclick = () => {
      TeachersView.downloadDebtTemplate();
    };

    container.querySelector('#btn-exp-debt').onclick = () => {
      TeachersView.openExportModal(true);
    };

    // ── GESTORI RICEVIMENTI ──
    container.querySelector('#btn-imp-ricevimento').onclick = () => {
      ScheduleView.showImportModal(state, () => {
        APP.toast('Ore di ricevimento aggiornate con successo', 'success');
        render(container, state);
      }, 'ricevimento');
    };

    container.querySelector('#btn-tmpl-ricevimento').onclick = () => {
      ScheduleView.downloadTemplate('ricevimento');
    };

    container.querySelector('#btn-exp-ricevimento').onclick = () => {
      ScheduleView.exportFilteredSchedule('R', state.yearId);
    };

    // ── GESTORI DISPONIBILITÀ (DIS) ──
    container.querySelector('#btn-imp-dis').onclick = () => {
      ScheduleView.showImportModal(state, () => {
        APP.toast('Disponibilità (DIS) aggiornate con successo', 'success');
        render(container, state);
      }, 'dis');
    };

    container.querySelector('#btn-tmpl-dis').onclick = () => {
      ScheduleView.downloadTemplate('dis');
    };

    container.querySelector('#btn-exp-dis').onclick = () => {
      ScheduleView.exportFilteredSchedule('DIS', state.yearId);
    };

    // ── GESTORI ORE ECCEDENTI (ECC) ──
    container.querySelector('#btn-imp-ecc').onclick = () => {
      ScheduleView.showImportModal(state, () => {
        APP.toast('Ore eccedenti (ECC) aggiornate con successo', 'success');
        render(container, state);
      }, 'ecc');
    };

    container.querySelector('#btn-tmpl-ecc').onclick = () => {
      ScheduleView.downloadTemplate('ecc');
    };

    container.querySelector('#btn-exp-ecc').onclick = () => {
      ScheduleView.exportFilteredSchedule('ECC', state.yearId);
    };

    // ── GESTORI ANAGRAFICA DOCENTI ──
    container.querySelector('#btn-view-teachers')?.addEventListener('click', () => APP.navigate('teachers'));
    container.querySelector('#btn-tmpl-teachers')?.addEventListener('click', () => TeachersView.downloadTeacherTemplate());
    container.querySelector('#btn-exp-teachers')?.addEventListener('click', () => TeachersView.openExportModal());

    // ── GESTORI ORGANIGRAMMA ──
    const orgInput = container.querySelector('#org-import-file-input');
    const orgUploadBtn = container.querySelector('#btn-upload-organigramma');
    const orgViewBtn = container.querySelector('#btn-view-organigramma');
    const orgDelBtn = container.querySelector('#btn-del-organigramma');
    const orgStatus = container.querySelector('#org-import-status');

    if (orgUploadBtn && orgInput) {
      orgUploadBtn.onclick = () => orgInput.click();
    }

    if (orgInput) {
      orgInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.type !== 'application/pdf') {
          APP.toast('Il file deve essere in formato PDF', 'error');
          return;
        }
        if (file.size > 2 * 1024 * 1024) {
          APP.toast('Il file supera la dimensione massima di 2MB', 'error');
          return;
        }

        if (orgStatus) orgStatus.innerHTML = '<span class="text-info"><div class="spinner"></div> Caricamento organigramma...</span>';

        const reader = new FileReader();
        reader.onload = async (ev) => {
          try {
            const base64Url = ev.target.result;
            await OrganigrammaView.saveData({
              url: base64Url,
              filename: file.name,
              updated_at: new Date().toISOString()
            });
            APP.toast('Organigramma PDF salvato con successo!', 'success');
            render(container, state);
          } catch(err) {
            if (orgStatus) orgStatus.innerHTML = `<span class="text-danger">Errore: ${err.message}</span>`;
            APP.toast('Errore: ' + err.message, 'error');
          }
        };
        reader.readAsDataURL(file);
      };
    }

    if (orgViewBtn) {
      orgViewBtn.onclick = () => APP.navigate('organigramma');
    }

    if (orgDelBtn) {
      orgDelBtn.onclick = async () => {
        if (await APP.confirm('Sei sicuro di voler rimuovere il documento PDF dell\'Organigramma?')) {
          try {
            await OrganigrammaView.deleteData();
            APP.toast('Organigramma rimosso con successo', 'success');
            render(container, state);
          } catch(err) {
            APP.toast('Errore: ' + err.message, 'error');
          }
        }
      };
    }

    // ── GESTORI ZONA PERICOLOSA (CHIRURGICI & SEPARATI) ──
    container.querySelector('#btn-danger-clear-prov').onclick = async () => {
      const ok = await APP.confirm(
        '⚠️ Sei sicuro di voler SVUOTARE L\'ORARIO PROVVISORIO per questo anno scolastico?\n\n' +
        'Verranno eliminati solo gli slot dell\'orario provvisorio e resettate le relative date di vigenza.\n' +
        'L\'orario definitivo, i docenti e le altre tabelle non verranno toccati.\n\nProcedere?'
      );
      if (ok) {
        try {
          await API.del(`/schedule/clear?year_id=${state.yearId}&type=provvisorio`);
          APP.toast('Orario provvisorio svuotato con successo', 'success');
          render(container, state);
        } catch(e) {
          APP.toast('Errore: ' + e.message, 'error');
        }
      }
    };

    container.querySelector('#btn-danger-clear-def').onclick = async () => {
      const ok = await APP.confirm(
        '⚠️ Sei sicuro di voler SVUOTARE L\'ORARIO DEFINITIVO per questo anno scolastico?\n\n' +
        'Verranno eliminati solo gli slot dell\'orario definitivo e resettate le relative date di vigenza.\n' +
        'L\'orario provvisorio e i docenti non verranno toccati.\n\nProcedere?'
      );
      if (ok) {
        try {
          await API.del(`/schedule/clear?year_id=${state.yearId}&type=definitivo`);
          APP.toast('Orario definitivo svuotato con successo', 'success');
          render(container, state);
        } catch(e) {
          APP.toast('Errore: ' + e.message, 'error');
        }
      }
    };

    container.querySelector('#btn-danger-clear-r').onclick = async () => {
      const ok = await APP.confirm(
        'Sei sicuro di voler eliminare tutte le ore di RICEVIMENTO (R) per l\'anno selezionato?\n\n' +
        'Le ore di lezione curricolari, le disponibilità e le eccedenze rimarranno intatte.'
      );
      if (ok) {
        try {
          await API.del(`/schedule/clear?year_id=${state.yearId}&type=R`);
          APP.toast('Ore di ricevimento (R) rimosse con successo', 'success');
          render(container, state);
        } catch(e) {
          APP.toast('Errore: ' + e.message, 'error');
        }
      }
    };

    container.querySelector('#btn-danger-clear-dis').onclick = async () => {
      const ok = await APP.confirm(
        'Sei sicuro di voler eliminare tutte le ore di DISPONIBILITÀ (DIS) per l\'anno selezionato?\n\n' +
        'Le ore di lezione curricolari, i ricevimenti e le eccedenze rimarranno intatti.'
      );
      if (ok) {
        try {
          await API.del(`/schedule/clear?year_id=${state.yearId}&type=DIS`);
          APP.toast('Disponibilità (DIS) rimosse con successo', 'success');
          render(container, state);
        } catch(e) {
          APP.toast('Errore: ' + e.message, 'error');
        }
      }
    };

    container.querySelector('#btn-danger-clear-ecc').onclick = async () => {
      const ok = await APP.confirm(
        'Sei sicuro di voler eliminare tutte le ORE ECCEDENTI (ECC) per l\'anno selezionato?\n\n' +
        'Le ore di lezione curricolari, le disponibilità e i ricevimenti rimarranno intatti.'
      );
      if (ok) {
        try {
          await API.del(`/schedule/clear?year_id=${state.yearId}&type=ECC`);
          APP.toast('Ore eccedenti (ECC) rimosse con successo', 'success');
          render(container, state);
        } catch(e) {
          APP.toast('Errore: ' + e.message, 'error');
        }
      }
    };
  }

  return { render };
})();
