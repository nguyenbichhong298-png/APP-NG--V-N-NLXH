"use client";

import { useEffect, useRef, useState } from "react";
import { api, ClientError, formatDate } from "@/lib/client/api";
import { formSignals, WORD_RANGE } from "@/lib/text";
import type { EssayVersion } from "@/lib/types";
import { Alert, Badge, Button, Textarea } from "./ui";

/**
 * Trình soạn thảo bài viết. Dùng cho cả bài gốc và bản chỉnh sửa.
 * Mỗi lần nộp tạo/ghi một phiên bản độc lập ở máy chủ; bản nháp được lưu cả ở máy chủ và trình duyệt.
 */
export function EssayRevisionEditor({
  endpoint,
  initialText,
  draftKey,
  savedAt: initialSavedAt,
  submitLabel = "Nộp bài",
  confirmText = "Nộp bài viết? Sau khi nộp sẽ không sửa được phiên bản này.",
  onSubmitted,
}: {
  endpoint: string;
  initialText: string;
  draftKey: string;
  savedAt?: string | null;
  submitLabel?: string;
  confirmText?: string;
  onSubmitted: (v: EssayVersion) => void;
}) {
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState<"draft" | "submit" | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(initialSavedAt ?? null);
  const [msg, setMsg] = useState<{ tone: "ok" | "error" | "info"; text: string } | null>(null);
  const dirty = useRef(false);
  const s = formSignals(text);

  // Khôi phục bản nháp trong trình duyệt nếu mới hơn bản ở máy chủ.
  useEffect(() => {
    try {
      const local = localStorage.getItem(draftKey);
      if (local && local !== initialText && local.trim()) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- khôi phục nháp một lần khi mở trình soạn thảo
        setText(local);
        dirty.current = true;
        setMsg({ tone: "info", text: "Đã khôi phục bản nháp chưa lưu trên trình duyệt này." });
      }
    } catch {
      /* trình duyệt chặn lưu trữ cục bộ */
    }
  }, [draftKey, initialText]);

  const change = (v: string) => {
    setText(v);
    dirty.current = true;
    try {
      localStorage.setItem(draftKey, v);
    } catch {
      /* bỏ qua */
    }
  };

  const save = async (submit: boolean) => {
    if (submit && !confirm(confirmText)) return;
    setSaving(submit ? "submit" : "draft");
    try {
      const v = await api<EssayVersion>(endpoint, { method: "PUT", body: { content: text, submit } });
      dirty.current = false;
      setSavedAt(v.created_at && !submit ? new Date().toISOString() : v.submitted_at);
      setMsg({ tone: "ok", text: submit ? "Đã nộp." : "Đã lưu nháp lên máy chủ." });
      if (submit) {
        try {
          localStorage.removeItem(draftKey);
        } catch {
          /* bỏ qua */
        }
        onSubmitted(v);
      }
    } catch (e) {
      setMsg({ tone: "error", text: (e as ClientError).message });
    } finally {
      setSaving(null);
    }
  };

  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    const t = setInterval(() => {
      if (dirty.current) void saveRef.current(false);
    }, 45000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-3">
      <Textarea
        rows={14}
        value={text}
        onChange={(e) => change(e.target.value)}
        className="essay-text text-base"
        placeholder="Viết đoạn văn của bạn tại đây (một đoạn, khoảng 200 chữ)…"
        aria-label="Nội dung bài viết"
      />
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge tone={s.lengthOk ? "ok" : "warn"}>
          {s.words} chữ (yêu cầu {WORD_RANGE.target} ± 100)
        </Badge>
        <Badge tone={s.singleParagraph ? "ok" : "warn"}>{s.paragraphs <= 1 ? "Một đoạn văn" : `${s.paragraphs} đoạn – nên viết liền một đoạn`}</Badge>
        <span className="text-muted">{savedAt ? `Lưu lần cuối: ${formatDate(savedAt)}` : "Chưa lưu"} · Tự lưu mỗi 45 giây</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => save(false)} loading={saving === "draft"}>
          Lưu nháp
        </Button>
        <Button onClick={() => save(true)} loading={saving === "submit"} disabled={s.words < 30}>
          {submitLabel}
        </Button>
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </div>
  );
}
