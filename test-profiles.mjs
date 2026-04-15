import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const envStr = fs.readFileSync(".env", "utf-8");
const env = Object.fromEntries(
  envStr.split("\n")
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"))
    .map(line => {
      const match = line.match(/^([^=]+)=(.*)$/);
      return match ? [match[1].trim(), match[2].trim().replace(/\r/g, "")] : null;
    })
    .filter(Boolean)
);

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testProfiles() {
  console.log("Fetching profiles...");
  const { data, error } = await supabase.from("profiles").select("*").limit(50);
  console.log("Profiles Data:", data);
  if (error) console.error("Error:", error);
}

testProfiles();
