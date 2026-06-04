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

async function checkProfile() {
  const driverId = "9865c99e-c057-4754-b437-3526018d3549";
  console.log(`Checking profile for driver: ${driverId}`);
  
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", driverId);
    
  console.log("Profile Data:", data);
  console.log("Error:", error);
}

checkProfile();
