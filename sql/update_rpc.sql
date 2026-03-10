CREATE OR REPLACE FUNCTION public.get_user_word_stats(p_user_id uuid)
RETURNS TABLE(
  user_word_id uuid,
  word_id uuid,
  registered_at timestamp with time zone,
  word text,
  part_of_speech text,
  meaning text,
  example_sentence text,
  translation text,
  importance text,
  total bigint,
  correct bigint,
  wrong bigint,
  success_rate numeric,
  last_answered timestamp with time zone,
  synonyms text
)
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    uw.id AS user_word_id,
    uw.word_id,
    uw.registered_at,
    wm.word,
    wm.part_of_speech,
    wm.meaning,
    wm.example_sentence,
    wm.translation,
    wm.importance,
    COALESCE(SUM(CASE WHEN uwh.id IS NOT NULL THEN 1 ELSE 0 END), 0)::bigint AS total,
    COALESCE(SUM(CASE WHEN uwh.is_correct = true THEN 1 ELSE 0 END), 0)::bigint AS correct,
    COALESCE(SUM(CASE WHEN uwh.is_correct = false THEN 1 ELSE 0 END), 0)::bigint AS wrong,
    CASE 
      WHEN COUNT(uwh.id) = 0 THEN 0.0
      ELSE ROUND(SUM(CASE WHEN uwh.is_correct = true THEN 1 ELSE 0 END)::numeric / COUNT(uwh.id)::numeric, 4)
    END AS success_rate,
    MAX(uwh.answered_at) AS last_answered,
    wm.synonyms
  FROM 
    user_words uw
  JOIN 
    words_master wm ON uw.word_id = wm.id
  LEFT JOIN 
    user_word_history uwh ON uw.id = uwh.user_word_id
  WHERE 
    uw.user_id = p_user_id
  GROUP BY 
    uw.id,
    uw.word_id,
    uw.registered_at,
    wm.word,
    wm.part_of_speech,
    wm.meaning,
    wm.example_sentence,
    wm.translation,
    wm.importance,
    wm.synonyms;
END;
$function$;
