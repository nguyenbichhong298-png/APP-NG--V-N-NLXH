"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/client/api";
import type { Profile } from "@/lib/types";
import { cx, Loading } from "./ui";

interface Me {
  user: Profile | null;
  mode: "supabase" | "demo" | "unconfigured";
  ai: boolean;
}

export function AppShell({ role, children, wide }: { role?: "teacher" | "student"; children: (me: Me & { user: Profile }) => ReactNode; wide?: boolean }) {
  const [me, setMe] = useState<Me | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    api<Me>("/api/me")
      .then((m) => {
        if (!m.user) router.replace(`/login?next=${encodeURIComponent(location.pathname)}`);
        // Giáo viên được xem mọi trang; học sinh không vào trang giáo viên.
        else if (role === "teacher" && m.user.role !== "teacher") router.replace("/student");
        else setMe(m);
      })
      .catch(() => router.replace("/login"));
  }, [role, router]);

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST", body: {} });
    router.replace("/login");
  };

  if (!me?.user) return <div className="mx-auto w-full max-w-5xl px-4"><Loading /></div>;
  const nav =
    me.user.role === "teacher"
      ? [
          { href: "/teacher", label: "Đánh giá đồng đẳng" },
          { href: "/teacher/prompts", label: "Đề bài" },
          { href: "/teacher/rubric", label: "Rubric" },
        ]
      : [
          { href: "/student", label: "Bài của tôi" },
          { href: "/student/rubric", label: "Tìm hiểu rubric" },
        ];
  return (
    <>
      <header className="no-print border-b border-line bg-surface">
        <div className={cx("mx-auto flex w-full flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3", wide ? "max-w-7xl" : "max-w-5xl")}>
          <Link href={me.user.role === "teacher" ? "/teacher" : "/student"} className="font-bold text-accent">
            AI Ngữ Văn <span className="font-normal text-muted">· NLXH 200 chữ</span>
          </Link>
          <nav className="flex flex-1 flex-wrap gap-1 text-sm">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cx("rounded-md px-3 py-1.5", pathname === n.href ? "bg-accent-soft font-medium text-accent" : "text-ink hover:bg-black/5")}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 text-sm">
            {me.mode === "demo" && <span className="rounded bg-warn-soft px-2 py-0.5 text-xs text-warn">Thử nghiệm</span>}
            <span className="text-muted">
              {me.user.full_name}
              {me.user.class_name ? ` · ${me.user.class_name}` : ""}
            </span>
            <button onClick={logout} className="text-muted underline-offset-2 hover:underline">
              Đăng xuất
            </button>
          </div>
        </div>
      </header>
      <main className={cx("mx-auto w-full flex-1 px-4 py-8", wide ? "max-w-7xl" : "max-w-5xl")}>{children(me as Me & { user: Profile })}</main>
    </>
  );
}
