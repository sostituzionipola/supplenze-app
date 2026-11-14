/**
 * SW.JS — Service Worker per Gestionale Sostituzioni I.C. Padre Gemelli
 * Configurato in modalità Passthrough / Network-First:
 * NON mette in cache rigida i file applicativi per evitare blocchi negli aggiornamenti.
 */

const SW_VERSION = '1.0.0';

self.addEventListener('install', (event) => {
  // Attiva subito il nuovo service worker
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Prendi il controllo immediato di tutti i client aperti
  event.waitUntil(self.clients.claim());
});

// Fetch passthrough: lascia sempre passare le richieste di rete al server senza cache trap
self.addEventListener('fetch', (event) => {
  return;
});

// Predisposizione per la ricezione di eventi Push (Web Push PWA)
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch(e) {
    data = { title: 'Nuova Notifica', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Gestionale Sostituzioni';
  const options = {
    body: data.body || 'Hai una nuova comunicazione.',
    icon: './apple-touch-icon.png?v=10',
    badge: './favicon.png?v=10',
    data: data.url || './index.html'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Click sulla notifica: apre o porta in primo piano l'applicazione
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data || './index.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes('index.html') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

