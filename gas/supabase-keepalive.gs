/**
 * Pings Supabase so the free-tier project's auto-pause (no API/DB activity
 * for 7 days) never triggers. Attach this function to a time-driven trigger
 * — see docs/supabase.md for setup steps. Not deployed automatically; this
 * file exists so the script is version-controlled, but it must be pasted
 * into an Apps Script project by hand.
 */
function keepSupabaseAlive() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty("SUPABASE_URL");
  const anonKey = props.getProperty("SUPABASE_ANON_KEY");

  if (!url || !anonKey) {
    throw new Error("Script properties SUPABASE_URL / SUPABASE_ANON_KEY が未設定です。");
  }

  // A real SELECT against the DB (not just an Auth/API-gateway ping), so it
  // reliably counts as the "database activity" Supabase's pause detector
  // looks for. RLS still returns zero rows for the anon role — see the
  // "grant select ... to anon" migration.
  const response = UrlFetchApp.fetch(url + "/rest/v1/saves?select=user_id&limit=1", {
    method: "get",
    headers: { apikey: anonKey },
    muteHttpExceptions: true
  });

  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error("Supabase keep-alive ping failed: status " + status + ", body: " + response.getContentText());
  }

  console.log("Supabase keep-alive ping OK (status " + status + ")");
}
