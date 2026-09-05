/* =========================================================
   Digi Saarthi — Supabase configuration
   ========================================================= */

const SUPABASE_URL = 'https://ozxpilvekgpahmruqyuv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96eHBpbHZla2dwYWhtcnVxeXV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1OTE1NjAsImV4cCI6MjEwNDE2NzU2MH0.J2IhtYN2cnDFbS1w-SCetRcSmgzjUo2GrZVdLcECn4A';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Google Apps Script Web App URL (Jo deploy karne ke baad mila tha)
const GDRIVE_UPLOAD_URL = 'https://script.google.com/macros/s/AKfycbysdpCcSemSdWXvn8554JxD4cUlFGYMBOjvo7KypWz00JrhUiJKoRGZ2us4Q_HVqKIGrg/exec';