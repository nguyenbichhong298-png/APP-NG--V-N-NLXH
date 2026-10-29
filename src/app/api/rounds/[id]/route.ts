import { body, route } from "@/lib/server/http";
import { patchRound, roundDetail, RoundPatch } from "@/lib/server/services";

export const GET = route<{ id: string }>(({ params }) => roundDetail(params.id), { role: "teacher" });

export const PATCH = route<{ id: string }>(async ({ req, params }) => patchRound(params.id, await body(req, RoundPatch)), {
  role: "teacher",
});
