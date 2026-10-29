"use client";

import { AppShell } from "@/components/AppShell";
import { TeacherPeerReviewDashboard } from "@/components/TeacherPeerReviewDashboard";

export default function TeacherHome() {
  return <AppShell role="teacher" wide>{() => <TeacherPeerReviewDashboard />}</AppShell>;
}
