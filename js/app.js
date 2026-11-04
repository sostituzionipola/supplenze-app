// ══════════════════════════════════════════════
// APP.JS — Router, Auth State, Toasts, Navigation
// ══════════════════════════════════════════════

const APP = (() => {
  let state = {
    user: null,
    yearId: null,
    years: [],
    currentView: 'operational_registry',
  };

  const ROLE_LABELS = {
    admin_master: 'Admin Master',
    admin: 'Amministratore',
    secretary: 'Segreteria',
    director: 'Dirigente',
    teacher: 'Docente'
  };
  
  const VIEW_TITLES = {
    operational_registry: 'Registro Operativo',
    substitutions: 'Sostituzioni',
    daily_overview: 'Prospetto Giornaliero',
    teachers: 'Gestione Docenti',
    schedule: 'Orario Scolastico',
    settings: 'Impostazioni',
    teacher_self_service: 'La Mia Area Docente',
    admin_notifications: 'Richieste Docenti',
    import_export: 'Importa ed Esporta Dati',
    events: 'Eventi Scolastici',
    login_preview: 'Schermata Login'
  };
  
  const navItems = [
    { id: 'operational_registry', label: '📋 Registro Operativo', role: 'admin' },
    { id: 'teachers', label: '👨‍🏫 Gestione Docenti', role: 'admin' },
    { id: 'schedule', label: '🕒 Orario Scolastico', role: 'admin' },
    { id: 'import_export', label: '📥 Importa ed Esporta Dati', role: 'admin' },
    { id: 'events', label: '📅 Eventi Scolastici', role: 'all' },
    { id: 'teacher_self_service', label: '👤 Area Personale', role: 'teacher' }
  ];
  
  let VIEWS = null;
  function getViews() {
    if (VIEWS) return VIEWS;
    // Queste variabili sono definite negli altri file .js caricati prima di app.js
    VIEWS = {
      operational_registry: typeof OperationalRegistryView !== 'undefined' ? OperationalRegistryView : { render: (c) => c.innerHTML = 'Errore caricamento Registro' },
      substitutions: typeof SubstitutionsView !== 'undefined' ? SubstitutionsView : { render: (c) => c.innerHTML = 'Errore caricamento Sostituzioni' },
      daily_overview: typeof DailyOverviewView !== 'undefined' ? DailyOverviewView : { render: (c) => c.innerHTML = 'Errore caricamento Prospetto' },
      teachers: typeof TeachersView !== 'undefined' ? TeachersView : { render: (c) => c.innerHTML = 'Errore caricamento Docenti' },
      schedule: typeof ScheduleView !== 'undefined' ? ScheduleView : { render: (c) => c.innerHTML = 'Errore caricamento Orario' },
      settings: typeof SettingsView !== 'undefined' ? SettingsView : { render: (c) => c.innerHTML = '<div class="empty-state"><h3>Errore di caricamento Impostazioni</h3><p>Controlla la console del browser per errori tecnici.</p></div>' },
      teacher_self_service: typeof TeacherSelfServiceView !== 'undefined' ? TeacherSelfServiceView : { render: (c) => c.innerHTML = 'Errore caricamento Area Docente' },
      admin_notifications: typeof AdminNotificationsView !== 'undefined' ? AdminNotificationsView : { render: (c) => c.innerHTML = 'Errore caricamento Notifiche' },
      import_export: typeof ImportExportView !== 'undefined' ? ImportExportView : { render: (c) => c.innerHTML = 'Errore caricamento Importa ed Esporta Dati' },
      events: typeof EventsView !== 'undefined' ? EventsView : { render: (c) => c.innerHTML = 'Errore caricamento Eventi Scolastici' },
      organigramma: typeof OrganigrammaView !== 'undefined' ? OrganigrammaView : { render: (c, s) => OrganigrammaView.render(c, s) },
      login_preview: { render: (c) => renderLoginPreview(c) }
    };
    return VIEWS;
  }

  function isAdminMaster() { return (state.user?.role || '').toLowerCase().trim() === 'admin_master'; }
  function isAdmin() { 
    const r = (state.user?.role || '').toLowerCase().trim();
    return r === 'admin' || r === 'admin_master'; 
  }
  function isTeacher() { return state.user?.role === 'teacher'; }

  function toast(msg, type='info', duration=3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const ic = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML = `<span>${ic[type]||'ℹ️'}</span><span style="flex:1">${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => el.remove(), duration);
  }

  function modal({ title, body, footer, size='' }) {
    const ov = document.createElement('div');
    ov.className = 'modal-overlay';
    ov.innerHTML = `
      <div class="modal ${size}">
        <div class="modal-header">
          <span class="modal-title">${title}</span>
          <button class="btn btn-ghost btn-sm" id="modal-close-btn">✕</button>
        </div>
        <div class="modal-body">${body}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>`;
    document.body.appendChild(ov);
    ov.querySelector('#modal-close-btn').onclick = () => ov.remove();
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    return ov;
  }

  function confirm(msg) {
    return new Promise(resolve => {
      const ov = modal({
        title: 'Conferma',
        body: `<p>${msg}</p>`,
        footer: `<button class="btn btn-secondary" id="conf-no">Annulla</button><button class="btn btn-danger" id="conf-yes">Conferma</button>`
      });
      ov.querySelector('#conf-yes').onclick = () => { ov.remove(); resolve(true); };
      ov.querySelector('#conf-no').onclick  = () => { ov.remove(); resolve(false); };
    });
  }

  function printAbsence(a) {
    const win = window.open('', '_blank');
    const typeLabel = {
      malattia: 'Malattia',
      malattia_ore: 'Malattia a Ore',
      assenza_giornaliera: 'Permesso Giornaliero',
      altro_permesso: 'Altro Permesso',
      permesso_orario: 'Permesso Orario',
      diritto_studio: 'Diritto allo Studio',
      uscita_didattica: 'Uscita / Soggiorno Didattico',
      ferie: 'Ferie',
      formazione: 'Formazione',
      concorsi_esami: 'Concorsi / Esami',
      matrimonio: 'Matrimonio',
      lutto: 'Lutto',
      permessi_sindacali: 'Permesso Sindacale',
      assemblea: 'Assemblea'
    }[a.type] || 'Assenza';

    win.document.write(`
      <html>
      <head>
        <title>Richiesta Assenza - ${a.teacher_name}</title>
        <style>
          body { font-family: 'Segoe UI', system-ui, sans-serif; padding: 40px; color: #1a1f35; line-height: 1.6; }
          .header { text-align: center; border-bottom: 2px solid #1a1f35; padding-bottom: 20px; margin-bottom: 40px; }
          .school-name { font-size: 22px; font-weight: 800; text-transform: uppercase; margin: 0; }
          .document-title { font-size: 18px; margin: 10px 0; color: #475569; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .label { font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: 700; margin-bottom: 4px; }
          .value { font-size: 16px; font-weight: 600; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
          .full-width { grid-column: span 2; }
          .footer { margin-top: 60px; display: flex; justify-content: space-between; }
          .signature-box { width: 220px; border-top: 1px solid #1a1f35; text-align: center; padding-top: 10px; font-size: 12px; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <p class="school-name">Ministero dell'Istruzione e del Merito</p>
          <p style="margin: 4px 0; font-weight: 600;">Istituto Comprensivo "Padre A. Gemelli"</p>
          <h1 class="document-title">COMUNICAZIONE DI ASSENZA / PERMESSO</h1>
        </div>

        <div class="info-grid">
          <div><div class="label">Docente Richiedente</div><div class="value">${a.teacher_name}</div></div>
          <div><div class="label">Data Operazione</div><div class="value">${new Date().toLocaleDateString('it-IT')}</div></div>
          
          <div><div class="label">Tipo di Assenza</div><div class="value">${typeLabel}</div></div>
          <div><div class="label">Periodo / Data</div><div class="value">${a.date}${a.date_end && a.date_end !== a.date ? ' al ' + a.date_end : ''}</div></div>
          
          ${a.hours && a.hours.length ? `<div class="full-width"><div class="label">Ore Interessate</div><div class="value">${a.hours.map(h => h + 'ª').join(', ')}</div></div>` : ''}
          ${a.classes && a.classes.length ? `<div class="full-width"><div class="label">Classi Coinvolte</div><div class="value">${a.classes.map(c => typeof c === 'object' ? c.name : c).join(', ')}</div></div>` : ''}
          ${a.reason ? `<div class="full-width"><div class="label">Motivazione</div><div class="value">${a.reason}</div></div>` : ''}
          
          <div class="full-width"><div class="label">Stato Richiesta</div><div class="value">${a.status === 'approved' ? 'APPROVATA' : 'IN ATTESA DI APPROVAZIONE'}</div></div>
        </div>

        <p style="font-size: 13px; color: #475569; margin-top: 40px;">
          Si attesta che la presente richiesta è stata inoltrata tramite il portale telematico d'istituto e registrata nei sistemi gestionali.
        </p>

        <div class="footer">
          <div class="signature-box">Firma del Docente</div>
          <div class="signature-box">Il Dirigente Scolastico</div>
        </div>

        <div class="no-print" style="margin-top: 50px; text-align: center;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #1a1f35; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Stampa Documento</button>
        </div>
      </body>
      </html>
    `);
    win.document.close();
  }

  function renderLoginPreview(container) {
    container.innerHTML = `
      <div class="page-header"><div class="page-title">🔑 Login (sola visualizzazione)</div></div>
      <div style="transform: scale(0.8); transform-origin: top center; margin-top: 20px; pointer-events: none; opacity: 0.8;">
        <div style="background: radial-gradient(ellipse at top,#1a1f35 0%,#0d1117 60%); border-radius: 12px; padding: 40px; border: 1px solid var(--border);">
          <div style="background: rgba(22,27,34,.95); border: 1px solid rgba(240,246,252,0.15); border-radius: 8px; padding: 32px; max-width: 340px; margin: 0 auto; text-align:center;">
             <div style="font-size: 24px; margin-bottom: 8px;">🏫</div>
             <h2 style="font-size: 18px; margin-bottom: 4px;">Gestione Sostituzioni</h2>
             <p style="font-size: 12px; color: var(--text-secondary); margin-bottom: 24px;">Accedi al portale scolastico</p>
             <div style="border: 1px solid var(--border); border-radius: 6px; padding: 10px; margin-bottom: 12px; font-size: 13px; color: var(--text-muted); text-align: left;">Username</div>
             <div style="border: 1px solid var(--border); border-radius: 6px; padding: 10px; margin-bottom: 16px; font-size: 13px; color: var(--text-muted); text-align: left;">••••••••</div>
             <div style="background: var(--accent); color: white; padding: 12px; border-radius: 6px; font-weight: 600;">Accedi</div>
          </div>
        </div>
      </div>
      <p style="text-align:center; color: var(--text-muted); font-size: 13px; margin-top: 10px;">Questa è un'anteprima statica della schermata mostrata agli utenti non autenticati.</p>
    `;
  }

  function showTermsModal() {
    modal({
      title: '📋 Termini e Condizioni di Servizio',
      body: `
        <div style="font-size:13px; line-height:1.7; height: 380px; overflow-y: auto; padding-right: 15px; color: var(--text-primary);">
          <h4 style="margin-top:0; color: var(--accent);">1. Finalità del Servizio</h4>
          <p>L'applicativo "Registro Sostituzioni - I.C. Padre A. Gemelli" è uno strumento di supporto organizzativo destinato esclusivamente al personale docente e amministrativo dell'Istituto. Il servizio mira a ottimizzare la gestione delle sostituzioni e la comunicazione interna relativa all'orario scolastico.</p>
          
          <h4 style="color: var(--accent);">2. Credenziali e Responsabilità</h4>
          <p>L'accesso avviene tramite account Google istituzionale (@padregemelli.net) o credenziali fornite dall'amministratore. L'utente è custode delle proprie credenziali e responsabile di ogni operazione effettuata sotto il proprio profilo. È fatto divieto di cedere le credenziali a terzi.</p>
          
          <h4 style="color: var(--accent);">3. Integrità dei Dati</h4>
          <p>L'inserimento di assenze, uscite didattiche e sostituzioni deve corrispondere al vero. Ogni manomissione o inserimento di dati mendaci potrà essere soggetta a verifiche amministrative. Nella fase attuale di "Versione di Sviluppo", i dati potrebbero essere resettati con preavviso minimo per ragioni tecniche.</p>
          
          <h4 style="color: var(--accent);">4. Proprietà Intellettuale</h4>
          <p>Il software, il layout e il sistema di gestione del registro sono proprietà intellettuale dell'I.C. "Padre A. Gemelli". Ne è vietata la riproduzione o la decompilazione senza autorizzazione esplicita.</p>
          
          <h4 style="color: var(--accent);">5. Limitazione di Responsabilità</h4>
          <p>L'Istituto non risponde di eventuali ritardi o disservizi derivanti da problemi di connettività esterna o dall'utilizzo improprio dell'applicazione da parte del personale.</p>
        </div>
      `,
      footer: '<button class="btn btn-primary" style="width:100%" onclick="this.closest(\'.modal-overlay\').remove()">Accetto i Termini</button>',
      size: 'modal-md'
    });
  }

  function showPrivacyModal() {
    modal({
      title: '⚖️ Informativa Privacy (GDPR - Art. 13)',
      body: `
        <div style="font-size:13px; line-height:1.7; height: 380px; overflow-y: auto; padding-right: 15px; color: var(--text-primary);">
          <h4 style="margin-top:0; color: var(--accent);">Titolare del Trattamento</h4>
          <p>Il Titolare del trattamento è l'I.C. "Padre A. Gemelli", nella persona del Dirigente Scolastico pro tempore.</p>
          
          <h4 style="color: var(--accent);">Finalità e Base Giuridica</h4>
          <p>Il trattamento dei dati personali (nome, cognome, indirizzo email, ore di servizio, assenze) è necessario per l'esecuzione di un compito di interesse pubblico connesso all'esercizio di pubblici poteri di cui è investito il Titolare, ovvero la gestione organizzativa dell'organico scolastico.</p>
          
          <h4 style="color: var(--accent);">Destinatari dei Dati</h4>
          <p>I dati sono accessibili esclusivamente al personale amministrativo autorizzato e, limitatamente al registro delle sostituzioni pubblico, al personale docente abilitato alla consultazione. Non è prevista la diffusione dei dati a terzi esterni all'Istituzione Scolastica, salvo obblighi di legge.</p>
          
          <h4 style="color: var(--accent);">Periodo di Conservazione</h4>
          <p>I dati saranno conservati per l'intera durata dell'anno scolastico in corso e archiviati secondo i termini di legge previsti per i documenti amministrativi della scuola.</p>
          
          <h4 style="color: var(--accent);">Diritti dell'Interessato</h4>
          <p>Gli interessati hanno il diritto di chiedere al titolare del trattamento l'accesso ai dati personali e la rettifica o la cancellazione degli stessi (Diritto all'oblio), o la limitazione del trattamento che li riguarda.</p>
        </div>
      `,
      footer: '<button class="btn btn-primary" style="width:100%" onclick="this.closest(\'.modal-overlay\').remove()">Chiudi Informativa</button>',
      size: 'modal-md'
    });
  }

  function showTeacherManual() {
    modal({
      title: '📖 Istruzioni ed Area Docenti',
      body: `
        <div style="font-size:13px; line-height:1.7; height: 420px; overflow-y: auto; padding-right: 15px; color: var(--text-primary);">
          <div style="padding:16px; background:var(--bg-secondary); border-radius:12px; border-left:4px solid var(--accent); margin-bottom:20px;">
            <h3 style="margin:0 0 8px 0; color:var(--accent);">🚀 Guida Rapida Docenti</h3>
            <p style="margin:0; font-size:12px;">Benvenuto nel portale gestionale dell'I.C. Padre A. Gemelli. Qui puoi gestire le tue assenze, consultare l'orario e accettare le sostituzioni assegnate.</p>
          </div>

          <h4 style="color: var(--accent);">📝 Come Segnalare un'Assenza</h4>
          <p>Dalla tua <strong>Area Personale</strong>, clicca sul pulsante <strong>"➕ Segnala una tua assenza"</strong>:</p>
          <ul>
            <li><strong>Permesso Giornaliero</strong>: Per motivi personali o familiari (max 3 giorni/anno, non richiede recupero).</li>
            <li><strong>Concorsi ed Esami</strong>: Fino a 8 giorni per anno scolastico (non retribuiti).</li>
            <li><strong>Formazione</strong>: Per attività di aggiornamento (max 5 giorni/anno, non richiede recupero).</li>
            <li><strong>Ferie</strong>: Seleziona la data e il sistema <strong>mostrerà i colleghi disponibili</strong> (sia chi è a disposizione/potenziamento, sia chi è libero da lezioni).</li>
            <li><strong>Permesso Orario</strong>: Genera un <strong>debito orario</strong> da recuperare entro 2 mesi.</li>
            <li><strong>Ora di Ricevimento</strong>: Indica l'ora settimanale dedicata ai genitori. <strong>In quest'ora non sarai chiamato per supplenze.</strong></li>
            <li><strong>Uscita Didattica</strong>: Indica le classi e i colleghi che ti accompagnano. Il sistema caricherà automaticamente la richiesta per tutti i membri del team.</li>
            <li><strong>Stampa</strong>: Una volta inviata, l'admin può generare il modulo ufficiale già compilato per la tua firma.</li>
            <li><strong>Revoca</strong>: Se hai commesso un errore, puoi annullare la tua richiesta cliccando sul tasto <strong>"Annulla"</strong> nella sezione "Le Mie Richieste" della tab Notifiche.</li>
            <li><strong>📅 Eventi Scolastici</strong>: Nella nuova sezione puoi visualizzare e aggiungere eventi d'istituto (progetti, incontri, orari speciali) indicando classi e colleghi coinvolti.</li>
          </ul>

          <h4 style="color: var(--accent);">🗳️ Invio Disponibilità (Fase di Scelta)</h4>
          <p>Nella scheda <strong>"Il Mio Orario"</strong> puoi indicare le ore in cui sei più disposto a recuperare: <strong>DIS</strong> (Disponibilità recupero), le ore in cui sei disposto a svolgere ore di straordinario <strong>ECC</strong> (Ore eccedenti) e le ore in cui sei disposto a ricevere i genitori <strong>R</strong> (Ricevimento):</p>
          <ol>
            <li>Clicca sugli slot vuoti per cambiare lo stato.</li>
            <li>Una volta completato, clicca su <strong>"Invia alla Segreteria"</strong>.</li>
            <li>L'azione è <strong>irreversibile</strong>: dopo l'invio solo l'amministratore potrà sbloccare il tuo profilo per nuove modifiche.</li>
          </ol>

          <h4 style="color: var(--accent);">✍️ Gestione Sostituzioni Assegnate</h4>
          <p>Se ti viene assegnata una sostituzione, riceverai una notifica. Dovrai recarti nella tua area personale (Tab "Notifiche & Sostituzioni") e cliccare su <strong>"Firma"</strong> per confermare.</p>
          <div class="badge badge-success" style="margin-bottom:10px">⭐ Credito Ferie</div>
          <p>Se sostituisci un collega in <strong>Ferie</strong> o <strong>Formazione</strong>, l'ora ti verrà accreditata per scalare il tuo eventuale debito orario.</p>

          <h4 style="color: var(--accent);">📊 Calcolo Debito Orario e Recuperi</h4>
          <p>Il sistema gestisce i debiti e i recuperi orari su base continuativa annuale:</p>
          <ul>
            <li><strong>Debito Iniziale (Supplenze e Uscite)</strong>: Assegnato all'inizio dell'anno per cattedra o potenziamento, è valido per <strong>l'intero anno scolastico</strong>.</li>
            <li><strong>Permessi Brevi (Art. 16 CCNL)</strong>: Fruibili fino a un massimo pari all'orario settimanale di cattedra (es. 18h). Devono essere recuperati tramite supplenze entro <strong>2 mesi</strong> dalla richiesta.</li>
            <li><strong>Visite Mediche a Ore</strong>: Le ore di visita medica breve confluiscono nei permessi da recuperare entro 2 mesi. Per visite a giornata intera o esami specialistici continuativi, selezionare <em>Malattia</em> o <em>Permessi Giornalieri</em>.</li>
          </ul>

          <h4 style="color: var(--accent);">🤒 Segnalazione Assenza per Malattia</h4>
          <p>La segnalazione dell'assenza per malattia sull'applicazione serve unicamente a consentire alla scuola di organizzare tempestivamente le supplenze delle classi.</p>
          <div class="badge badge-warning" style="margin-bottom:10px">⚠️ Promemoria Amministrativo</div>
          <p>La trasmissione del certificato medico telematico o del numero di protocollo PUC deve essere effettuata direttamente verso la Segreteria del Personale secondo le consuete modalità istituzionali.</p>
          
          <h4 style="color: var(--accent);">🌴 Ferie e Permessi durante l'Anno Scolastico</h4>
          <p><strong>1. Permessi Retribuiti per Motivi Personali (3 giorni):</strong><br>
          Spettano sia ai docenti di ruolo sia ai docenti con contratto annuale o fino al 30 giugno (a domanda con semplice autocertificazione, senza obbligo di recupero e senza dover cercare colleghi per la sostituzione: la copertura è organizzata dalla scuola).</p>

          <p><strong>2. Ferie durante le Lezioni (fino a 6 giorni):</strong><br>
          &bull; <em>Ferie Ordinarie:</em> richiedibili indicando nella domanda i colleghi disponibili a sostituire a costo zero per la scuola.<br>
          &bull; <em>Ferie per Motivi Personali/Familiari (Art. 15 c. 2):</em> fruibili con semplice autocertificazione, senza dover cercare sostituti (copertura a cura della scuola).<br>
          ⚠️ <em>Nota importante:</em> in entrambi i casi, i giorni fruiti durante le lezioni vengono <strong>sottratti dal conto delle ferie annuali</strong> e dovranno essere <strong>indicati come giorni già fruiti (e quindi scalati) nella richiesta di ferie estive</strong> presentata a fine anno alla Segreteria.</p>

          <div class="badge badge-info" style="margin-bottom:8px">Altri Permessi Contrattuali (Ruolo e Tempo Determinato)</div>
          <p>I congedi per <strong>Matrimonio (15 gg)</strong>, <strong>Formazione (5 gg)</strong>, <strong>Lutto (3 gg per evento)</strong> e <strong>Assemblee sindacali (10 h)</strong> spettano a tutto il personale secondo quanto previsto dal CCNL vigente. Per le supplenze brevi e saltuarie, i permessi per motivi personali sono fruibili fino a 8 giorni ad anno scolastico non retribuiti.</p>
          
          <h4 style="color: var(--accent);">✍️ Firma Sostituzioni Assegnate</h4>
          <p>Tutte le sostituzioni assegnate o concordate devono essere confermate digitalmente tramite il pulsante "Firma" nella sezione "Sostituzioni Assegnate" dell'Area Docente.</p>
        </div>
      `,
      footer: '<button class="btn btn-primary" style="width:100%" onclick="this.closest(\'.modal-overlay\').remove()">Ho Capito</button>',
      size: 'modal-md'
    });
  }

  function showAdminManual() {
    modal({
      title: '🛠️ Istruzioni Area Amministratore',
      body: `
        <div style="font-size:13px; line-height:1.7; height: 420px; overflow-y: auto; padding-right: 15px; color: var(--text-primary);">
          <div style="padding:16px; background:var(--accent-light); border-radius:12px; border-left:4px solid var(--accent); margin-bottom:20px;">
            <h3 style="margin:0 0 8px 0; color:var(--accent);">🛠️ Console Amministrativa</h3>
            <p style="margin:0; font-size:12px;">Guida operativa per la gestione del registro e delle emergenze quotidiane.</p>
          </div>

          <h4 style="color: var(--accent);">🧩 Criteri di Assegnazione (Logica Sostituzioni)</h4>
          <p>Il sistema popola automaticamente le colonne del Registro Operativo seguendo questi criteri:</p>
          <ol>
              <li><strong>In Compresenza</strong>: Docenti presenti nella stessa classe alla stessa ora.</li>
              <li><strong>Compresenza in altre sezioni</strong>: Docenti presenti in altre classi alla stessa ora (potenzialmente spostabili).</li>
              <li><strong>A Disposizione / Potenziamento / Liberi</strong>: Docenti con debito da recuperare (priorità massima) o liberi da ogni impegno nell'orario ufficiale per tale ora.</li>
              <li><strong>Eccedenti / Straordinario</strong>: Docenti che hanno dichiarato disponibilità per ore extra.</li>
              <li><strong>Oltre 5 Ore</strong>: Docenti liberi, ma che supererebbero il limite di 5 ore consecutive.</li>
              <li><strong>Ricevimento (R)</strong>: I docenti in ricevimento <strong>rimangono visibili</strong> tra i candidati ma sono contrassegnati da una <strong style="color:var(--danger)">R rossa</strong> per segnalare l'impegno concomitante.</li>
              <li><strong>Fallback</strong>: Elenco alfabetico di tutti i docenti del plesso.</li>
          </ol>
          
          <h4 style="color: var(--accent);">Gestione Amministrativa e Caricamento Dati</h4>
          <ul>
            <li><strong>Importa dati (Novità)</strong>: Dal menu laterale, l'amministratore può caricare massivamente l'orario, l'anagrafica e i debiti iniziali, oltre ad esportare i dati correnti.</li>
            <li><strong>Inserire Sostituzioni</strong>: Usa il tasto <strong>"+ Nuova Sostituzione"</strong>. È possibile selezionare **più docenti contemporaneamente** (es. assemblea sindacale).</li>
            <li><strong>Registro Operativo</strong>: Le colonne mostrano ora distintamente i docenti in compresenza nella classe e quelli in **compresenza in altre sezioni**.</li>
            <li><strong>Gestione Supplenti (A tempo det.)</strong>: Se un docente è assente per lungo periodo, usa lo strumento integrato nel modale <strong>"Aggiungi/Modifica Docente"</strong> (scheda "Gestione Supplenti") nell'Anagrafica. Qui puoi nominare un supplente che erederà l'orario del titolare, riceverà notifiche e avrà un suo saldo ore personale.</li>
            <li><strong>Eventi Scolastici (Novità)</strong>: Dal menu laterale è possibile accedere alla bacheca degli eventi. Qui si possono coordinare progetti, uscite e incontri, specificando classi e docenti coinvolti per una migliore pianificazione scolastica.</li>
          </ul>

          <h4 style="color: var(--accent);">❌ Correzione ed Eliminazione</h4>
          <p>Se commetti un errore:</p>
          <ul>
            <li><strong>Singola Ora</strong>: Clicca sulla <strong>"✕"</strong> rossa accanto al nome del docente nel registro operativo.</li>
            <li><strong>Intera Assenza</strong>: Nel menu "⋮" (Tre puntini), seleziona <strong>"Elimina Assenza..."</strong>.</li>
          </ul>

          <div class="dropdown-divider" style="margin:20px 0"></div>

          <h4 style="margin-top:0; color: var(--accent);">1. Gestione Permessi Brevi</h4>
          <p>Le ore di permesso orario richieste dai docenti vengono caricate automaticamente come <strong>debito orario</strong>. Il sistema monitora la scadenza dei due mesi per il recupero.</p>
          
          <h4 style="color: var(--accent);">2. Approvazione Ferie</h4>
          <p>Quando un docente richiede ferie indicando i sostituti, l'amministratore vedrà i nomi dei colleghi nella scheda della richiesta. All'approvazione, il sistema notificherà automaticamente i sostituti indicati.</p>
          
          <h4 style="color: var(--accent);">3. Inserimento da Registro</h4>
          <p>L'amministratore può inserire assenze per ferie, formazione o permessi direttamente dal Registro Operativo o da Richieste Docenti. Nel modulo di inserimento, la <strong>motivazione è facoltativa</strong>.</p>
          
          <h4 style="color: var(--accent);">4. Uscite di Team</h4>
          <p>Registrando un'uscita (dal registro o approvando quella di un docente), puoi indicare più accompagnatori. Il sistema sincronizzerà i record di assenza per tutto il gruppo.</p>

          <h4 style="color: var(--accent);">5. Stampa Moduli</h4>
          <p>Usa l'icona 🖨️ (presente in Registro Operativo e Gestione Assenze) per generare istantaneamente il modulo di assenza istituzionale con l'intestazione dell'Istituto, pronto per la firma.</p>

          <h4 style="color: var(--accent);">6. Traccia Log</h4>
          <p>Ogni operazione di modifica (assegnazione, eliminazione, approvazione) viene registrata nel log di sistema con data, ora e utente che ha effettuato l'azione.</p>
        </div>
      `,
      footer: '<button class="btn btn-primary" style="width:100%" onclick="this.closest(\'.modal-overlay\').remove()">Chiudi</button>',
      size: 'modal-md'
    });
  }

  const getHash = () => window.location.hash.slice(1).replace(/^\//, '');

  function navigate(view) {
    const v = view.replace(/^\//, ''); // Normalize
    const currentViews = getViews();
    if (!currentViews[v]) return;
    
    if (v === 'login_preview' && !isAdminMaster()) { toast('Accesso negato.', 'warning'); return; }
    if (v === 'settings' && !isAdminMaster()) { toast('Accesso riservato ad Admin Master.', 'warning'); return; }
    if (['teachers', 'import_export', 'admin_notifications'].includes(v) && !isAdmin()) {
      toast('Permessi insufficienti.', 'warning'); return;
    }

    state.currentView = v;
    localStorage.setItem('sg_current_view', v);
    
    // Sync hash
    if (getHash() !== v) {
      window.location.hash = '/' + v;
    }

    document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === v));
    const content = document.getElementById('content-area');
    if (content) {
      content.innerHTML = '<div class="loading-overlay"><div class="spinner"></div> Caricamento…</div>';
      currentViews[v].render(content, state);
    }
  }

  let _authInitialized = false;
  async function checkAuth() {
    try {
      // 1. Avviamo la sincronizzazione dati (necessaria per avere i profili utente)
      Engine.init(async (db) => {
        console.log("[APP] Database Cloud sincronizzato. Verifica sessione...");
        
        // Se non abbiamo ancora inizializzato l'auth, proviamo ora
        if (!_authInitialized) {
          try {
            const user = await API.get('/auth/me');
            console.log("[APP] Sessione ripristinata:", user.username || user.email);
            state.user = user;
            _authInitialized = true;
            
            await loadYears();
            showApp();
            
            const targetView = getHash() || localStorage.getItem('sg_current_view') || 'operational_registry';
            navigate(targetView);
          } catch(e) {
            // Se fallisce l'auth/me, il token manuale non è più valido (es. DB resettato)
            console.log("[APP] Nessun utente rilevato via token.");
            const token = API.getToken();
            if (token && token.startsWith('cloud-')) {
               API.setToken(null);
               showLogin();
            }
          }
        } else if (state.user) {
          // Se siamo già loggati (es. via onAuth), aggiorniamo l'utente fresco e la navbar
          try {
            const fresh = await API.get('/auth/me');
            if (fresh) {
              state.user = fresh;
              updateUserInfo();
              buildNav();
            }
          } catch(e) {}
          navigate(state.currentView);
          loadYears();
        }
      });

      // 2. Ascoltiamo il segnale di autenticazione Firebase
      Engine.onAuth(async (firebaseUser) => {
        if (firebaseUser) {
           console.log("[APP] Firebase User rilevato:", firebaseUser.email);
           _authInitialized = true;
           try {
              const user = await API.get('/auth/me');
              state.user = user;
              await loadYears();
              showApp();
              const targetView = getHash() || localStorage.getItem('sg_current_view') || 'operational_registry';
              navigate(targetView);
           } catch(e) {
              showLogin();
           }
        } else {
           // Se Firebase dice che non c'è nessuno, verifichiamo se abbiamo un token manuale
           const token = API.getToken();
           if (!token) {
              console.log("[APP] Nessuna sessione (Firebase o Manuale).");
              _authInitialized = true;
              showLogin();
           } else if (token.startsWith('cloud-') && !_authInitialized) {
              // Abbiamo un token manuale, ma Engine.init potrebbe non aver ancora finito.
              // finalize verrà gestito nel callback di Engine.init
              console.log("[APP] In attesa di sincronizzazione per sessione manuale...");
           }
        }
      });

      // 3. Timeout di sicurezza
      setTimeout(() => {
        if (!_authInitialized) {
          console.warn("[APP] Timeout connessione o deadlock auth. Mostro login.");
          showLogin();
        }
      }, 6000);

    } catch(e) {
      console.error("[APP] Errore critico inizializzazione:", e);
      showLogin();
    }
  }

  function showLogin() {
    const login = document.getElementById('login-screen');
    const app = document.getElementById('app');
    if (login) login.style.display = 'flex';
    if (app) app.style.display = 'none';
  }

  function showApp() {
    const login = document.getElementById('login-screen');
    const app = document.getElementById('app');
    if (login) login.style.display = 'none';
    if (app) app.style.display = 'flex';
    updateUserInfo();
    updateTopbarDate();
    buildNav();

    // Initial routing based on hash
    const initialView = getHash() || (isTeacher() ? 'teacher_self_service' : 'operational_registry');
    navigate(initialView);

    // Watch for hash changes (back/forward buttons)
    window.addEventListener('hashchange', () => {
      const v = getHash();
      if (v && v !== state.currentView) navigate(v);
    });

    // Exit sandbox banner button
    document.getElementById('btn-exit-sandbox')?.addEventListener('click', () => {
      toggleSimulationMode(false);
    });
    updateSandboxBanner();
  }

  async function loadYears() {
    const sel = document.getElementById('year-selector');
    if (sel) sel.innerHTML = '<option value="">Caricamento...</option>';
    
    try {
      const years = await API.get('/settings/years');
      state.years = years || [];
      if (sel) {
        // Rimuoviamo il vecchio listener se presente per evitare duplicati
        sel.onchange = (e) => {
          const nid = e.target.value;
          state.yearId = nid;
          localStorage.setItem('sg_year_id', nid);
          navigate(state.currentView);
        };

        if (!state.years.length) {
          sel.innerHTML = '<option value="">(Nessun Anno)</option>';
          state.yearId = null;
          sel.classList.add('pulse-attention');
          if (isAdmin()) setTimeout(() => showOnboardingPrompt(), 500);
        } else {
          const options = state.years.map(y => {
            return `<option value="${y.id}" ${state.yearId === String(y.id) ? 'selected' : ''}>${escHtml(y.name)}</option>`;
          });
          if (!state.yearId) {
            options.unshift('<option value="" selected disabled>— Seleziona Anno —</option>');
          }
          sel.innerHTML = options.join('');
          
          if (!state.yearId) {
            const savedId = localStorage.getItem('sg_year_id');
            const active = (savedId && state.years.find(y => y.id == savedId)) || state.years.find(y => y.is_active) || state.years[state.years.length - 1];
            state.yearId = active ? String(active.id) : null;
            if (state.yearId) localStorage.setItem('sg_year_id', state.yearId);
          }
          
          sel.value = state.yearId || "";
          sel.classList.toggle('pulse-attention', !state.yearId);
        }
      }
      renderSimControl();
    } catch(e) { 
      console.error('Errore caricamento anni:', e); 
      if (sel) sel.innerHTML = '<option value="">Errore dati</option>';
    }
  }

  function isSimulationMode() {
    return typeof Engine !== 'undefined' && Engine.isSandboxActive ? Engine.isSandboxActive() : false;
  }

  function updateSandboxBanner() {
    const banner = document.getElementById('sandbox-banner');
    if (banner) {
      banner.style.display = (isAdmin() && isSimulationMode()) ? 'block' : 'none';
    }
  }

  function renderSimControl() {
    const wrap = document.getElementById('sidebar-sim-wrapper');
    if (!wrap) return;

    if (!isAdmin() || !isSimulationMode()) {
      wrap.innerHTML = '';
      updateSandboxBanner();
      return;
    }

    // Mostra solo il badge informativo se la modalità test è attiva
    wrap.innerHTML = `
      <div style="background:rgba(245, 158, 11, 0.12); border:1px solid rgba(245, 158, 11, 0.4); border-radius:8px; padding:6px 10px; font-size:11px; font-weight:700; color:#d97706; display:flex; align-items:center; gap:6px; justify-content:center;">
        <span>🧪</span> Modalità Test Attiva
      </div>
    `;
    updateSandboxBanner();
  }

  async function toggleSimulationMode(enable) {
    if (!state.yearId) {
      toast('Seleziona prima un anno scolastico', 'warning');
      return;
    }

    if (enable) {
      const res = Engine.startSandbox(state.yearId);
      if (res && res.testDate) {
        localStorage.setItem('registry_preselected_date', res.testDate);
      }
      toast('🧪 Modalità Simulazione attivata (Sessione locale protetta).', 'success');
    } else {
      Engine.stopSandbox();
      localStorage.removeItem('registry_preselected_date');
      toast('Modalità Simulazione disattivata. Ripristinati i dati reali.', 'info');
    }

    renderSimControl();
    updateSandboxBanner();
    await loadYears();
    navigate('operational_registry');
  }

  function showOnboardingPrompt() {
    if (state.currentView === 'settings') return; // Se è già lì, non disturbare
    modal({
      title: '👋 Benvenuto nel Registro Sostituzioni',
      body: `
        <div style="text-align:center; padding: 10px;">
          <div style="font-size:40px; margin-bottom:16px;">🗓️</div>
          <p>Per iniziare ad utilizzare il sistema, è necessario configurare la struttura scolastica.</p>
          <div style="background:var(--accent-light); padding:12px; border-radius:8px; font-size:13px; margin: 16px 0;">
            <strong>Step 1</strong>: Crea l'Anno Scolastico corrente nelle impostazioni.
          </div>
        </div>
      `,
      footer: '<button class="btn btn-primary" style="width:100%" onclick="APP.navigate(\'settings\'); this.closest(\'.modal-overlay\').remove()">Vai alle Impostazioni</button>'
    });
  }

  function updateUserInfo() {
    const u = state.user;
    if (!u) return;
    const avatar = (u.teacher?.name || u.username || 'A').charAt(0).toUpperCase();
    const avEl = document.getElementById('user-avatar');
    const nmEl = document.getElementById('user-name');
    const rlEl = document.getElementById('user-role');
    if (avEl) avEl.textContent = avatar;
    if (nmEl) nmEl.textContent = u.teacher?.name || u.username;
    if (rlEl) {
      rlEl.textContent = ROLE_LABELS[u.role] || u.role;
      if (u.role === 'admin_master') rlEl.style.color = 'var(--warning-text)';
    }
  }

  function updateTopbarDate() {
    const el = document.getElementById('topbar-date');
    if (!el) return;
    const now = new Date();
    const day = now.toLocaleDateString('it-IT', { weekday: 'long' });
    const date = now.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
    el.innerHTML = `Oggi è <span>${day}, ${date}</span>`;
  }

  function buildNav() {
    const role = (state.user?.role || '').toLowerCase().trim();
    const isMaster = role === 'admin_master';
    const isAdminOrMaster = role === 'admin' || role === 'admin_master';

    const showIf = (selector, condition) => {
      const el = document.querySelector(selector);
      if (el) el.style.display = condition ? (el.tagName === 'DIV' ? 'flex' : 'block') : 'none';
    };

    // Amministrazione (riservata ad Admin e Master)
    showIf('#admin-section-label', isAdminOrMaster);
    showIf('.nav-item[data-view="teachers"]', isAdminOrMaster);
    showIf('.nav-item[data-view="admin_notifications"]', isAdminOrMaster);
    showIf('.nav-item[data-view="import_export"]', isAdminOrMaster);
    showIf('.nav-item[data-view="settings"]', isMaster); // Solo Admin Master!
    showIf('#nav-login-preview', isMaster);
    showIf('#nav-instr-admin', isAdminOrMaster);

    // Principale (visibili a tutti)
    showIf('.nav-item[data-view="schedule"]', true);
    showIf('.nav-item[data-view="organigramma"]', true);

    renderSimControl();
  }

  function logout() {
    API.setToken(null);
    localStorage.removeItem('sg_user');
    state.user = null;
    Engine.logout();
    window.location.reload(); 
  }

  return { 
    init: () => checkAuth(),
    navigate, toast, modal, confirm, logout, loadYears, showApp, showLogin,
    showPrivacyModal, showTermsModal, showTeacherManual, showAdminManual,
    isSimulationMode, toggleSimulationMode, renderSimControl,
    getState: () => state,
    isAdmin, isAdminMaster, isTeacher
  };
})();

// ── GLOBAL HANDLERS ──

async function handleLoginSubmit(e) {
  if (e) e.preventDefault();
  const uEl = document.getElementById('login-username');
  const pEl = document.getElementById('login-password');
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  const cb = document.getElementById('login-terms-cb');

  if (!uEl || !pEl || !errEl || !btn || !cb) return;

  if (!cb.checked) {
    errEl.style.display = 'flex';
    errEl.textContent = 'Accetta i Termini e Condizioni per continuare.';
    cb.parentElement.style.color = 'var(--danger-text)';
    return;
  }

  btn.disabled = true;
  errEl.style.display = 'flex';
  errEl.textContent = 'Autenticazione...';

  try {
    const res = await API.post('/auth/login', { username: uEl.value.trim(), password: pEl.value });
    console.log('[LOGIN] Successo:', res.user.username);
    APP.getState().user = res.user;
    API.setToken(res.token);
    await APP.loadYears();
    APP.showApp();
  } catch (err) {
    console.error('[LOGIN] Errore:', err);
    errEl.textContent = err.message || 'Credenziali non valide';
    btn.disabled = false;
  }
}

window.handleGoogleSignIn = async (response) => {
  const errEl = document.getElementById('login-error');
  try {
    if (errEl) { errEl.style.display='flex'; errEl.textContent = 'Autenticazione Google in corso...'; }
    const res = await Engine.loginWithGoogle();
    APP.getState().user = res.user;
    API.setToken(res.token);
    // showApp verrà chiamato automaticamente da onAuth
  } catch(e) {
    if (errEl) { errEl.style.display='flex'; errEl.textContent = e.message; }
  }
};

// ── DOM INIT ──

document.addEventListener('DOMContentLoaded', () => {
  console.log('[APP] DOM Caricato, avvio...');
  APP.init();

  const lForm = document.getElementById('login-form');
  if (lForm) lForm.onsubmit = handleLoginSubmit;

  const rForm = document.getElementById('register-form');
  if (rForm) {
    rForm.onsubmit = async (e) => {
      e.preventDefault();
      const email = document.getElementById('reg-email').value;
      const username = document.getElementById('reg-username').value;
      const password = document.getElementById('reg-password').value;
      const errEl = document.getElementById('register-error');
      if (password.length < 6) { errEl.style.display='flex'; errEl.textContent = 'Password troppo corta (min 6 car.)'; return; }
      try {
        await API.post('/auth/register', { email, username, password });
        APP.toast('Registrazione completata!', 'success');
        document.getElementById('goto-login')?.click();
      } catch(ex) { errEl.style.display='flex'; errEl.textContent = ex.message; }
    };
  }

  const resetDB = () => {
    if (window.confirm('Cancellare tutti i dati locali e ripristinare il sistema?')) {
      localStorage.clear();
      window.location.reload();
    }
  };
  document.getElementById('emergency-reset-btn')?.addEventListener('click', resetDB);
  document.getElementById('emergency-reset-btn-reg')?.addEventListener('click', resetDB);

  document.getElementById('goto-register')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('login-card').style.display = 'none';
    document.getElementById('register-card').style.display = 'block';
  });
  document.getElementById('goto-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('login-card').style.display = 'block';
    document.getElementById('register-card').style.display = 'none';
  });

  // Link Termini e Privacy nella pagina di Login/Registrazione
  document.getElementById('login-terms-link')?.addEventListener('click', (e) => { e.preventDefault(); APP.showTermsModal(); });
  document.getElementById('login-privacy-link')?.addEventListener('click', (e) => { e.preventDefault(); APP.showPrivacyModal(); });
  document.getElementById('reg-terms-link')?.addEventListener('click', (e) => { e.preventDefault(); APP.showTermsModal(); });
  document.getElementById('reg-privacy-link')?.addEventListener('click', (e) => { e.preventDefault(); APP.showPrivacyModal(); });

  const sidebar = document.querySelector('.sidebar');
  const toggle = document.getElementById('mobile-toggle-btn');
  const closeBtn = document.getElementById('sidebar-close-btn');

  if (toggle && sidebar) {
    toggle.onclick = (e) => {
      e.stopPropagation();
      if (window.innerWidth <= 1024) sidebar.classList.toggle('open');
      else sidebar.classList.toggle('collapsed');
    };
  }

  if (closeBtn && sidebar) {
    closeBtn.onclick = () => sidebar.classList.remove('open');
  }

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const v = item.dataset.view;
      if (v) {
        APP.navigate(v);
        if (window.innerWidth <= 1024) sidebar?.classList.remove('open');
      }
    });
  });

  document.getElementById('logout-btn')?.addEventListener('click', () => APP.logout());
  
  // Sidebar Legal & Info Links
  document.getElementById('nav-privacy')?.addEventListener('click', () => {
    APP.showPrivacyModal();
    if (window.innerWidth <= 1024) sidebar?.classList.remove('open');
  });
  document.getElementById('nav-terms')?.addEventListener('click', () => {
    APP.showTermsModal();
    if (window.innerWidth <= 1024) sidebar?.classList.remove('open');
  });
  document.getElementById('nav-instr-teacher')?.addEventListener('click', () => {
    APP.showTeacherManual();
    if (window.innerWidth <= 1024) sidebar?.classList.remove('open');
  });
  document.getElementById('nav-instr-admin')?.addEventListener('click', () => {
    APP.showAdminManual();
    if (window.innerWidth <= 1024) sidebar?.classList.remove('open');
  });

  // Gestore cambio anno
  document.getElementById('year-selector')?.addEventListener('change', e => {
    const newYearId = e.target.value;
    if (APP.getState().yearId != newYearId) {
      APP.getState().yearId = newYearId;
      localStorage.setItem('sg_year_id', newYearId);
      APP.navigate(APP.getState().currentView);
    }
  });

  const zoomSel = document.getElementById('ui-zoom-select');
  if (zoomSel) {
    const saved = localStorage.getItem('ui_zoom') || '1.0';
    zoomSel.value = saved;
    document.body.style.zoom = saved;
    zoomSel.onchange = (e) => {
      document.body.style.zoom = e.target.value;
      localStorage.setItem('ui_zoom', e.target.value);
    };
  }
});
