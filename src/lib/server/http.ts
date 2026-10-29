import "server-only";
import { z } from "zod";
import { getCurrentUser } from "./auth";
import type { Profile, Role } from "../types";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const notFound = (what = "Không tìm thấy dữ liệu.") => new ApiError(404, what);
export const forbidden = (what = "Bạn không có quyền thực hiện thao tác này.") => new ApiError(403, what);
export const badRequest = (what: string, fields?: Record<string, string>) => new ApiError(400, what, fields);

function toResponse(err: unknown) {
  if (err instanceof ApiError) {
    return Response.json({ error: err.message, fields: err.fields }, { status: err.status });
  }
  if (err instanceof z.ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) fields[issue.path.join(".")] = issue.message;
    return Response.json({ error: "Dữ liệu gửi lên không hợp lệ.", fields }, { status: 400 });
  }
  console.error(err);
  const message = err instanceof Error ? err.message : "Lỗi không xác định.";
  return Response.json({ error: `Lỗi máy chủ: ${message}` }, { status: 500 });
}

type Handler<C> = (ctx: { user: Profile; req: Request; params: C }) => Promise<unknown>;

/** Bọc route handler: xác thực, phân quyền, chuyển lỗi thành JSON. */
export function route<C = Record<string, never>>(handler: Handler<C>, opts: { role?: Role } = {}) {
  return async (req: Request, ctx?: { params: Promise<C> }) => {
    try {
      const user = await getCurrentUser();
      if (!user) throw new ApiError(401, "Bạn cần đăng nhập.");
      if (opts.role && user.role !== opts.role) throw forbidden();
      const params = (ctx ? await ctx.params : {}) as C;
      const data = await handler({ user, req, params });
      return Response.json(data ?? { ok: true });
    } catch (err) {
      return toResponse(err);
    }
  };
}

export function publicRoute(handler: (req: Request) => Promise<unknown>) {
  return async (req: Request) => {
    try {
      return Response.json((await handler(req)) ?? { ok: true });
    } catch (err) {
      return toResponse(err);
    }
  };
}

export async function body<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw badRequest("Nội dung yêu cầu không phải JSON hợp lệ.");
  }
  return schema.parse(json);
}
