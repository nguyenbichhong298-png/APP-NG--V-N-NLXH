import { z } from "zod";
import { setDemoSession } from "@/lib/server/auth";
import { getDb, isDemoMode } from "@/lib/server/db";
import { ApiError, body, publicRoute } from "@/lib/server/http";
import { ensureDemoSeed } from "@/lib/server/services";

function assertDemo() {
  if (!isDemoMode()) throw new ApiError(404, "Chế độ thử nghiệm đã tắt.");
}

export const GET = publicRoute(async () => {
  assertDemo();
  const users = await ensureDemoSeed();
  return { users: users.map((u) => ({ id: u.id, full_name: u.full_name, role: u.role, class_name: u.class_name })) };
});

export const POST = publicRoute(async (req) => {
  assertDemo();
  const { userId } = await body(req, z.object({ userId: z.string().min(1) }));
  const user = await getDb().get("profiles", userId);
  if (!user) throw new ApiError(404, "Không có tài khoản thử nghiệm này.");
  await setDemoSession(user.id);
  return { user };
});
