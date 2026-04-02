// src/context/RuleContext.js
// 룰(시스템) 목록을 전역으로 관리하는 Context
import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const RuleContext = createContext(null)

export function RuleProvider({ children }) {
  const { user } = useAuth()
  const [rules, setRules] = useState([])

  const load = async () => {
    if (!user) return
    const { data } = await supabase
      .from('rule_systems')
      .select('*')
      .eq('user_id', user.id)
      .order('name')
    setRules(data || [])
  }

  useEffect(() => { load() }, [user])

  const addRule = async (name) => {
    if (!name.trim()) return
    await supabase.from('rule_systems').insert({ user_id: user.id, name: name.trim() })
    load()
  }

  const removeRule = async (id) => {
    await supabase.from('rule_systems').delete().eq('id', id)
    load()
  }

  return (
    <RuleContext.Provider value={{ rules, addRule, removeRule, reload: load }}>
      {children}
    </RuleContext.Provider>
  )
}

export const useRules = () => useContext(RuleContext)
