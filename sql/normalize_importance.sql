-- words_masterテーブルのimportanceカラムを数字に統一するマイグレーション
-- '★★★★★' のような文字を '5' のような数字文字列に変換します。

UPDATE words_master
SET importance = CASE 
    WHEN importance LIKE '%★%' THEN
        CAST(
            LENGTH(REPLACE(importance, '☆', '')) -- 余分な☆があれば無視して★の数をカウント
        AS TEXT)
    WHEN importance ~ '^[0-9]+$' THEN
        importance -- 既に数字の場合はそのまま
    ELSE
        '3' -- デフォルト値（空文字や想定外の値の場合）
END
WHERE importance LIKE '%★%';
