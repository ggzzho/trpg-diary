// src/components/supporter/AlignmentChartSection.js
import React, { useState } from 'react'
import { Mi } from '../Mi'

const SESSION_TYPE_ITEMS = ['온라인', '오프라인', '보이스', '텍스트', '1:1', '다인(n명)', '마스터링', '플레이어', '단기', '장기']
const PLATFORM_ITEMS    = ['Roll20', '코코포리아', '도돈토후', '디스코드', '행아웃', '오픈카톡']
const EXTERNAL_ITEMS    = ['외부 구인 가능', '외부 관전 가능']
const PLAY_STYLE_ITEMS  = ['단문', '중문', '장문', '대사(행동)', '"대사"행동', '메타 발언 가능', '초성 사용 가능']

const emptyForm = () => ({
  session_type: [], session_type_pinned: [],
  platform: [], platform_etc: '', platform_pinned: [],
  external: [], external_etc: '',
  schedule: { weekday:'', weekend:'', advance:'' },
  play_style: [], play_style_etc: '', play_style_pinned: [],
  other_tendencies: [],   // [{ label:'', content:'' }]
  main_rulebook: '',
  preferred: '',
  triggers: '',
})

const toggle = (arr, item) => arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]

// 기존 문자열 배열 → { label, content } 배열로 변환
const normalizeOtherTendencies = (arr) => {
  if (!arr || arr.length === 0) return []
  if (typeof arr[0] === 'string') return arr.map(s => ({ label: s, content: '' }))
  return arr
}

// 기존 요일별 일정 → 평일/주말 방식으로 변환
const normalizeSchedule = (s) => {
  if (!s) return { weekday:'', weekend:'', advance:'' }
  if ('weekday' in s || 'weekend' in s) {
    return { weekday: s.weekday||'', weekend: s.weekend||'', advance: s.advance||'' }
  }
  // 구버전 마이그레이션: 첫 번째 비어있지 않은 값 사용
  const weekdayVal = [s.mon, s.tue, s.wed, s.thu, s.fri].find(Boolean) || ''
  const weekendVal = [s.sat, s.sun].find(Boolean) || ''
  return { weekday: weekdayVal, weekend: weekendVal, advance: s.advance||'' }
}

function hasChartData(chart) {
  if (!chart) return false
  const sched = chart.schedule || {}
  const hasSchedule = !!(sched.weekday || sched.weekend || sched.advance ||
    ['mon','tue','wed','thu','fri','sat','sun'].some(k => sched[k]))
  return !!(
    (chart.session_type||[]).length ||
    (chart.platform||[]).length || chart.platform_etc ||
    (chart.external||[]).length || chart.external_etc ||
    hasSchedule ||
    (chart.play_style||[]).length || chart.play_style_etc ||
    (chart.other_tendencies||[]).length ||
    chart.main_rulebook || chart.preferred || chart.triggers
  )
}

// ── 공통 컴포넌트 ─────────────────────────────────────────────

function TagChip({ label, pinned }) {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:3,
      padding:'2px 9px', borderRadius:100,
      fontSize:'0.72rem', fontWeight: pinned ? 700 : 600,
      background: pinned ? 'var(--color-primary)' : 'var(--color-nav-active-bg)',
      color: pinned ? '#fff' : 'var(--color-accent)',
      border: pinned ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
      margin:'2px 2px',
    }}>
      {pinned && <span style={{ fontSize:'0.65rem' }}>✦</span>}
      {label}
    </span>
  )
}

// 체크박스 + ★ 강조 버튼
function CheckItem({ checked, label, pinned, onChange, onTogglePin }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:1, marginRight:8, marginBottom:5 }}>
      <label style={{ display:'inline-flex', alignItems:'center', gap:4, cursor:'pointer', fontSize:'0.82rem' }}>
        <input type="checkbox" checked={checked} onChange={onChange}
          style={{ accentColor:'var(--color-primary)', cursor:'pointer' }}/>
        {label}
      </label>
      <button
        onClick={onTogglePin}
        disabled={!checked}
        title={pinned ? '강조 해제' : '강조 표시'}
        style={{
          background:'none', border:'none', cursor: checked ? 'pointer' : 'default',
          padding:'0 3px', fontSize:'0.9rem', lineHeight:1,
          color: pinned ? '#f5a623' : checked ? 'var(--color-border)' : 'transparent',
          transition:'color 0.15s',
        }}>★</button>
    </span>
  )
}

function Row({ label, children }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:8, paddingBottom:6 }}>
      <span style={{
        fontSize:'0.72rem', fontWeight:700, color:'var(--color-text-light)',
        minWidth:90, paddingTop:5, flexShrink:0, lineHeight:1.3,
      }}>{label}</span>
      <div style={{ flex:1, display:'flex', flexWrap:'wrap', alignItems:'center' }}>{children}</div>
    </div>
  )
}

function TextRow({ label, text }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:8, paddingBottom:8 }}>
      <span style={{
        fontSize:'0.72rem', fontWeight:700, color:'var(--color-text-light)',
        minWidth:90, paddingTop:3, flexShrink:0, lineHeight:1.3,
      }}>{label}</span>
      <p style={{ fontSize:'0.82rem', lineHeight:1.75, whiteSpace:'pre-wrap', color:'var(--color-text)', margin:0, flex:1 }}>
        {text}
      </p>
    </div>
  )
}

function EditSection({ label, children }) {
  return (
    <div style={{ marginBottom:16 }}>
      <div style={{ fontSize:'0.78rem', fontWeight:700, color:'var(--color-text-light)', marginBottom:6 }}>{label}</div>
      <div style={{ paddingLeft:4 }}>{children}</div>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────

export default function AlignmentChartSection({ profile, isOwner, onSave }) {
  const chart = profile?.alignment_chart || {}
  const hasData = hasChartData(chart)

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const setF = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const openEdit = () => {
    const c = profile?.alignment_chart || {}
    setForm({
      session_type:        c.session_type || [],
      session_type_pinned: c.session_type_pinned || [],
      platform:            c.platform || [],
      platform_etc:        c.platform_etc || '',
      platform_pinned:     c.platform_pinned || [],
      external:            c.external || [],
      external_etc:        c.external_etc || '',
      schedule:            normalizeSchedule(c.schedule),
      play_style:          c.play_style || [],
      play_style_etc:      c.play_style_etc || '',
      play_style_pinned:   c.play_style_pinned || [],
      other_tendencies:    normalizeOtherTendencies(c.other_tendencies),
      main_rulebook:       c.main_rulebook || '',
      preferred:           c.preferred || '',
      triggers:            c.triggers || '',
    })
    setEditing(true)
  }

  const save = async () => {
    setSaving(true)
    await onSave({ alignment_chart: form })
    setSaving(false)
    setEditing(false)
  }

  // 체크박스 핀 토글 헬퍼
  const handleCheck = (field, item) =>
    setF(field, toggle(form[field], item))

  const handlePin = (pinnedField, checkedField, item) => {
    if (!form[checkedField].includes(item)) return  // 체크 안 된 항목은 핀 불가
    setF(pinnedField, toggle(form[pinnedField], item))
  }

  // other_tendencies 핸들러
  const addOther = () =>
    setF('other_tendencies', [...form.other_tendencies, { label:'', content:'' }])

  const updateOther = (idx, key, val) =>
    setF('other_tendencies', form.other_tendencies.map((o, i) => i === idx ? { ...o, [key]: val } : o))

  const removeOther = (idx) =>
    setF('other_tendencies', form.other_tendencies.filter((_, i) => i !== idx))

  if (!hasData && !isOwner) return null

  // ── 표시 모드 ──────────────────────────────────────────────
  if (!editing) {
    // 구버전 일정 데이터 표시 처리
    const sched = chart.schedule || {}
    const schedNorm = normalizeSchedule(sched)

    return (
      <div style={{ marginTop:20, textAlign:'left', borderTop:'1px solid var(--color-border)', paddingTop:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
          <Mi size="sm" color="accent">tune</Mi>
          <span style={{ fontSize:'0.9rem', fontWeight:700, color:'var(--color-accent)' }}>TRPG 성향표</span>
          {isOwner && (
            <button className="btn btn-ghost btn-sm" onClick={openEdit}
              style={{ marginLeft:'auto', fontSize:'0.73rem', padding:'2px 10px' }}>
              <Mi size="sm">edit</Mi> 편집
            </button>
          )}
        </div>

        {!hasData && isOwner && (
          <div onClick={openEdit} style={{
            textAlign:'center', padding:'16px 0',
            color:'var(--color-text-light)', fontSize:'0.82rem',
            border:'1.5px dashed var(--color-border)', borderRadius:10, cursor:'pointer',
          }}>
            ✦ TRPG 성향표를 작성해보세요
          </div>
        )}

        {hasData && (
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>

            {/* 세션 유형 */}
            {(chart.session_type||[]).length > 0 && (
              <Row label="세션 유형">
                {chart.session_type.map(i => (
                  <TagChip key={i} label={i} pinned={(chart.session_type_pinned||[]).includes(i)}/>
                ))}
              </Row>
            )}

            {/* 선호 유형 */}
            {((chart.platform||[]).length > 0 || chart.platform_etc || (chart.external||[]).length > 0 || chart.external_etc) && (
              <Row label="선호 유형">
                {(chart.platform||[]).map(i => (
                  <TagChip key={i} label={i} pinned={(chart.platform_pinned||[]).includes(i)}/>
                ))}
                {chart.platform_etc && <TagChip label={`기타: ${chart.platform_etc}`}/>}
                {(chart.external||[]).map(i => <TagChip key={i} label={i}/>)}
                {chart.external_etc && <TagChip label={`기타: ${chart.external_etc}`}/>}
              </Row>
            )}

            {/* 일정 조율 */}
            {(schedNorm.weekday || schedNorm.weekend || schedNorm.advance) && (
              <Row label="일정 조율">
                {schedNorm.weekday && <TagChip label={`평일 ${schedNorm.weekday}`}/>}
                {schedNorm.weekend && <TagChip label={`주말 ${schedNorm.weekend}`}/>}
                {schedNorm.advance && <TagChip label={`📅 ${schedNorm.advance}`}/>}
              </Row>
            )}

            {/* 플레이 성향 */}
            {((chart.play_style||[]).length > 0 || chart.play_style_etc) && (
              <Row label="플레이 성향">
                {(chart.play_style||[]).map(i => (
                  <TagChip key={i} label={i} pinned={(chart.play_style_pinned||[]).includes(i)}/>
                ))}
                {chart.play_style_etc && <TagChip label={`기타: ${chart.play_style_etc}`}/>}
              </Row>
            )}

            {/* 기타 성향 */}
            {(chart.other_tendencies||[]).length > 0 && (
              <Row label="기타 성향">
                {chart.other_tendencies.map((item, idx) => {
                  const label = typeof item === 'string' ? item : item.label
                  const content = typeof item === 'string' ? '' : item.content
                  const display = label && content ? `${label}: ${content}` : label
                  return display ? <TagChip key={idx} label={display}/> : null
                })}
              </Row>
            )}

            {/* 선호 사항 */}
            {chart.preferred && <TextRow label="선호 사항" text={chart.preferred}/>}

            {/* 불호 사항 */}
            {chart.triggers && <TextRow label="불호 (트리거)" text={chart.triggers}/>}

            {/* 주력룰 */}
            {chart.main_rulebook && (
              <Row label="주력룰">
                <span style={{ fontSize:'0.82rem' }}>{chart.main_rulebook}</span>
              </Row>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── 편집 모드 ──────────────────────────────────────────────
  return (
    <div style={{ marginTop:20, textAlign:'left', border:'1px solid var(--color-border)', borderRadius:12, padding:'16px 18px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:16 }}>
        <Mi size="sm" color="accent">tune</Mi>
        <span style={{ fontSize:'0.9rem', fontWeight:700, color:'var(--color-accent)' }}>TRPG 성향표 편집</span>
        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)} style={{ marginLeft:'auto' }}>취소</button>
      </div>

      {/* 강조 안내 */}
      <div style={{
        fontSize:'0.75rem', color:'var(--color-text-light)', marginBottom:14,
        padding:'6px 10px', background:'var(--color-nav-active-bg)', borderRadius:6,
        display:'flex', alignItems:'center', gap:5,
      }}>
        <span style={{ color:'#f5a623' }}>★</span> 체크한 항목의 ★를 클릭하면 강조 표시(✦)로 표시됩니다.
      </div>

      {/* 세션 유형 */}
      <EditSection label="세션 유형">
        {SESSION_TYPE_ITEMS.map(item => (
          <CheckItem key={item} label={item}
            checked={form.session_type.includes(item)}
            pinned={form.session_type_pinned.includes(item)}
            onChange={() => {
              handleCheck('session_type', item)
              // 체크 해제 시 핀도 해제
              if (form.session_type.includes(item))
                setF('session_type_pinned', form.session_type_pinned.filter(x => x !== item))
            }}
            onTogglePin={() => handlePin('session_type_pinned', 'session_type', item)}/>
        ))}
      </EditSection>

      {/* 선호 유형 */}
      <EditSection label="선호 유형 (플랫폼)">
        {PLATFORM_ITEMS.map(item => (
          <CheckItem key={item} label={item}
            checked={form.platform.includes(item)}
            pinned={form.platform_pinned.includes(item)}
            onChange={() => {
              handleCheck('platform', item)
              if (form.platform.includes(item))
                setF('platform_pinned', form.platform_pinned.filter(x => x !== item))
            }}
            onTogglePin={() => handlePin('platform_pinned', 'platform', item)}/>
        ))}
        <div style={{ marginTop:6 }}>
          <input className="form-input" placeholder="기타 플랫폼 직접 입력" value={form.platform_etc}
            onChange={e => setF('platform_etc', e.target.value)}
            style={{ fontSize:'0.82rem', padding:'4px 10px', maxWidth:280 }}/>
        </div>
        <div style={{ marginTop:10 }}>
          {EXTERNAL_ITEMS.map(item => (
            <CheckItem key={item} label={item}
              checked={form.external.includes(item)}
              pinned={false}
              onChange={() => handleCheck('external', item)}
              onTogglePin={() => {}}/>
          ))}
        </div>
        <div style={{ marginTop:6 }}>
          <input className="form-input" placeholder="외부 활동 기타 기재" value={form.external_etc}
            onChange={e => setF('external_etc', e.target.value)}
            style={{ fontSize:'0.82rem', padding:'4px 10px', maxWidth:280 }}/>
        </div>
      </EditSection>

      {/* 일정 조율 */}
      <EditSection label="일정 조율">
        <div style={{ display:'flex', flexDirection:'column', gap:6, maxWidth:360, marginBottom:8 }}>
          {[
            { key:'weekday', label:'평일 (월~금)' },
            { key:'weekend', label:'주말 (토~일)' },
          ].map(({ key, label }) => (
            <div key={key} style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ fontSize:'0.82rem', fontWeight:700, color:'var(--color-accent)', minWidth:80, flexShrink:0 }}>{label}</span>
              <input className="form-input" placeholder="예: 19~23시"
                value={form.schedule[key]||''}
                onChange={e => setF('schedule', { ...form.schedule, [key]: e.target.value })}
                style={{ fontSize:'0.79rem', padding:'3px 8px', flex:1 }}/>
            </div>
          ))}
        </div>
        <input className="form-input" placeholder="조율 가능 시점 (예: 1주 전, 당일 가능)"
          value={form.schedule.advance}
          onChange={e => setF('schedule', { ...form.schedule, advance: e.target.value })}
          style={{ fontSize:'0.82rem', padding:'4px 10px', maxWidth:360 }}/>
      </EditSection>

      {/* 플레이 성향 */}
      <EditSection label="플레이 성향">
        {PLAY_STYLE_ITEMS.map(item => (
          <CheckItem key={item} label={item}
            checked={form.play_style.includes(item)}
            pinned={form.play_style_pinned.includes(item)}
            onChange={() => {
              handleCheck('play_style', item)
              if (form.play_style.includes(item))
                setF('play_style_pinned', form.play_style_pinned.filter(x => x !== item))
            }}
            onTogglePin={() => handlePin('play_style_pinned', 'play_style', item)}/>
        ))}
        <div style={{ marginTop:6 }}>
          <input className="form-input" placeholder="기타 성향 직접 입력" value={form.play_style_etc}
            onChange={e => setF('play_style_etc', e.target.value)}
            style={{ fontSize:'0.82rem', padding:'4px 10px', maxWidth:280 }}/>
        </div>
      </EditSection>

      {/* 기타 성향 — 자유 항목 세트 */}
      <EditSection label="기타 성향">
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {form.other_tendencies.map((item, idx) => (
            <div key={idx} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <input className="form-input" placeholder="항목명"
                value={item.label}
                onChange={e => updateOther(idx, 'label', e.target.value)}
                style={{ fontSize:'0.82rem', padding:'4px 8px', width:120, flexShrink:0 }}/>
              <input className="form-input" placeholder="내용"
                value={item.content}
                onChange={e => updateOther(idx, 'content', e.target.value)}
                style={{ fontSize:'0.82rem', padding:'4px 8px', flex:1 }}/>
              <button onClick={() => removeOther(idx)}
                style={{ background:'none', border:'none', cursor:'pointer', color:'#e57373', fontSize:'1rem', lineHeight:1, flexShrink:0 }}
                title="삭제">×</button>
            </div>
          ))}
        </div>
        <button className="btn btn-outline btn-sm" onClick={addOther}
          style={{ marginTop:8, fontSize:'0.78rem', display:'flex', alignItems:'center', gap:4 }}>
          <Mi size="sm">add</Mi> 항목 추가
        </button>
      </EditSection>

      {/* 선호 사항 */}
      <EditSection label="선호 사항">
        <textarea className="form-textarea"
          placeholder="선호하는 플레이 스타일, 분위기, 설정 등을 자유롭게 작성해주세요."
          value={form.preferred}
          onChange={e => setF('preferred', e.target.value)}
          maxLength={500}
          style={{ fontSize:'0.82rem', minHeight:72 }}/>
        <div style={{ fontSize:'0.72rem', color:'var(--color-text-light)', textAlign:'right', marginTop:2 }}>
          {form.preferred.length}/500
        </div>
      </EditSection>

      {/* 불호 사항(트리거) */}
      <EditSection label="불호 사항 (트리거)">
        <textarea className="form-textarea"
          placeholder="불편하거나 기피하는 요소가 있다면 작성해주세요."
          value={form.triggers}
          onChange={e => setF('triggers', e.target.value)}
          maxLength={500}
          style={{ fontSize:'0.82rem', minHeight:72 }}/>
        <div style={{ fontSize:'0.72rem', color:'var(--color-text-light)', textAlign:'right', marginTop:2 }}>
          {form.triggers.length}/500
        </div>
      </EditSection>

      {/* 주력룰 */}
      <EditSection label="주력룰">
        <input className="form-input" placeholder="예: CoC 7판, DnD 5e" value={form.main_rulebook}
          onChange={e => setF('main_rulebook', e.target.value)}
          style={{ fontSize:'0.82rem', padding:'4px 10px', maxWidth:360 }}/>
      </EditSection>

      <div style={{ display:'flex', gap:8, marginTop:4 }}>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? '저장 중...' : '저장'}
        </button>
        <button className="btn btn-outline" onClick={() => setEditing(false)}>취소</button>
      </div>
    </div>
  )
}
