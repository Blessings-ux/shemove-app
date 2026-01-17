import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create a simple Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Helper to check if an error is an AbortError (safe to ignore)
export const isAbortError = (error) => {
  if (!error) return false;
  const errorMessage = error?.message || error?.toString() || "";
  const errorName = error?.name || "";
  return (
    errorName === "AbortError" ||
    errorMessage.includes("aborted") ||
    errorMessage.includes("abort") ||
    errorMessage.includes("signal") ||
    error?.code === "ABORT_ERR" ||
    error?.code === 20
  );
};

// Suppress unhandled promise rejections for AbortError
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    if (isAbortError(event.reason)) {
      event.preventDefault();
    }
  });
}
