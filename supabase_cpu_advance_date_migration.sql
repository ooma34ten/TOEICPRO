-- =============================================
-- CPU進行日付トラッキング追加
-- Supabase SQL Editor で実行してください
-- =============================================

-- race_participants テーブルに CPU最後進行日付カラムを追加
ALTER TABLE race_participants ADD COLUMN IF NOT EXISTS last_cpu_advance_date TEXT;
