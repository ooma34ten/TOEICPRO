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

if (!supabaseUrl || !supabaseKey) {
    console.error("Error: Missing Supabase credentials in .env.local.");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("🔍 Checking for reported words to delete...");

    // 1. word_reports からすべての word_id を取得
    const { data: reports, error: fetchError } = await supabase
        .from("word_reports")
        .select("word_id, word_text");

    if (fetchError) {
        console.error("❌ Error fetching reports:", fetchError.message);
        process.exit(1);
    }

    if (!reports || reports.length === 0) {
        console.log("✅ No reported words found. Everything is clean!");
        process.exit(0);
    }

    // 重複を削除して削除対象の word_id のリストを作成
    const uniqueReports = [];
    const reportIds = new Set();

    for (const report of reports) {
        if (report.word_id && !reportIds.has(report.word_id)) {
            reportIds.add(report.word_id);
            uniqueReports.push(report);
        }
    }

    console.log(`📋 Found ${uniqueReports.length} unique reported word(s) to process.`);

    // 2. 順番に削除を実行
    for (const report of uniqueReports) {
        const wordId = report.word_id;
        const wordText = report.word_text;

        console.log(`\n-----------------------------------------`);
        console.log(`⚠️ Deleting reported word: "${wordText}" (ID: ${wordId})`);

        // 2-1. user_word_history の削除
        const { data: userWords } = await supabase.from("user_words").select("id").eq("word_id", wordId);
        if (userWords && userWords.length > 0) {
            const userWordIds = userWords.map(uw => uw.id);
            await supabase.from("user_word_history").delete().in("user_word_id", userWordIds);
            console.log(`  - Deleted history for ${userWordIds.length} user_words.`);
        }

        // 2-2. user_words の削除
        const { error: uwError } = await supabase.from("user_words").delete().eq("word_id", wordId);
        if (uwError) {
            console.error(`  - Failed to delete user_words: ${uwError.message}`);
        } else {
            console.log(`  - Deleted user_words.`);
        }

        // 2-3. word_reports からの削除
        await supabase.from("word_reports").delete().eq("word_id", wordId);
        console.log(`  - Deleted related word_reports.`);

        // 2-4. words_master から削除
        const { error: wmError } = await supabase.from("words_master").delete().eq("id", wordId);
        if (wmError) {
            console.error(`  - Failed to delete words_master: ${wmError.message}`);
        } else {
            console.log(`  - Successfully deleted from words_master!`);
        }
    }

    console.log(`\n🎉 Finished deleting all reported words.`);
    process.exit(0);
}

run();
