importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp(Object.fromEntries(new URL(self.location).searchParams));
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  // Messages with a notification payload are already displayed by the browser.
  if (payload.notification) return;
  const notification = payload.notification || {};
  self.registration.showNotification(notification.title || "Shopping Hospitalar", {
    body: notification.body || "Você tem um novo alerta.",
    icon: "/icon-192.png",
    badge: "/favicon.png",
    tag: payload.data?.path || "shopping-hospitalar",
    requireInteraction: true,
    vibrate: [300, 100, 300],
    data: { path: payload.data?.path || "/notificacoes" },
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const path = event.notification.data?.path || "/notificacoes";
  const url = new URL(path, self.location.origin).href;
  if (new URL(url).origin !== self.location.origin) return;
  event.waitUntil(clients.openWindow(url));
});
