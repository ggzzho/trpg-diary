-- TRPG Diary RLS 공개 페이지 수정
-- 다른 사람의 공개 페이지에서 데이터가 안 보이는 문제 해결
-- Supabase SQL Editor > 새 탭 > 붙여넣기 > Run

-- 기존 정책 삭제 후 재생성 (공개 프로필 사용자의 데이터는 누구나 읽기 가능)
DROP POLICY IF EXISTS "schedules_policy" ON public.schedules;
DROP POLICY IF EXISTS "availability_policy" ON public.availability;
DROP POLICY IF EXISTS "play_logs_policy" ON public.play_logs;
DROP POLICY IF EXISTS "rulebooks_policy" ON public.rulebooks;
DROP POLICY IF EXISTS "scenarios_policy" ON public.scenarios;
DROP POLICY IF EXISTS "pairs_policy" ON public.pairs;
DROP POLICY IF EXISTS "rule_systems_policy" ON public.rule_systems;

-- 본인은 전체, 공개 프로필 사용자의 데이터는 누구나 읽기
CREATE POLICY "schedules_select" ON public.schedules FOR SELECT
  USING (auth.uid()=user_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id=user_id AND is_public=true));
CREATE POLICY "schedules_insert" ON public.schedules FOR INSERT WITH CHECK (auth.uid()=user_id);
CREATE POLICY "schedules_update" ON public.schedules FOR UPDATE USING (auth.uid()=user_id);
CREATE POLICY "schedules_delete" ON public.schedules FOR DELETE USING (auth.uid()=user_id);

CREATE POLICY "availability_select" ON public.availability FOR SELECT
  USING (auth.uid()=user_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id=user_id AND is_public=true));
CREATE POLICY "availability_insert" ON public.availability FOR INSERT WITH CHECK (auth.uid()=user_id);
CREATE POLICY "availability_update" ON public.availability FOR UPDATE USING (auth.uid()=user_id);
CREATE POLICY "availability_delete" ON public.availability FOR DELETE USING (auth.uid()=user_id);

CREATE POLICY "play_logs_select" ON public.play_logs FOR SELECT
  USING (auth.uid()=user_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id=user_id AND is_public=true));
CREATE POLICY "play_logs_insert" ON public.play_logs FOR INSERT WITH CHECK (auth.uid()=user_id);
CREATE POLICY "play_logs_update" ON public.play_logs FOR UPDATE USING (auth.uid()=user_id);
CREATE POLICY "play_logs_delete" ON public.play_logs FOR DELETE USING (auth.uid()=user_id);

CREATE POLICY "rulebooks_select" ON public.rulebooks FOR SELECT
  USING (auth.uid()=user_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id=user_id AND is_public=true));
CREATE POLICY "rulebooks_insert" ON public.rulebooks FOR INSERT WITH CHECK (auth.uid()=user_id);
CREATE POLICY "rulebooks_update" ON public.rulebooks FOR UPDATE USING (auth.uid()=user_id);
CREATE POLICY "rulebooks_delete" ON public.rulebooks FOR DELETE USING (auth.uid()=user_id);

CREATE POLICY "scenarios_select" ON public.scenarios FOR SELECT
  USING (auth.uid()=user_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id=user_id AND is_public=true));
CREATE POLICY "scenarios_insert" ON public.scenarios FOR INSERT WITH CHECK (auth.uid()=user_id);
CREATE POLICY "scenarios_update" ON public.scenarios FOR UPDATE USING (auth.uid()=user_id);
CREATE POLICY "scenarios_delete" ON public.scenarios FOR DELETE USING (auth.uid()=user_id);

CREATE POLICY "pairs_select" ON public.pairs FOR SELECT
  USING (auth.uid()=user_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id=user_id AND is_public=true));
CREATE POLICY "pairs_insert" ON public.pairs FOR INSERT WITH CHECK (auth.uid()=user_id);
CREATE POLICY "pairs_update" ON public.pairs FOR UPDATE USING (auth.uid()=user_id);
CREATE POLICY "pairs_delete" ON public.pairs FOR DELETE USING (auth.uid()=user_id);

CREATE POLICY "rule_systems_policy" ON public.rule_systems FOR ALL USING (auth.uid()=user_id);

SELECT 'RLS 공개 페이지 수정 완료! ✅' as result;
