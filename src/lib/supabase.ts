import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ytxtyphbguszjndtpakm.supabase.co";

const supabaseAnonKey =
  "sb_publishable_NCILoAG5w2kh9ciKd3QM8w_TTUfHkC4";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});