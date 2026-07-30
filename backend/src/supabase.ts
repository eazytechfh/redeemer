import { createClient } from "@supabase/supabase-js";
import { env } from "./config.js";

// This module is server-only. Never import it from the frontend.
export const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

