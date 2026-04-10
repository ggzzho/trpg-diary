// src/pages/AdminNoticePage.js
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { Mi } from '../components/Mi'
import { ConfirmDialog } from '../components/Layout'

// ── 간단한 마크다운 렌더러 ──
export function MarkdownRenderer({ content, style }) {
  if (!content) return null

  // XSS sanitize - 위험한 태그/속성 제거
  const sanitize = (str) => str
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')  // onclick, onerror 등
    .replace(/javascript\s*:/gi, '')
    .replace(/data\s*:/gi, '')

  const html = sanitize(content)
    // 이미지
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:8px;margin:8px 0;display:block;"/>')
    // 굵게
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // 기울임
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // h1
    .replace(/^# (.+)$/gm, '<h1 style="font-size:1.3rem;font-weight:700;margin:12px 0 6px;">$1</h1>')
    // h2
    .replace(/^## (.+)$/gm, '<h2 style="font-size:1.1rem;font-weight:700;margin:10px 0 5px;">$1</h2>')
    // h3
    .replace(/^### (.+)$/gm, '<h3 style="font-size:1rem;font-weight:700;margin:8px 0 4px;">$1</h3>')
    // 가로줄
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--color-border);margin:12px 0;"/>')
    // 목록
    .replace(/^- (.+)$/gm, '<li style="margin:3px 0;padding-left:4px;">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul style="padding-left:20px;margin:6px 0;">$&</ul>')
    // 링크
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer noopener" style="color:var(--color-primary);text-decoration:underline;">$1</a>')
    // 줄바꿈
    .replace(/\n/g, '<br/>')

  return (
    <div
      style={{ fontSize:'0.88rem', lineHeight:1.8, color:'var(--color-text-light)', ...style }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

const BLANK = { title:'', content:'', is_popup:false, is_active:true }

const MARKDOWN_GUIDE = `**굵게** / *기울임*
# 제목1 / ## 제목2
- 목록 항목
[링크텍스트](URL)
![이미지설명](이미지URL)
---  (구분선)`

export default function AdminNoticePage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [preview, setPreview] = useState(false)

  useEffect(() => {
    if (profile && !profile.is_admin) navigate('/dashboard')
  }, [profile])

  const load = async () => {
    const { data } = await supabase.from('notices').select('*').order('created_at', { ascending: false })
    setNotices(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setForm(BLANK); setPreview(false); setModal(true) }
  const openEdit = (n) => { setEditing(n); setForm({ title:n.title, content:n.content, is_popup:n.is_popup, is_active:n.is_active }); setPreview(false); setModal(true) }

  const save = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    if (editing) {
      await supabase.from('notices').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editing.id)
    } else {
      await supabase.from('notices').insert(form)
    }
    setSaving(false); setModal(false); load()
  }

  const remove = async (id) => {
    await supabase.from('notices').delete().eq('id', id)
    load()
  }

  const toggleActive = async (n) => {
    await supabase.from('notices').update({ is_active: !n.is_active }).eq('id', n.id)
    load()
  }

  const set = k => e => setForm(f => ({...f, [k]: e.target.value}))

  return (
    <div className="fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title">
            <Mi style={{marginRight:8, verticalAlign:'middle'}}>campaign</Mi>공지사항 관리
          </h1>
          <p className="page-subtitle">회원에게 전달할 공지와 팝업을 등록해요</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>
          <Mi size="sm" color="white">add</Mi> 공지 등록
        </button>
      </div>

      {loading
        ? <div className="text-sm text-light" style={{textAlign:'center',padding:40}}>불러오는 중...</div>
        : notices.length === 0
          ? <div className="card" style={{textAlign:'center',padding:40,color:'var(--color-text-light)'}}>
              등록된 공지가 없어요
            </div>
          : <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {notices.map(n => (
                <div key={n.id} className="card" style={{padding:'14px 18px'}}>
                  <div className="flex justify-between items-center">
                    <div style={{display:'flex',alignItems:'center',gap:10,flex:1,minWidth:0}}>
                      {n.is_popup && (
                        <span className="badge badge-primary" style={{fontSize:'0.65rem',flexShrink:0}}>
                          <Mi size="sm" color="white">notifications</Mi> 팝업
                        </span>
                      )}
                      <span style={{fontWeight:600,fontSize:'0.9rem',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {n.title}
                      </span>
                      <span className={`badge ${n.is_active?'badge-green':'badge-gray'}`} style={{fontSize:'0.65rem',flexShrink:0}}>
                        {n.is_active?'활성':'비활성'}
                      </span>
                    </div>
                    <div style={{display:'flex',gap:6,flexShrink:0,marginLeft:12}}>
                      <button className="btn btn-ghost btn-sm" style={{fontSize:'0.75rem',color:n.is_active?'#e57373':'var(--color-accent)'}}
                        onClick={()=>toggleActive(n)}>
                        {n.is_active?'비활성':'활성'}
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(n)}>수정</button>
                      <button className="btn btn-ghost btn-sm" style={{color:'#e57373'}} onClick={()=>setConfirm(n.id)}>삭제</button>
                    </div>
                  </div>
                  <div className="text-xs text-light" style={{marginTop:6}}>
                    {new Date(n.created_at).toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'})}
                    {n.content && <span style={{marginLeft:8}}>{n.content.slice(0,60)}{n.content.length>60?'...':''}</span>}
                  </div>
                </div>
              ))}
            </div>
      }

      {/* 등록/수정 모달 */}
      {modal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',zIndex:9000,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div style={{background:'var(--color-surface)',borderRadius:16,padding:28,width:'100%',maxWidth:640,maxHeight:'90vh',overflowY:'auto',border:'1px solid var(--color-border)'}}>
            <h3 style={{fontWeight:700,marginBottom:20,fontSize:'1rem'}}>{editing?'공지 수정':'공지 등록'}</h3>

            <div className="form-group">
              <label className="form-label">제목 *</label>
              <input className="form-input" value={form.title} onChange={set('title')} placeholder="공지 제목을 입력해주세요"/>
            </div>

            {/* 에디터 / 미리보기 탭 */}
            <div className="form-group">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <label className="form-label" style={{margin:0}}>내용 (마크다운)</label>
                <button className="btn btn-ghost btn-sm" style={{fontSize:'0.75rem'}}
                  onClick={()=>setPreview(v=>!v)}>
                  <Mi size="sm">{preview?'edit':'visibility'}</Mi>
                  {preview?'편집':'미리보기'}
                </button>
              </div>
              {preview
                ? <div style={{minHeight:200,padding:'12px 14px',borderRadius:8,border:'1px solid var(--color-border)',background:'var(--color-nav-active-bg)'}}>
                    <MarkdownRenderer content={form.content}/>
                  </div>
                : <textarea className="form-textarea" value={form.content} onChange={set('content')}
                    placeholder="내용을 입력해주세요&#10;&#10;마크다운 문법을 지원해요"
                    style={{minHeight:200,fontFamily:'monospace',fontSize:'0.84rem'}}/>
              }
              {/* 마크다운 가이드 */}
              <div style={{marginTop:6,padding:'8px 12px',borderRadius:6,background:'rgba(200,169,110,0.06)',border:'1px solid var(--color-border)',fontSize:'0.72rem',color:'var(--color-text-light)',whiteSpace:'pre-line'}}>
                💡 마크다운 문법{'\n'}{MARKDOWN_GUIDE}
              </div>
            </div>

            {/* 옵션 */}
            <div style={{display:'flex',gap:20,marginBottom:20}}>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:'0.85rem'}}>
                <input type="checkbox" checked={form.is_popup} onChange={e=>setForm(f=>({...f,is_popup:e.target.checked}))}/>
                <Mi size="sm" color="accent">notifications</Mi>
                팝업으로 표시
                <span style={{fontSize:'0.72rem',color:'var(--color-text-light)'}}>(로그인 시 자동 팝업)</span>
              </label>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:'0.85rem'}}>
                <input type="checkbox" checked={form.is_active} onChange={e=>setForm(f=>({...f,is_active:e.target.checked}))}/>
                활성화
              </label>
            </div>

            <div className="flex justify-end gap-8">
              <button className="btn btn-outline btn-sm" onClick={()=>setModal(false)}>취소</button>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={saving||!form.title.trim()}>
                {saving?'저장 중...':'저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={!!confirm} onClose={()=>setConfirm(null)}
        onConfirm={()=>remove(confirm)} message="이 공지를 삭제하시겠어요?"/>
    </div>
  )
}
