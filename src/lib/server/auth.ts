import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getDb, isDemoMode, isSupabaseConfigured, now } from "./db";
import type { Profile, Role } from "../types";

const DEMO_COOKIE = "nv_demo_uid";

function demoSecret() {
  return process.env.DEMO_SECRET || "dev-only-demo-secret";
}

function sign(value: string) {
  return createHmac("sha256", demoSecret()).update(value).digest("base64url");
}

export function signDemoUid(uid: string) {
  return `${uid}.${sign(uid)}`;
}

function verifyDemoCookie(raw: string | undefined): string | null {
  if (!raw) return null;
  const i = raw.lastIndexOf(".");
  if (i < 0) return null;
  const uid = raw.slice(0, i);
  const a = Buffer.from(raw.slice(i + 1));
  const b = Buffer.from(sign(uid));
  return a.length === b.length && timingSafeEqual(a, b) ? uid : null;
}

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        for (const { name, value, options } of list) store.set(name, value, options);
      },
    },
  });
}

function roleForEmail(email: string | null | undefined): Role {
  const teachers = (process.env.TEACHER_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return email && teachers.includes(email.toLowerCase()) ? "teacher" : "student";
}

/** Người dùng hiện tại (đã xác thực) hoặc null. */
export async function getCurrentUser(): Promise<Profile | null> {
  const db = getDb();
  if (isSupabaseConfigured()) {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return null;
    const existing = await db.get("profiles", user.id);
    if (existing) return existing;
    const meta = (user.user_metadata ?? {}) as { full_name?: string; class_name?: string };
    return db.insert("profiles", {
      id: user.id,
      email: user.email ?? null,
      full_name: meta.full_name || user.email || "Học sinh",
      class_name: meta.class_name || null,
      role: roleForEmail(user.email),
      created_at: now(),
    });
  }
  if (isDemoMode()) {
    const uid = verifyDemoCookie((await cookies()).get(DEMO_COOKIE)?.value);
    return uid ? db.get("profiles", uid) : null;
  }
  return null;
}

export async function setDemoSession(uid: string) {
  (await cookies()).set(DEMO_COOKIE, signDemoUid(uid), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  if (isSupabaseConfigured()) {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
  }
  (await cookies()).delete(DEMO_COOKIE);
}
