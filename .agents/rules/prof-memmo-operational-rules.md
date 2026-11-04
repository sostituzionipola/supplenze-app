# REGOLE OPERATIVE DI SICUREZZA PER L'ECOSISTEMA PROF. MEMMO
# Versione 2.4 - Consolidata, Blindata e Armonizzata (27 Ottobre 2026)

Tutti gli agenti AI e i programmatori che operano sui repository dell'Ecosistema Prof. Memmo DEVONO rispettare rigorosamente le seguenti regole inderogabili.

---

### AMBITO E PERIMETRO UFFICIALE DELL'ECOSISTEMA (I 10 REPOSITORY CANONICI)
L'Ecosistema didattico e gestionale di Prof. Memmo è costituito esclusivamente dai seguenti 10 progetti ufficiali:
1. **prof-memmo-gestione-siti** (Hub Admin di Gestione e Portale Operativo)
2. **games** (Portale Vetrina, Catalogo Giochi e Accesso Unificato)
3. **fantaletteratura** (FantaLetteratura)
4. **la-rotta-degli-eroi** (La Rotta degli Eroi)
5. **la-corte-della-commedia** (La Corte della Commedia)
6. **palestra-di-riflessione** (La Palestra di Riflessione)
7. **ops-storia** [ops-web] (Ops! Operazione Storia)
8. **l-oratore** (L'Oratore)
9. **historygram** (HistoryGram)
10. **la-ruota-geografica** (La Ruota Geografica)

> [!IMPORTANT]
> Applicazioni organizzative separate (es. **Supplenze App**) sono strumenti autonomi a destinazione d'uso differente, non fanno parte dell'ecosistema giochi e materiali didattici e sono tassativamente escluse dagli audit globali, dalle metriche didattiche e dalle pipeline di rilascio dell'ecosistema.

---

### ART. 1 - NESSUNA INIZIATIVA NON RICHIESTA (ZERO UNSOLICITED INITIATIVES)
- E' fatto divieto assoluto di introdurre nuovi componenti UI, campi input, selettori, form, modali o stili che non siano stati espressamente richiesti e concordati con l'utente.
- Le implementazioni devono attenersi scrupolosamente all'obiettivo pattuito, senza estensioni arbitrarie.

---

### ART. 2 - DIVIETO ASSOLUTO DI CANCELLAZIONE SILENZIOSA (ZERO DELETIONS GUARD)
- E' severamente vietato cancellare, rinominare, commentare o svuotare:
  1. Blocchi di markup HTML preesistenti (viste, card, pulsanti, riepiloghi, elenchi).
  2. Metodi e funzioni JavaScript dei motori core (GameEngine, Board, AudioEngine, LiveEditor, App, Auth, DiagnosticsService).
  3. Classi o regole CSS preesistenti.
  4. Strutture dati e record nei file JSON.
- Qualsiasi modifica deve essere puramente additiva o di correzione mirata, preservando la retrocompatibilita totale con il markup storico approvato.

---

### ART. 3 - SALVAGUARDIA TOTALE DI UTENTE, AUTENTICAZIONE (SSO), LOGIN E ABBONAMENTI
- E' fatto divieto di alterare o rimuovere i componenti di autenticazione Firebase, i file di sessione (js/auth/session.js), la guardia abbonamenti (hub-subscription-guard.js) e il menu profilo utente (user-dropdown, avatar, nome, ruolo, scuola).
- I flussi di Single Sign-On (SSO) cross-progetto e i reindirizzamenti via query param (?redirect=...) devono essere sempre garantiti e funzionanti sia in ambiente standard che in ambiente /preview/.
- Le collezioni Cloud Firestore (hub_users, eroi_users, corte_users, fanta_users, palestra_users, ops_users, hub_settings, hub_didactic_overrides) non devono mai essere corrotte, svuotate o private di permessi di sicurezza.

---

### ART. 4 - INTEGRITA STRUTTURALE DEI COMPONENTI PROTETTI
- **Footer di Copyright Patamu**: Deve essere presente in tutte le viste principali, con altezza badge esattamente a 52px (object-fit: contain; flex-shrink: 0;), testo legale giustificato e opacita controllata.
- **Barra di Navigazione Inferiore (Dock Bar)**: Posizionamento fisso in basso a 64px di altezza, centrata, con icone, etichette e transizioni fluide.
- **Isolamento Modali**: Tutti i modali secondari (legale, profilo, salvataggi, live editor) devono avere la regola CSS `.hidden, [hidden] { display: none !important; }` per non influenzare mai il flusso e lo scroll delle pagine.

---

### ART. 5 - AUDIT AUTOMATICO ANTI-REGRESSIONE E VERIFICA VISIVA OBBLIGATORIA (PRE-COMMIT)
Prima di considerare conclusa qualsiasi modifica e prima di effettuare il push su Git, l'agente DEVE eseguire una verifica programmatica e visiva rigorosa:
1. **Audit Sintassi CSS Totale (File esterni e tag `<style>` inline)**:
   - Conteggio e bilanciamento matematico perfetto delle parentesi graffe `{` e `}` su tutti i file `.css` e su tutti i tag `<style>` embedded nelle pagine HTML (scarto zero tollerato).
   - Verifica di chiusura esplicita di ogni selettore e proprietà con `;` e `}`.
2. **Audit Visivo Obbligatorio (Browser Subagent / Visual Testing)**:
   - Per qualsiasi modifica che tocca HTML, CSS o flussi di navigazione/onboarding/login, l'agente ha il divieto assoluto di concludere il task senza aver prima eseguito una verifica con il browser reale/subagent.
   - L'agente deve catturare gli screenshot di collaudo per ogni sotto-vista (es. Scelta Ruolo, Accesso Docente, Codice Classe Studente, Roster Claiming, Onboarding Profilo) e confermare visivamente proporzioni, griglie e allineamenti.
3. **Defensive UI Pattern (Contenimento Forzato Asset & Immagini)**:
   - Nessuna immagine, avatar, badge o icona può essere inserita senza stili o classi di contenimento protetto (`max-width: 100%; max-height: 100%; object-fit: cover; aspect-ratio: 1/1;` e dimensioni fisse sul container) per impedire il rendering sformato anche in caso di anomalie di stile.
4. **Audit Database JSON**: Validazione di tutti i file JSON tramite parser automatico per certificare l'assenza di errori di sintassi, virgole mancanti o codifica.
5. **Audit Coerenza DOM / JS**: Verifica che nessun metodo JS referenzi ID o classi cancellati o inesistenti.
6. **Audit Working Tree**: Controllo di git diff e git status per verificare che non ci siano file sporchi o modifiche collaterali non intenzionali.

---

### ART. 6 - MODALITA CONSULTIVA (READ-ONLY) SU DOMANDE ESPLORATIVE
- Quando l'utente formula domande di parere, riflessione o strategia ("che ne pensi?", "come la vedi?", "cosa faresti?"), l'agente opera in modalita rigorosamente **READ-ONLY**.
- In questa modalita e vietato modificare file, eseguire comandi distruttivi o avviare refactoring: l'agente deve limitarsi a fornire analisi obiettive, confronti tecnici e proposte dettagliate in attesa dell'approvazione esplicita.

---

### ART. 7 - GESTIONE BRANCH, WORKFLOW DI RILASCIO E PREVIEW COME 'RELEASE CANDIDATE'
1. **Branch Preview come Release Candidate Ufficiale**:
   - Tutti i test, le verifiche e le implementazioni dell'assistente DEVONO essere committati e spinti **esclusivamente sul branch `preview`** (`git push origin preview`).
   - La versione su `preview` NON è una bozza transitoria, ma la **Release Candidate definitiva e pronta per la produzione**: al termine di ogni blocco, `preview` deve essere funzionante al 100% per permettere all'utente di rilasciarla immediatamente su `main` tramite l'Hub Admin.
   - E' fatto divieto assoluto di eseguire il push diretto sul branch `main` dall'assistente: la promozione di `preview` a `main` è riservata unicamente all'azione dell'utente tramite il pulsante "Pubblica su Live (main)" nell'Hub Admin.
2. **Pre-Flight Check e Sincronizzazione da `origin/main`**:
   - Prima di iniziare a lavorare su `preview` per qualsiasi progetto, l'agente DEVE eseguire un controllo preventivo di `origin/main`. Se l'utente ha effettuato rilasci automatici da Hub Admin su `main`, l'agente deve eseguire `git fetch` e `git merge origin/main` in `preview` per garantire l'assoluta continuità della cronologia Git.

---

### ART. 8 - PROTOCOLLO DI COLLAUDO OBBLIGATORIO A 3 LIVELLI DELL'ECOSISTEMA (TARGET CANALE PREVIEW)
Prima di considerare conclusa qualsiasi sessione di lavoro o rilascio, è fatto obbligo inderogabile di eseguire la scansione automatica di integrità sui **10 ambienti `/preview/` dell'Ecosistema Prof. Memmo** secondo il protocollo a 3 livelli:

1. **LIVELLO 1: AUDIT DI RETE & ASSET SUL CANALE PREVIEW (ZERO-404 / 500)**:
   - **Target Obbligatorio Preview**: La scansione di rete automatica (`tools/audit_ecosistema.py`) deve validare primariamente gli ambienti `https://prof-memmo.github.io/<progetto>/preview/` dei 10 siti dell'ecosistema (con opzione `--live` per verifiche post-rilascio).
   - **Zero 404 / 500 / 503**: Ogni singolo foglio di stile CSS, script JS, font web, immagine, logo, video e manifest collegato alle pagine deve rispondere con HTTP 200 OK.
   - **Coerenza di radice e URL Encoding**: Nessun percorso di immagine o video può contenere spazi grezzi o apici conflittuali negli attributi HTML (devono essere codificati con `%20` o normalizzati a livello di filesystem).

2. **LIVELLO 2: AUDIT BROWSER REALE, CONSOLE & CROSS-BROWSER SCOLASTICO (CHROMIUM + WEBKIT/SAFARI)**:
   - **Rendering e Booting Completo**: Apertura automatizzata delle pagine preview tramite motore browser reale (Playwright / Headless Browser).
   - **Ispezione Console Obbligatoria**: Nessuna eccezione JavaScript non gestita ammessa in console (`console.error`, `Uncaught TypeError`, ecc.).
   - **Verifica Cross-Browser Scolastica**: Il percorso critico di autenticazione e accesso studente (portale, inserimento codice classe, selezione roster e token) deve essere validato obbligatoriamente sia su motore Chromium sia su motore WebKit (Safari), assicurando piena compatibilità con tablet e iPad utilizzati nelle scuole.
   - **Certificazione Firebase/Auth**: Monitoraggio del completamento del bootstrap dei servizi cloud (es. emissione evento `firebaseHubReady` o log di successo `🔥 Firebase Hub Centrale Unico inizializzato`).

3. **LIVELLO 3: TEST FUNZIONALE E2E E ZERO DEAD-CLICKS (INTERACTION & BUTTON LIFECYCLE GUARD)**:
   - **Zero Elementi Interattivi 'Morti'**: Divieto assoluto di tag `<a>` o `<button>` con `href="#"`, `href="javascript:void(0)"` o listener privi di handler attivo.
   - **Simulazione Clic Reale**: Il browser automatizzato deve simulare i clic e le interazioni chiave dell'utente (apertura modali legali Patamu, navigazione tra sezioni, drawer).
   - **Stati Visivi Obbligatori**: Ogni pulsante deve implementare feedback visivo per `:hover`, `:active`, `:focus-visible` e `disabled` (con disabilitazione immediata anti-doppio submit sui form).
   - **Modali e Overlay**: Blocco dello scroll del body (`overflow: hidden`), chiusura esplicita ("X"), click su backdrop e tasto `Escape`.
   - **Footer Condiviso**: Verifica che Privacy Policy e Termini aprano correttamente `#pmSharedOverlay` tramite `https://gestionesiti.profmemmo.it/shared/legal-modal.js`.

---

### ART. 9 - PROTOCOLLO DI COLLAUDO CROMATICO E ACCESSIBILITÀ VISIVA (WCAG CONTRAST GUARD)
Prima di considerare conclusa qualsiasi modifica stilistica o di layout, l'agente DEVE eseguire un audit cromatico sul browser:
1. **Soglie Minime di Contrasto (WCAG 2.1 Livello AA)**:
   - **Testo Standard (< 18pt o < 14pt bold)**: rapporto di contrasto testo/sfondo calcolato >= 4.5:1.
   - **Testo Grande o Titoli (>= 18pt o >= 14pt bold)**: rapporto di contrasto >= 3.0:1.
   - **Contorno e Forma dei Componenti Interattivi**: i bordi/sfondi dei pulsanti e campi input devono avere contrasto >= 3.0:1 rispetto allo sfondo della pagina.
   - **Testo all'interno dei Pulsanti**: il testo interno a un pulsante deve garantire contrasto >= 4.5:1 sia nello stato di riposo che nello stato `:hover`.
2. **Risoluzione di Trasparenze, Gradienti e Glassmorphism**:
   - In presenza di sfondi sfumati (`linear-gradient`) o pannelli trasparenti (`backdrop-filter: blur`, `rgba(...)`), il contrasto deve essere calcolato rispetto al colore effettivo di rendering sottostante. Nessun testo deve risultare affogato o scarsamente leggibile.
3. **Verifica Responsive e Touch Targets (Mobile Guard)**:
   - Verifica alle risoluzioni mobile (375px e 390px) e tablet (768px):
     - Assoluta assenza di scroll orizzontale non intenzionale (`overflow-x` parassita).
     - Area cliccabile minima per pulsanti e icone di tocco pari ad almeno 44x44px (o 48x48px).
4. **Certificazione Cromatico-Visiva**:
   - L'agente deve confermare nel messaggio di consegna il superamento dell'audit cromatico e l'assenza di violazioni di contrasto sui componenti modificati.

---

### ART. 10 - PROTOCOLLO DI COLLAUDO FIREBASE, CLOUD FIRESTORE E INTEGRITÀ BACKEND
Nelle applicazioni che integrano Firebase e Firestore, prima del rilascio su `preview` l'agente deve certificare l'integrità dei flussi dati:
1. **Zero Errori di Permessi Firestore (Security Rules Guard)**:
   - Tutte le operazioni di lettura, scrittura, aggiornamento e cancellazione devono essere testate senza produrre eccezioni `FirebaseError: Missing or insufficient permissions`.
2. **Protezione dello Stato di Autenticazione (Zero-Flicker Guard)**:
   - L'inizializzazione del listener `onAuthStateChanged` deve gestire correttamente lo stato intermedio di caricamento (skeleton o spinner), senza mai mostrare transitoriamente il form di login a un utente che possiede una sessione valida.
3. **Validazione Domini Autorizzati (Authorized Domains)**:
   - Per i test e i flussi di autenticazione negli ambienti `/preview/`, verificare che il dominio di staging sia censito negli Authorized Domains di Firebase Auth per evitare blocchi nei redirect Google/Email Sign-In.
4. **Integrità Strutturale dei Dati (Schema Preservation)**:
   - Nessuna scrittura su Firestore può sovrascrivere o azzerare proprietà preesistenti con `undefined`. Ogni mutazione deve preservare i campi standard di audit (`updatedAt`, `uid`, tenant/scuola).
5. **Integrità Asset di Rete e Policy Audio**:
   - Verifica di zero errori `404 Not Found` nel tab Network per risorse JSON didattiche, avatar, icone o suoni.
   - Nelle app dotate di `AudioEngine`, verificare che nessun audio venga avviato prima del primo gesto/click dell'utente, prevenendo eccezioni non gestite `NotAllowedError: play() failed`.
6. **Standard Manutenzione Straordinaria & Guardiano Centralizzato (WIP Guard)**:
   - Ogni gioco dell'Ecosistema deve integrare il Guardiano Centralizzato (`shared/hub-subscription-guard.js`). Quando un gioco è disattivato su Firestore (`isActive: false`):
     - Nel portale Vetrina e nell'Archivio: il pulsante deve assumere la classe `.wip-link` con etichetta *"Lavori in corso"* e aprire la modale informativa dedicata.
     - Nel gioco diretto: l'overlay deve mostrare obbligatoriamente l'avatar ufficiale del **Capibara al PC con caffè (`16.png`)**, il titolo *"Lavori in corso"* / *"Manutenzione Straordinaria"* e i pulsanti di rientro al portale.

---

### ART. 11 - WORKFLOW SEQUENZIALE A BLOCCHI E APPROVAZIONE ESPLICITA (STEP-BY-STEP CHECKPOINT GUARD)
Per garantire il pieno controllo su ogni modifica ed evitare derive o regressioni a catena, ogni operazione di sviluppo deve seguire rigorosamente un flusso sequenziale frammentato:
1. **Scomposizione Obbligatoria in Blocchi Atomici (Atomic Milestones)**:
   - Qualsiasi task, implementazione o sessione di refactoring DEVE essere preventivamente suddivisa in **blocchi di lavoro singoli, isolati e sequenziali**.
   - E' fatto divieto assoluto di eseguire modifiche cumulative o di lavorare su più componenti/obiettivi contemporaneamente nello stesso step.
2. **Report di Collaudo e Anti-Regressione al Termine di Ogni Blocco**:
   - Al completamento di ciascun blocco, l'agente DEVE arrestare l'esecuzione e presentare all'utente un riepilogo formale contenente:
     - *Perimetro del blocco*: file toccati ed esatta modifica apportata.
     - *Esito Audit Tecnico*: bilanciamento CSS (`{}` a saldo zero), validazione JSON, 0 errori in console.
     - *Verifica Regressioni*: conferma che i blocchi precedenti, i componenti protetti e le viste non modificate siano rimasti intatti e funzionanti.
     - *Esito Collaudo Visivo / Subagent*: eventuale screenshot e conferma del corretto rendering.
3. **Punto di Arresto e Attesa dell'OK Esplicito (Checkpoint Stop)**:
   - Dopo aver emesso il report del blocco, l'agente ha il **DIVIETO ASSOLUTO di procedere al blocco successivo** in autonomia.
   - L'agente deve terminare il proprio turno e rimanere in attesa dell'esplicito messaggio di convalida dell'utente ("ok", "procedi", "avanti"). Nessuna riga di codice del blocco successivo può essere scritta prima di tale conferma.

---

### ART. 12 - PROTOCOLLO DI AUDIT DI CONFORMITÀ DIDATTICA, UX E LIM ("MANCA QUALCOSA?")
Ogni volta che l'utente formula domande aperte di verifica come:
*"Manca qualcosa?"*, *"Ci sono problemi?"*, *"Secondo te va bene?"*, *"Audit conformità"*, o qualsiasi richiesta di revisione generale su un gioco o componente dell'Ecosistema:

1. **Divieto di Fermarsi al Solo Collaudo Tecnico (Anti-False-Positive Guard)**:
   - L'agente NON DEVE limitarsi a verificare se il codice compila, se i test di rete danno HTTP 200 o se il git working tree è pulito. Per un linter o test di rete, un pulsante orfano o un testo grafico illeggibile risultano "100% OK", ma violano gli standard didattici dell'Ecosistema.
2. **Audit Obbligatorio sui 5 Pilastri di Conformità UX & LIM**:
   - **Pilastro 1: Zero-Scroll Viewport**: La vista operativa del gioco deve essere rigorosamente contenuta al 100% all'interno del viewport (desktop/LIM), senza barre di scorrimento verticali parassite.
   - **Pilastro 2: Eliminazione Ridondanze UI (Zero-Redundancy Guard)**: Nessun pulsante a centro schermo deve duplicare azioni già presenti negli elementi primari di gioco (es. ruote, tabelloni, carte) o nella dock bar inferiore (es. pulsante "Regolamento" duplicato nella welcome o pulsanti "Reset/Free" ridondanti sotto elementi interattivi).
   - **Pilastro 3: Leggibilità Grafica e Canvas a Distanza LIM (3 Metri)**:
     - Nei componenti grafici `<canvas>` o SVG, è vietato l'uso di font sottili o non scalabili (es. *Julius Sans One* su testi piccoli). Utilizzare esclusivamente font solidi ad alta leggibilità (`system-ui`, `Inter`, `sans-serif`) con pesi `bold` o `900`.
     - Rispetto del contrasto WCAG (testo chiaro su spicchi/tessere scure con ombra a 360°, testo scuro su spicchi chiari).
     - Gestione multiriga automatica per etichette composte da più parole: nessun testo deve toccare, sovrapporsi o finire coperto sotto perni, mozzi centrali o bordi esterni.
   - **Pilastro 4: Allineamento agli Standard Ecosistema (L'Oratore / HistoryGram Benchmark)**:
     - Presenza obbligatoria della modale "Riprendi Partita" e gestione salvataggi in LocalStorage.
     - Visualizzazione delle prove/sfide estratte tramite modale pop-up centrale ad alto contrasto con timer dedicato (non testo inline statico sotto gli elementi).
     - Proporzioni armoniose dei pulsanti primari (mai bottoni sovradimensionati che rompono la gerarchia visiva).
   - **Pilastro 5: Sovranità dell'Hub Admin e Divieto Assoluto di Hardcoding**:
     - Qualsiasi impostazione, descrizione delle card, elenco punti, prezzo, sconto promozionale, stato di attivazione di un gioco (`games_status`) o configurazione didattica che possa essere modificata dall'utente tramite il pannello di controllo dell'Hub centrale (`prof-memmo-gestione-siti`), **NON DEVE MAI essere modificata o forzata nel codice sorgente statico dall'agente**.
     - L'agente ha il dovere di indicare all'utente la sezione precisa dell'Hub in cui intervenire in autonomia e limitarsi nel codice a garantire la corretta sincronizzazione dinamica con Firestore.
3. **Ispezione Visiva Reale Tramite Browser Subagent**:
   - L'agente DEVE eseguire una scansione reale con il browser subagent catturando le viste chiave (Welcome, Scelta Argomento/Lobby, Tavolo di Gioco) ed emettere un report puntuale con checkbox `[X]` / `[ ]` per ciascuno dei 5 pilastri.

---

### ART. 13 - PROTOCOLLO DI INTEGRITÀ SEMANTICA DEI CONTENUTI, REGOLE DI PUNTEGGIO E CICLO DI TURNO (SEMANTIC & MULTI-TURN GAMEPLAY INTEGRITY GUARD)
Valido tassativamente per tutte le applicazioni e siti presenti e futuri dell'Ecosistema Prof. Memmo:
1. **Zero-Template e Zero-Duplicati nei Dataset Didattici (Content Uniqueness Guard)**:
   - E' fatto divieto assoluto di rilasciare o mantenere dataset JSON/JS con testi template clonati, generici o procedurati con copia-incolla (es. formule burocratiche ripetute, refusi di sintassi, tracce identiche su più slot).
   - Ogni mazzo, livello didattico o categoria deve possedere contenuti unici, autentici, narrativi e tarati pedagogicamente sul target scolastico reale (A1-A2 Scuola Primaria, B1 Scuola Media, B2-C2 Superiori).
   - L'indice di unicità semantica dei testi didattici all'interno di ogni file/dataset deve essere >= 95%.
2. **Coerenza Effetto-Punteggio (Scoring Business Logic Guard)**:
   - Qualsiasi elemento interattivo a schermo (buzzer penalità, bonus tempo, moltiplicatori di passi, conteggio vocaboli) DEVE produrre un impatto matematico reale, verificabile ed esplicitamente visualizzato nel riepilogo a video. E' severamente vietato avere pulsanti dotati di feedback sonoro/visivo privi di impatto effettivo sulle regole di gioco o sul punteggio.
3. **Rotazione E2E dei Contenuti nei Turni (Multi-Turn Progression Guard)**:
   - Nei giochi a squadre o a turni, ogni transizione di turno deve garantire l'estrazione e il rendering visivo di contenuti differenti: due squadre consecutive nello stesso round o in turni contigui non possono mai visualizzare la medesima traccia identica.
4. **Contratto Universale di Persistenza e Ripresa Sessione (Save & Resume Contract)**:
   - Tutte le applicazioni a sessione devono salvare lo stato automaticamente a ogni turno (`autoSave`) e devono esporre:
     1. Un banner o pulsante evidente nella schermata principale per riprendere la sessione interrotta.
     2. Un'opzione di uscita ordinata *"Salva ed Esci"* accessibile in qualsiasi momento durante la partita.
5. **Estensione Obbligatoria del Collaudo Automatico (Universal Test Suite Integration)**:
   - I collaudi automatici dell'ecosistema (Master Suite `collaudo_totale.py` e Preflight Hub `releases-ui.js`) devono obbligatoriamente includere l'Audit Semantico dei dataset e la simulazione multi-turno Playwright per validare il flusso reale su tutti i siti presenti e futuri.

---

### ART. 14 - PROTOCOLLO DI CONGELAMENTO COMPONENTI STABILIZZATI E DIVIETO DI MODIFICA (FROZEN COMPONENTS GUARD)
1. **Definizione di Componente Congelato / Stabilizzato**:
   - Sono dichiarati formalmente **CONGELATI E STABILIZZATI** tutti i componenti trasversali che hanno raggiunto la conformità di ecosistema:
     1. **Header Globale e Navigazione Superiore** (Branding, loghi, proporzioni, allineamenti, layout responsive).
     2. **Menù a Tendina Profilo (User Dropdown)**: logica di autenticazione Firebase, SSO, lettura avatar e switch di ruolo.
     3. **Footer Istituzionale di Copyright Patamu**: altezza fissa esatta a 52px, modali legali condivise.
     4. **Meccaniche di Gioco Collaudate** e schermate di partita a turni validate.
2. **Divieto Assoluto di Modifica Diretta (Freeze Lock)**:
   - È fatto divieto assoluto all'agente di modificare, rifattorizzare, applicare pezze o alterare il codice di un componente congelato, anche in presenza di segnalazioni di anomalie o dubbi dell'utente.
3. **Obbligo di Arresto in Read-Only e Notifica Preventiva di Congelamento**:
   - Se l'utente o il contesto portano l'attenzione su un componente o un comportamento appartenente a un blocco congelato, l'agente DEVE:
     1. Arrestare immediatamente l'esecuzione in modalità rigorosamente **READ-ONLY**.
     2. Notificare esplicitamente all'utente: *"Attenzione: la parte indicata fa parte del blocco CONGELATO e STABILIZZATO dell'Ecosistema. Per preservare l'integrità ed evitare regressioni a catena, non effettuerò alcuna modifica senza la tua esplicita autorizzazione."*
     3. Fornire una diagnosi obiettiva e attendere l'ordine scritto esplicito dell'utente prima di toccare qualsiasi file.
4. **Bando ai Falsi Positivi di Compilazione**:
   - È fatto divieto assoluto di considerare risolto un problema o conforme un componente basandosi esclusivamente sull'esito positivo del compilatore (`npm run build`, assenza di errori di sintassi o linter). L'unico criterio di conformità valido è il comportamento a runtime nel browser reale su tutte le piattaforme supportate.

---

### ART. 15 - PROTOCOLLO DI NON-REGRESSIONE DELLA NAVIGAZIONE E COLLAUDO A VERIFICA DI STATO (NAVIGATION INTEGRITY & STATE-ASSERTION TEST GUARD)
Valido tassativamente per tutte le applicazioni e siti presenti e futuri dell'Ecosistema Prof. Memmo:
1. **Separazione tra Navigazione e Protezione Contenuto (Zero Dumb Buttons)**:
   - È fatto divieto assoluto di rendere i pulsanti e tab di navigazione (`.tab-item`, `[data-view]`, `[data-section]`, `.nav-item`) inerti o bloccati con un `return;` silenzioso che lasci l'utente intrappolato sulla Home page senza feedback visivo.
   - La transizione alla vista richiesta deve sempre scattare (`view.classList.add('active')`); se l'area richiede autenticazione o un piano specifico, sarà il contenuto interno della vista a mostrare il prompt di login o la card autorizzativa Capibara/HubSubscriptionGuard, mai la barra di navigazione a congelarsi.
2. **Resilienza all'Asincronia di Autenticazione (Zero Sync Auth Assumptions)**:
   - È severamente vietato subordinare il cambio di vista a controlli sincroni istantanei su variabili in memoria (`currentUserEmail`, `window.auth.currentUser`) al momento del clic.
   - Il routing deve verificare in modo resiliente e immediato anche i token/ruoli persistiti in `localStorage` (`hub_user_class`, `pm_student_class`, `fanta_user_email`, `loratore_user_name`), garantendo continuità operativa ed evitando blocchi all'avvio.
3. **Collaudo Obbligatorio con Asserzione di Stato Reale (State-Assertion Driven Testing)**:
   - È fatto divieto categorico di considerare superato un collaudo verificando soltanto l'assenza di errori in console (`0 pageerror` o assenza di alert).
   - Ogni collaudo automatico (`tools/test_every_button_ecosystem.py` e `tools/collaudo_totale.py`) DEVE obbligatoriamente verificare tramite Playwright l'effetto collaterale visivo nel DOM:
     $$\text{targetView.classList.contains('active')} == \text{true} \quad \text{e} \quad \text{display} \neq \text{'none'}$$
     Se la vista target non diventa attiva e visibile a schermo, il test deve fallire immediatamente segnalando la regressione bloccante.
4. **Scansione Esaustiva Senza Troncamenti di Loop**:
   - I crawler e test runner di navigazione non possono mai applicare limiti arbitrari al numero di elementi testati (es. `[:15]`). Tutti gli elementi interattivi visibili (`button, [role='button'], a.btn, .btn, .tab-item, [data-view], [data-section], .nav-item, .admin-tab-btn`) devono essere cliccati e verificati integralmente su tutti i giochi dell'ecosistema.
5. **Diff-Check Obbligatorio sulle Viste Pubbliche**:
   - Qualsiasi intervento sugli array `isPublic` / `isPublicView` deve essere preceduto da un censimento completo dei tab definiti nell'`index.html` del gioco, assicurando che nessuna scheda stabilizzata (es. *Classifiche*, *Schede*, *Regolamento*, *Tabellone*) venga esclusa o resa inaccessibile per errore collaterale.
