import { createClient } from "@supabase/supabase-js";
import type { Database } from "./supabase-types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
        "Missing Supabase environment variables. " +
        "Make sure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set in your .env file, " +
        "then restart the dev server."
    );
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: true,
    },
});
