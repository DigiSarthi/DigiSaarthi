/* =========================================================
   Digi Saarthi — Supabase configuration
   =========================================================
   Fill these two values in after creating your Supabase project
   (Project Settings → API → Project URL / anon public key).

   The anon key is SAFE to keep in this public file — it is
   designed to be public. Real protection comes from the Row
   Level Security (RLS) policies set up inside Supabase (see the
   setup SQL provided separately), not from hiding this key.

   Never put a Supabase "service_role" key here — that one is
   secret and bypasses RLS entirely.
   ========================================================= */

const SUPABASE_URL = 'https://ozxpilvekgpahmruqyuv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96eHBpbHZla2dwYWhtcnVxeXV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1OTE1NjAsImV4cCI6MjEwNDE2NzU2MH0.J2IhtYN2cnDFbS1w-SCetRcSmgzjUo2GrZVdLcECn4A';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
