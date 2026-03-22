-- user_stats テーブルに nickname カラムを追加
ALTER TABLE user_stats
ADD COLUMN IF NOT EXISTS nickname TEXT DEFAULT NULL;
