import { create } from "zustand";
import { supabase } from "../services/supabase";

// Store the auth subscription so we can manage it
let authSubscription = null;

export const useAuthStore = create((set, get) => ({
  user: null,
  profile: null,
  loading: true,
  error: null,

  initialize: async () => {
    try {
      set({ loading: true });

      // Get current session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        // Fetch profile
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        if (error && error.code !== "PGRST116") {
          // Ignore not found error initially
          console.error("Error fetching profile:", error);
        }

        set({ user: session.user, profile: profile || null, loading: false });
      } else {
        set({ user: null, profile: null, loading: false });
      }

      // Unsubscribe from previous listener if exists
      if (authSubscription) {
        authSubscription.unsubscribe();
      }

      // Listen for changes
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          try {
            const { data: profile } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", session.user.id)
              .single();
            set({
              user: session.user,
              profile: profile || null,
              loading: false,
            });
          } catch (err) {
            // Ignore abort errors during rapid state changes
            if (err.name !== "AbortError") {
              console.error("Profile fetch error:", err);
            }
            set({ user: session.user, profile: null, loading: false });
          }
        } else {
          set({ user: null, profile: null, loading: false });
        }
      });

      authSubscription = subscription;
    } catch (err) {
      // Ignore abort errors
      if (err.name !== "AbortError") {
        set({ error: err.message, loading: false });
      }
    }
  },

  signIn: async ({ email, password }) => {
    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        set({ error: error.message, loading: false });
        return { error };
      }

      // Fetch the user's profile to get their role
      let profile = null;
      if (data?.user) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", data.user.id)
          .single();

        if (profileError) {
          console.error("Error fetching profile:", profileError);
        } else {
          profile = profileData;
          console.log("Fetched profile on signIn:", profile);
        }
        set({ user: data.user, profile, loading: false });
      }

      return { data: { ...data, profile } };
    } catch (err) {
      if (err.name !== "AbortError") {
        set({ error: err.message, loading: false });
        return { error: err };
      }
      return { error: err };
    }
  },

  signUp: async ({ email, password, fullName, phone, role }) => {
    set({ loading: true, error: null });
    try {
      // 1. Sign up auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: phone,
            role: role,
          },
        },
      });

      if (authError) {
        set({ error: authError.message, loading: false });
        return { error: authError };
      }

      // 2. We depend on a Supabase Trigger to create the profile usually,
      // but we can optimistic update or handle additional logic here if needed.
      // For now, assume trigger handles public.profiles creation.

      set({ loading: false });
      return { data: authData };
    } catch (err) {
      if (err.name !== "AbortError") {
        set({ error: err.message, loading: false });
      }
      return { error: err };
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
      set({ user: null, profile: null });
    } catch (err) {
      // Ignore abort errors during sign out
      if (err.name !== "AbortError") {
        console.error("Sign out error:", err);
      }
      set({ user: null, profile: null });
    }
  },
}));
