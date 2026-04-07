-- =============================================
-- race_id とキャラクターガチャ用フラグの追加
-- Supabase SQL Editor で実行してください
-- =============================================

ALTER TABLE race_participants ADD COLUMN IF NOT EXISTS race_id UUID NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE race_history ADD COLUMN IF NOT EXISTS race_id UUID;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS character_gacha_done BOOLEAN DEFAULT FALSE;
