// TRPG Diary Service Worker
// PWA 설치 조건 충족용 — fetch는 모두 네트워크로 직접 처리

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim())
})

// fetch 핸들러 없음: 모든 요청은 브라우저 기본 네트워크로 처리
// (외부 폰트/Supabase/YouTube 등 간섭 없음)
