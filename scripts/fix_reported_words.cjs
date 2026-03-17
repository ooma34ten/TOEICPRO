const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

function getEnv() {
    const envPath = path.resolve(__dirname, "../.env.local");
    if (!fs.existsSync(envPath)) {
        console.error("Error: .env.local file not found at " + envPath);
        process.exit(1);
    }
    const envFile = fs.readFileSync(envPath, "utf8");
    const env = {};
    envFile.split("\n").forEach((line) => {
        const [key, ...rest] = line.split("=");
        if (key && rest.length > 0) {
            env[key.trim()] = rest.join("=").trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
        }
    });
    return env;
}

const env = getEnv();

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
const geminiApiKey = env.GEMINI_API_KEY;

if (!supabaseUrl || !supabaseKey || !geminiApiKey) {
    console.error("Error: Missing required environment variables in .env.local.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 単語名に付いている装飾（「(A)」「1.」「A)」など）を取り除く
function cleanWordText(rawWord) {
    return rawWord
        .replace(/^[\s(（]*[A-Za-z0-9][)）.\s]+/g, "") // (A), A), 1., (1) などを削除
        .trim();
}

async function getGeminiCorrection(word) {
    console.log(`\n🤖 Calling Gemini API for word: "${word}"...`);
    try {
        const res = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Goog-Api-Key": geminiApiKey,
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: `
                  あなたは英語学習アシスタントです。
                  日本語で解答してください。
                  次の単語について、以下の JSON 形式 **だけ** を返してください。
                  JSON 以外の文章・記号・説明・マークダウンは一切出力してはいけません。
                  入力された単語にスペルミスや明らかな誤字がある場合は、正しいスペルの英単語に直して解答してください。
                  複数の意味がある場合は代表的なものを1つ選んで含めてください。
                  TOEIC対策ように解答してください。

                  形式:
                  {
                    "word": "example",
                    "definitions": [
                      {
                        "word": "単語（英語）",
                        "part_of_speech": "品詞（日本語）",
                        "meaning": "意味",
                        "example": "TOEICでよく出る例文。",
                        "translation": "例文の日本語訳",
                        "importance": "1〜5（数字で。5が最重要、TOEIC頻出度）",
                        "synonyms": "類義語をカンマ区切りで（例：obtain, acquire, gain）。なければ空文字列。"
                      }
                    ]
                  }

                  単語: ${word}
                  `,
                                },
                            ],
                        },
                    ],
                }),
            }
        );

        if (!res.ok) {
            throw new Error(`Gemini API error: ${res.status} ${res.statusText}`);
        }

        const data = await res.json();
        let answer = "回答なし";

        if (data?.candidates?.length) {
            const candidate = data.candidates[0];
            if (Array.isArray(candidate.content) && candidate.content[0]?.parts?.length) {
                answer = candidate.content[0].parts[0].text;
            } else if (candidate.content?.parts?.length) {
                answer = candidate.content.parts[0].text;
            } else if (candidate.content?.text) {
                answer = candidate.content.text;
            } else if (candidate.text) {
                answer = candidate.text;
            }
        }

        if (answer !== "回答なし") {
            answer = answer
                .replace(/```json|```/g, "")
                .replace(/単語\s*[:：]\s*/g, "")
                .trim();

            const match = answer.match(/{[\s\S]*}/);
            if (match) {
                answer = match[0];
            }
        }

        const parsed = JSON.parse(answer);
        if (parsed.definitions && parsed.definitions.length > 0) {
            return parsed.definitions[0];
        }
        return null;

    } catch (error) {
        console.error(`❌ Error fetching correction for "${word}":`, error.message);
        return null;
    }
}

async function run() {
    console.log("🔍 Checking for reported words in word_reports table...");

    // Fetch up to 20 reports
    const { data: reports, error: fetchError } = await supabase
        .from("word_reports")
        .select("*")
        .order("created_at", { ascending: true })
        .limit(20);

    if (fetchError) {
        console.error("❌ Error fetching reports:", fetchError.message);
        process.exit(1);
    }

    if (!reports || reports.length === 0) {
        console.log("✅ No pending reported words found. Everything is clean!");
        process.exit(0);
    }

    console.log(`📋 Found ${reports.length} report(s). Processing...`);

    for (const report of reports) {
        const originalWordText = report.word_text;
        const wordId = report.word_id;

        // (A) や 1. などの余計な文字を削除
        const cleanWord = cleanWordText(originalWordText);

        console.log(`\n-----------------------------------------`);
        console.log(`⚠️ Processing report for: "${originalWordText}" -> cleaned as: "${cleanWord}" (Reason: ${report.report_reason})`);

        // Call Gemini with cleaned word
        const correction = await getGeminiCorrection(cleanWord);

        if (!correction) {
            console.log(`⚠️ Failed to get valid correction for "${originalWordText}". Skipping.`);
            continue;
        }

        console.log(`✅ Got correction from Gemini:`, correction.meaning);

        // Update words_master
        const updateData = {
            word: correction.word,
            part_of_speech: correction.part_of_speech,
            meaning: correction.meaning,
            example_sentence: correction.example,
            translation: correction.translation,
            importance: String(correction.importance || 3),
            synonyms: correction.synonyms || ""
        };

        let query = supabase.from("words_master").update(updateData);
        if (wordId) {
            query = query.eq("id", wordId);
        } else {
            query = query.eq("word", originalWordText);
        }

        const { error: updateError } = await query;

        console.log(`✅ Successfully updated words_master for "${originalWordText}"!`);

        // Delete report since it was fixed
        const { error: deleteError } = await supabase
            .from("word_reports")
            .delete()
            .eq("id", report.id);

        if (deleteError) {
            console.error(`❌ Failed to delete report ${report.id}:`, deleteError.message);
        } else {
            console.log(`🗑️ Deleted report ${report.id}`);
        }
    }

    console.log(`\n🎉 Finished processing reports.`);
    process.exit(0);
}

run();
