"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Loading } from "@/components/ui";
import { api } from "@/lib/client/api";
import type { Profile } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    api<{ user: Profile | null }>("/api/me")
      .then(({ user }) => router.replace(!user ? "/login" : user.role === "teacher" ? "/teacher" : "/student"))
      .catch(() => router.replace("/login"));
  }, [router]);
  return (
    <main className="mx-auto w-full max-w-5xl px-4">
      <Loading />
    </main>
  );
}
