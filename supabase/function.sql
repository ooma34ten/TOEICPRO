create or replace function get_user_word_progress(uid uuid)
returns table(date text, daily_correct bigint, registered bigint, mastered bigint)
as $$
begin
  return query
  with all_user_answers as (
    -- ログインユーザーの解答履歴に絞る
    select uwa.*
    from user_word_answers as uwa
    join user_words as uw on uwa.user_word_id = uw.id
    where uw.user_id = uid
  ),
  dates as (
    -- 対象ユーザーの活動日をすべて列挙
    select distinct date(timezone('JST', created_at)) as activity_date
    from all_user_answers
    union
    select distinct date(timezone('JST', registered_at))
    from user_words
    where user_id = uid
  ),
  daily_corrects as (
    -- 日毎の正解数を計算
    select
      date(timezone('JST', created_at)) as answer_date,
      count(*) as correct_count
    from all_user_answers
    where is_correct = true
    group by answer_date
  ),
  daily_registered as (
    -- 日毎の単語登録数を計算
    select
      date(timezone('JST', registered_at)) as reg_date,
      count(*) as registered_count
    from user_words
    where user_id = uid
    group by reg_date
  ),
  -- 各単語の正解数、解答数、最終正解日を計算
  word_stats as (
    select
      user_word_id,
      sum(case when is_correct then 1 else 0 end) as correct_answers_count,
      count(*) as total_answers_count,
      max(case when is_correct then created_at else null end) as last_correct_answer_date
    from all_user_answers
    group by user_word_id
  ),
  mastered_words as (
    -- 完全記憶の条件を満たす単語を抽出
    select
      user_word_id,
      last_correct_answer_date
    from word_stats
    where
      correct_answers_count >= 6 and
      (correct_answers_count::decimal / total_answers_count) >= 0.9
  ),
  daily_mastered as (
    -- 日毎の完全記憶数を計算 (最終正解日に基づく)
    select
      date(timezone('JST', last_correct_answer_date)) as mastered_date,
      count(*) as mastered_count
    from mastered_words
    group by mastered_date
  )
  -- 全ての日付を基準に、各指標を結合
  select
    to_char(d.activity_date, 'YYYY-MM-DD') as date,
    coalesce(dc.correct_count, 0) as daily_correct,
    coalesce(dr.registered_count, 0) as registered,
    coalesce(dm.mastered_count, 0) as mastered
  from dates d
  left join daily_corrects dc on d.activity_date = dc.answer_date
  left join daily_registered dr on d.activity_date = dr.reg_date
  left join daily_mastered dm on d.activity_date = dm.mastered_date
  order by d.activity_date;
end;
$$ language plpgsql;
