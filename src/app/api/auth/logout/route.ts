import { clearSession } from "@/lib/server/auth";
import { publicRoute } from "@/lib/server/http";

export const POST = publicRoute(async () => {
  await clearSession();
  return { ok: true };
});
