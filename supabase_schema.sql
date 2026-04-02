-- ============================================================
-- TRPG Diary - Supabase SQL Schema
-- Supabase 대시보드 > SQL Editor 에서 실행하세요
-- ============================================================

-- 1. 사용자 프로필 (auth.users 와 연결)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  -- 테마 설정
  theme_color TEXT DEFAULT '#c8a96e',
  theme_bg_color TEXT DEFAULT '#faf6f0',
  theme_accent TEXT DEFAULT '#8b6f47',
  background_image_url TEXT,
  font_style TEXT DEFAULT 'serif',
  -- 공개 설정
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 일정 관리
CREATE TABLE IF NOT EXISTS public.schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  location TEXT,
  system_name TEXT,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'confirmed', 'completed', 'cancelled')),
  is_gm BOOLEAN DEFAULT false,
  color TEXT DEFAULT '#c8a96e',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 공수표 (빈자리/모집 리스트)
CREATE TABLE IF NOT EXISTS public.availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  role TEXT CHECK (role IN ('PL', 'GM', 'both')) DEFAULT 'PL',
  system_name TEXT,
  preferred_days TEXT[],
  preferred_time TEXT,
  description TEXT,
  contact TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 다녀온 기록 (플레이 로그)
CREATE TABLE IF NOT EXISTS public.play_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  played_date DATE NOT NULL,
  system_name TEXT,
  scenario_name TEXT,
  role TEXT CHECK (role IN ('PL', 'GM')) DEFAULT 'PL',
  character_name TEXT,
  gm_name TEXT,
  venue TEXT,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  memo TEXT,
  image_urls TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. 보유 룰북
CREATE TABLE IF NOT EXISTS public.rulebooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  system_name TEXT,
  publisher TEXT,
  edition TEXT,
  cover_image_url TEXT,
  purchase_date DATE,
  format TEXT CHECK (format IN ('physical', 'digital', 'both')) DEFAULT 'physical',
  condition TEXT DEFAULT 'good',
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. 보유 시나리오
CREATE TABLE IF NOT EXISTS public.scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  system_name TEXT,
  author TEXT,
  publisher TEXT,
  cover_image_url TEXT,
  player_count TEXT,
  estimated_time TEXT,
  difficulty TEXT CHECK (difficulty IN ('beginner', 'intermediate', 'advanced', 'expert')),
  format TEXT CHECK (format IN ('physical', 'digital', 'both')) DEFAULT 'physical',
  status TEXT CHECK (status IN ('unplayed', 'played', 'gm_done', 'want')) DEFAULT 'unplayed',
  memo TEXT,
  purchase_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 페어 목록 (같이 플레이한 사람들)
CREATE TABLE IF NOT EXISTS public.pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nickname TEXT,
  contact TEXT,
  first_met_date DATE,
  systems TEXT[],
  memo TEXT,
  relation TEXT CHECK (relation IN ('PL', 'GM', 'both')) DEFAULT 'both',
  play_count INTEGER DEFAULT 0,
  avatar_color TEXT DEFAULT '#c8a96e',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 방명록
CREATE TABLE IF NOT EXISTS public.guestbook (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RLS (Row Level Security) 정책
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.play_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rulebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guestbook ENABLE ROW LEVEL SECURITY;

-- profiles: 본인만 수정, 공개 프로필은 누구나 조회
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (is_public = true OR auth.uid() = id);
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 나머지 테이블: 본인만 CRUD, 조회는 프로필 공개 여부 따름
CREATE POLICY "schedules_own" ON public.schedules FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "schedules_public_read" ON public.schedules FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND is_public = true)
);

CREATE POLICY "availability_own" ON public.availability FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "availability_public_read" ON public.availability FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND is_public = true)
);

CREATE POLICY "play_logs_own" ON public.play_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "play_logs_public_read" ON public.play_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND is_public = true)
);

CREATE POLICY "rulebooks_own" ON public.rulebooks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "rulebooks_public_read" ON public.rulebooks FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND is_public = true)
);

CREATE POLICY "scenarios_own" ON public.scenarios FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "scenarios_public_read" ON public.scenarios FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND is_public = true)
);

CREATE POLICY "pairs_own" ON public.pairs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "pairs_public_read" ON public.pairs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND is_public = true)
);

-- 방명록: 비밀글은 작성자+소유자만, 일반 글은 누구나
CREATE POLICY "guestbook_select" ON public.guestbook FOR SELECT USING (
  is_private = false OR auth.uid() = owner_id OR auth.uid() = author_id
);
CREATE POLICY "guestbook_insert" ON public.guestbook FOR INSERT WITH CHECK (true);
CREATE POLICY "guestbook_delete" ON public.guestbook FOR DELETE USING (auth.uid() = owner_id OR auth.uid() = author_id);

-- ============================================================
-- Storage Buckets (Supabase 대시보드 > Storage 에서 생성하거나 아래 실행)
-- ============================================================

-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('backgrounds', 'backgrounds', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('covers', 'covers', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('play-images', 'play-images', true);

-- ============================================================
-- 트리거: 회원가입 시 프로필 자동 생성
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', '새로운 모험가')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
