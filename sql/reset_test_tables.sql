-- 1) Reset existing data (Cascade will handled test_result_items)
TRUNCATE public.test_results RESTART IDENTITY CASCADE;

-- 2) Modify test_result_items
ALTER TABLE public.test_result_items 
ADD COLUMN question_id uuid REFERENCES public.toeic_questions(id) ON DELETE SET NULL;

ALTER TABLE public.test_result_items
DROP COLUMN question,
DROP COLUMN correct_answer,
DROP COLUMN part_of_speech,
DROP COLUMN category;

-- 3) Modify test_results
ALTER TABLE public.test_results
DROP COLUMN level;
