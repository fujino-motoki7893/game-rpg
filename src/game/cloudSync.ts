import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { GameSave } from "./types";

// VITE_SUPABASE_* are compiled in at build time by Vite; unset in .env means
// cloud sync stays fully disabled and the game behaves exactly as before
// (localStorage-only), so this feature is safe to leave off in any deploy.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// persistSave() runs on nearly every player action, so pushes are debounced
// rather than sent per-call to avoid hammering the DB.
const SYNC_DEBOUNCE_MS = 3000;
const SAVES_TABLE = "saves";

let client: SupabaseClient | null | undefined;
let cachedUserId: string | null = null;
let pendingSave: GameSave | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

function getClient(): SupabaseClient | null {
  if (client !== undefined) return client;
  client = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
  return client;
}

export function isCloudSyncEnabled(): boolean {
  return getClient() !== null;
}

// Anonymous auth gives every browser install a stable user id (persisted in
// its own localStorage key by the Supabase SDK) without a login screen.
async function ensureSignedIn(): Promise<string | null> {
  const supabase = getClient();
  if (!supabase) return null;
  if (cachedUserId) return cachedUserId;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user) {
      cachedUserId = sessionData.session.user.id;
      return cachedUserId;
    }

    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data.user) {
      console.warn("[cloudSync] anonymous sign-in failed", error);
      return null;
    }
    cachedUserId = data.user.id;
    return cachedUserId;
  } catch (err) {
    console.warn("[cloudSync] sign-in unreachable", err);
    return null;
  }
}

export async function fetchCloudSave(): Promise<GameSave | null> {
  const supabase = getClient();
  if (!supabase) return null;

  const userId = await ensureSignedIn();
  if (!userId) return null;

  try {
    const { data, error } = await supabase
      .from(SAVES_TABLE)
      .select("data")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.warn("[cloudSync] fetch failed", error);
      return null;
    }
    return (data?.data as GameSave | undefined) ?? null;
  } catch (err) {
    console.warn("[cloudSync] fetch unreachable", err);
    return null;
  }
}

// Fire-and-forget: callers (persistSave) must not await this or block
// gameplay on network round-trips.
export function scheduleCloudSync(save: GameSave): void {
  if (!isCloudSyncEnabled()) return;

  pendingSave = save;
  if (syncTimer) return;

  syncTimer = setTimeout(() => {
    syncTimer = null;
    void flushCloudSync();
  }, SYNC_DEBOUNCE_MS);
}

async function flushCloudSync(): Promise<void> {
  const supabase = getClient();
  const save = pendingSave;
  pendingSave = null;
  if (!supabase || !save) return;

  const userId = await ensureSignedIn();
  if (!userId) return;

  try {
    const { error } = await supabase.from(SAVES_TABLE).upsert({
      user_id: userId,
      save_version: save.saveVersion,
      data: save,
      updated_at: new Date().toISOString()
    });
    if (error) {
      console.warn("[cloudSync] upsert failed", error);
    }
  } catch (err) {
    console.warn("[cloudSync] upsert unreachable", err);
  }
}
