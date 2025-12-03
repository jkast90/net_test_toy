// public/service-worker.js

self.addEventListener("install", () => {
  console.log("Service Worker installed");
  self.skipWaiting();
});

self.addEventListener("activate", () => {
  console.log("Service Worker activated");
  return self.clients.claim();
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/notes") && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow("/notes");
      }
    }),
  );
});
