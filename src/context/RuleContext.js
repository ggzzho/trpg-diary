// src/context/RuleContext.js
// parent_id가 null인 부모 룰북의 title을 룰 드롭다운에 표시
import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const RuleContext = createContext(null)

export function RuleProvider({ children }) {
  const { user } = useAuth()
  const [rules, setRules] = useState([])

  const load = async () => {
    if (!user) return
    const { data } = await supabase
      .from('rulebooks')
      .select('id, title, color')
      .eq('user_id', user.id)
      .is('parent_id', null)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('title')
    setRules((data || []).map(r => ({ id:r.id, name:r.title, color:r.color||null })))
  }

  useEffect(() => { load() }, [user])

  // system_name → color 맵 (컬러 없는 룰은 제외)
  const colorMap = useMemo(() => {
    const m = {}
    rules.forEach(r => { if (r.color) m[r.name] = r.color })
    return m
  }, [rules])

  return (
    <RuleContext.Provider value={{ rules, colorMap, reload: load }}>
      {children}
    </RuleContext.Provider>
  )
}

export const useRules = () => useContext(RuleContext)
