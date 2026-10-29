import { route } from "@/lib/server/http";
import { revisionCompare } from "@/lib/server/services";

export const GET = route<{ versionId: string }>(({ user, params }) => revisionCompare(user, params.versionId));
