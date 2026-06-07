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

async function test() {
  const email = `test_signup_${Date.now()}@example.com`;
  const password = "Password123!";
  const phone = `+2547${Math.floor(10000000 + Math.random() * 90000000)}`;
  
  console.log(`Attempting to signup user: ${email} with phone: ${phone}`);
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: "Test Signup User",
        phone: phone,
        role: "passenger",
      },
    },
  });

  if (error) {
    console.error("Signup failed!");
    console.error("Error Message:", error.message);
    console.error("Error Status:", error.status);
    console.error("Full Error Details:", error);
  } else {
    console.log("Signup succeeded!");
    console.log("User Data:", data.user);
    
    // Clean up if it succeeded (though we might not be able to delete it without service role key)
    console.log("Checking if profile was created...");
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();
      
    if (profileError) {
      console.error("Profile not found or error:", profileError.message);
    } else {
      console.log("Profile created successfully:", profile);
    }
  }
}

test();
