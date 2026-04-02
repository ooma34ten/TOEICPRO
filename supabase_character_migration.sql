-- =============================================
-- キャラクター育成 & 10人レース用 マイグレーション
-- Supabase SQL Editor で実行してください
-- =============================================

-- 1. user_stats テーブルにキャラクタータイプ列を追加
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS character_type TEXT DEFAULT 'cat';

-- 2. race_participants テーブルにキャラクタータイプ列を追加
ALTER TABLE race_participants ADD COLUMN IF NOT EXISTS character_type TEXT DEFAULT 'cat';

-- 3. race_participants テーブルにCPU仮想XP列を追加（キャラ進化表示用）
ALTER TABLE race_participants ADD COLUMN IF NOT EXISTS cpu_total_xp INTEGER DEFAULT 5000;
