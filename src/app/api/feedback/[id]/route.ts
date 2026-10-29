import { route } from "@/lib/server/http";
import { writerView } from "@/lib/server/services";

export const GET = route<{ id: string }>(({ user, params }) => writerView(user, params.id));
