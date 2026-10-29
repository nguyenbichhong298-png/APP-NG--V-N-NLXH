import { route } from "@/lib/server/http";
import { deleteAssignment } from "@/lib/server/services";

export const DELETE = route<{ id: string }>(async ({ params }) => deleteAssignment(params.id), { role: "teacher" });
