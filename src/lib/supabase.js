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
export const pairsApi = makeTableApi('pairs')
export const bookmarksApi = makeTableApi('bookmarks')

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
const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export const uploadFile = async (bucket, path, file) => {
  // 파일 형식 검증
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { url: null, error: { message: 'JPG, PNG, GIF, WebP 형식만 업로드 가능해요.' } }
  }
  // 파일 크기 검증 (2MB 제한)
  if (file.size > MAX_FILE_SIZE) {
    return { url: null, error: { message: `파일 크기가 너무 커요. 2MB 이하의 이미지를 사용해주세요. (현재: ${(file.size/1024/1024).toFixed(1)}MB)` } }
  }
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
  if (error) return { url: null, error }
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path)
  return { url: publicUrl, error: null }
}
