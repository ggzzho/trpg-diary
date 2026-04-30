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
        최종 수정일: 2026년 5월 (v1.3 — 후원·멤버십 정책 추가)
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
                <li><strong>서비스 이용 중 생성 (후원 관련):</strong> 후원 등급, 등급 변경 이력, 최초 유료 서비스 이용 시작일</li>
                <li><strong>문의하기 게시판 이용 시:</strong> 이메일 주소 (선택 입력)</li>
                <li><strong>후원 신청 시 (구글폼):</strong> 가입 이메일, 사용자 이름 URL, 후원 등급 선택, 포스타입 닉네임, 동의 여부</li>
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
              <li>후원 신청자 등급 부여 및 관리</li>
              <li>후원 만료 후 데이터 한도 조정</li>
              <li>서비스 관련 공지 발송 (알림 기능)</li>
            </ul>
          )
        },
        {
          title: '3. 개인정보 보유 및 이용 기간',
          content: (
            <ul>
              <li>회원 탈퇴 시 계정 및 모든 개인 데이터(일정, 룰북, 기록, 시나리오, 페어, 공수표, 북마크 등)는 즉시 영구 삭제되며 복구할 수 없습니다.</li>
              <li>단, 타인의 페이지에 남긴 방명록·문의 글은 해당 페이지 소유자의 콘텐츠로 간주되어 삭제되지 않을 수 있습니다.</li>
              <li>탈퇴한 이메일은 탈퇴 후 24시간 동안 재가입이 제한됩니다.</li>
              <li>탈퇴 후 재가입 시, 탈퇴 전 타인의 페이지에 남긴 글은 새 계정과 연결되지 않습니다.</li>
              <li>관련 법령에 의해 보존이 필요한 경우 해당 기간 동안 보관합니다.</li>
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
                <li><strong>포스타입(Postype)</strong> — 후원 결제 처리 (대한민국)</li>
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
              <li>문의: 사이트 내 '문의하기' 게시판 또는 관리자에게 직접 연락</li>
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
              <li><strong>문의:</strong> 사이트 내 '문의하기' 게시판</li>
            </ul>
          )
        },
        {
          title: '9. 방침 변경',
          content: (
            <p>개인정보 처리방침이 변경될 경우 사이트 내 공지를 통해 안내합니다.</p>
          )
        },
        {
          title: '10. 월 정기 후원(유료 서비스) 및 결제·환불 정책',
          content: (
            <>
              <p style={{ marginBottom:10 }}>TRPG Diary는 포스타입(Postype) 플랫폼을 통한 월 정기 후원 방식으로 유료 서비스를 운영합니다.</p>
              <p style={{ fontWeight:600, marginBottom:4 }}>① 후원 방식</p>
              <ul style={{ marginBottom:12 }}>
                <li>결제는 포스타입(Postype) 플랫폼을 통해 진행되며, TRPG Diary는 신용카드 번호 등 민감한 금융 정보를 직접 수집하지 않습니다.</li>
              </ul>
              <p style={{ fontWeight:600, marginBottom:4 }}>② 등급 반영 절차</p>
              <ul style={{ marginBottom:12 }}>
                <li>후원 완료 후 구글폼으로 신청하시면 24시간 이내 수동으로 등급이 반영됩니다.</li>
                <li>이후 30일 단위로 반자동 갱신되며, 후원이 중단될 경우 만료일 이후 일반 등급으로 전환됩니다.</li>
              </ul>
              <p style={{ fontWeight:600, marginBottom:4 }}>③ 환불 정책</p>
              <ul style={{ marginBottom:12 }}>
                <li>후원 후 7일 이내, 등급 혜택을 사용하지 않은 경우 전액 환불이 가능합니다.</li>
                <li>등급 혜택(추가 저장 공간 등)을 사용한 경우 환불이 불가합니다.</li>
                <li>중도 해지 시 잔여 기간에 대한 일할 환불은 제공되지 않습니다.</li>
                <li>환불 요청: 사이트 내 '문의하기' 게시판으로 연락해 주세요.</li>
              </ul>
              <p style={{ fontWeight:600, marginBottom:4 }}>④ 후원 만료 시 데이터 처리</p>
              <ul>
                <li>후원 만료 후 30일 이내 재후원이 없을 경우, 각 게시판 저장 한도가 일반 한도(1,000개)로 조정됩니다.</li>
                <li>한도를 초과한 데이터는 목록에서 숨겨지지만, 데이터베이스에는 보관됩니다.</li>
                <li>재후원 시 숨겨진 데이터는 자동으로 복원됩니다.</li>
              </ul>
            </>
          )
        },
      ].map((section, i) => (
        <div key={i} style={{
          marginBottom:32, paddingBottom:32,
          borderBottom: i < 9 ? '1px solid var(--color-border)' : 'none'
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
        본 방침은 2026년 5월부터 적용됩니다.<br/>
        문의사항은 사이트 내{' '}
        <a href="/u/trpg00_Z?tab=feedback"
          style={{ color:'var(--color-accent)', textDecoration:'none', fontWeight:600 }}>
          문의하기
        </a>
        {' '}게시판을 이용해주세요.
      </div>
    </div>
  )
}
