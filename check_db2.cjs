const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: "c:\\Users\\risay\\masaki\\010_TOEIC学習アプリ\\Nextjs_ws\\TOEICPRO\\.env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from("race_participants").select("*").limit(1);
  if (data && data.length > 0) {
    console.log("COLUMNS_IN_DB_JSON=" + JSON.stringify(Object.keys(data[0])));
  } else {
    console.log("NO_DATA_OR_ERROR:", error);
  }
}
check();
