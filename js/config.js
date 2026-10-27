// Conexión a Supabase (proyecto "Concurso-Concepmi", tablas jur_*).
// La clave "anon" es pública por diseño: las tablas están cerradas y
// todo pasa por funciones que validan el código de jurado o de admin.
export const SUPABASE_URL = "https://sczjwiqdktjtulnmnngk.supabase.co";
export const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjemp3aXFka3RqdHVsbm1ubmdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2ODc2MDIsImV4cCI6MjEwNjI2MzYwMn0.Jq3LN0sheR_6Bj8pqBQw4skeYCf_V1R0hDpgQEZwgcE";

// Cada cuántos segundos se actualiza el panel de admin en vivo
export const SEGUNDOS_REFRESCO = 4;
