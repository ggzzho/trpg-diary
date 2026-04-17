// src/lib/fetchOgMeta.js
// OG 메타 가져오기 — 여러 서비스 순차 시도
export async function fetchOgMeta(url) {
  // 1차: jsonlink.io (무료, 제한 없음)
  try {
    const res = await fetch(
      `https://jsonlink.io/api/extract?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(8000) }
    )
    const json = await res.json()
    if (json.title || json.images?.[0]) {
      return {
        title: json.title || '',
        description: json.description || '',
        thumbnail_url: json.images?.[0] || '',
      }
    }
  } catch {}

  // 2차: microlink.io (월 100회 제한 있음)
  try {
    const res = await fetch(
      `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=false`,
      { signal: AbortSignal.timeout(10000) }
    )
    const json = await res.json()
    if (json.status === 'success' && json.data) {
      const d = json.data
      return {
        title: d.title || '',
        description: d.description || '',
        thumbnail_url: d.image?.url || d.logo?.url || '',
      }
    }
  } catch {}

  // 3차: allorigins (폴백)
  try {
    const res = await fetch(
      `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(8000) }
    )
    const json = await res.json()
    const html = json.contents || ''
    if (html) {
      const getMeta = (prop) => {
        const m = html.match(new RegExp(`<meta[^>]*(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i'))
                 || html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, 'i'))
        return m ? m[1] : null
      }
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
      const title = getMeta('og:title') || (titleMatch ? titleMatch[1].trim() : '') || ''
      const thumbnail_url = getMeta('og:image') || ''
      const description = getMeta('og:description') || getMeta('description') || ''
      if (title || thumbnail_url) return { title, description, thumbnail_url }
    }
  } catch {}

  return { title: '', description: '', thumbnail_url: '' }
}
