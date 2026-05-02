// src/context/AuthContext.js
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, getProfile, notificationsApi } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notifCounts, setNotifCounts] = useState({ guestbook: 0, feedback: 0, total: 0 })

  const loadProfile = async (userId) => {
    const { data } = await getProfile(userId)
    setProfile(data)
  }

  const refreshNotifs = useCallback(async () => {
    const counts = await notificationsApi.getUnreadCounts()
    setNotifCounts(counts)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) { loadProfile(session.user.id); refreshNotifs() }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) { loadProfile(session.user.id); refreshNotifs() }
      else { setProfile(null); setNotifCounts({ guestbook: 0, feedback: 0, total: 0 }) }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line

  // 탭 포커스 시 알림 재조회
  useEffect(() => {
    const onFocus = () => { if (user) refreshNotifs() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [user, refreshNotifs])

  const refreshProfile = () => user && loadProfile(user.id)

  // DB 저장 + 로컬 profile 상태 즉시 반영 (페이지 이동 후 돌아와도 설정 유지)
  const updateProfileField = useCallback(async (updates) => {
    if (!user) return
    await supabase.from('profiles').update(updates).eq('id', user.id)
    setProfile(prev => prev ? { ...prev, ...updates } : prev)
  }, [user])

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile, updateProfileField, notifCounts, refreshNotifs }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
