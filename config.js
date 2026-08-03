// Fill these in after creating your Supabase project.
// Project Settings > API > Project URL and anon public key.
// The anon key is meant to be public in frontend code — that's normal for Supabase.
const SUPABASE_URL = "https://lvkfjmeglcknzxjvtupp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_nCoP00Cmp-koiz3TIzkRXw_1vtDLxDS";

// Fixed email used for the single admin account (see setup instructions).
const ADMIN_EMAIL = "admin@civ6.local";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
