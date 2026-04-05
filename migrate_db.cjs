const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: "c:\\Users\\risay\\masaki\\010_TOEIC学習アプリ\\Nextjs_ws\\TOEICPRO\\.env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  const query = `
    ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS last_race_view_date TEXT;
  `;
  const { data, error } = await supabase.rpc('run_sql', { query });
  // Since we don't have run_sql RPC natively in Supabase without a custom function,
  // let's just create an SQL file and instruct the user, OR since we don't have direct SQL access
  // maybe we don't need SQL. We can just use supabase.rpc if it exists.
  console.log("Since run_sql might not exist, please run this statement in Supabase SQL editor: ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS last_race_view_date TEXT;");
}
runMigration();
