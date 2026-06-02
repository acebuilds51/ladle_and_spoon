// ════════════════════════════════════════════════════════════════
//  Ladle & Spoon — Firebase Cloud Messaging Service Worker
//  File name: firebase-messaging-sw.js
//  Must be in the ROOT of your GitHub repo alongside index.html
//  Version: 4
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

const APP_URL = 'https://acebuilds51.github.io/ladle_and_spoon/';

// Handle background notifications (app closed or not in focus)
messaging.onBackgroundMessage(function(payload) {
  console.log('[SW] Background message received:', JSON.stringify(payload));

  const title = (payload.data && payload.data.title) ||
                (payload.notification && payload.notification.title) ||
                'Ladle & Spoon';
  const body  = (payload.data && payload.data.body) ||
                (payload.notification && payload.notification.body) ||
                "Check this week's menu!";
  const url   = (payload.data && payload.data.url) || APP_URL;
  const icon  = (payload.data && payload.data.icon) ||
                'https://res.cloudinary.com/drcjmvjc9/image/upload/v1762996224/Ladle_and_Spoon_Logo_Clean_pylcav.png';

  const options = {
    body:               body,
    icon:               icon,
    badge:              icon,
    tag:                'ladle-spoon-notification',
    renotify:           false,
    requireInteraction: false,
    data:               { url: url }
  };

  console.log('[SW] Showing notification:', title, body, url);
  return self.registration.showNotification(title, options);
});

// Tap notification — navigate directly to the URL stored in notification data
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : APP_URL;

  console.log('[SW] Notification clicked, opening:', targetUrl);

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Look for an existing app window
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf('acebuilds51.github.io/ladle_and_spoon') >= 0 && 'focus' in client) {
          // Navigate existing window to the specific URL (e.g. rating deep link)
          if ('navigate' in client) {
            return client.navigate(targetUrl).then(function(c) { return c.focus(); });
          }
          return client.focus();
        }
      }
      // No existing window — open a new one at the target URL
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
