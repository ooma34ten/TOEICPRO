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
    const { data, error } = await supabase
        .from("words_master")
        .select("word, synonyms")
        .not("synonyms", "is", null)
        .neq("synonyms", "")
        .limit(5);

    console.log("Data with synonyms:", data);
    console.log("Error:", error);
}

check();
