import { body, route } from "@/lib/server/http";
import { createRound, listRounds, RoundIn } from "@/lib/server/services";

export const GET = route(() => listRounds(), { role: "teacher" });

export const POST = route(async ({ user, req }) => createRound(user, await body(req, RoundIn)), { role: "teacher" });
