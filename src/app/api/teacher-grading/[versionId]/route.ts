import { body, route } from "@/lib/server/http";
import { getTeacherGrading, saveTeacherGrading, TeacherGradingIn } from "@/lib/server/services";

export const GET = route<{ versionId: string }>(({ params }) => getTeacherGrading(params.versionId), { role: "teacher" });

export const PUT = route<{ versionId: string }>(
  async ({ user, req, params }) => saveTeacherGrading(user, params.versionId, await body(req, TeacherGradingIn)),
  { role: "teacher" },
);
