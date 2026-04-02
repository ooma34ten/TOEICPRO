-- =============================================
-- ウィークリーレース用テーブル
-- Supabase SQL Editor で実行してください
-- =============================================

-- 1. race_participants テーブル
CREATE TABLE IF NOT EXISTS race_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  distance INTEGER DEFAULT 0,
  character_emoji TEXT DEFAULT '🐱',
  display_name TEXT NOT NULL,
  is_cpu BOOLEAN DEFAULT FALSE,
  cpu_daily_pace INTEGER DEFAULT 0,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- user_id + week_start の UNIQUE 制約（CPUはuser_idがNULLなので別途対応）
CREATE UNIQUE INDEX IF NOT EXISTS idx_race_participants_user_week 
  ON race_participants(user_id, week_start) WHERE user_id IS NOT NULL;

-- RLS
ALTER TABLE race_participants ENABLE ROW LEVEL SECURITY;

-- 全参加者を閲覧可能（同じ週のレース参加者を表示するため）
CREATE POLICY "Anyone can view race participants" 
  ON race_participants FOR SELECT USING (true);

-- 自分のレコードのみ更新可能
CREATE POLICY "Users can update own race participant" 
  ON race_participants FOR UPDATE USING (auth.uid() = user_id);

-- 挿入は service_role 経由で行うため（CPU作成含む）、ここでは制限しない
CREATE POLICY "Allow insert for authenticated users" 
  ON race_participants FOR INSERT WITH CHECK (true);

-- 2. race_history テーブル
CREATE TABLE IF NOT EXISTS race_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  final_rank INTEGER,
  final_distance INTEGER,
  total_participants INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

ALTER TABLE race_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own race history" 
  ON race_history FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Allow insert race history" 
  ON race_history FOR INSERT WITH CHECK (true);

-- 3. user_stats にキャラクター列を追加
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS character_emoji TEXT DEFAULT '🐱';
