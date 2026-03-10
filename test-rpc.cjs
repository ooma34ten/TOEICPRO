const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

function getEnv() {
    const envPath = path.resolve(__dirname, ".env.local");
    const envFile = fs.readFileSync(envPath, "utf8");
    const env = {};
    envFile.split("\n").forEach((line) => {
        const [key, value] = line.split("=");
        if (key && value) {
            env[key.trim()] = value.trim();
        }
    });
    return env;
}

const env = getEnv();
const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
    const { data: users } = await supabase.from("user_words").select("user_id").limit(1);
    if (!users || users.length === 0) return console.log("No users found");

    const userId = users[0].user_id;

    const { data, error } = await supabase.rpc("get_user_word_stats", { p_user_id: userId });

    if (data && data.length > 0) {
        console.log("Keys in returned RPC object:", Object.keys(data[0]));
        console.log("Synonyms for first 3:", data.slice(0, 3).map(d => d.synonyms));
    }
    console.log("Error:", error);
}

check();
