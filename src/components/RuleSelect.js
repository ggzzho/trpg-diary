// src/components/RuleSelect.js
import React, { useState } from 'react'
import { useRules } from '../context/RuleContext'
import { Modal } from './Layout'

// ── 룰 선택 드롭다운 ──────────────────────────────────────────
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

// ── 룰 목록 관리 모달 ─────────────────────────────────────────
export function RuleManagerModal({ isOpen, onClose }) {
  const { rules, addRule, removeRule } = useRules()
  const [newName, setNewName] = useState('')

  const handleAdd = async () => {
    if (!newName.trim()) return
    await addRule(newName)
    setNewName('')
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🎲 룰 목록 관리"
      footer={<button className="btn btn-outline btn-sm" onClick={onClose}>닫기</button>}
    >
      {/* 추가 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          className="form-input"
          placeholder="새 룰 이름 (예: CoC 7th, D&D 5e...)"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          style={{ flex: 1 }}
        />
        <button className="btn btn-primary btn-sm" onClick={handleAdd}>추가</button>
      </div>

      {/* 목록 */}
      {rules.length === 0
        ? <p className="text-sm text-light" style={{ textAlign: 'center', padding: '20px 0' }}>
            아직 룰이 없어요. 추가해보세요!
          </p>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rules.map(r => (
              <div key={r.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', borderRadius: 8,
                background: 'rgba(200,169,110,0.06)',
                border: '1px solid var(--color-border)'
              }}>
                <span style={{ fontSize: '0.88rem' }}>{r.name}</span>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: '#e57373', padding: '2px 8px' }}
                  onClick={() => removeRule(r.id)}
                >삭제</button>
              </div>
            ))}
          </div>
      }
    </Modal>
  )
}
