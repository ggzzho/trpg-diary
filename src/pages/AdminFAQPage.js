// src/pages/AdminFAQPage.js
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Mi } from '../components/Mi'
import { ConfirmDialog } from '../components/Layout'
import { MarkdownRenderer } from './AdminNoticePage'

const CATEGORIES = ['계정', '기능', '이용방법', '결제·후원', '기타']

const BLANK = { category: '기능', question: '', answer: '', sort_order: 0, is_active: true }

const MARKDOWN_GUIDE = `**굵게** / *기울임*
# 제목1 / ## 제목2
- 목록 항목
[링크텍스트](URL)
---  (구분선)`

export default function AdminFAQPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [faqs, setFaqs] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [preview, setPreview] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState('all')

  useEffect(() => {
    if (profile && !profile.is_admin) navigate('/dashboard')
  }, [profile]) // eslint-disable-line

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('faqs').select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    setFaqs(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, []) // eslint-disable-line

  const openNew = () => {
    setEditing(null); setForm(BLANK); setPreview(false); setModal(true)
  }
  const openEdit = (f) => {
    setEditing(f)
    setForm({ category: f.category, question: f.question, answer: f.answer, sort_order: f.sort_order, is_active: f.is_active })
    setPreview(false); setModal(true)
  }

  const save = async () => {
    if (!form.question.trim() || !form.answer.trim()) return
    setSaving(true)
    const payload = {
      category:   form.category,
      question:   form.question.trim(),
      answer:     form.answer.trim(),
      sort_order: Number(form.sort_order) || 0,
      is_active:  form.is_active,
      updated_at: new Date().toISOString(),
    }
    if (editing) {
      await supabase.from('faqs').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('faqs').insert(payload)
    }
    setSaving(false); setModal(false); load()
  }

  const remove = async (id) => {
    await supabase.from('faqs').delete().eq('id', id)
    setConfirm(null); load()
  }

  const toggleActive = async (f) => {
    await supabase.from('faqs').update({ is_active: !f.is_active }).eq('id', f.id)
    load()
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const filtered = categoryFilter === 'all' ? faqs : faqs.filter(f => f.category === categoryFilter)

  return (
    <div className="fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">
            <Mi style={{ marginRight: 8, verticalAlign: 'middle' }}>help_outline</Mi>FAQ 관리
          </h1>
          <p className="page-subtitle">자주 묻는 질문을 등록하고 관리해요</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <Mi size="sm" color="white">add</Mi> FAQ 등록
        </button>
      </div>

      {/* 카테고리 필터 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {['all', ...CATEGORIES].map(c => (
          <button key={c}
            className={`btn btn-sm ${categoryFilter === c ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setCategoryFilter(c)}>
            {c === 'all'
              ? `전체 (${faqs.length})`
              : `${c} (${faqs.filter(f => f.category === c).length})`}
          </button>
        ))}
      </div>

      {loading
        ? <div className="text-sm text-light" style={{ textAlign: 'center', padding: 40 }}>불러오는 중...</div>
        : filtered.length === 0
          ? <div className="card" style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-light)' }}>
              등록된 FAQ가 없어요
            </div>
          : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtered.map(f => (
                <div key={f.id} className="card" style={{ padding: '14px 18px' }}>
                  <div className="flex justify-between items-center">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 100, fontSize: '0.68rem', fontWeight: 700,
                        background: 'var(--color-nav-active-bg)', color: 'var(--color-accent)', flexShrink: 0,
                      }}>{f.category}</span>
                      <span style={{
                        fontWeight: 600, fontSize: '0.9rem',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{f.question}</span>
                      <span className={`badge ${f.is_active ? 'badge-green' : 'badge-gray'}`}
                        style={{ fontSize: '0.65rem', flexShrink: 0 }}>
                        {f.is_active ? '활성' : '비활성'}
                      </span>
                      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-light)', flexShrink: 0 }}>
                        순서 {f.sort_order}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, marginLeft: 12 }}>
                      <button className="btn btn-ghost btn-sm"
                        style={{ fontSize: '0.75rem', color: f.is_active ? '#e57373' : 'var(--color-accent)' }}
                        onClick={() => toggleActive(f)}>
                        {f.is_active ? '비활성' : '활성'}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => openEdit(f)}>수정</button>
                      <button className="btn btn-ghost btn-sm" style={{ color: '#e57373' }}
                        onClick={() => setConfirm(f.id)}>삭제</button>
                    </div>
                  </div>
                  <div className="text-xs text-light" style={{ marginTop: 6, paddingLeft: 2 }}>
                    {f.answer.slice(0, 80)}{f.answer.length > 80 ? '...' : ''}
                  </div>
                </div>
              ))}
            </div>
      }

      {/* 등록/수정 모달 */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{
            background: 'var(--color-surface)', borderRadius: 16, padding: 28,
            width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto',
            border: '1px solid var(--color-border)',
          }}>
            <h3 style={{ fontWeight: 700, marginBottom: 20, fontSize: '1rem' }}>
              {editing ? 'FAQ 수정' : 'FAQ 등록'}
            </h3>

            {/* 카테고리 + 정렬 순서 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12, marginBottom: 16 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">카테고리 *</label>
                <select className="form-select" value={form.category} onChange={set('category')}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">정렬 순서</label>
                <input className="form-input" type="number" min={0}
                  value={form.sort_order} onChange={set('sort_order')} placeholder="0" />
              </div>
            </div>

            {/* 질문 */}
            <div className="form-group">
              <label className="form-label">질문 *</label>
              <input className="form-input" value={form.question} onChange={set('question')}
                placeholder="자주 묻는 질문을 입력해주세요" />
            </div>

            {/* 답변 */}
            <div className="form-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" style={{ margin: 0 }}>답변 * (마크다운)</label>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }}
                  onClick={() => setPreview(v => !v)}>
                  <Mi size="sm">{preview ? 'edit' : 'visibility'}</Mi>
                  {preview ? '편집' : '미리보기'}
                </button>
              </div>
              {preview
                ? <div style={{
                    minHeight: 160, padding: '12px 14px', borderRadius: 8,
                    border: '1px solid var(--color-border)', background: 'var(--color-nav-active-bg)',
                  }}>
                    <MarkdownRenderer content={form.answer} />
                  </div>
                : <textarea className="form-textarea" value={form.answer} onChange={set('answer')}
                    placeholder="답변을 입력해주세요&#10;&#10;마크다운 문법을 지원해요"
                    style={{ minHeight: 160, fontFamily: 'monospace', fontSize: '0.84rem' }} />
              }
              <div style={{
                marginTop: 6, padding: '8px 12px', borderRadius: 6,
                background: 'rgba(200,169,110,0.06)', border: '1px solid var(--color-border)',
                fontSize: '0.72rem', color: 'var(--color-text-light)', whiteSpace: 'pre-line',
              }}>
                💡 마크다운 문법{'\n'}{MARKDOWN_GUIDE}
              </div>
            </div>

            {/* 활성화 */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem' }}>
                <input type="checkbox" checked={form.is_active}
                  onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} />
                활성화
              </label>
            </div>

            <div className="flex justify-end gap-8">
              <button className="btn btn-outline btn-sm" onClick={() => setModal(false)}>취소</button>
              <button className="btn btn-primary btn-sm" onClick={save}
                disabled={saving || !form.question.trim() || !form.answer.trim()}>
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={!!confirm} onClose={() => setConfirm(null)}
        onConfirm={() => remove(confirm)} message="이 FAQ를 삭제하시겠어요?" />
    </div>
  )
}
