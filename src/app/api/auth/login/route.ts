import { z } from "zod";
import { getCurrentUser, supabaseServer } from "@/lib/server/auth";
import { isSupabaseConfigured } from "@/lib/server/db";
import { ApiError, body, publicRoute } from "@/lib/server/http";

const LoginIn = z.object({
  email: z.string().email("Email không hợp lệ."),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 kí tự."),
});

export const POST = publicRoute(async (req) => {
  if (!isSupabaseConfigured()) throw new ApiError(400, "Chưa cấu hình Supabase.");
  const { email, password } = await body(req, LoginIn);
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new ApiError(401, "Sai email hoặc mật khẩu.");
  return { user: await getCurrentUser() };
});
