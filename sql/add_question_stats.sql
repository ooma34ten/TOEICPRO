-- toeic_questions に集計用カラムを追加 (デフォルト値 0)
ALTER TABLE public.toeic_questions 
ADD COLUMN IF NOT EXISTS correct_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS incorrect_count integer NOT NULL DEFAULT 0;

-- アトミックな更新のための RPC 関数 (同時実行でも正しくカウントするため)
CREATE OR REPLACE FUNCTION increment_question_stats(q_id uuid, is_correct boolean)
RETURNS void AS $$
BEGIN
  IF is_correct THEN
    UPDATE public.toeic_questions 
    SET correct_count = correct_count + 1 
    WHERE id = q_id;
  ELSE
    UPDATE public.toeic_questions 
    SET incorrect_count = incorrect_count + 1 
    WHERE id = q_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
