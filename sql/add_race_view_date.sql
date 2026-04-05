-- 1. raceの初回確認判定用の日付カラム
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS last_race_view_date TEXT;
