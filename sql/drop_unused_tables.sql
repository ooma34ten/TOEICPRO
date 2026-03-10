-- 1. unused items: foreign keys drop
ALTER TABLE public.ai_generated_questions_queue DROP CONSTRAINT IF EXISTS ai_generated_questions_queue_level_fkey;
ALTER TABLE public.test_results DROP CONSTRAINT IF EXISTS test_results_level_fkey;

-- 2. drop view (since v_available_questions depends on toeic_question_stats and is unused)
DROP VIEW IF EXISTS public.v_available_questions CASCADE;

-- 3. drop table
DROP TABLE IF EXISTS public.toeic_question_stats CASCADE;
DROP TABLE IF EXISTS public.toeic_levels CASCADE;

