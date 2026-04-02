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
export const uploadFile = async (bucket, path, file) => {
  const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
  if (error) return { url: null, error }
  const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(data.path)
  return { url: publicUrl, error: null }
}
