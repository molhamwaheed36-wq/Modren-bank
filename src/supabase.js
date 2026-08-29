import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL || "https://uisegcwusjtkqjcvkopn.supabase.co";
const key =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_r3jT9p6GWXgrPq2caQagGw_79y2ZhRQ";

export const supabase = createClient(url, key);

export async function adminCount() {
  const { data, error } = await supabase.rpc("admin_count");
  if (error) throw error;
  return data ?? 0;
}

export async function createFirstAdmin(username, passwordHash) {
  const { data, error } = await supabase.rpc("create_first_admin", {
    p_username: username,
    p_hash: passwordHash,
  });
  if (error) throw error;
  return data;
}

export async function loginUser(username, passwordHash) {
  const { data, error } = await supabase.rpc("login_user", {
    p_username: username,
    p_hash: passwordHash,
  });
  if (error) throw error;
  return data;
}
