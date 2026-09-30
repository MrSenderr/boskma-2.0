// Service worker: alleen pushberichten.
//
// Bewust géén fetch-handler. Deze worker onderschept geen enkel verzoek en
// bewaart niets, dus hij kan nooit een oude versie van de app blijven tonen.
// Het enige wat hij doet is een melding tonen als er een push binnenkomt, en de
// app openen als je erop tikt.

self.addEventListener('push', (event) => {
  let d = {}
  try {
    d = event.data ? event.data.json() : {}
  } catch {
    d = { body: event.data ? event.data.text() : '' }
  }

  event.waitUntil(
    self.registration.showNotification(d.title || 'Kim', {
      body: d.body || '',
      // Zelfde tag = de melding vervangt de vorige in plaats van te stapelen.
      tag: d.tag,
      renotify: Boolean(d.tag),
      data: { url: d.url || '/' },
      icon: '/app-192.png',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'

  // Staat de app al open, dan gebruiken we dat venster. Anders een nieuw.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((vensters) => {
      for (const v of vensters) {
        if ('focus' in v) {
          if ('navigate' in v) v.navigate(url)
          return v.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
