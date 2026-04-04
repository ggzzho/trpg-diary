// src/pages/PrivacyPage.js
import React from 'react'
import { Link } from 'react-router-dom'
import { Mi } from '../components/Mi'

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth:720, margin:'0 auto', padding:'40px 24px 80px' }}>

      {/* 뒤로가기 */}
      <Link to="/" style={{ display:'inline-flex', alignItems:'center', gap:6,
        color:'var(--color-text-light)', fontSize:'0.82rem', textDecoration:'none', marginBottom:32 }}>
        <Mi size="sm" color="light">arrow_back</Mi> 돌아가기
      </Link>

      <h1 style={{ fontSize:'1.5rem', fontWeight:700, color:'var(--color-accent)',
        marginBottom:8, display:'flex', alignItems:'center', gap:10 }}>
        <Mi>shield</Mi> 개인정보 처리방침
      </h1>
      <p style={{ fontSize:'0.82rem', color:'var(--color-text-light)', marginBottom:40 }}>
        최종 수정일: 2026년 4월
      </p>

      {[
        {
          title: '1. 수집하는 개인정보 항목',
          content: (
            <>
              <p>TRPG Diary는 서비스 제공을 위해 아래와 같은 개인정보를 수집합니다.</p>
              <ul>
                <li><strong>필수:</strong> 이메일 주소, 사용자명(아이디)</li>
                <li><strong>선택:</strong> 닉네임, 프로필 이미지, 자기소개, 헤더 이미지</li>
                <li><strong>서비스 이용 중 생성:</strong> 일정, 룰북, 다녀온 기록, 시나리오, 페어, 방명록 등 이용자가 직접 입력한 콘텐츠</li>
                <li><strong>문의/피드백 시:</strong> 이메일 주소 (선택 입력)</li>
              </ul>
            </>
          )
        },
        {
          title: '2. 개인정보 수집 및 이용 목적',
          content: (
            <ul>
              <li>회원 식별 및 서비스 제공</li>
              <li>공개 프로필 페이지 운영</li>
              <li>방명록·문의 기능 제공</li>
              <li>서비스 오류 확인 및 개선</li>
            </ul>
          )
        },
        {
          title: '3. 개인정보 보유 및 이용 기간',
          content: (
            <ul>
              <li>회원 탈퇴 시까지 보유 후 즉시 삭제</li>
              <li>단, 관련 법령에 의해 보존이 필요한 경우 해당 기간 동안 보관</li>
            </ul>
          )
        },
        {
          title: '4. 개인정보의 제3자 제공',
          content: (
            <p>TRPG Diary는 이용자의 개인정보를 제3자에게 제공하지 않습니다.<br/>
            단, 이용자가 직접 공개 설정한 프로필 정보는 다른 이용자에게 공개될 수 있습니다.</p>
          )
        },
        {
          title: '5. 개인정보 처리 위탁',
          content: (
            <>
              <p>원활한 서비스 제공을 위해 아래 업체에 일부 업무를 위탁합니다.</p>
              <ul>
                <li><strong>Supabase Inc.</strong> — 데이터베이스 및 인증 서비스 (미국)</li>
                <li><strong>Vercel Inc.</strong> — 웹 호스팅 서비스 (미국)</li>
              </ul>
              <p style={{ marginTop:8 }}>위탁 업체들은 서비스 제공 목적 외 개인정보를 이용하지 않습니다.</p>
            </>
          )
        },
        {
          title: '6. 이용자의 권리',
          content: (
            <ul>
              <li>개인정보 열람, 수정, 삭제 요청 가능</li>
              <li>환경설정 페이지에서 직접 수정 가능</li>
              <li>탈퇴 요청 시 모든 개인정보 삭제 처리</li>
              <li>문의: 사이트 내 문의/피드백 탭 또는 관리자에게 직접 연락</li>
            </ul>
          )
        },
        {
          title: '7. 쿠키 및 자동 수집 정보',
          content: (
            <p>로그인 상태 유지를 위해 브라우저의 로컬 스토리지를 사용합니다.
            별도의 광고 쿠키나 추적 스크립트는 사용하지 않습니다.</p>
          )
        },
        {
          title: '8. 개인정보 보호책임자',
          content: (
            <ul>
              <li><strong>운영자:</strong> 젯 관장 (trpg00_Z)</li>
              <li><strong>문의:</strong> 사이트 내 문의/피드백 탭</li>
            </ul>
          )
        },
        {
          title: '9. 방침 변경',
          content: (
            <p>개인정보 처리방침이 변경될 경우 사이트 내 공지를 통해 안내합니다.</p>
          )
        },
      ].map((section, i) => (
        <div key={i} style={{
          marginBottom:32, paddingBottom:32,
          borderBottom: i < 8 ? '1px solid var(--color-border)' : 'none'
        }}>
          <h2 style={{ fontSize:'1rem', fontWeight:700, color:'var(--color-text)',
            marginBottom:12 }}>{section.title}</h2>
          <div style={{ fontSize:'0.88rem', color:'var(--color-text-light)', lineHeight:1.8 }}>
            {section.content}
          </div>
        </div>
      ))}

      <div style={{ marginTop:40, padding:'16px 20px', borderRadius:10,
        background:'rgba(200,169,110,0.06)', border:'1px solid var(--color-border)',
        fontSize:'0.8rem', color:'var(--color-text-light)', textAlign:'center' }}>
        본 방침은 2026년 4월부터 적용됩니다.<br/>
        문의사항은 사이트 내{' '}
        <a href="/u/trpg00_Z?tab=feedback"
          style={{ color:'var(--color-accent)', textDecoration:'none', fontWeight:600 }}>
          문의/피드백
        </a>
        {' '}탭을 이용해주세요.
      </div>
    </div>
  )
}
