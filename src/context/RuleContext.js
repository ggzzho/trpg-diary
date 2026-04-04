// src/context/RuleContext.js
// 룰 목록을 룰북 목록에서 자동으로 가져옴
import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const RuleContext = createContext(null)

export function RuleProvider({ children }) {
  const { user } = useAuth()
  const [rules, setRules] = useState([])

  const load = async () => {
    if (!user) return
    // 룰북 목록에서 system_name(룰) 컬럼을 가져와 중복 제거 후 정렬
    const { data } = await supabase
      .from('rulebooks')
      .select('system_name')
      .eq('user_id', user.id)
      .not('system_name', 'is', null)
    const unique = [...new Set((data || []).map(r => r.system_name).filter(Boolean))].sort()
    setRules(unique.map((name, i) => ({ id: i, name })))
  }

  useEffect(() => { load() }, [user])

  return (
    <RuleContext.Provider value={{ rules, reload: load }}>
      {children}
    </RuleContext.Provider>
  )
}

export const useRules = () => useContext(RuleContext)
