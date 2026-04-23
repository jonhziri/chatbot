const { createClient } = require("@supabase/supabase-js");

function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function createSupabaseClient() {
  if (!hasSupabaseConfig()) {
    return null;
  }

  try {
    return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  } catch (error) {
    console.warn(
      `[storage] Supabase Client konnte nicht initialisiert werden, nutze Fallback: ${error.message || error}`
    );
    return null;
  }
}

module.exports = {
  createSupabaseClient,
  hasSupabaseConfig
};
