const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
require("dotenv").config({ path: "c:\\Users\\risay\\masaki\\010_TOEIC学習アプリ\\Nextjs_ws\\TOEICPRO\\.env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from("race_participants").select("*").limit(1);
  if (data && data.length > 0) {
    fs.writeFileSync("c:\\Users\\risay\\masaki\\010_TOEIC学習アプリ\\Nextjs_ws\\TOEICPRO\\db_out.txt", JSON.stringify(Object.keys(data[0])));
  } else {
    fs.writeFileSync("c:\\Users\\risay\\masaki\\010_TOEIC学習アプリ\\Nextjs_ws\\TOEICPRO\\db_out.txt", "ERROR:" + JSON.stringify({error, data}));
  }
}
check();
