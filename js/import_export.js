/**
 * IMPORT_EXPORT.JS
 * Unified view for all administrative data imports.
 * Centralizes logic from schedule and teachers views.
 */
var ImportExportView = (() => {
  let _container = null, _state = null;

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

    container.innerHTML = `
      <div class="page-header" style="margin-bottom:24px; padding-bottom:12px; border-bottom:1px solid var(--border)">
        <div class="page-title">📥 Importa ed Esporta Dati</div>
        <p style="font-size:13px; color:var(--text-secondary); margin-top:4px;">Gestione centralizzata per il caricamento massivo e lo scaricamento dei dati di sistema.</p>
      </div>

      <div class="grid grid-cols-1 md-grid-cols-2 lg-grid-cols-3 gap-24">
        <!-- 1. IMPORT ORARIO -->
        <div class="card import_card" style="display:flex; flex-direction:column; border:1px solid var(--border-light); background:var(--bg-card);">
          <div class="card-header" style="background:var(--bg-secondary); border-bottom:1px solid var(--border)">
            <h3 class="card-title">📅 Orario Scolastico</h3>
          </div>
          <div class="card-body" style="flex:1; padding:20px;">
            <p style="font-size:12px; line-height:1.5; margin-bottom:12px;">
              Carica un file <strong>Excel</strong> o <strong>CSV</strong> in formato <strong>Matrice</strong>.<br/>
              Il sistema analizzerà automaticamente i giorni e le ore dalle prime due righe.
            </p>
            
            <div style="background:#1e293b; border:1px solid #334155; border-radius:6px; overflow:hidden; margin-bottom:16px;">
              <table style="width:100%; font-size:9px; text-align:center; border-collapse:collapse; color:#f8fafc;">
                <thead>
                  <tr style="background:#0f172a; border-bottom:1px solid #334155;">
                    <th style="padding:4px; border-right:1px solid #334155;">MATERIA</th>
                    <th style="padding:4px; border-right:1px solid #334155;">DOCENTE</th>
                    <th colspan="2" style="padding:4px;">LUNEDI</th>
                  </tr>
                  <tr style="background:#0f172a; border-bottom:1px solid #334155;">
                    <th style="border-right:1px solid #334155;"></th>
                    <th style="border-right:1px solid #334155;"></th>
                    <th style="padding:2px; border-right:1px solid #334155; font-weight:400; color:#94a3b8;">8ª</th>
                    <th style="padding:2px; font-weight:400; color:#94a3b8;">9ª</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="border-bottom:1px solid #334155;">
                    <td style="padding:4px; color:#818cf8; text-align:left;">LETTERE</td>
                    <td style="padding:4px; font-weight:700; text-align:left;">ROSSI M.</td>
                    <td style="padding:2px; border-right:1px solid #334155;">3A</td>
                    <td style="padding:2px; color:#4ade80; font-weight:700;">DIS</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <button class="btn btn-primary" id="btn-imp-schedule" style="width:100%; justify-content:center; gap:8px; margin-bottom:12px;">📥 Importa Orario</button>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
               <button class="btn btn-secondary btn-sm" id="btn-exp-schedule" style="flex:1; justify-content:center; min-width:80px;">📤 Esporta</button>
               <button class="btn btn-secondary btn-sm" id="btn-tmpl-schedule" style="flex:1; justify-content:center; min-width:80px;">📄 Template</button>
               <button class="btn btn-secondary btn-sm" id="btn-full-schedule" style="flex:1; justify-content:center; min-width:80px;">🖥️ Schermo Intero</button>
               <button class="btn btn-ghost btn-sm" id="btn-clear-schedule" style="width:100%; justify-content:center; color:#ef4444; border:1px solid #ef4444; margin-top:4px;">🗑️ Svuota Orario</button>
            </div>
          </div>
        </div>

        <!-- 2. ANAGRAFICA DOCENTI (Sola consultazione & Export) -->
        <div class="card import_card" style="display:flex; flex-direction:column; border:1px solid var(--border-light); background:var(--bg-card);">
          <div class="card-header" style="background:var(--bg-secondary); border-bottom:1px solid var(--border)">
            <h3 class="card-title">👨‍🏫 Anagrafica Docenti</h3>
          </div>
          <div class="card-body" style="flex:1; padding:20px; display:flex; flex-direction:column;">
            <p style="font-size:12px; line-height:1.6; margin-bottom:16px; color:var(--text-secondary);">
              L'anagrafica dei docenti e le relative email istituzionali vengono create e sincronizzate automaticamente al caricamento dell'<strong>Orario Scolastico</strong>.<br/>
              Da questa sezione puoi consultare le schede o scaricare l'elenco ufficiale completo.
            </p>
            
            <div style="display:flex; flex-direction:column; gap:8px; margin-top:auto;">
              <button class="btn btn-primary" id="btn-view-teachers" style="width:100%; justify-content:center; gap:8px;">👁️ Consulta Anagrafica</button>
              <button class="btn btn-secondary btn-sm" id="btn-exp-teachers" style="width:100%; justify-content:center; gap:8px;">📤 Esporta Anagrafica (.xlsx)</button>
            </div>
          </div>
        </div>

        <!-- 3. IMPORT RICEVIMENTO -->
        <div class="card import_card" style="display:flex; flex-direction:column; border:1px solid var(--border-light); background:var(--bg-card);">
          <div class="card-header" style="background:var(--bg-secondary); border-bottom:1px solid var(--border)">
            <h3 class="card-title">🤝 Ora Ricevimento</h3>
          </div>
          <div class="card-body" style="flex:1; padding:20px;">
            <p style="font-size:12px; line-height:1.5; margin-bottom:12px;">
              Carica le ore di ricevimento (R) per i docenti.<br/>
              Usa il formato matrice: <strong>Materia, Docente, Orario...</strong>
            </p>
            <div style="background:#1e293b; border:1px solid #334155; border-radius:6px; overflow:hidden; margin-bottom:16px;">
              <table style="width:100%; font-size:9px; text-align:center; border-collapse:collapse; color:#f8fafc;">
                <thead>
                  <tr style="background:#0f172a; border-bottom:1px solid #334155;">
                    <th style="padding:4px; border-right:1px solid #334155;">DOCENTE</th>
                    <th style="padding:4px;">LUNEDI (8ª)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding:6px; font-weight:700; text-align:left;">ROSSI M.</td>
                    <td style="padding:6px; color:#f59e0b; font-weight:700;">R</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button class="btn btn-primary" id="btn-imp-ricevimento" style="width:100%; justify-content:center; gap:8px;">📥 Importa Ricevimenti</button>
          </div>
        </div>

        <!-- 4. IMPORT DISPONIBILITA (DIS) -->
        <div class="card import_card" style="display:flex; flex-direction:column; border:1px solid var(--border-light); background:var(--bg-card);">
          <div class="card-header" style="background:var(--bg-secondary); border-bottom:1px solid var(--border)">
            <h3 class="card-title">⚡ Disponibilità (DIS)</h3>
          </div>
          <div class="card-body" style="flex:1; padding:20px;">
            <p style="font-size:12px; line-height:1.5; margin-bottom:12px;">
              Carica le ore a disposizione per il recupero (DIS).<br/>
              Formato: <strong>Matrice</strong> (Docente + Giorni/Ore).
            </p>
            <div style="background:#1e293b; border:1px solid #334155; border-radius:6px; overflow:hidden; margin-bottom:16px;">
              <table style="width:100%; font-size:9px; text-align:center; border-collapse:collapse; color:#f8fafc;">
                <thead>
                  <tr style="background:#0f172a; border-bottom:1px solid #334155;">
                    <th style="padding:4px; border-right:1px solid #334155;">DOCENTE</th>
                    <th style="padding:4px;">LUNEDI (9ª)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding:6px; font-weight:700; text-align:left;">ROSSI M.</td>
                    <td style="padding:6px; color:#4ade80; font-weight:700;">DIS</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button class="btn btn-primary" id="btn-imp-dis" style="width:100%; justify-content:center; gap:8px;">📥 Importa DIS</button>
          </div>
        </div>

        <!-- 5. IMPORT ECCEDENTI (ECC) -->
        <div class="card import_card" style="display:flex; flex-direction:column; border:1px solid var(--border-light); background:var(--bg-card);">
          <div class="card-header" style="background:var(--bg-secondary); border-bottom:1px solid var(--border)">
            <h3 class="card-title">💜 Ore Eccedenti (ECC)</h3>
          </div>
          <div class="card-body" style="flex:1; padding:20px;">
            <p style="font-size:12px; line-height:1.5; margin-bottom:12px;">
              Carica le ore eccedenti dichiarate (ECC).<br/>
              Formato: <strong>Matrice</strong> (Docente + Giorni/Ore).
            </p>
            <div style="background:#1e293b; border:1px solid #334155; border-radius:6px; overflow:hidden; margin-bottom:16px;">
              <table style="width:100%; font-size:9px; text-align:center; border-collapse:collapse; color:#f8fafc;">
                <thead>
                  <tr style="background:#0f172a; border-bottom:1px solid #334155;">
                    <th style="padding:4px; border-right:1px solid #334155;">DOCENTE</th>
                    <th style="padding:4px;">MARTEDI (10ª)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding:6px; font-weight:700; text-align:left;">BIANCHI A.</td>
                    <td style="padding:6px; color:#a78bfa; font-weight:700;">ECC</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button class="btn btn-primary" id="btn-imp-ecc" style="width:100%; justify-content:center; gap:8px;">📥 Importa ECC</button>
          </div>
        </div>

        <!-- 6. IMPORT ORE RECUPERO -->
        <div class="card import_card" style="display:flex; flex-direction:column; border:1px solid var(--border-light); background:var(--bg-card);">
          <div class="card-header" style="background:var(--bg-secondary); border-bottom:1px solid var(--border)">
            <h3 class="card-title">📊 Ore da Recuperare / Debito</h3>
          </div>
          <div class="card-body" style="flex:1; padding:20px;">
            <p style="font-size:12px; line-height:1.5; margin-bottom:12px;">
              Carica i saldi iniziali del debito orario.<br/>
              File: <em>Docente, Totale Ore</em>.
            </p>
            <button class="btn btn-primary" id="btn-imp-debt" style="width:100%; justify-content:center; gap:8px; margin-bottom:12px;">⚖️ Importa Debiti</button>
            <button class="btn btn-secondary btn-sm" id="btn-exp-debt" style="width:100%; justify-content:center;">📤 Esporta Debiti</button>
          </div>
        </div>
      </div>

      <div class="card mt-24" style="border-left:4px solid var(--accent);">
         <div class="card-body" style="padding:16px 20px;">
            <h4 style="margin:0 0 8px 0; color:var(--accent);">🆘 Guida Rapida</h4>
            <p style="font-size:13px; margin:0; line-height:1.6;">
               Tutte le importazioni supportano file <strong>Excel</strong> e <strong>CSV</strong>. <br/>
               In caso di nomi duplicati, il sistema aggiornerà i dati esistenti.
            </p>
         </div>
      </div>
    `;

    // Wire events
    container.querySelector('#btn-imp-schedule').onclick = () => ScheduleView.showImportModal(state, () => APP.toast('Orario aggiornato','success'));
    container.querySelector('#btn-imp-ricevimento').onclick = () => ScheduleView.showImportModal(state, () => APP.toast('Ricevimenti aggiornati','success'));
    container.querySelector('#btn-imp-dis').onclick = () => ScheduleView.showImportModal(state, () => APP.toast('Disponibilità DIS aggiornate','success'));
    container.querySelector('#btn-imp-ecc').onclick = () => ScheduleView.showImportModal(state, () => APP.toast('Ore eccedenti ECC aggiornate','success'));
    container.querySelector('#btn-view-teachers')?.addEventListener('click', () => APP.navigate('teachers'));
    container.querySelector('#btn-full-schedule')?.addEventListener('click', () => ScheduleView.exportFullPdf());
    container.querySelector('#btn-imp-debt')?.addEventListener('click', () => TeachersView.openImportModal(true));
    container.querySelector('#btn-tmpl-schedule')?.addEventListener('click', () => ScheduleView.downloadTemplate());

    container.querySelector('#btn-exp-schedule')?.addEventListener('click', () => ScheduleView.openExportModal());
    container.querySelector('#btn-exp-teachers')?.addEventListener('click', () => TeachersView.openExportModal());
    container.querySelector('#btn-exp-debt')?.addEventListener('click', () => TeachersView.openExportModal(true));
    
    container.querySelector('#btn-clear-schedule').onclick = async () => {
      if (await APP.confirm('Sei sicuro di voler SVUOTARE l\'intero orario per questo anno?')) {
        try {
          await API.del(`/schedule/all?year_id=${state.yearId}`);
          APP.toast('Orario svuotato con successo','success');
          APP.navigate('import_export'); 
        } catch(e) { APP.toast(e.message, 'error'); }
      }
    };
  }

  return { render };
})();
