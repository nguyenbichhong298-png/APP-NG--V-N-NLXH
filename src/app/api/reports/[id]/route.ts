import { route } from "@/lib/server/http";
import { peerReport } from "@/lib/server/services";

export const GET = route<{ id: string }>(({ user, params }) => peerReport(user, params.id));
