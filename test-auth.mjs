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
console.log("URL:", supabaseUrl); // Just to verify

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Attempting reset password for test1@gmail.com");
  const { data, error } = await supabase.auth.resetPasswordForEmail("test1@gmail.com", {
    redirectTo: "http://localhost:5174/reset-password",
  });
  console.log("Auth Reset Response:", data);
  if (error) {
    console.error("Auth Reset Error:", error.message, error.name, error.status);
  }

  // Also see if we can find this user we can't search auth.users with anon key, but let's try calling another auth method to verify.
}

test();
