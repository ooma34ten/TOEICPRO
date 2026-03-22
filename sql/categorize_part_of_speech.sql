-- words_masterテーブルの品詞(part_of_speech)を完全項目化するマイグレーション

-- 全データを大分類に置換
UPDATE words_master
SET part_of_speech = CASE 
    WHEN part_of_speech LIKE '%代名詞%' THEN '代名詞'
    WHEN part_of_speech LIKE '%名詞%' THEN '名詞'
    WHEN part_of_speech LIKE '%助動詞%' THEN '助動詞'
    WHEN part_of_speech LIKE '%動詞%' THEN '動詞'
    WHEN part_of_speech LIKE '%形容詞%' THEN '形容詞'
    WHEN part_of_speech LIKE '%副詞%' THEN '副詞'
    WHEN part_of_speech LIKE '%前置詞%' THEN '前置詞'
    WHEN part_of_speech LIKE '%接続詞%' THEN '接続詞'
    WHEN part_of_speech LIKE '%冠詞%' THEN '冠詞'
    WHEN part_of_speech LIKE '%間投詞%' THEN '間投詞'
    WHEN part_of_speech LIKE '%熟語%' OR part_of_speech LIKE '%フレーズ%' OR part_of_speech LIKE '%イディオム%' THEN '熟語・フレーズ'
    WHEN part_of_speech IS NULL OR part_of_speech = '' THEN NULL
    ELSE 'その他'
END;
