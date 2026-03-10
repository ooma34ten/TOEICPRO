-- ========================================
-- word_reports テーブル作成
-- Supabase SQL Editor で実行してください
-- ========================================

CREATE TABLE IF NOT EXISTS word_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id TEXT,
  word_text TEXT NOT NULL,
  report_reason TEXT NOT NULL,
  report_detail TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS有効化
ALTER TABLE word_reports ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分の報告のみ INSERT 可能
CREATE POLICY "Users can insert own reports"
  ON word_reports
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ユーザーは自分の報告のみ SELECT 可能
CREATE POLICY "Users can view own reports"
  ON word_reports
  FOR SELECT
  USING (auth.uid() = user_id);
