// ════════════════════════════════════════════════════════════════
//  Ladle & Spoon — Firebase Cloud Messaging Service Worker
//  Version: 5
// ════════════════════════════════════════════════════════════════
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyDYt3OeHN0yorpDAWu4MPvH55GnkO_yD44",
  authDomain:        "ladle-and-spoon-push-notify.firebaseapp.com",
  projectId:         "ladle-and-spoon-push-notify",
  storageBucket:     "ladle-and-spoon-push-notify.firebasestorage.app",
  messagingSenderId: "432229384791",
  appId:             "1:432229384791:web:4db16a355c485a91a95912"
});

const messaging = firebase.messaging();
const APP_BASE  = 'https://acebuilds51.github.io/ladle_and_spoon/';

// Handle background push (app closed or backgrounded)
messaging.onBackgroundMessage(function(payload) {
  const data  = payload.data || {};
  const title = data.title || 'Ladle & Spoon';
  const body  = data.body  || "Check this week's menu!";
  const url   = data.url   || APP_BASE;
  const icon  = data.icon  || 'https://res.cloudinary.com/drcjmvjc9/image/upload/v1762996224/Ladle_and_Spoon_Logo_Clean_pylcav.png';

  return self.registration.showNotification(title, {
    body, icon, badge: icon,
    tag:  'ladle-spoon-notification',
    renotify: false,
    requireInteraction: false,
    data: { url }
  });
});

// Notification tap — always open a NEW window at the exact URL
// This ensures ?rate=...&email=... params are present in window.location
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || APP_BASE;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // For rating URLs — always open fresh so the app re-reads window.location.search
      if(targetUrl.indexOf('?rate=') >= 0) {
        return clients.openWindow(targetUrl);
      }
      // For non-rating notifications — focus existing window if open
      for (var i = 0; i < clientList.length; i++) {
        if(clientList[i].url.indexOf('acebuilds51.github.io/ladle_and_spoon') >= 0 && 'focus' in clientList[i]){
          return clientList[i].focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
