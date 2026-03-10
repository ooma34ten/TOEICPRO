const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

function getEnv() {
    const envPath = path.resolve(__dirname, "../.env.local");
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
const supabase = createClient(supabaseUrl, supabaseKey);

const wordsToDelete = [
    "e1406d2f-f17c-4737-b2dc-11cc03ce2848",
    "7f8ae3b2-93d9-44b1-81de-8f9f99d496a3",
    "17586bd5-1b22-4e72-b055-798c8397df93",
    "a36f7534-6792-46bc-aa02-e2d338b61f35",
    "7fc286e0-341b-4adb-803b-406886dd5772",
    "7e36d4c5-09eb-4834-8d86-9653de4c8a7c",
    "56954a8c-c414-48dc-8c84-a88c185e14ad",
    "9b38ebae-e9c1-4d9a-abb0-f9247ffab820",
    "520ff15d-aeaf-475c-91be-9ac2f28bc6b9",
    "c99da786-e5c5-4a7f-b8c0-030f78dddd9e",
    "81ee8607-d8e0-4841-9fdc-2ec752debd35"
];

async function run() {
    console.log("Starting deletion process...");

    for (const wordId of wordsToDelete) {
        console.log(`\nProcessing word_id: ${wordId}`);

        // 1. user_word_history の削除 (外部キー制約回避)
        const { data: userWords } = await supabase.from("user_words").select("id").eq("word_id", wordId);
        if (userWords && userWords.length > 0) {
            const userWordIds = userWords.map(uw => uw.id);
            await supabase.from("user_word_history").delete().in("user_word_id", userWordIds);
            console.log(`  - Deleted history for ${userWordIds.length} user_words.`);
        }

        // 2. user_words の削除
        const { error: uwError } = await supabase.from("user_words").delete().eq("word_id", wordId);
        if (uwError) {
            console.error(`  - Failed to delete user_words: ${uwError.message}`);
        } else {
            console.log(`  - Deleted user_words.`);
        }

        // 3. word_reports からも念のため削除
        await supabase.from("word_reports").delete().eq("word_id", wordId);
        console.log(`  - Deleted related word_reports.`);

        // 4. words_master から削除
        const { error: wmError } = await supabase.from("words_master").delete().eq("id", wordId);
        if (wmError) {
            console.error(`  - Failed to delete words_master: ${wmError.message}`);
        } else {
            console.log(`  - Successfully deleted from words_master!`);
        }
    }

    console.log("\nFinished processing all words.");
}

run();
