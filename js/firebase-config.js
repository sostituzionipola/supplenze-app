/**
 * FIREBASE-CONFIG.JS
 * Configurazione ufficiale per Gestionale Sostituzioni I.C. Padre Gemelli
 */
const firebaseConfig = {
  apiKey: "AIzaSyDvey4zIAZIC8LO78mrBq42swIaq04oZXs",
  authDomain: "gestionale-sostituzioni.firebaseapp.com",
  projectId: "gestionale-sostituzioni",
  storageBucket: "gestionale-sostituzioni.firebasestorage.app",
  messagingSenderId: "296227070316",
  appId: "1:296227070316:web:4595ffe081c8cf81411349"
};

// Esportazione globale (compatibilità con script caricati via tag)
window.firebaseConfig = firebaseConfig;

// Webhook Google Apps Script per Notifiche Email e Foglio Storico
window.GAS_EMAIL_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxNXNrI6DR4nE5vVrSmI1vmpw8OOjPQUMP-rLvQKFva4a0lnoyqUi5-oXZV8dNWw3AO7Q/exec";

