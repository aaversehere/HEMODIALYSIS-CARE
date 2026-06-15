(function () {
  const config = window.HEMODIALYSIS_CARE_SUPABASE;

  if (!window.supabase) {
    window.hdcSupabase = null;
    window.hdcSupabaseError = 'Library Supabase gagal dimuat. Pastikan HP terhubung internet.';
    return;
  }

  if (!config?.url || !config?.anonKey) {
    window.hdcSupabase = null;
    window.hdcSupabaseError = 'supabase-config.js tidak termuat atau belum berisi URL dan anon key.';
    return;
  }

  try {
    const projectUrl = new URL(config.url).origin;
    window.hdcSupabase = window.supabase.createClient(projectUrl, config.anonKey);
    window.hdcSupabaseError = '';
  } catch (error) {
    window.hdcSupabase = null;
    window.hdcSupabaseError = 'SUPABASE_URL di supabase-config.js belum valid.';
  }
})();
