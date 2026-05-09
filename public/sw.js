// TRPG Diary Service Worker
const CACHE_NAME = 'trpg-diary-v1'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim())
})

// Supabase API 및 외부 리소스는 캐시하지 않음 — 네트워크 우선
self.addEventListener('fetch', (e) => {
  const url = e.request.url
  if (
    url.includes('supabase.co') ||
    url.includes('googleapis.com') ||
    url.includes('youtube.com') ||
    url.includes('ytimg.com') ||
    e.request.method !== 'GET'
  ) return

  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  )
})
