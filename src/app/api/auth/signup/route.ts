import { z } from "zod";
import { supabaseServer } from "@/lib/server/auth";
import { isSupabaseConfigured } from "@/lib/server/db";
import { ApiError, body, publicRoute } from "@/lib/server/http";

const SignupIn = z.object({
  email: z.string().email("Email không hợp lệ."),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 kí tự."),
  full_name: z.string().trim().min(2, "Nhập họ tên.").max(100),
  class_name: z.string().trim().max(20).optional(),
});

export const POST = publicRoute(async (req) => {
  if (!isSupabaseConfigured()) throw new ApiError(400, "Chưa cấu hình Supabase.");
  const input = await body(req, SignupIn);
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: { data: { full_name: input.full_name, class_name: input.class_name ?? null } },
  });
  if (error) throw new ApiError(400, `Không tạo được tài khoản: ${error.message}`);
  return { needsConfirmation: !data.session };
});
