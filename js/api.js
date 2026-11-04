/**
 * API.JS — Mapper tra le chiamate REST e l'Engine Cloud.
 * Funge da ponte per le viste esistenti integrando Firebase.
 */
const API = (() => {
  let _token = localStorage.getItem('sg_token');

  function setToken(t) {
    _token = t;
    if (t) localStorage.setItem('sg_token', t);
    else localStorage.removeItem('sg_token');
  }

  function getToken() { return _token; }

  async function request(method, path, data) {
    console.log(`[API CLOUD] ${method} ${path}`, data);
    
    try {
      // --- AUTH ---
      if (path === '/auth/login') return await Engine.login(data.username, data.password);
      
      if (path === '/auth/login-google') return await Engine.loginWithGoogle();
      
      if (path === '/auth/me') {
        const token = getToken();
        // 1. Check for manual "cloud-" token
        if (token && token.startsWith('cloud-')) {
          const userId = token.replace('cloud-', '');
          const dbUser = Engine.getDb().users.find(u => String(u.id) === String(userId));
          if (dbUser) {
            const teacher = dbUser.teacher_id ? Engine.getDb().teachers.find(t => t.id === dbUser.teacher_id) : null;
            return { ...dbUser, teacher };
          }
        }

        // 2. Check for Firebase User
        const user = await new Promise(resolve => {
           const unsubscribe = Engine.onAuth(u => {
             unsubscribe();
             resolve(u);
           });
        });
        if (user) {
          const userEmail = (user.email || '').toLowerCase().trim();
          let dbUser = Engine.getDb().users.find(u => (u.email || '').toLowerCase().trim() === userEmail);

          if (!dbUser && typeof firebase !== 'undefined' && firebase.firestore) {
            try {
              const fs = firebase.firestore();
              const snap = await fs.collection('users').get();
              const foundDoc = snap.docs.find(d => ((d.data().email || '').toLowerCase().trim() === userEmail));
              if (foundDoc) {
                dbUser = { ...foundDoc.data(), id: foundDoc.id };
                const currUsers = Engine.getDb().users;
                if (!currUsers.some(u => u.id === dbUser.id)) currUsers.push(dbUser);
              }
            } catch(e) {
              console.warn("[API] Fallback query users error:", e);
            }
          }

          const teacher = dbUser && dbUser.teacher_id ? Engine.getDb().teachers.find(t => t.id === dbUser.teacher_id) : null;
          return dbUser ? { ...dbUser, teacher } : { username: user.displayName, email: user.email, role: 'teacher' };
        }
        throw new Error('Not authenticated');
      }

      // --- SETTINGS (Reads are sync from local cache _db) ---
      if (path === '/settings/years' && method === 'GET') return Engine.getYears();
      if (path === '/settings/years' && method === 'POST') return await Engine.addYear(data);
      if (path.startsWith('/settings/years/') && method === 'PUT') return await Engine.activateYear(path.split('/')[3]);
      if (path.startsWith('/settings/years/') && method === 'DELETE') return await Engine.deleteYear(path.split('/')[3]);
      
      if (path.startsWith('/settings/stats') && method === 'GET') {
        const sp = new URLSearchParams(path.split('?')[1] || '');
        const yId = sp.get('year_id');
        return {
          totalTeachers: Engine.getTeachers(yId).length,
          totalClasses: Engine.getClasses(yId).length,
          totalEvents: Engine.getEvents(yId).length,
          assemblea: 0
        };
      }

      if (path.startsWith('/settings/classes') && method === 'GET') return Engine.getClasses(new URLSearchParams(path.split('?')[1]).get('year_id'));
      if (path === '/settings/classes' && method === 'POST') return await Engine.addClass(data);
      if (path === '/settings/classes/bulk' && method === 'POST') return await Engine.addBulkClasses(data.names, data.school_year_id);
      if (path.startsWith('/settings/classes/') && method === 'DELETE') return await Engine.deleteClass(path.split('/')[3]);
      if (path === '/settings/clear-history' && method === 'POST') {
        return { ok: true };
      }
      
      // --- LOGS & USERS ---
      if (path === '/settings/log' && method === 'GET') return Engine.getLogs();
      if (path === '/settings/users' && method === 'GET') return Engine.getUsers();
      if (path === '/settings/users' && method === 'POST') return await Engine.addUser(data);
      if (path.startsWith('/settings/users/') && method === 'PUT') return await Engine.updateUser(path.split('/')[3], data);
      if (path.startsWith('/settings/users/') && method === 'DELETE') return await Engine.deleteUser(path.split('/')[3]);
      if (path === '/auth/change-password' && method === 'POST') return await Engine.changePassword(data.currentPassword, data.newPassword);

      // --- NOTIFICATIONS ---
      if (path.startsWith('/notifications') && method === 'GET') {
        const sp = new URLSearchParams(path.split('?')[1] || '');
        return Engine.getNotifications(sp.get('teacher_id'));
      }
      if (path.startsWith('/notifications/') && path.endsWith('/read') && method === 'POST') {
        return await Engine.markNotificationRead(path.split('/')[2]);
      }

      // --- TRIPS (Uscite didattiche) ---
      if (path.startsWith('/trips') && method === 'GET') {
        const sp = new URLSearchParams(path.split('?')[1] || '');
        return Engine.getTrips(sp.get('date'), sp.get('year_id'));
      }
      if (path === '/trips' && method === 'POST') return await Engine.addTrip(data);
      if (path.startsWith('/trips/') && method === 'DELETE') return await Engine.deleteTrip(path.split('/')[2]);
      
      // --- TEACHERS ---
      if (path.startsWith('/teachers') && method === 'GET') {
          const sp = new URLSearchParams(path.split('?')[1]);
          return Engine.getTeachers(sp.get('year_id'));
      }
      if (path === '/teachers' && method === 'POST') return await Engine.addTeacher(data);
      if (path.startsWith('/teachers/') && method === 'PUT') return await Engine.updateTeacher(path.split('/')[2], data);
      if (path.startsWith('/teachers/') && method === 'DELETE') return await Engine.deleteTeacher(path.split('/')[2]);
      if (path.includes('/hours') && method === 'PATCH') return await Engine.adjustHours(path.split('/')[2], data.delta, data.type);

      // --- SCHEDULE ---
      if (path.startsWith('/schedule/clear') && method === 'DELETE') {
        const sp = new URLSearchParams(path.split('?')[1]);
        return await Engine.clearSchedule(sp.get('year_id'), sp.get('type') || 'all');
      }
      if (path.startsWith('/schedule/all') && method === 'DELETE') {
        const sp = new URLSearchParams(path.split('?')[1]);
        return await Engine.clearSchedule(sp.get('year_id'), 'all');
      }
      if (path.startsWith('/schedule') && method === 'GET') {
        const sp = new URLSearchParams(path.split('?')[1]);
        return Engine.getSchedule(sp.get('year_id'), sp.get('teacher_id'));
      }
      if (path === '/schedule/slot' && method === 'PUT') return await Engine.updateSlot(data);

      // --- ABSENCES ---
      if (path.startsWith('/absences') && method === 'GET') {
        const sp = new URLSearchParams(path.split('?')[1]);
        return Engine.getAbsences(sp.get('date'), sp.get('year_id'));
      }
      if (path === '/absences/batch-update' && method === 'POST') return await Engine.updateAbsenceBatch(data.ids, data.updates);
      if (path.startsWith('/absences/') && method === 'PUT') return await Engine.updateAbsence(path.split('/')[2], data);
      if (path.startsWith('/absences/') && path.endsWith('/status') && method === 'PATCH') return await Engine.updateAbsenceStatus(path.split('/')[2], data.status);
      if (path.startsWith('/absences/') && method === 'DELETE') return await Engine.deleteAbsence(path.split('/')[2]);

      // --- SUBSTITUTIONS ---
      if (path.startsWith('/substitutions/daily') && method === 'GET') {
        const sp = new URLSearchParams(path.split('?')[1]);
        return Engine.getDailySubstitutions(sp.get('date'), sp.get('year_id'));
      }
      if (path === '/substitutions/assign' && method === 'POST') return await Engine.assignSubstitution(data);
      if (path.startsWith('/substitutions/') && path.endsWith('/reject') && method === 'POST') return await Engine.rejectSubstitution(path.split('/')[2], data.reason);
      if (path.startsWith('/substitutions/') && path.endsWith('/accept') && method === 'POST') return await Engine.acceptSubstitution(path.split('/')[2]);
      if (path.startsWith('/substitutions/') && method === 'DELETE') return await Engine.deleteSubstitution(path.split('/')[2]);
      if (path.startsWith('/substitutions/history') && method === 'GET') return Engine.getDb().substitutions || [];
      
      // --- LONG TERM ASSIGNMENTS ---
      if (path === '/long-term-assignments' && method === 'GET') return Engine.getLongTermAssignments();
      
      // --- EVENTS ---
      if (path.startsWith('/events') && method === 'GET') {
          const sp = new URLSearchParams(path.split('?')[1]);
          return Engine.getEvents(sp.get('year_id'));
      }
      if (path === '/events' && method === 'POST') return await Engine.addEvent(data);
      if (path.startsWith('/events/') && method === 'PUT') return await Engine.updateEvent(path.split('/')[2], data);
      if (path.startsWith('/events/') && method === 'DELETE') return await Engine.deleteEvent(path.split('/')[2]);

      throw new Error(`Cloud API: Path not handled ${path}`);
    } catch (err) {
      console.error(`[API ERROR] ${path}`, err);
      throw err;
    }
  }

  return {
    setToken, getToken,
    get   : (p)    => request('GET',    p),
    post  : (p, d) => request('POST',   p, d),
    put   : (p, d) => request('PUT',    p, d),
    patch : (p, d) => request('PATCH',  p, d),
    del   : (p)    => request('DELETE', p),
  };
})();
