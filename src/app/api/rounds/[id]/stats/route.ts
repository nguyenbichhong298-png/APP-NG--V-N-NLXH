import { route } from "@/lib/server/http";
import { roundStats } from "@/lib/server/services";

export const GET = route<{ id: string }>(({ params }) => roundStats(params.id), { role: "teacher" });
