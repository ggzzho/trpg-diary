# ✦ TRPG Diary

나만의 TRPG 다이어리 웹앱입니다.  
일정 관리, 공수표, 플레이 기록, 룰북/시나리오 목록, 페어, 방명록을 한곳에서 관리하고 링크로 공유할 수 있어요.

---

## 📦 기술 스택

| 역할 | 기술 |
|------|------|
| 프론트엔드 | React 18 + React Router v6 |
| 백엔드 / DB | Supabase (PostgreSQL + Auth + Storage) |
| 스타일 | 순수 CSS (아늑한 다이어리 감성) |
| 배포 | Vercel / Netlify (무료) |

---

## 🚀 시작하기

### 1단계 — Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com) 접속 → 무료 계정 생성
2. **New Project** 클릭 → 프로젝트 이름, 비밀번호, 리전(Northeast Asia 권장) 설정
3. 프로젝트 생성 완료까지 약 1분 대기

### 2단계 — 데이터베이스 스키마 적용

1. Supabase 대시보드 → **SQL Editor** 탭 클릭
2. `supabase_schema.sql` 파일 전체 내용을 붙여넣기
3. **Run** 버튼 클릭 (오류 없이 실행되면 OK)

### 3단계 — Storage 버킷 생성

Supabase 대시보드 → **Storage** 탭에서 아래 버킷을 생성하세요.  
(각 버킷 생성 시 **Public bucket** 옵션을 켜세요)

| 버킷 이름 | 용도 |
|-----------|------|
| `avatars` | 프로필 사진 |
| `backgrounds` | 배경 이미지 |
| `covers` | 룰북/시나리오 표지 이미지 |
| `play-images` | 플레이 사진 |

### 4단계 — 환경변수 설정

```bash
# 프로젝트 폴더에서
cp .env.example .env
```

`.env` 파일을 열고 Supabase 정보를 입력하세요.  
Supabase 대시보드 → **Project Settings** → **API** 탭에서 확인:

```env
REACT_APP_SUPABASE_URL=https://abcdefghijklmn.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 5단계 — 로컬 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm start
# → http://localhost:3000 에서 확인
```

---

## 🌐 배포하기

### Vercel로 배포 (추천 · 무료)

1. [vercel.com](https://vercel.com) 가입 → GitHub 연동
2. 프로젝트를 GitHub에 push
3. Vercel에서 **New Project** → GitHub 저장소 선택
4. **Environment Variables** 섹션에서 `.env`의 변수 2개 추가:
   - `REACT_APP_SUPABASE_URL`
   - `REACT_APP_SUPABASE_ANON_KEY`
5. **Deploy** 클릭 → 약 2분 후 배포 완료

배포 후 도메인(예: `your-app.vercel.app`)을 Supabase에 등록해야 해요:  
Supabase → **Authentication** → **URL Configuration** → **Site URL** 에 배포 URL 추가

### Netlify로 배포 (대안)

```bash
npm run build
# build/ 폴더를 Netlify에 드래그앤드롭으로 업로드
```

---

## 📁 프로젝트 구조

```
trpg-diary/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   └── Layout.js          # 사이드바, 모달, 공통 컴포넌트
│   ├── context/
│   │   ├── AuthContext.js      # 로그인 상태 전역 관리
│   │   └── ThemeContext.js     # 테마 색상 전역 관리
│   ├── lib/
│   │   └── supabase.js         # Supabase 클라이언트 + API 헬퍼
│   ├── pages/
│   │   ├── AuthPage.js         # 로그인 / 회원가입
│   │   ├── Dashboard.js        # 홈 대시보드
│   │   ├── SchedulePage.js     # 일정 관리
│   │   ├── AvailabilityPage.js # 공수표 리스트
│   │   ├── PlayLogPage.js      # 다녀온 기록
│   │   ├── RulebookPage.js     # 보유 룰북
│   │   ├── ScenarioPage.js     # 보유 시나리오
│   │   ├── PairsPage.js        # 페어 목록
│   │   ├── GuestbookPage.js    # 방명록
│   │   ├── SettingsPage.js     # 환경설정 (테마, 프로필)
│   │   └── PublicProfilePage.js # 공개 프로필 (/u/username)
│   ├── App.js                  # 라우터
│   ├── index.js                # 진입점
│   └── index.css               # 전역 스타일
├── supabase_schema.sql          # DB 스키마 (Supabase에서 실행)
├── .env.example                 # 환경변수 예시
└── package.json
```

---

## ✨ 주요 기능

### 🔐 인증
- 이메일/비밀번호 회원가입 및 로그인
- 회원가입 시 이메일 인증 (Supabase 기본 제공)
- 사용자명(@username) 기반 공개 URL

### 📅 일정 관리
- 예정/확정/완료/취소 상태 관리
- PL/GM 역할 구분
- 날짜별 정렬, 필터링

### 📋 공수표 리스트
- 원하는 요일/시간대 공개
- 역할(PL/GM/둘 다) 설정
- 활성/비활성 전환

### 📖 다녀온 기록
- 플레이 날짜, 시스템, 시나리오명, 캐릭터 기록
- 5점 별점 평가
- 플레이 소감 메모

### 📚 보유 룰북 / 🗺️ 보유 시나리오
- 표지 이미지 URL 등록
- 형태(실물/전자) 구분
- 시나리오 플레이 상태 추적 (미플/PL완료/GM완료/위시)

### 👥 페어 목록
- 아바타 색상 커스터마이징
- 함께한 시스템, 만남 날짜 기록
- 플레이 횟수 집계

### 💌 방명록
- 비밀 방명록 지원
- 소유자/작성자만 삭제 가능

### ⚙️ 환경설정
- 6가지 프리셋 테마
- 메인/배경/강조 컬러 자유 설정
- 배경 이미지 URL 또는 파일 업로드
- 프로필 사진 업로드
- 공개/비공개 전환

### 🔗 공개 프로필
- `/u/username` 형태의 공유 가능한 URL
- 방문자도 방명록 작성 가능
- 본인의 테마 색상이 그대로 적용됨

---

## 🛡️ 보안 (RLS)

모든 테이블에 **Row Level Security**가 적용되어 있어요:
- 본인 데이터만 수정/삭제 가능
- 공개 프로필로 설정한 경우에만 타인이 조회 가능
- 비밀 방명록은 작성자와 소유자만 열람 가능

---

## 🐛 자주 발생하는 문제

### 로그인 후 프로필이 없다고 나와요
→ `supabase_schema.sql`의 트리거가 실행됐는지 확인해주세요.  
SQL Editor에서 `SELECT * FROM public.profiles;` 로 확인 가능해요.

### 이미지 업로드가 안 돼요
→ Storage 버킷이 **Public**으로 설정됐는지 확인해주세요.  
Supabase → Storage → 버킷 설정 → Public 체크

### 배포 후 로그인이 안 돼요
→ Supabase → Authentication → URL Configuration에  
배포된 도메인(`https://your-app.vercel.app`)을 추가해주세요.

---

## 📝 라이선스

개인 사용 자유. 상업적 사용 시 문의해주세요.
