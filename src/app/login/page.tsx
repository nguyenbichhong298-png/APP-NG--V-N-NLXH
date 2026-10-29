"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, Button, Card, Field, Input, Loading } from "@/components/ui";
import { api, ClientError } from "@/lib/client/api";
import type { Profile } from "@/lib/types";

type DemoUser = Pick<Profile, "id" | "full_name" | "role" | "class_name">;

function nextUrl(role: string) {
  const n = new URLSearchParams(location.search).get("next");
  return n && n.startsWith("/") && !n.startsWith("//") ? n : role === "teacher" ? "/teacher" : "/student";
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"supabase" | "demo" | "unconfigured" | null>(null);
  const [demoUsers, setDemoUsers] = useState<DemoUser[]>([]);
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [form, setForm] = useState({ email: "", password: "", full_name: "", class_name: "" });
  const [err, setErr] = useState<ClientError | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ mode: "supabase" | "demo" | "unconfigured" }>("/api/me").then(async (m) => {
      setMode(m.mode);
      if (m.mode === "demo") setDemoUsers((await api<{ users: DemoUser[] }>("/api/auth/demo")).users);
    });
  }, []);

  const demoLogin = async (u: DemoUser) => {
    await api("/api/auth/demo", { method: "POST", body: { userId: u.id } });
    router.push(nextUrl(u.role));
  };

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      if (tab === "login") {
        const { user } = await api<{ user: Profile }>("/api/auth/login", { method: "POST", body: { email: form.email, password: form.password } });
        router.push(nextUrl(user.role));
      } else {
        const r = await api<{ needsConfirmation: boolean }>("/api/auth/signup", { method: "POST", body: form });
        if (r.needsConfirmation) setInfo("Đã tạo tài khoản. Hãy mở email để xác nhận, sau đó đăng nhập.");
        else router.push("/student");
      }
    } catch (e) {
      setErr(e as ClientError);
    } finally {
      setBusy(false);
    }
  };

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-16">
      <h1 className="text-center text-2xl font-bold text-accent">AI Ngữ Văn</h1>
      <p className="mb-8 text-center text-sm text-muted">Luyện viết đoạn văn nghị luận xã hội 200 chữ · Đánh giá đồng đẳng</p>
      {mode === null && <Loading />}
      {mode === "unconfigured" && <Alert tone="error" title="Chưa cấu hình máy chủ">Cần thiết lập biến môi trường Supabase. Xem README.</Alert>}

      {mode === "demo" && (
        <Card>
          <h2 className="font-semibold">Chế độ thử nghiệm</h2>
          <p className="mb-4 text-xs text-muted">Dữ liệu lưu trong tệp cục bộ. Chọn một tài khoản mẫu để vào.</p>
          <div className="grid gap-2">
            {demoUsers.map((u) => (
              <Button key={u.id} variant={u.role === "teacher" ? "primary" : "secondary"} onClick={() => demoLogin(u)} className="justify-between">
                <span>{u.full_name}</span>
                <span className="text-xs opacity-80">{u.role === "teacher" ? "Giáo viên" : `Học sinh · ${u.class_name}`}</span>
              </Button>
            ))}
          </div>
        </Card>
      )}

      {mode === "supabase" && (
        <Card>
          <div className="mb-4 flex gap-1 rounded-lg bg-paper p-1 text-sm">
            {(["login", "signup"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-md py-1.5 ${tab === t ? "bg-surface font-semibold shadow-sm" : "text-muted"}`}>
                {t === "login" ? "Đăng nhập" : "Tạo tài khoản học sinh"}
              </button>
            ))}
          </div>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            {tab === "signup" && (
              <>
                <Field label="Họ và tên" error={err?.fields?.full_name} required>
                  <Input value={form.full_name} onChange={set("full_name")} autoComplete="name" />
                </Field>
                <Field label="Lớp">
                  <Input value={form.class_name} onChange={set("class_name")} placeholder="12A1" />
                </Field>
              </>
            )}
            <Field label="Email" error={err?.fields?.email} required>
              <Input type="email" value={form.email} onChange={set("email")} autoComplete="email" />
            </Field>
            <Field label="Mật khẩu" error={err?.fields?.password} required>
              <Input type="password" value={form.password} onChange={set("password")} autoComplete={tab === "login" ? "current-password" : "new-password"} />
            </Field>
            <Button type="submit" loading={busy} className="w-full">
              {tab === "login" ? "Đăng nhập" : "Tạo tài khoản"}
            </Button>
            {err && !err.fields && <Alert tone="error">{err.message}</Alert>}
            {info && <Alert tone="ok">{info}</Alert>}
          </form>
        </Card>
      )}
    </main>
  );
}
