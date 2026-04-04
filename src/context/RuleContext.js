// src/context/RuleContext.js
// parent_id가 null인 부모 룰북의 title을 룰 드롭다운에 표시
import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const RuleContext = createContext(null)

export function RuleProvider({ children }) {
  const { user } = useAuth()
  const [rules, setRules] = useState([])

  const load = async () => {
    if (!user) return
    // 부모 룰북(parent_id가 null)의 title만 가져와 룰 드롭다운에 표시
    const { data } = await supabase
      .from('rulebooks')
      .select('id, title')
      .eq('user_id', user.id)
      .is('parent_id', null)
      .order('title')
    setRules((data || []).map(r => ({ id:r.id, name:r.title })))
  }

  useEffect(() => { load() }, [user])

  return (
    <RuleContext.Provider value={{ rules, reload: load }}>
      {children}
    </RuleContext.Provider>
  )
}

export const useRules = () => useContext(RuleContext)
