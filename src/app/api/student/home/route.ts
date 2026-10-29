import { route } from "@/lib/server/http";
import { studentHome } from "@/lib/server/services";

export const GET = route(({ user }) => studentHome(user));
