// src/pages/SchedulePage.js
import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { schedulesApi } from '../lib/supabase'
import { Modal, EmptyState, LoadingSpinner, ConfirmDialog } from '../components/Layout'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

const STATUS_MAP = {
  planned: { label: '예정', badge: 'badge-blue' },
  confirmed: { label: '확정', badge: 'badge-green' },
  completed: { label: '완료', badge: 'badge-gray' },
  cancelled: { label: '취소', badge: 'badge-red' },
}

const BLANK = {
  title: '', scheduled_date: '', scheduled_time: '',
  location: '', system_name: '', description: '',
  status: 'planned', is_gm: false, color: '#c8a96e'
}

export default function SchedulePage() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [confirm, setConfirm] = useState(null)
  const [filter, setFilter] = useState('upcoming')

  const load = async () => {
    const { data } = await schedulesApi.getAll(user.id)
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [user])

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const openNew = () => {
    setEditing(null)
    setForm({ ...BLANK, scheduled_date: new Date().toISOString().split('T')[0] })
    setModal(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm({ ...item })
    setModal(true)
  }

  const save = async () => {
    if (!form.title || !form.scheduled_date) return
    if (editing) {
      await schedulesApi.update(editing.id, form)
    } else {
      await schedulesApi.create({ ...form, user_id: user.id })
    }
    setModal(false)
    load()
  }

  const remove = async (id) => {
    await schedulesApi.remove(id)
    load()
  }

  const today = new Date().toISOString().split('T')[0]
  const filtered = items.filter(i => {
    if (filter === 'upcoming') return i.scheduled_date >= today && i.status !== 'cancelled'
    if (filter === 'past') return i.scheduled_date < today || i.status === 'completed'
    if (filter === 'cancelled') return i.status === 'cancelled'
    return true
  }).sort((a,b) => a.scheduled_date.localeCompare(b.scheduled_date))

  return (
    <div className="fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">📅 일정 관리</h1>
          <p className="page-subtitle">예정된 세션과 지나간 플레이 일정을 관리해요</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ 일정 추가</button>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-8" style={{ marginBottom: 24 }}>
        {[
          { key: 'upcoming', label: '예정' },
          { key: 'past', label: '지나간' },
          { key: 'cancelled', label: '취소됨' },
          { key: 'all', label: '전체' },
        ].map(f => (
          <button
            key={f.key}
            className={`btn ${filter === f.key ? 'btn-primary' : 'btn-outline'} btn-sm`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : filtered.length === 0
        ? <EmptyState icon="📅" title="일정이 없어요" description="새 일정을 추가해보세요!" action={<button className="btn btn-primary" onClick={openNew}>일정 추가하기</button>} />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(item => (
              <div key={item.id} className="card card-sm" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {/* 날짜 블록 */}
                <div style={{
                  background: 'rgba(200,169,110,0.12)', borderRadius: 10,
                  padding: '10px 14px', textAlign: 'center', minWidth: 56, flexShrink: 0
                }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--color-text-light)' }}>
                    {format(new Date(item.scheduled_date), 'M월', { locale: ko })}
                  </div>
                  <div className="text-serif" style={{ fontSize: '1.5rem', color: 'var(--color-accent)', fontWeight: 700, lineHeight: 1 }}>
                    {format(new Date(item.scheduled_date), 'd')}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--color-text-light)' }}>
                    {format(new Date(item.scheduled_date), 'EEE', { locale: ko })}
                  </div>
                </div>

                {/* 내용 */}
                <div style={{ flex: 1 }}>
                  <div className="flex items-center gap-8" style={{ marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.title}</span>
                    <span className={`badge ${STATUS_MAP[item.status]?.badge || 'badge-gray'}`}>
                      {STATUS_MAP[item.status]?.label}
                    </span>
                    {item.is_gm && <span className="badge badge-primary">GM</span>}
                  </div>
                  <div className="text-xs text-light flex gap-12">
                    {item.system_name && <span>📌 {item.system_name}</span>}
                    {item.scheduled_time && <span>🕐 {item.scheduled_time}</span>}
                    {item.location && <span>📍 {item.location}</span>}
                  </div>
                  {item.description && <p className="text-sm text-light" style={{ marginTop: 6 }}>{item.description}</p>}
                </div>

                {/* 액션 */}
                <div className="flex gap-8">
                  <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)}>수정</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: '#e57373' }} onClick={() => setConfirm(item.id)}>삭제</button>
                </div>
              </div>
            ))}
          </div>
        )
      }

      {/* 등록/수정 모달 */}
      <Modal isOpen={modal} onClose={() => setModal(false)}
        title={editing ? '일정 수정' : '새 일정 추가'}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setModal(false)}>취소</button>
            <button className="btn btn-primary" onClick={save}>저장</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">제목 *</label>
          <input className="form-input" placeholder="세션명 또는 일정명" value={form.title} onChange={set('title')} />
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">날짜 *</label>
            <input className="form-input" type="date" value={form.scheduled_date} onChange={set('scheduled_date')} />
          </div>
          <div className="form-group">
            <label className="form-label">시간</label>
            <input className="form-input" type="time" value={form.scheduled_time} onChange={set('scheduled_time')} />
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">시스템</label>
            <input className="form-input" placeholder="CoC, D&D, 나이트메어..." value={form.system_name} onChange={set('system_name')} />
          </div>
          <div className="form-group">
            <label className="form-label">장소</label>
            <input className="form-input" placeholder="온라인 / 홍대 보드게임카페..." value={form.location} onChange={set('location')} />
          </div>
        </div>
        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">상태</label>
            <select className="form-select" value={form.status} onChange={set('status')}>
              <option value="planned">예정</option>
              <option value="confirmed">확정</option>
              <option value="completed">완료</option>
              <option value="cancelled">취소</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">역할</label>
            <select className="form-select" value={form.is_gm ? 'gm' : 'pl'} onChange={e => setForm(f => ({ ...f, is_gm: e.target.value === 'gm' }))}>
              <option value="pl">PL (플레이어)</option>
              <option value="gm">GM (게임 마스터)</option>
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">메모</label>
          <textarea className="form-textarea" placeholder="준비할 사항, 참가자 등..." value={form.description} onChange={set('description')} style={{ minHeight: 80 }} />
        </div>
      </Modal>

      <ConfirmDialog isOpen={!!confirm} onClose={() => setConfirm(null)} onConfirm={() => remove(confirm)} message="이 일정을 삭제하시겠어요?" />
    </div>
  )
}
