-- 品詞の表記ゆれを統一するマイグレーション

-- 1. 先頭のtypoアルファベット（例："d動詞" -> "動詞"）を削除
UPDATE words_master
SET part_of_speech = REGEXP_REPLACE(part_of_speech, '^[a-zA-Z a-z]+(動詞|名詞|形容詞|副詞|接続詞|前置詞|代名詞|冠詞|助動詞|間投詞)', '\1')
WHERE part_of_speech ~ '^[a-zA-Z a-z]+(動詞|名詞|形容詞|副詞|接続詞|前置詞|代名詞|冠詞|助動詞|間投詞)';

-- 2. カッコを全角に統一し、中の区切り文字をスラッシュに統一
UPDATE words_master
SET part_of_speech = REPLACE(REPLACE(REPLACE(REPLACE(part_of_speech, '(', '（'), ')', '）'), '・', '/'), '／', '/')
WHERE part_of_speech LIKE '%(%' OR part_of_speech LIKE '%・%' OR part_of_speech LIKE '%／%';
