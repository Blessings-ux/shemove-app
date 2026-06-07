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

async function inspect() {
  const res = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: {
      "apikey": supabaseKey,
    }
  });
  const spec = await res.json();
  console.log("Full response:", spec);
}

inspect();
