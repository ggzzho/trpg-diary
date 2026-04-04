// src/components/RuleSelect.js
import React from 'react'
import { useRules } from '../context/RuleContext'

// 룰북 목록에 등록된 룰을 드롭다운으로 선택
export function RuleSelect({ value, onChange, placeholder = '룰 선택' }) {
  const { rules } = useRules()

  return (
    <select
      className="form-select"
      value={value || ''}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {rules.map(r => (
        <option key={r.id} value={r.name}>{r.name}</option>
      ))}
      {/* 직접 입력한 값이 목록에 없을 때도 표시 */}
      {value && !rules.find(r => r.name === value) && (
        <option value={value}>{value}</option>
      )}
    </select>
  )
}

// 하위 호환을 위해 빈 컴포넌트로 유지 (import 에러 방지)
export function RuleManagerModal() { return null }
