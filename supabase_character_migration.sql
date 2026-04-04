-- =============================================
-- キャラクター育成 & ランクシステム マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- 1. user_stats テーブルにキャラクタータイプ列を追加
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS character_type TEXT DEFAULT 'cat';

-- 2. user_stats テーブルにレースランク列を追加 (1=最高, 10=最低)
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS race_rank INTEGER DEFAULT 10;

-- 3. race_participants テーブルにキャラクタータイプ列を追加
ALTER TABLE race_participants ADD COLUMN IF NOT EXISTS character_type TEXT DEFAULT 'cat';

-- 4. race_participants テーブルにCPU仮想XP列を追加（キャラ進化表示用）
ALTER TABLE race_participants ADD COLUMN IF NOT EXISTS cpu_total_xp INTEGER DEFAULT 5000;

-- 5. race_history テーブルにランク変動列を追加
ALTER TABLE race_history ADD COLUMN IF NOT EXISTS rank_before INTEGER;
ALTER TABLE race_history ADD COLUMN IF NOT EXISTS rank_after INTEGER;
