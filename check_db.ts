import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: "c:\\Users\\risay\\masaki\\010_TOEIC学習アプリ\\Nextjs_ws\\TOEICPRO\\.env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from("race_participants").select("*").limit(1);
  if (error) {
    console.error("Error:", error);
  } else if (data && data.length > 0) {
    console.log("Columns:", Object.keys(data[0]));
  } else {
    // If table is empty, we can try to get column info from information_schema or just insert a dummy and rollback
    console.log("No data found, trying to fetch single row.");
    // Supabase has no easy introspection without Postgres role, but we can do a dummy query 
    // to check if daily_progress exists by selecting it explicitly.
  }
  
  const { error: error2 } = await supabase.from("race_participants").select("daily_progress").limit(1);
  if (error2) {
    console.log("daily_progress column check error:", error2.message);
  } else {
    console.log("daily_progress column exists.");
  }
}

check();
