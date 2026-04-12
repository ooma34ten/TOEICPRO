-- =============================================
-- 不要テーブルの削除
-- Supabase SQL Editor で実行してください
-- =============================================

-- 1. FK制約の削除（他テーブルの参照を解除）
ALTER TABLE public.ai_generated_questions_queue 
  DROP CONSTRAINT IF EXISTS ai_generated_questions_queue_level_fkey;
ALTER TABLE public.test_results 
  DROP CONSTRAINT IF EXISTS test_results_level_fkey;

-- 2. ビューの削除
DROP VIEW IF EXISTS public.v_available_questions CASCADE;

-- 3. テーブルの削除
DROP TABLE IF EXISTS public.toeic_question_stats CASCADE;
DROP TABLE IF EXISTS public.toeic_levels CASCADE;
