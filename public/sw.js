self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {}
  event.waitUntil(self.registration.showNotification(data.title || 'Concierge Go', {
    body: data.body || 'You have a new task update.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { link: data.link || '/notifications' },
    tag: data.taskId || 'concierge-go-update',
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.link || '/notifications', self.location.origin).href
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => client.url === target)
    return existing ? existing.focus() : clients.openWindow(target)
  }))
})
