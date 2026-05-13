// src/components/BulkImportModal.js
// 룰북 / 시나리오 CSV·엑셀 일괄 등록 모달 (후원자 전용)
import React, { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { Modal } from './Layout'
import { Mi } from './Mi'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ── 설정 ──────────────────────────────────────────────────────────────────────
const CONFIG = {
  rulebook: {
    label: '룰북',
    table: 'rulebooks',
    // 템플릿 헤더 (한글 표시명 → DB 필드명)
    columns: [
      { header: '제목(필수)',    key: 'title' },
      { header: '출판사',        key: 'publisher' },
      { header: '메모',          key: 'memo' },
      { header: '태그(쉼표구분)', key: 'tags' },
    ],
    // 중복 체크 기준 필드 (제목만)
    dupKeys: ['title'],
    // 행 → insert payload 변환
    rowToPayload: (row, userId) => ({
      user_id: userId,
      title: (row.title || '').trim(),
      publisher: (row.publisher || '').trim() || null,
      memo: (row.memo || '').trim() || null,
      tags: row.tags ? row.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      parent_id: null,
      color: '',
      cover_image_url: '',
    }),
    sample: [
      { '제목(필수)': '크툴루의 부름 7판', '출판사': '아크라이트', '메모': '주력 시스템', '태그(쉼표구분)': 'GM,주력' },
      { '제목(필수)': '던전즈&드래곤즈 플레이어즈 핸드북', '출판사': '', '메모': '', '태그(쉼표구분)': '' },
    ],
  },
  scenario: {
    label: '시나리오',
    table: 'scenarios',
    columns: [
      { header: '제목(필수)',        key: 'title' },
      { header: '시스템명',          key: 'system_name' },
      { header: '저자',              key: 'author' },
      { header: '형태',              key: 'format' },
      { header: '인원',              key: 'player_count' },
      { header: '상태태그(쉼표구분)', key: 'status_tags' },
      { header: '시나리오URL',       key: 'scenario_url' },
      { header: '메모',              key: 'memo' },
    ],
    dupKeys: ['title', 'system_name'],
    rowToPayload: (row, userId) => ({
      user_id: userId,
      title: (row.title || '').trim(),
      system_name: (row.system_name || '').trim() || null,
      author: (row.author || '').trim() || null,
      format: (row.format || '').trim() || null,
      player_count: (row.player_count || '').trim() || null,
      status_tags: row.status_tags ? row.status_tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      scenario_url: (row.scenario_url || '').trim() || null,
      memo: (row.memo || '').trim() || null,
      parent_id: null,
      purchase_date: null,
    }),
    sample: [
      { '제목(필수)': '가스등 속으로', '시스템명': 'CoC 7판', '저자': '홍길동', '형태': 'digital', '인원': '3~5', '상태태그(쉼표구분)': 'PL완료', '시나리오URL': '', '메모': '명작' },
      { '제목(필수)': '붉은 달', '시스템명': 'D&D 5e', '저자': '', '형태': '', '인원': '', '상태태그(쉼표구분)': '위시', '시나리오URL': '', '메모': '' },
    ],
  },
}

// ── 중복 키 만들기 ──────────────────────────────────────────────────────────
function dupKey(row, keys) {
  return keys.map(k => (row[k] || '').toLowerCase().trim()).join('||')
}

// ── 템플릿 CSV 다운로드 ──────────────────────────────────────────────────────
function downloadTemplate(type) {
  const cfg = CONFIG[type]
  const ws = XLSX.utils.json_to_sheet(cfg.sample, { header: cfg.columns.map(c => c.header) })
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, cfg.label)
  XLSX.writeFile(wb, `${cfg.label}_일괄등록_템플릿.xlsx`)
}

// ── 헤더 → key 매핑 ─────────────────────────────────────────────────────────
function mapHeaders(rawHeaders, columns) {
  // 한글 헤더 → key, 영문 key도 직접 허용
  const headerToKey = {}
  columns.forEach(c => {
    headerToKey[c.header.toLowerCase()] = c.key
    headerToKey[c.key.toLowerCase()] = c.key
  })
  return rawHeaders.map(h => headerToKey[(h || '').toLowerCase()] || null)
}

// ── 파일 파싱 ────────────────────────────────────────────────────────────────
async function parseFile(file, columns) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target.result)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        if (raw.length < 2) return resolve([])
        const headers = (raw[0] || []).map(String)
        const keyMap = mapHeaders(headers, columns)
        const rows = []
        for (let i = 1; i < raw.length; i++) {
          const cells = raw[i]
          // 모든 셀이 비어있으면 skip
          if (!cells.some(c => String(c).trim())) continue
          const row = {}
          keyMap.forEach((key, idx) => {
            if (key) row[key] = String(cells[idx] || '').trim()
          })
          rows.push(row)
        }
        resolve(rows)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export function BulkImportModal({ isOpen, onClose, type, existingItems = [], onSuccess }) {
  const { user, profile } = useAuth()
  const cfg = CONFIG[type]
  const fileRef = useRef()

  const [step, setStep] = useState('upload')   // 'upload' | 'preview' | 'done'
  const [parsed, setParsed] = useState([])      // 전체 파싱 결과
  const [toInsert, setToInsert] = useState([])  // 중복 제외 후 등록 예정
  const [dupCount, setDupCount] = useState(0)
  const [errCount, setErrCount] = useState(0)
  const [doneCount, setDoneCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [fileError, setFileError] = useState('')

  const isSponsor = profile?.membership_tier && profile.membership_tier !== 'free'

  const reset = () => {
    setStep('upload')
    setParsed([])
    setToInsert([])
    setDupCount(0)
    setErrCount(0)
    setDoneCount(0)
    setFileError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleClose = () => { reset(); onClose() }

  // 기존 데이터 중복 키 셋
  const existingKeys = new Set(
    existingItems.map(item => dupKey(item, cfg.dupKeys))
  )

  const handleFile = async e => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileError('')

    const ext = file.name.split('.').pop().toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      setFileError('.csv 또는 .xlsx 파일만 업로드할 수 있어요.')
      return
    }

    try {
      const rows = await parseFile(file, cfg.columns)
      // 제목 없는 행 = 형식 오류
      const valid = rows.filter(r => r.title)
      const errors = rows.length - valid.length

      // 중복 판별
      const newRows = []
      let dups = 0
      valid.forEach(row => {
        const k = dupKey(row, cfg.dupKeys)
        if (existingKeys.has(k)) { dups++; return }
        newRows.push(row)
      })

      setParsed(rows)
      setToInsert(newRows)
      setDupCount(dups)
      setErrCount(errors)
      setStep('preview')
    } catch {
      setFileError('파일을 읽을 수 없어요. 템플릿 형식을 확인해주세요.')
    }
  }

  const handleImport = async () => {
    if (!toInsert.length) return
    setLoading(true)
    const payloads = toInsert.map(row => cfg.rowToPayload(row, user.id))

    // 100건씩 배치 insert
    let count = 0
    const BATCH = 100
    for (let i = 0; i < payloads.length; i += BATCH) {
      const batch = payloads.slice(i, i + BATCH)
      const { error } = await supabase.from(cfg.table).insert(batch)
      if (!error) count += batch.length
    }

    setDoneCount(count)
    setLoading(false)
    setStep('done')
    onSuccess?.()
  }

  // ── 비후원자 안내 ──
  if (!isSponsor) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="일괄 등록">
        <div style={{ textAlign:'center', padding:'24px 0' }}>
          <Mi style={{ fontSize:40, color:'var(--color-primary)', marginBottom:12 }}>volunteer_activism</Mi>
          <div style={{ fontWeight:700, fontSize:'1rem', marginBottom:8 }}>후원자 전용 기능이에요</div>
          <div className="text-sm text-light" style={{ lineHeight:1.7 }}>
            일괄 등록은 ♥ 원하트 이상 후원자에게만 제공돼요.<br/>
            후원을 통해 더 많은 기능을 이용해보세요!
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`${cfg.label} 일괄 등록`}
      footer={
        step === 'upload' ? (
          <button className="btn btn-outline btn-sm" onClick={handleClose}>닫기</button>
        ) : step === 'preview' ? (
          <>
            <button className="btn btn-outline btn-sm" onClick={reset}>다시 선택</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleImport}
              disabled={loading || toInsert.length === 0}
            >
              {loading ? '등록 중...' : `${toInsert.length}건 등록하기`}
            </button>
          </>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={handleClose}>완료</button>
        )
      }
    >
      {/* ── STEP 1: 업로드 ── */}
      {step === 'upload' && (
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          {/* 템플릿 다운로드 */}
          <div style={{ background:'var(--color-nav-active-bg)', borderRadius:10, padding:'14px 16px' }}>
            <div style={{ fontWeight:600, fontSize:'0.88rem', marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
              <Mi size='sm' color='accent'>download</Mi>
              1단계 — 템플릿 다운로드
            </div>
            <p className="text-sm text-light" style={{ marginBottom:10, lineHeight:1.6 }}>
              아래 버튼으로 엑셀 템플릿을 받아 작성한 뒤 업로드하세요.<br/>
              Google 스프레드시트도 CSV로 내보내기 후 업로드 가능해요.
            </p>
            <button className="btn btn-outline btn-sm" onClick={() => downloadTemplate(type)}>
              <Mi size='sm'>table_view</Mi> {cfg.label} 템플릿 다운로드 (.xlsx)
            </button>
          </div>

          {/* 파일 업로드 */}
          <div>
            <div style={{ fontWeight:600, fontSize:'0.88rem', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}>
              <Mi size='sm' color='accent'>upload_file</Mi>
              2단계 — 파일 업로드
            </div>
            <label style={{
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
              gap:8, padding:'28px 20px', borderRadius:10, cursor:'pointer',
              border:'2px dashed var(--color-border)',
              background:'var(--color-nav-active-bg)',
              transition:'border-color 0.2s',
            }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) { fileRef.current.files = e.dataTransfer.files; handleFile({ target: { files: [f] } }) } }}
            >
              <Mi style={{ fontSize:32, color:'var(--color-text-light)' }}>upload</Mi>
              <span className="text-sm" style={{ fontWeight:500 }}>파일을 드래그하거나 클릭해서 선택</span>
              <span className="text-xs text-light">.csv · .xlsx · .xls 지원</span>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display:'none' }} onChange={handleFile}/>
            </label>
            {fileError && (
              <div style={{ marginTop:8, fontSize:'0.82rem', color:'#e57373', display:'flex', alignItems:'center', gap:4 }}>
                <Mi size='sm' style={{ color:'#e57373' }}>error</Mi>{fileError}
              </div>
            )}
          </div>

          {/* 필드 안내 */}
          <div style={{ fontSize:'0.78rem', color:'var(--color-text-light)', lineHeight:1.8 }}>
            <strong style={{ color:'var(--color-text)' }}>사용 가능한 컬럼:</strong><br/>
            {cfg.columns.map(c => `${c.header}`).join(' · ')}
          </div>
        </div>
      )}

      {/* ── STEP 2: 미리보기 ── */}
      {step === 'preview' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* 요약 카드 */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
            {[
              { label:'등록 예정', count: toInsert.length, color:'var(--color-accent)', icon:'check_circle' },
              { label:'중복 건너뜀', count: dupCount, color:'var(--color-primary)', icon:'skip_next' },
              { label:'형식 오류', count: errCount, color:'#e57373', icon:'cancel' },
            ].map(({ label, count, color, icon }) => (
              <div key={label} style={{ background:'var(--color-nav-active-bg)', borderRadius:10, padding:'12px 10px', textAlign:'center' }}>
                <Mi style={{ fontSize:20, color, marginBottom:4 }}>{icon}</Mi>
                <div style={{ fontSize:'1.3rem', fontWeight:700, color }}>{count}</div>
                <div className="text-xs text-light">{label}</div>
              </div>
            ))}
          </div>

          {toInsert.length === 0 ? (
            <div style={{ textAlign:'center', padding:'16px 0', color:'var(--color-text-light)', fontSize:'0.88rem' }}>
              {dupCount > 0 ? '모든 항목이 이미 등록되어 있어요.' : '등록할 수 있는 항목이 없어요. 파일 형식을 확인해주세요.'}
            </div>
          ) : (
            <>
              <div style={{ fontSize:'0.82rem', color:'var(--color-text-light)', fontWeight:600 }}>미리보기 (앞 5건)</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {toInsert.slice(0, 5).map((row, i) => (
                  <div key={i} style={{ background:'var(--color-nav-active-bg)', borderRadius:8, padding:'8px 12px', fontSize:'0.83rem' }}>
                    <span style={{ fontWeight:600 }}>{row.title}</span>
                    {row.system_name && <span className="text-xs text-light" style={{ marginLeft:8 }}>{row.system_name}</span>}
                    {(row.author) && <span className="text-xs text-light" style={{ marginLeft:8 }}>{row.author}</span>}
                  </div>
                ))}
                {toInsert.length > 5 && (
                  <div className="text-xs text-light" style={{ textAlign:'center', paddingTop:4 }}>
                    외 {toInsert.length - 5}건 더...
                  </div>
                )}
              </div>
            </>
          )}

          {dupCount > 0 && (
            <div style={{ fontSize:'0.78rem', color:'var(--color-text-light)', background:'var(--color-nav-active-bg)', borderRadius:8, padding:'8px 12px', lineHeight:1.6 }}>
              ℹ️ 중복 기준: {type === 'rulebook' ? '제목이 동일한 경우' : '제목 + 시스템명이 동일한 경우'} 건너뜁니다.
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: 완료 ── */}
      {step === 'done' && (
        <div style={{ textAlign:'center', padding:'24px 0' }}>
          <Mi style={{ fontSize:44, color:'var(--color-accent)', marginBottom:12 }}>check_circle</Mi>
          <div style={{ fontWeight:700, fontSize:'1.1rem', marginBottom:8 }}>
            {doneCount}건이 등록되었어요!
          </div>
          {dupCount > 0 && (
            <div className="text-sm text-light">{dupCount}건은 중복으로 건너뛰었어요.</div>
          )}
        </div>
      )}
    </Modal>
  )
}
