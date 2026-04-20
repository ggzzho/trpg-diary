// src/components/supporter/AlignmentChartSection.js
import React, { useState } from 'react'
import { Mi } from '../Mi'

const SESSION_TYPE_ITEMS = ['온라인', '오프라인', '보이스', '텍스트', '1:1', '다인(n명)', '마스터링', '플레이어', '단기', '장기']
const PLATFORM_ITEMS    = ['Roll20', '코코포리아', '도돈토후', '디스코드', '행아웃', '오픈카톡']
const EXTERNAL_ITEMS    = ['외부 구인 가능', '외부 관전 가능']
const PLAY_STYLE_ITEMS  = ['단문', '중문', '장문', '대사(행동)', '"대사"행동', '사담 가능', '메타 발언 가능', '초성 사용 가능']
const OTHER_ITEMS       = ['글', '그림', '소비', '디자인', '덕질', '캐릭터성', '연애요소', 'PVP', 'RP', 'G']
const DAYS = [
  { key:'mon', label:'월' }, { key:'tue', label:'화' }, { key:'wed', label:'수' },
  { key:'thu', label:'목' }, { key:'fri', label:'금' }, { key:'sat', label:'토' }, { key:'sun', label:'일' },
]

const emptyForm = () => ({
  session_type: [],
  platform: [], platform_etc: '',
  external: [], external_etc: '',
  schedule: { mon:'', tue:'', wed:'', thu:'', fri:'', sat:'', sun:'', advance:'' },
  play_style: [], play_style_etc: '',
  other_tendencies: [],
  main_rulebook: '',
  main_playtime: '',
})

const toggle = (arr, item) => arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]

function TagChip({ label }) {
  return (
    <span style={{
      display:'inline-flex', padding:'2px 9px', borderRadius:100,
      fontSize:'0.72rem', fontWeight:600,
      background:'var(--color-nav-active-bg)',
      color:'var(--color-accent)',
      border:'1px solid var(--color-border)',
      margin:'2px 2px',
    }}>{label}</span>
  )
}

function CheckItem({ checked, label, onChange }) {
  return (
    <label style={{ display:'inline-flex', alignItems:'center', gap:4, cursor:'pointer', fontSize:'0.82rem', marginRight:10, marginBottom:5 }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ accentColor:'var(--color-primary)', cursor:'pointer' }}/>
      {label}
    </label>
  )
}

function Row({ label, children }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', gap:8, paddingBottom:6 }}>
      <span style={{
        fontSize:'0.72rem', fontWeight:700, color:'var(--color-text-light)',
        minWidth:86, paddingTop:5, flexShrink:0, lineHeight:1.3,
      }}>{label}</span>
      <div style={{ flex:1, display:'flex', flexWrap:'wrap', alignItems:'center' }}>{children}</div>
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

function hasChartData(chart) {
  if (!chart) return false
  return !!(
    (chart.session_type||[]).length ||
    (chart.platform||[]).length || chart.platform_etc ||
    (chart.external||[]).length || chart.external_etc ||
    (chart.schedule && Object.values(chart.schedule).some(v => v)) ||
    (chart.play_style||[]).length || chart.play_style_etc ||
    (chart.other_tendencies||[]).length ||
    chart.main_rulebook || chart.main_playtime
  )
}

export default function AlignmentChartSection({ profile, isOwner, onSave }) {
  const chart = profile?.alignment_chart || {}
  const hasData = hasChartData(chart)

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)

  const openEdit = () => {
    const c = profile?.alignment_chart || {}
    setForm({
      session_type: c.session_type || [],
      platform: c.platform || [], platform_etc: c.platform_etc || '',
      external: c.external || [], external_etc: c.external_etc || '',
      schedule: { mon:'', tue:'', wed:'', thu:'', fri:'', sat:'', sun:'', advance:'', ...(c.schedule || {}) },
      play_style: c.play_style || [], play_style_etc: c.play_style_etc || '',
      other_tendencies: c.other_tendencies || [],
      main_rulebook: c.main_rulebook || '',
      main_playtime: c.main_playtime || '',
    })
    setEditing(true)
  }

  const save = async () => {
    setSaving(true)
    await onSave({ alignment_chart: form })
    setSaving(false)
    setEditing(false)
  }

  // 비공개 조건: 데이터 없고 오너가 아닐 때
  if (!hasData && !isOwner) return null

  // ── 표시 모드 ──────────────────────────────────────
  if (!editing) {
    return (
      <div style={{ marginTop:20, textAlign:'left', borderTop:'1px solid var(--color-border)', paddingTop:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
          <Mi size="sm" color="accent">tune</Mi>
          <span style={{ fontSize:'0.9rem', fontWeight:700, color:'var(--color-accent)' }}>성향표</span>
          {isOwner && (
            <button className="btn btn-ghost btn-sm" onClick={openEdit}
              style={{ marginLeft:'auto', fontSize:'0.73rem', padding:'2px 10px' }}>
              <Mi size="sm">edit</Mi> 편집
            </button>
          )}
        </div>

        {!hasData && isOwner && (
          <div
            onClick={openEdit}
            style={{
              textAlign:'center', padding:'16px 0',
              color:'var(--color-text-light)', fontSize:'0.82rem',
              border:'1.5px dashed var(--color-border)', borderRadius:10, cursor:'pointer',
            }}
          >
            ✦ 성향표를 작성해보세요
          </div>
        )}

        {hasData && (
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {(chart.session_type||[]).length > 0 && (
              <Row label="세션 유형">
                {chart.session_type.map(i => <TagChip key={i} label={i}/>)}
              </Row>
            )}
            {((chart.platform||[]).length > 0 || chart.platform_etc || (chart.external||[]).length > 0 || chart.external_etc) && (
              <Row label="선호 유형">
                {(chart.platform||[]).map(i => <TagChip key={i} label={i}/>)}
                {chart.platform_etc && <TagChip label={`기타: ${chart.platform_etc}`}/>}
                {(chart.external||[]).map(i => <TagChip key={i} label={i}/>)}
                {chart.external_etc && <TagChip label={`기타: ${chart.external_etc}`}/>}
              </Row>
            )}
            {chart.schedule && Object.entries(chart.schedule).some(([k,v]) => k !== 'advance' && v) && (
              <Row label="일정 조율">
                <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                  {DAYS.map(({key,label}) => chart.schedule[key]
                    ? <TagChip key={key} label={`${label} ${chart.schedule[key]}`}/>
                    : null
                  )}
                  {chart.schedule.advance && <TagChip label={`📅 ${chart.schedule.advance}`}/>}
                </div>
              </Row>
            )}
            {((chart.play_style||[]).length > 0 || chart.play_style_etc) && (
              <Row label="플레이 성향">
                {(chart.play_style||[]).map(i => <TagChip key={i} label={i}/>)}
                {chart.play_style_etc && <TagChip label={`기타: ${chart.play_style_etc}`}/>}
              </Row>
            )}
            {(chart.other_tendencies||[]).length > 0 && (
              <Row label="기타 성향">
                {chart.other_tendencies.map(i => <TagChip key={i} label={i}/>)}
              </Row>
            )}
            {chart.main_rulebook && (
              <Row label="주력룰">
                <span style={{ fontSize:'0.82rem' }}>{chart.main_rulebook}</span>
              </Row>
            )}
            {chart.main_playtime && (
              <Row label="주 플레이 시간대">
                <span style={{ fontSize:'0.82rem' }}>{chart.main_playtime}</span>
              </Row>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── 편집 모드 ──────────────────────────────────────
  return (
    <div style={{ marginTop:20, textAlign:'left', border:'1px solid var(--color-border)', borderRadius:12, padding:'16px 18px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:16 }}>
        <Mi size="sm" color="accent">tune</Mi>
        <span style={{ fontSize:'0.9rem', fontWeight:700, color:'var(--color-accent)' }}>성향표 편집</span>
        <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)} style={{ marginLeft:'auto' }}>취소</button>
      </div>

      <EditSection label="세션 유형">
        {SESSION_TYPE_ITEMS.map(item => (
          <CheckItem key={item} label={item}
            checked={form.session_type.includes(item)}
            onChange={() => setForm(f => ({...f, session_type: toggle(f.session_type, item)}))}/>
        ))}
      </EditSection>

      <EditSection label="선호 유형 (플랫폼)">
        {PLATFORM_ITEMS.map(item => (
          <CheckItem key={item} label={item}
            checked={form.platform.includes(item)}
            onChange={() => setForm(f => ({...f, platform: toggle(f.platform, item)}))}/>
        ))}
        <div style={{ marginTop:6 }}>
          <input className="form-input" placeholder="기타 플랫폼 직접 입력" value={form.platform_etc}
            onChange={e => setForm(f => ({...f, platform_etc: e.target.value}))}
            style={{ fontSize:'0.82rem', padding:'4px 10px', maxWidth:280 }}/>
        </div>
        <div style={{ marginTop:10 }}>
          {EXTERNAL_ITEMS.map(item => (
            <CheckItem key={item} label={item}
              checked={form.external.includes(item)}
              onChange={() => setForm(f => ({...f, external: toggle(f.external, item)}))}/>
          ))}
        </div>
        <div style={{ marginTop:6 }}>
          <input className="form-input" placeholder="외부 활동 기타 기재" value={form.external_etc}
            onChange={e => setForm(f => ({...f, external_etc: e.target.value}))}
            style={{ fontSize:'0.82rem', padding:'4px 10px', maxWidth:280 }}/>
        </div>
      </EditSection>

      <EditSection label="일정 조율">
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:6, marginBottom:8 }}>
          {DAYS.map(({key,label}) => (
            <div key={key} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:'0.82rem', fontWeight:700, color:'var(--color-accent)', minWidth:16 }}>{label}</span>
              <input className="form-input" placeholder="예: 19-23시" value={form.schedule[key]||''}
                onChange={e => setForm(f => ({...f, schedule:{...f.schedule,[key]:e.target.value}}))}
                style={{ fontSize:'0.79rem', padding:'3px 8px', flex:1 }}/>
            </div>
          ))}
        </div>
        <input className="form-input" placeholder="조율 가능 시점 (예: 1주 전, 당일 가능)" value={form.schedule.advance}
          onChange={e => setForm(f => ({...f, schedule:{...f.schedule,advance:e.target.value}}))}
          style={{ fontSize:'0.82rem', padding:'4px 10px', maxWidth:280 }}/>
      </EditSection>

      <EditSection label="플레이 성향">
        {PLAY_STYLE_ITEMS.map(item => (
          <CheckItem key={item} label={item}
            checked={form.play_style.includes(item)}
            onChange={() => setForm(f => ({...f, play_style: toggle(f.play_style, item)}))}/>
        ))}
        <div style={{ marginTop:6 }}>
          <input className="form-input" placeholder="기타 성향 직접 입력" value={form.play_style_etc}
            onChange={e => setForm(f => ({...f, play_style_etc: e.target.value}))}
            style={{ fontSize:'0.82rem', padding:'4px 10px', maxWidth:280 }}/>
        </div>
      </EditSection>

      <EditSection label="기타 성향">
        {OTHER_ITEMS.map(item => (
          <CheckItem key={item} label={item}
            checked={form.other_tendencies.includes(item)}
            onChange={() => setForm(f => ({...f, other_tendencies: toggle(f.other_tendencies, item)}))}/>
        ))}
      </EditSection>

      <EditSection label="주력룰">
        <input className="form-input" placeholder="예: CoC 7판, DnD 5e" value={form.main_rulebook}
          onChange={e => setForm(f => ({...f, main_rulebook: e.target.value}))}
          style={{ fontSize:'0.82rem', padding:'4px 10px', maxWidth:360 }}/>
      </EditSection>

      <EditSection label="주 플레이 시간대">
        <input className="form-input" placeholder="예: 평일 저녁 8~11시" value={form.main_playtime}
          onChange={e => setForm(f => ({...f, main_playtime: e.target.value}))}
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
