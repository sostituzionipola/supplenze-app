/**
 * ENGINE.JS — Il "cuore" dell'applicazione (Cloud Version)
 * Gestisce i dati via Firebase Firestore e Authentication.
 * Sincronizzazione in tempo reale per multi-utenza.
 */
const Engine = (() => {
  // ── FIREBASE INITIALIZATION ────────────────────────────────────────────────
  if (!firebase.apps.length) {
    firebase.initializeApp(window.firebaseConfig);
  }
  const db = firebase.firestore();
  const auth = firebase.auth();

  // ── STATO INIZIALE & SCHEMI ──────────────────────────────────────────────────
  const INITIAL_DB = {
    school_years: [{ id: 2, name: '2025/26', is_active: 1 }],
    users: [],
    teachers: [],
    classes: [],
    schedule: [],
    absences: [],
    trips: [],
    substitutions: [],
    notifications: [],
    logs: [],
    long_term_assignments: [],
    school_events: []
  };

  const ROLE_LEVELS = { admin_master: 100, admin: 50, director: 30, secretary: 20, teacher: 10 };

  let _db = { ...INITIAL_DB };
  let _sandboxDb = null;
  let _initialized = false;
  let _onDataUpdate = null;

  // ── SANDBOX ISOLATION (Sessione Locale Protetta) ─────────────────────────
  function isSandboxActive() {
    return localStorage.getItem('sg_sandbox_active') === 'true';
  }

  function _loadSandbox() {
    if (_sandboxDb) return _sandboxDb;
    const raw = localStorage.getItem('sg_sandbox_db');
    if (raw) {
      try { _sandboxDb = JSON.parse(raw); return _sandboxDb; } catch(e) {}
    }
    return null;
  }

  function _getActiveDb() {
    if (isSandboxActive()) {
      const s = _loadSandbox();
      if (s) return s;
    }
    return _db;
  }

  function _saveSandbox(sDb) {
    _sandboxDb = sDb;
    localStorage.setItem('sg_sandbox_db', JSON.stringify(sDb));
    if (_onDataUpdate) _onDataUpdate(sDb);
  }

  function startSandbox(yearId) {
    const targetYearId = Number(yearId || (_db.school_years.find(y => y.is_active)?.id || 1));
    const targetD = new Date();
    if (targetD.getDay() === 0) targetD.setDate(targetD.getDate() + 1);
    else if (targetD.getDay() === 6) targetD.setDate(targetD.getDate() + 2);
    const testDate = targetD.toISOString().slice(0, 10);

    const NAMES = [
      'MARIO ROSSI', 'ANNA BIANCHI', 'LUIGI VERDI', 'ELENA NERI', 'GIUSEPPE RUSSO',
      'LAURA FRANCHI', 'MARCO COSTA', 'GIOVANNA GALLI', 'PAOLO RIZZI', 'SILVIA MORI',
      'ROBERTO FERRARI', 'FRANCESCA GRECO', 'STEFANO BRUNI', 'MONICA LOMBARDI', 'ALESSANDRO SERRA'
    ];
    const SUBJECTS = ['MATEMATICA', 'LETTERE', 'INGLESE', 'ARTE', 'ED. FISICA', 'STORIA', 'SCIENZE', 'TECNOLOGIA', 'MUSICA', 'RELIGIONE'];
    const SECTIONS = ['A', 'B', 'C', 'D', 'E'];
    const DAYS = ['LUNEDI', 'MARTEDI', 'MERCOLEDI', 'GIOVEDI', 'VENERDI'];

    const classes = [];
    const classIds = [];
    SECTIONS.forEach(sec => {
      [1, 2, 3].forEach(grade => {
        const name = `${grade}${sec}`;
        const id = 1000 + classIds.length;
        classes.push({ id, name, school_year_id: targetYearId });
        classIds.push(id);
      });
    });

    const teachers = NAMES.map((name, i) => ({
      id: 500 + i, name,
      subject: SUBJECTS[i % SUBJECTS.length],
      assigned_classes: 'Tutte',
      email: `${name.toLowerCase().replace(/\s+/g, '.')}@scuola.it`,
      school_year_id: targetYearId,
      hours_subs: 10, hours_trips: 0, is_available: 1
    }));

    const schedule = [];
    teachers.forEach((t, i) => {
      DAYS.forEach(day => {
        if (i < 2) {
          for (let h = 8; h <= 13; h++) {
            schedule.push({
              id: 2000 + schedule.length, teacher_id: t.id, day,
              hour: h, class_id: classIds[h % classIds.length], slot_type: 'normal', raw_value: 'OK', school_year_id: targetYearId
            });
          }
        } else {
          const h = 8 + ((i + DAYS.indexOf(day)) % 6);
          schedule.push({
            id: 2000 + schedule.length, teacher_id: t.id, day,
            hour: h, class_id: classIds[i % classIds.length], slot_type: 'normal', raw_value: 'OK', school_year_id: targetYearId
          });
          if (i % 3 === 0) {
            schedule.push({
              id: 2010 + schedule.length, teacher_id: t.id, day,
              hour: (h + 1) > 13 ? 8 : (h + 1), class_id: null, slot_type: 'disponibile', raw_value: 'DIS', school_year_id: targetYearId
            });
          }
        }
      });
    });

    const absences = [teachers[0], teachers[1]].map((t, idx) => ({
      id: 3000 + idx,
      teacher_id: t.id,
      teacher_name: t.name,
      date: testDate,
      type: 'assenza_giornaliera',
      status: 'approved',
      school_year_id: targetYearId
    }));

    const sandbox = {
      ...INITIAL_DB,
      school_years: [..._db.school_years],
      users: [..._db.users],
      classes,
      teachers,
      schedule,
      absences,
      substitutions: [],
      trips: [],
      notifications: [],
      logs: [],
      long_term_assignments: [],
      school_events: []
    };

    localStorage.setItem('sg_sandbox_active', 'true');
    _saveSandbox(sandbox);
    return { ok: true, testDate };
  }

  function stopSandbox() {
    localStorage.removeItem('sg_sandbox_active');
    localStorage.removeItem('sg_sandbox_db');
    _sandboxDb = null;
    if (_onDataUpdate) _onDataUpdate(_db);
    return { ok: true };
  }

  // ── REAL-TIME SYNC ─────────────────────────────────────────────────────────
  async function _initSync(callback) {
    if (_initialized) return;
    _onDataUpdate = callback;

    const collections = [
      'school_years', 'users', 'teachers', 'classes', 'schedule', 
      'absences', 'trips', 'substitutions', 'notifications', 'logs', 'long_term_assignments',
      'school_events'
    ];

    try {
      const snapshot = await db.collection('system').doc('metadata').get();
      if (!snapshot.exists) {
          console.log("Database cloud vuoto. Avvio migrazione iniziale...");
          await _performMigration();
      }

      // Sincronizzazione in tempo reale di tutte le collezioni
      const initPromises = collections.map(col => {
        return new Promise(resolve => {
          let isFirst = true;
          db.collection(col).onSnapshot(snap => {
            _db[col] = snap.docs.map(doc => {
              const data = doc.data();
              const id = isNaN(doc.id) ? doc.id : Number(doc.id);
              return { ...data, id };
            });
            if (isFirst) {
              isFirst = false;
              resolve();
            } else if (_initialized && _onDataUpdate) {
              _onDataUpdate(_db);
            }
          }, err => {
            console.error(`Errore Sync [${col}]:`, err);
            if (isFirst) {
              isFirst = false;
              resolve();
            }
          });
        });
      });

      await Promise.all(initPromises);
      _initialized = true;
      if (_onDataUpdate) _onDataUpdate(_db);
    } catch (err) {
      console.error("Errore Inizializzazione Firebase:", err);
    }
  }

  async function _performMigration() {
    const localRaw = localStorage.getItem('sg_supplenze_db');
    if (!localRaw) return;

    let localData;
    try { localData = JSON.parse(localRaw); } catch(e) { return; }

    console.log("Migrazione dati locali verso Cloud...");
    const batch = db.batch();
    
    for (const key of Object.keys(localData)) {
      if (Array.isArray(localData[key])) {
        localData[key].forEach(item => {
          const docId = String(item.id || Date.now() + Math.random());
          const { id, ...data } = item;
          const docRef = db.collection(key).doc(docId);
          batch.set(docRef, data);
        });
      }
    }
    
    batch.set(db.collection('system').doc('metadata'), { 
      migrated: true, 
      timestamp: firebase.firestore.FieldValue.serverTimestamp() 
    });
    
    await batch.commit();
    console.log("Migrazione completata con successo.");
  }

  // ── HELPER DATA ─────────────────────────────────────────────────────────────
  const DAYS = ['LUNEDI', 'MARTEDI', 'MERCOLEDI', 'GIOVEDI', 'VENERDI'];
  const SCHOOL_HOURS = {
    LUNEDI:    [8, 9, 10, 11, 12, 13, 14, 15],
    MARTEDI:   [8, 9, 10, 11],
    MERCOLEDI: [8, 9, 10, 11, 12, 13, 14, 15],
    GIOVEDI:   [8, 9, 10, 11, 12, 13, 14, 15],
    VENERDI:   [8, 9, 10, 11, 12, 13, 14, 15],
    SABATO:    [8, 9, 10, 11, 12]
  };

  function getDayOfWeek(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return ['DOMENICA', 'LUNEDI', 'MARTEDI', 'MERCOLEDI', 'GIOVEDI', 'VENERDI', 'SABATO'][d.getDay()] || null;
  }

  // ── API ENGINE ──────────────────────────────────────────────────────────────

  const api = {
    init: (callback) => _initSync(callback),
    onAuth: (callback) => auth.onAuthStateChanged(callback),
    
    getDb: () => _getActiveDb(),
    isSandboxActive,
    startSandbox,
    stopSandbox,

    logActivity: async (userId, action, details) => {
      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        sDb.logs = sDb.logs || [];
        sDb.logs.unshift({
          timestamp: new Date().toISOString(),
          username: userId || 'system',
          action,
          detail: details || ''
        });
        _saveSandbox(sDb);
        return;
      }
      await db.collection('logs').add({
        timestamp: new Date().toISOString(),
        username: userId || 'system',
        action,
        detail: details || ''
      });
    },
    getLogs: () => [...(_getActiveDb().logs || [])].map(l => ({
      ...l,
      username: l.username || l.user_id || 'system',
      detail: l.detail || l.details || ''
    })).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)),

    // ── ANNI SCOLASTICI ──
    getYears: () => _getActiveDb().school_years,
    addYear: async (y) => {
      const id = Date.now();
      const newYear = { ...y, id, is_active: 0 };
      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        sDb.school_years.push(newYear);
        _saveSandbox(sDb);
        return newYear;
      }
      await db.collection('school_years').doc(String(id)).set(newYear);
      return newYear;
    },
    activateYear: async (id) => {
      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        sDb.school_years.forEach(y => y.is_active = (y.id == id ? 1 : 0));
        _saveSandbox(sDb);
        return;
      }
      const batch = db.batch();
      _db.school_years.forEach(y => {
        batch.update(db.collection('school_years').doc(String(y.id)), { is_active: (y.id == id ? 1 : 0) });
      });
      await batch.commit();
    },
    deleteYear: async (id) => {
      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        sDb.school_years = sDb.school_years.filter(y => y.id != id);
        _saveSandbox(sDb);
        return;
      }
      await db.collection('school_years').doc(String(id)).delete();
    },

    // ── AUTH (Misto locale/email per compatibilità) ──
    getUser: () => auth.currentUser,
    onAuth: (cb) => auth.onAuthStateChanged(cb),
    login: async (username, password) => {
        const currentDb = _getActiveDb();
        let user = currentDb.users.find(u => u.username && u.username.toLowerCase() === username.toLowerCase() && u.password_hash === password);
        if (!user && username.toLowerCase() === 'admin' && (password === 'admin' || password === 'admin123')) {
          user = { id: 1, username: 'admin', role: 'admin_master', name: 'Amministratore' };
        }
        if (!user) throw new Error('Credenziali non valide.');
        const teacher = user.teacher_id ? currentDb.teachers.find(t => t.id === user.teacher_id) : null;
        return { token: 'cloud-' + user.id, user: { ...user, teacher } };
    },

    loginWithGoogle: async () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await auth.signInWithPopup(provider);
      const email = result.user.email;

      if (!email.toLowerCase().endsWith('@padregemelli.net')) {
        await auth.signOut();
        throw new Error(`Accesso negato. Usa l'account @padregemelli.net.`);
      }

      const currentDb = _getActiveDb();
      const teacher = currentDb.teachers.find(t => t.email && t.email.toLowerCase() === email.toLowerCase());
      const adminUser = currentDb.users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
      
      const user = adminUser || currentDb.users.find(u => u.teacher_id === (teacher ? teacher.id : null));
      if (!user) {
        if (teacher) {
           const newUser = {
             username: email.split('@')[0],
             role: 'teacher', teacher_id: teacher.id,
             email, created_at: new Date().toISOString()
           };
           const docRef = await db.collection('users').add(newUser);
           return { token: docRef.id, user: { ...newUser, id: docRef.id, teacher } };
        }
        await auth.signOut();
        throw new Error(`Utente ${email} non presente nel database scolastico.`);
      }
      return { token: user.id || user.username, user: { ...user, teacher } };
    },

    logout: () => auth.signOut(),

    getUsers: () => _getActiveDb().users,
    addUser: async (u) => {
       const user = { ...u, created_at: new Date().toISOString() };
       if (isSandboxActive()) {
         const sDb = _getActiveDb();
         const id = Date.now();
         const newU = { ...user, id };
         sDb.users.push(newU);
         _saveSandbox(sDb);
         return newU;
       }
       const docRef = await db.collection('users').add(user);
       return { ...user, id: docRef.id };
    },
    updateUser: async (id, u) => {
       if (isSandboxActive()) {
         const sDb = _getActiveDb();
         const idx = sDb.users.findIndex(x => x.id == id);
         if (idx !== -1) { sDb.users[idx] = { ...sDb.users[idx], ...u }; _saveSandbox(sDb); }
         return;
       }
       await db.collection('users').doc(String(id)).update(u);
    },
    deleteUser: async (id) => {
       if (isSandboxActive()) {
         const sDb = _getActiveDb();
         sDb.users = sDb.users.filter(x => x.id != id);
         _saveSandbox(sDb);
         return;
       }
       await db.collection('users').doc(String(id)).delete();
    },

    // ── DOCENTI ──
    getTeachers: (yearId) => {
      const currentDb = _getActiveDb();
      const yid = Number(yearId || currentDb.school_years.find(y => y.is_active)?.id);
      return currentDb.teachers.filter(t => Number(t.school_year_id) === yid).sort((a,b)=>a.name.localeCompare(b.name));
    },
    addTeacher: async (t) => {
      const id = Date.now();
      const newT = { ...t, hours_subs: parseInt(t.hours_subs)||0, hours_trips: parseInt(t.hours_trips)||0, is_available: 1, id };
      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        sDb.teachers.push(newT);
        _saveSandbox(sDb);
        return newT;
      }
      await db.collection('teachers').doc(String(id)).set(newT);
      return newT;
    },
    updateTeacher: async (id, t) => {
      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        const idx = sDb.teachers.findIndex(x => x.id == id);
        if (idx !== -1) { sDb.teachers[idx] = { ...sDb.teachers[idx], ...t }; _saveSandbox(sDb); }
        return;
      }
      await db.collection('teachers').doc(String(id)).update(t);
    },
    deleteTeacher: async (id) => {
      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        sDb.teachers = sDb.teachers.filter(x => x.id != id);
        _saveSandbox(sDb);
        return;
      }
      await db.collection('teachers').doc(String(id)).delete();
    },
    adjustHours: async (id, delta, type='subs') => {
      const currentDb = _getActiveDb();
      const t = currentDb.teachers.find(x => x.id == id);
      if (t) {
        const field = type === 'trips' ? 'hours_trips' : 'hours_subs';
        const newVal = Math.max(0, (t[field] || 0) + delta);
        if (isSandboxActive()) {
          t[field] = newVal;
          _saveSandbox(currentDb);
          return;
        }
        await db.collection('teachers').doc(String(id)).update({ [field]: newVal });
      }
    },

    // ── CLASSI ──
    getClasses: (yearId) => {
      const currentDb = _getActiveDb();
      const yid = Number(yearId || currentDb.school_years.find(y => y.is_active)?.id);
      return currentDb.classes.filter(c => Number(c.school_year_id) === yid).sort((a,b)=>a.name.localeCompare(b.name));
    },
    addClass: async (c) => {
      const id = Date.now();
      const cls = { ...c, id, name: c.name.toUpperCase().trim() };
      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        sDb.classes.push(cls);
        _saveSandbox(sDb);
        return;
      }
      await db.collection('classes').doc(String(id)).set(cls);
    },
    addBulkClasses: async (names, yearId) => {
      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        names.forEach(n => {
          const id = Date.now() + Math.random();
          sDb.classes.push({ name: n.toUpperCase().trim(), school_year_id: yearId, id });
        });
        _saveSandbox(sDb);
        return;
      }
      const batch = db.batch();
      names.forEach(n => {
        const id = String(Date.now() + Math.random());
        batch.set(db.collection('classes').doc(id), { name: n.toUpperCase().trim(), school_year_id: yearId, id });
      });
      await batch.commit();
    },
    deleteClass: async (id) => {
      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        sDb.classes = sDb.classes.filter(x => x.id != id);
        _saveSandbox(sDb);
        return;
      }
      await db.collection('classes').doc(String(id)).delete();
    },

    // ── ORARIO ──
    determineScheduleType: (date, yearId) => {
      const yid = String(yearId);
      const currentDb = _getActiveDb();
      let periods = currentDb.schedule_periods?.[yid];
      if (!periods) {
        try {
          const loc = localStorage.getItem(`sg_sched_periods_${yid}`);
          if (loc) periods = JSON.parse(loc);
        } catch(e) {}
      }
      if (periods?.provvisorio?.start_date && periods?.provvisorio?.end_date && date) {
        if (date >= periods.provvisorio.start_date && date <= periods.provvisorio.end_date) {
          return 'provvisorio';
        }
      }
      return 'definitivo';
    },

    getSchedule: (yearId, teacherId, day, scheduleType, date) => {
      const currentDb = _getActiveDb();
      const yid = Number(yearId);
      const tid = teacherId ? Number(teacherId) : null;
      let targetType = scheduleType;
      if (!targetType && date) {
        targetType = Engine.determineScheduleType(date, yearId);
      }
      return currentDb.schedule.filter(s => 
        Number(s.school_year_id) === yid && 
        (!tid || Number(s.teacher_id) === tid) &&
        (!day || s.day === day.toUpperCase()) &&
        (!targetType || s.schedule_type === targetType || (!s.schedule_type && targetType === 'definitivo'))
      ).sort((a,b) => a.hour - b.hour);
    },
    updateSlot: async (slot) => {
      const { teacher_id, day, hour, raw_value, school_year_id, schedule_type = 'definitivo' } = slot;
      const currentDb = _getActiveDb();
      const classes = currentDb.classes.filter(c => c.school_year_id == school_year_id);
      let slot_type = 'empty', class_id = null;
      if (raw_value) {
        const v = raw_value.trim().toUpperCase();
        if (v === 'DIS') slot_type = 'disponibile';
        else if (v === 'ECC') slot_type = 'eccedente';
        else if (v === 'R') slot_type = 'ricevimento';
        else if (v === '*' || v === '') slot_type = 'asterisco';
        else {
          const cls = classes.find(c => c.name.toUpperCase() === v.replace(/[*]/g,''));
          if (cls) { slot_type = 'normal'; class_id = cls.id; }
          else slot_type = 'empty';
        }
      }

      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        const existing = sDb.schedule.find(s => s.teacher_id == teacher_id && s.day == day && s.hour == hour && s.school_year_id == school_year_id && (s.schedule_type || 'definitivo') === schedule_type);
        if (existing) {
          Object.assign(existing, { class_id, slot_type, raw_value, schedule_type });
        } else {
          sDb.schedule.push({ id: Date.now() + Math.random(), teacher_id, day, hour, class_id, slot_type, raw_value, school_year_id, schedule_type });
        }
        _saveSandbox(sDb);
        return;
      }

      const docId = `${teacher_id}_${day}_${hour}_${school_year_id}_${schedule_type}`;
      await db.collection('schedule').doc(docId).set({
        teacher_id, day, hour, class_id, slot_type, raw_value, school_year_id, schedule_type
      });
    },

    getSchedulePeriods: async (yearId) => {
      const yid = String(yearId);
      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        return sDb.schedule_periods?.[yid] || {
          provvisorio: { start_date: '', end_date: '' },
          definitivo: { start_date: '', end_date: '' }
        };
      }
      try {
        const snap = await db.collection('system').doc(`schedule_periods_${yid}`).get();
        if (snap.exists) {
          const data = snap.data();
          if (!_db.schedule_periods) _db.schedule_periods = {};
          _db.schedule_periods[yid] = data;
          return data;
        }
      } catch(e) {
        console.warn('Errore lettura periodi cloud:', e);
      }
      const loc = localStorage.getItem(`sg_sched_periods_${yid}`);
      if (loc) {
        try {
          const parsed = JSON.parse(loc);
          if (!_db.schedule_periods) _db.schedule_periods = {};
          _db.schedule_periods[yid] = parsed;
          return parsed;
        } catch(e) {}
      }
      return {
        provvisorio: { start_date: '', end_date: '' },
        definitivo: { start_date: '', end_date: '' }
      };
    },

    saveSchedulePeriod: async ({ school_year_id, type, start_date, end_date }) => {
      const yid = String(school_year_id);
      let curr = await Engine.getSchedulePeriods(yid);
      if (!curr) curr = { provvisorio: { start_date: '', end_date: '' }, definitivo: { start_date: '', end_date: '' } };
      curr[type] = { start_date: start_date || '', end_date: end_date || '' };
      
      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        if (!sDb.schedule_periods) sDb.schedule_periods = {};
        sDb.schedule_periods[yid] = curr;
        _saveSandbox(sDb);
        return curr;
      }
      if (!_db.schedule_periods) _db.schedule_periods = {};
      _db.schedule_periods[yid] = curr;
      localStorage.setItem(`sg_sched_periods_${yid}`, JSON.stringify(curr));
      try {
        await db.collection('system').doc(`schedule_periods_${yid}`).set(curr);
      } catch(e) {
        console.error('Errore salvataggio periodi cloud:', e);
      }
      return curr;
    },

    clearSchedule: async (yearId, type = 'all') => {
      const yid = Number(yearId);
      const currentDb = _getActiveDb();
      
      const matchesType = (slot) => {
        if (!type || type === 'all') return true;
        const raw = (slot.raw_value || '').toUpperCase().trim();
        const st = slot.slot_type;
        const schedType = slot.schedule_type || 'definitivo';

        if (type === 'provvisorio') {
          return schedType === 'provvisorio';
        }
        if (type === 'definitivo') {
          return schedType === 'definitivo';
        }
        if (type === 'ricevimento' || type === 'R') {
          return st === 'ricevimento' || raw === 'R';
        }
        if (type === 'disponibile' || type === 'DIS') {
          return st === 'disponibile' || raw === 'DIS';
        }
        if (type === 'eccedente' || type === 'ECC') {
          return st === 'eccedente' || raw === 'ECC';
        }
        return false;
      };

      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        sDb.schedule = sDb.schedule.filter(s => {
          if (Number(s.school_year_id) !== yid && String(s.school_year_id) !== String(yearId)) return true;
          return !matchesType(s);
        });
        if (type === 'provvisorio' && sDb.schedule_periods?.[String(yearId)]) {
          sDb.schedule_periods[String(yearId)].provvisorio = { start_date: '', end_date: '' };
        } else if (type === 'definitivo' && sDb.schedule_periods?.[String(yearId)]) {
          sDb.schedule_periods[String(yearId)].definitivo = { start_date: '', end_date: '' };
        }
        _saveSandbox(sDb);
        return { ok: true };
      }

      const snap = await db.collection('schedule').get();
      const batch = db.batch();
      let count = 0;
      
      snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.school_year_id == yearId || data.school_year_id == yid) {
          if (matchesType(data)) {
            batch.delete(doc.ref);
            count++;
          }
        }
      });

      if (count > 0) {
        await batch.commit();
      }

      if (type === 'provvisorio' || type === 'definitivo') {
        await Engine.saveSchedulePeriod({ school_year_id: yearId, type, start_date: '', end_date: '' });
      }

      currentDb.schedule = currentDb.schedule.filter(s => {
        if (Number(s.school_year_id) !== yid && String(s.school_year_id) !== String(yearId)) return true;
        return !matchesType(s);
      });

      return { ok: true, deleted: count };
    },

    // ── ASSENZE ──
    getAbsences: (date, yearId) => {
      const currentDb = _getActiveDb();
      const yid = Number(yearId);
      return currentDb.absences.filter(a => 
        (!date || a.date === date) && 
        (!yid || Number(a.school_year_id) === yid)
      ).map(a => ({
        ...a, 
        teacher_name: currentDb.teachers.find(t=>t.id == a.teacher_id)?.name || '?',
        status: a.status || 'approved'
      })).sort((a,b) => a.teacher_name.localeCompare(b.teacher_name));
    },
    addAbsence: async (a, creatorId) => {
      const teachersToProcess = Array.isArray(a.teacher_id) ? a.teacher_id : [a.teacher_id];
      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        teachersToProcess.forEach(tid => {
          const absId = Date.now() + Math.random();
          const status = a.status || 'approved';
          sDb.absences.push({ ...a, id: absId, teacher_id: tid, status, created_at: new Date().toISOString() });
        });
        _saveSandbox(sDb);
        return;
      }

      const batch = db.batch();
      for (const tid of teachersToProcess) {
        const absId = String(Date.now() + Math.random());
        const status = a.status || 'approved';
        const docRef = db.collection('absences').doc(absId);
        batch.set(docRef, { ...a, teacher_id: tid, status, created_at: new Date().toISOString() });

        const notifId = String(Date.now() + Math.random());
        batch.set(db.collection('notifications').doc(notifId), {
          teacher_id: tid,
          date: a.date,
          type: a.type || 'assenza_giornaliera',
          status: status,
          processed_by: creatorId || 'system',
          created_at: new Date().toISOString()
        });
      }
      await batch.commit();
    },
    updateAbsenceStatus: async (id, status) => {
      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        const a = sDb.absences.find(x => x.id == id);
        if (a) { a.status = status; _saveSandbox(sDb); }
        return;
      }
      await db.collection('absences').doc(String(id)).update({ status });
    },
    updateAbsence: async (id, updates) => {
      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        const a = sDb.absences.find(x => x.id == id);
        if (a) { Object.assign(a, updates, { is_regularized: true, updated_at: new Date().toISOString() }); _saveSandbox(sDb); }
        return;
      }
      await db.collection('absences').doc(String(id)).update({
        ...updates,
        is_regularized: true,
        updated_at: new Date().toISOString()
      });
    },
    updateAbsenceBatch: async (ids, updates) => {
      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        ids.forEach(id => {
          const a = sDb.absences.find(x => x.id == id);
          if (a) Object.assign(a, updates, { is_regularized: true, updated_at: new Date().toISOString() });
        });
        _saveSandbox(sDb);
        return;
      }
      const batch = db.batch();
      ids.forEach(id => {
        batch.update(db.collection('absences').doc(String(id)), {
          ...updates,
          is_regularized: true,
          updated_at: new Date().toISOString()
        });
      });
      await batch.commit();
    },
    deleteAbsence: async (id) => {
      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        sDb.absences = sDb.absences.filter(x => x.id != id);
        _saveSandbox(sDb);
        return;
      }
      await db.collection('absences').doc(String(id)).delete();
    },

    // ── SOSTITUZIONI ──
    assignSubstitution: async (sub) => {
      const id = String(Date.now() + Math.random());
      const newSub = { ...sub, id, created_at: new Date().toISOString() };
      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        sDb.substitutions = (sDb.substitutions || []).filter(s => !(s.date === sub.date && s.hour == sub.hour && s.absent_teacher_id == sub.absent_teacher_id && s.sub_role === sub.sub_role));
        sDb.substitutions.push(newSub);
        _saveSandbox(sDb);
        return newSub;
      }
      await db.collection('substitutions').doc(id).set(newSub);
      return newSub;
    },
    rejectSubstitution: async (id, rejectReason) => {
      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        const sub = (sDb.substitutions || []).find(s => s.id == id);
        if (sub) {
          sub.status = 'rejected';
          sub.accepted = false;
          sub.reject_reason = rejectReason || 'Rifiutata dal docente';
          sub.rejected_at = new Date().toISOString();
          _saveSandbox(sDb);
        }
        return;
      }
      await db.collection('substitutions').doc(String(id)).update({
        status: 'rejected',
        accepted: false,
        reject_reason: rejectReason || 'Rifiutata dal docente',
        rejected_at: new Date().toISOString()
      });
    },
    acceptSubstitution: async (id) => {
      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        const sub = (sDb.substitutions || []).find(s => s.id == id);
        if (sub) {
          sub.status = 'approved';
          sub.accepted = true;
          sub.accepted_at = new Date().toISOString();
          _saveSandbox(sDb);
        }
        return;
      }
      await db.collection('substitutions').doc(String(id)).update({
        status: 'approved',
        accepted: true,
        accepted_at: new Date().toISOString()
      });
    },
    deleteSubstitution: async (id) => {
      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        sDb.substitutions = (sDb.substitutions || []).filter(s => s.id != id);
        _saveSandbox(sDb);
        return;
      }
      await db.collection('substitutions').doc(String(id)).delete();
    },

    // Business Logic Helper
    getDailySubstitutions: (date, yearId) => {
      const dayOfWeek = getDayOfWeek(date);
      if (!dayOfWeek || !SCHOOL_HOURS[dayOfWeek]) return { slots: [], trips: [], absences: [] };

      const currentDb = _getActiveDb();
      const hours = SCHOOL_HOURS[dayOfWeek];
      const absToday = Engine.getAbsences(date, yearId).filter(a => a.status === 'approved');
      const allSubsRows = currentDb.substitutions.filter(s => s.date === date && s.school_year_id == yearId);
      const activeSchedType = Engine.determineScheduleType(date, yearId);

      const slots = [];
      absToday.forEach(abs => {
        hours.forEach(h => {
          const slot = currentDb.schedule.find(s => 
            s.teacher_id == abs.teacher_id && 
            s.day == dayOfWeek && 
            s.hour == h && 
            s.slot_type === 'normal' &&
            ((s.schedule_type || 'definitivo') === activeSchedType)
          );
          if (slot) {
            const sub = allSubsRows.find(s => s.hour == h && s.absent_teacher_id == abs.teacher_id);
            slots.push({
              hour: h,
              class_id: slot.class_id,
              className: currentDb.classes.find(c => c.id == slot.class_id)?.name || '?',
              absent_teacher_id: abs.teacher_id,
              absentTeacherName: abs.teacher_name,
              schedule_type: activeSchedType,
              substitute_teacher_id: sub ? sub.substitute_teacher_id : null,
              substituteTeacherName: sub ? (currentDb.teachers.find(t=>t.id == sub.substitute_teacher_id)?.name || '?') : '',
              sub_role: sub ? sub.sub_role : ''
            });
          }
        });
      });

      return { slots, absences: absToday, schedule_type: activeSchedType };
    },

    // ── ASSEGNAZIONI LUNGO TERMINE ──
    getLongTermAssignments: () => _getActiveDb().long_term_assignments,

    // ── EVENTI SCOLASTICI ──
    getEvents: (yearId) => {
      const currentDb = _getActiveDb();
      const yid = Number(yearId);
      return currentDb.school_events.filter(e => !yid || Number(e.school_year_id) === yid)
        .sort((a,b) => new Date(a.date) - new Date(b.date));
    },
    addEvent: async (event) => {
      const id = String(Date.now() + Math.random());
      const newEvent = { ...event, id, created_at: new Date().toISOString() };
      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        sDb.school_events.push(newEvent);
        _saveSandbox(sDb);
        return newEvent;
      }
      await db.collection('school_events').doc(id).set(newEvent);
      return newEvent;
    },
    deleteEvent: async (id) => {
      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        sDb.school_events = sDb.school_events.filter(x => x.id != id);
        _saveSandbox(sDb);
        return;
      }
      await db.collection('school_events').doc(String(id)).delete();
    },
    updateEvent: async (id, event) => {
      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        const idx = sDb.school_events.findIndex(x => x.id == id);
        if (idx !== -1) { sDb.school_events[idx] = { ...sDb.school_events[idx], ...event }; _saveSandbox(sDb); }
        return;
      }
      await db.collection('school_events').doc(String(id)).update(event);
    },

    // ── USCITE DIDATTICHE ──
    getTrips: (date, yearId) => {
      const currentDb = _getActiveDb();
      const yid = Number(yearId);
      return currentDb.trips.filter(t => (!date || t.date === date) && (!yid || Number(t.school_year_id) === yid));
    },
    addTrip: async (trip) => {
      const id = String(Date.now() + Math.random());
      const newTrip = { ...trip, id, created_at: new Date().toISOString() };
      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        sDb.trips.push(newTrip);
        _saveSandbox(sDb);
        return newTrip;
      }
      await db.collection('trips').doc(id).set(newTrip);
      return newTrip;
    },
    deleteTrip: async (id) => {
      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        sDb.trips = sDb.trips.filter(x => x.id != id);
        _saveSandbox(sDb);
        return;
      }
      await db.collection('trips').doc(String(id)).delete();
    },

    // ── NOTIFICHE ──
    getNotifications: (teacherId) => {
      const currentDb = _getActiveDb();
      const tid = teacherId ? Number(teacherId) : null;
      return (currentDb.notifications || []).filter(n => !tid || Number(n.teacher_id) === tid)
        .sort((a,b) => (b.created_at || '').localeCompare(a.created_at || ''));
    },
    markNotificationRead: async (id) => {
      if (isSandboxActive()) {
        const sDb = _getActiveDb();
        const n = (sDb.notifications || []).find(x => x.id == id);
        if (n) { n.read = true; _saveSandbox(sDb); }
        return;
      }
      await db.collection('notifications').doc(String(id)).update({ read: true });
    },

    // ── CAMBIO PASSWORD ──
    changePassword: async (currentPw, newPw) => {
      const currentUser = APP.getState().user;
      if (!currentUser) throw new Error('Non autenticato');
      const currentDb = _getActiveDb();
      const userDoc = currentDb.users.find(u => u.id === currentUser.id || u.username === currentUser.username);
      if (!userDoc) throw new Error('Utente non trovato');
      if (userDoc.password_hash && userDoc.password_hash !== currentPw && userDoc.password !== currentPw) {
        throw new Error('Password attuale non corretta');
      }
      if (isSandboxActive()) {
        userDoc.password_hash = newPw;
        userDoc.password = newPw;
        _saveSandbox(currentDb);
        return { ok: true };
      }
      await db.collection('users').doc(String(userDoc.id)).update({
        password_hash: newPw,
        password: newPw
      });
      return { ok: true };
    }
  };

  return api;
})();
