import { getCurrentUser } from "@/lib/server/auth";
import { isDemoMode, isSupabaseConfigured } from "@/lib/server/db";
import { isAIConfigured } from "@/lib/server/ai";

export async function GET() {
  const mode = isSupabaseConfigured() ? "supabase" : isDemoMode() ? "demo" : "unconfigured";
  if (mode === "unconfigured") return Response.json({ user: null, mode, ai: isAIConfigured() });
  try {
    return Response.json({ user: await getCurrentUser(), mode, ai: isAIConfigured() });
  } catch (err) {
    console.error(err);
    return Response.json({ user: null, mode, ai: isAIConfigured(), error: err instanceof Error ? err.message : String(err) });
  }
}
