// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ Supabase 환경변수가 설정되지 않았습니다. .env 파일을 확인하세요.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Auth helpers ──────────────────────────────────────────────
export const signUp = async (email, password, username, displayName) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, display_name: displayName }
    }
  })
  return { data, error }
}

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export const getSession = async () => {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

// ── Profile helpers ───────────────────────────────────────────
export const getProfile = async (usernameOrId) => {
  const isUUID = /^[0-9a-f-]{36}$/.test(usernameOrId)
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq(isUUID ? 'id' : 'username', usernameOrId)
    .single()
  return { data, error }
}

export const updateProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()
  return { data, error }
}

// ── Generic CRUD factory ──────────────────────────────────────
const makeTableApi = (table) => ({
  getAll: async (userId) => {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(2500)
    return { data, error }
  },
  create: async (payload) => {
    const { data, error } = await supabase.from(table).insert(payload).select().single()
    return { data, error }
  },
  update: async (id, updates) => {
    const { data, error } = await supabase.from(table).update(updates).eq('id', id).select().single()
    return { data, error }
  },
  remove: async (id) => {
    const { error } = await supabase.from(table).delete().eq('id', id)
    return { error }
  }
})

export const schedulesApi = makeTableApi('schedules')
export const availabilityApi = makeTableApi('availability')
export const playLogsApi = makeTableApi('play_logs')
export const rulebooksApi = makeTableApi('rulebooks')
export const scenariosApi = makeTableApi('scenarios')
export const wishScenariosApi = makeTableApi('wish_scenarios')
export const pairsApi = makeTableApi('pairs')
export const charactersApi = makeTableApi('characters')
export const bookmarksApi = makeTableApi('bookmarks')
export const dotoriApi = makeTableApi('dotori')

// ── 멤버십 관리 API (관리자 전용) ─────────────────────────────
export const membershipApi = {
  // 이메일·닉네임·아이디로 유저 검색 (SECURITY DEFINER 함수 호출)
  searchUser: async (query) => {
    const { data, error } = await supabase.rpc('admin_search_user', { p_query: query })
    return { data, error }
  },
  // 등급 설정 (SECURITY DEFINER 함수 호출)
  setMembership: async (email, tier, note = null) => {
    const { data, error } = await supabase.rpc('admin_set_membership', {
      p_target_email: email,
      p_new_tier: tier,
      p_note: note,
    })
    return { data, error }
  },
  // 로그 되돌리기 (SECURITY DEFINER 함수 호출)
  revertLog: async (logId) => {
    const { data, error } = await supabase.rpc('admin_revert_membership', { p_log_id: logId })
    return { data, error }
  },
  // 최근 수정 내역 조회 (RLS로 관리자만 읽기 가능)
  getLogs: async (limit = 30) => {
    const { data, error } = await supabase
      .from('membership_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    return { data, error }
  },
  // 전체 회원 목록 (페이지네이션 + 필터, SECURITY DEFINER)
  listUsers: async ({ tier = null, page = 1, perPage = 30, search = null } = {}) => {
    const { data, error } = await supabase.rpc('admin_list_users', {
      p_tier:     tier,
      p_page:     page,
      p_per_page: perPage,
      p_search:   search || null,
    })
    return { data, error }
  },
}

// ── 북마크 태그 API ───────────────────────────────────────────
export const bookmarkTagsApi = {
  getAll: async (userId) => {
    const { data, error } = await supabase.from('bookmark_tags').select('*').eq('user_id', userId).order('name')
    return { data, error }
  },
  create: async (payload) => {
    const { data, error } = await supabase.from('bookmark_tags').insert(payload).select().single()
    return { data, error }
  },
  remove: async (id) => {
    const { error } = await supabase.from('bookmark_tags').delete().eq('id', id)
    return { error }
  }
}

// ── 도토리 태그 API ───────────────────────────────────────────
export const dotoriTagsApi = {
  getAll: async (userId) => {
    const { data, error } = await supabase.from('dotori_tags').select('*').eq('user_id', userId).order('name')
    return { data, error }
  },
  create: async (payload) => {
    const { data, error } = await supabase.from('dotori_tags').insert(payload).select().single()
    return { data, error }
  },
  remove: async (id) => {
    const { error } = await supabase.from('dotori_tags').delete().eq('id', id)
    return { error }
  }
}

// ── OG 메타데이터 (allorigins 프록시) ────────────────────────
export const fetchOgMeta = async (url) => {
  try {
    const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`)
    const json = await res.json()
    const html = json.contents || ''
    const getMeta = (prop) => {
      const m = html.match(new RegExp(`<meta[^>]*(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i'))
               || html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, 'i'))
      return m ? m[1] : null
    }
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    return {
      title: getMeta('og:title') || (titleMatch ? titleMatch[1].trim() : '') || '',
      description: getMeta('og:description') || getMeta('description') || '',
      thumbnail_url: getMeta('og:image') || '',
    }
  } catch {
    return { title: '', description: '', thumbnail_url: '' }
  }
}

// ── Guestbook ─────────────────────────────────────────────────
export const guestbookApi = {
  getAll: async (ownerId) => {
    const { data, error } = await supabase
      .from('guestbook')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
    return { data, error }
  },
  create: async (payload) => {
    const { data, error } = await supabase.from('guestbook').insert(payload).select().single()
    return { data, error }
  },
  remove: async (id) => {
    const { error } = await supabase.from('guestbook').delete().eq('id', id)
    return { error }
  }
}

// ── Storage helpers ───────────────────────────────────────────
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

// 버킷별 압축 설정 (maxBytes는 DB 버킷 제한과 동일하게 유지)
const BUCKET_CONFIG = {
  'avatars':      { maxBytes: 1 * 1024 * 1024,         maxPx: 500,  quality: 0.85 },
  'covers':       { maxBytes: 1 * 1024 * 1024,         maxPx: 600,  quality: 0.85 },
  'play-images':  { maxBytes: 2.5 * 1024 * 1024,       maxPx: 1600, quality: 0.85 },
  'backgrounds':  { maxBytes: 2.5 * 1024 * 1024,       maxPx: 1920, quality: 0.85 },
}

// Canvas로 이미지 압축
const compressImage = (file, maxPx, quality) => {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      let { width, height } = img
      if (width > height) {
        if (width > maxPx) { height = Math.round(height * maxPx / width); width = maxPx }
      } else {
        if (height > maxPx) { width = Math.round(width * maxPx / height); height = maxPx }
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      const isPng = file.type === 'image/png' || file.type === 'image/gif'
      // JPEG/WebP만 배경 채우기 (PNG·GIF는 투명도 보존)
      if (!isPng) {
        const themeBg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || '#faf6f0'
        ctx.fillStyle = themeBg
        ctx.fillRect(0, 0, width, height)
      }
      ctx.drawImage(img, 0, 0, width, height)
      const mimeType = isPng ? 'image/png' : 'image/jpeg'
      canvas.toBlob(blob => resolve(blob || file), mimeType, isPng ? 1 : quality)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

// 버킷 제한에 맞게 자동 압축 (초과 시 품질 단계적으로 낮춤)
const compressToFit = async (file, bucket) => {
  const config = BUCKET_CONFIG[bucket] || { maxBytes: 2.5 * 1024 * 1024, maxPx: 1920, quality: 0.85 }
  const { maxBytes, maxPx, quality } = config
  const isPngGif = file.type === 'image/png' || file.type === 'image/gif'

  let blob = await compressImage(file, maxPx, quality)

  // JPEG/WebP: 품질을 0.1씩 낮춰가며 목표 크기 이하로
  if (!isPngGif && blob.size > maxBytes) {
    let q = quality - 0.1
    while (blob.size > maxBytes && q >= 0.3) {
      blob = await compressImage(file, maxPx, q)
      q -= 0.1
    }
  }

  // PNG/GIF: 해상도를 절반으로 줄여 재시도
  if (isPngGif && blob.size > maxBytes) {
    blob = await compressImage(file, Math.round(maxPx / 2), 1)
  }

  return blob
}

// ── 혜택 최초 사용일 기록 ─────────────────────────────────────
// 스티커 추가 / BGM 추가 / 커서 효과 ON / 성향표 저장 중 하나라도 최초 사용 시 호출
export const recordFirstMembershipUse = async (profile, userId) => {
  if (profile?.membership_first_used_at) return  // 이미 기록됨
  await supabase
    .from('profiles')
    .update({ membership_first_used_at: new Date().toISOString() })
    .eq('id', userId)
}

// ── Notifications ─────────────────────────────────────────────
export const notificationsApi = {
  getUnreadCounts: async () => {
    const { data, error } = await supabase
      .from('notifications')
      .select('type')
      .eq('is_read', false)
    if (error) return { guestbook: 0, feedback: 0, total: 0 }
    const arr = data || []
    const guestbook   = arr.filter(n => ['guestbook_comment','guestbook_reply'].includes(n.type)).length
    const feedback    = arr.filter(n => ['feedback_comment','feedback_reply','inquiry_new'].includes(n.type)).length
    const inquiry     = arr.filter(n => n.type === 'inquiry_reply').length
    return { guestbook, feedback, inquiry, total: arr.length }
  },
  getAll: async (limit = 20) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return []
    return data || []
  },
  markRead: async (type) => {
    let q = supabase.from('notifications').update({ is_read: true }).eq('is_read', false)
    if (type) q = q.eq('type', type)
    const { error } = await q
    return { error }
  },
  markReadById: async (id) => {
    const { error } = await supabase
      .from('notifications').update({ is_read: true }).eq('id', id)
    return { error }
  },
  markAllRead: async () => {
    const { error } = await supabase
      .from('notifications').update({ is_read: true }).eq('is_read', false)
    return { error }
  },
}

export const uploadFile = async (bucket, path, file, options = {}) => {
  // 파일 형식 검증
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { url: null, error: { message: 'JPG, PNG, GIF, WebP 형식만 업로드 가능해요.' } }
  }
  // 버킷 설정에 맞게 자동 압축 (크기 초과 여부와 무관하게 항상 적용)
  const uploadTarget = await compressToFit(file, bucket)

  // 압축 후에도 제한 초과 시 업로드 차단
  const config = BUCKET_CONFIG[bucket]
  if (config && uploadTarget.size > config.maxBytes) {
    return { url: null, error: { message: `이미지를 최대한 압축했지만 크기 제한을 초과해요. 더 작은 이미지를 사용해주세요.` } }
  }

  const isPngGif = file.type === 'image/png' || file.type === 'image/gif'
  const uploadContentType = isPngGif ? 'image/png' : 'image/jpeg'
  const { data, error } = await supabase.storage.from(bucket).upload(path, uploadTarget, { upsert: true, contentType: uploadContentType })
  if (error) return { url: null, error }
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path)
  return { url: publicUrl, error: null }
}
