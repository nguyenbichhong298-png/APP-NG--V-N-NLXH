import { getCurrentUser } from "@/lib/server/auth";
import { isDemoMode, isSupabaseConfigured } from "@/lib/server/db";
import { isAIConfigured } from "@/lib/server/ai";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return Response.json({
      user,
      mode: isSupabaseConfigured() ? "supabase" : isDemoMode() ? "demo" : "unconfigured",
      ai: isAIConfigured(),
    });
  } catch (err) {
    return Response.json({ user: null, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
