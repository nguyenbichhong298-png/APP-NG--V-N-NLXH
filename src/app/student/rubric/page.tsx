"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { ErrorCodeTable, RubricViewer } from "@/components/RubricViewer";
import { Badge, Card, PageHeader, Steps, cx } from "@/components/ui";
import { ERROR_CODE_MAP } from "@/lib/error-codes";

// Tình huống luyện nhận diện mã lỗi trước khi đánh giá thật.
const QUIZ = [
  { text: "“Có rất nhiều bạn trẻ đã trở thành nhà phát minh nổi tiếng.” (không nêu tên, sự việc cụ thể)", answer: "BC", options: ["BC", "PT", "LL-LK"] },
  { text: "Bài nêu dẫn chứng về một nhà khoa học rồi chuyển ngay sang ý khác, không giải thích dẫn chứng chứng minh điều gì.", answer: "PT", options: ["LK", "PT", "BC"] },
  { text: "“Cần học giỏi, đầu tư, sáng tạo, hợp tác, đổi mới.” – không giải thích từng giải pháp.", answer: "LL-LK", options: ["LL-S", "LL-LK", "LL"] },
  { text: "Đề yêu cầu đề xuất giải pháp nhưng bài chỉ bàn về vai trò của công nghệ.", answer: "LĐ-SL", options: ["LĐ-CC", "LĐ-SL", "LL-S"] },
  { text: "Bài viết 4 đoạn, mỗi giải pháp xuống dòng thành một đoạn riêng.", answer: "HT-XD", options: ["HT-DL", "HT-XD", "CT-NG"] },
];

export default function StudentRubricPage() {
  return (
    <AppShell role="student" wide>
      {() => (
        <>
          <Steps current={1} />
          <PageHeader
            step="Bước 1"
            title="Tìm hiểu rubric"
            subtitle="Đọc kĩ bốn tiêu chí và các mức đánh giá. Nhấn vào một ô để xem các mã lỗi thường gặp khi chưa đạt mức tối đa."
          />
          <div className="space-y-6">
            <RubricViewer />
            <Card>
              <h2 className="mb-3 font-semibold">Bảng mã lỗi chẩn đoán nhanh</h2>
              <ErrorCodeTable />
            </Card>
            <Quiz />
          </div>
        </>
      )}
    </AppShell>
  );
}

function Quiz() {
  const [picked, setPicked] = useState<Record<number, string>>({});
  const correct = QUIZ.filter((q, i) => picked[i] === q.answer).length;
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Tự kiểm tra: đây là lỗi gì?</h2>
        <Badge tone="info">
          Đúng {correct}/{QUIZ.length}
        </Badge>
      </div>
      <ol className="mt-3 space-y-4 text-sm">
        {QUIZ.map((q, i) => (
          <li key={i}>
            <p>
              {i + 1}. {q.text}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {q.options.map((o) => {
                const chosen = picked[i] === o;
                return (
                  <button
                    key={o}
                    onClick={() => setPicked((p) => ({ ...p, [i]: o }))}
                    className={cx(
                      "rounded-lg border px-3 py-1.5",
                      chosen ? (o === q.answer ? "border-ok bg-ok-soft text-ok" : "border-accent bg-accent-soft text-accent") : "border-line",
                    )}
                  >
                    <span className="font-mono font-semibold">{o}</span> {ERROR_CODE_MAP[o].shortName}
                  </button>
                );
              })}
            </div>
            {picked[i] && (
              <p className="mt-1 text-xs text-muted">
                {picked[i] === q.answer ? "Chính xác. " : `Chưa đúng – đáp án: ${q.answer}. `}
                {ERROR_CODE_MAP[q.answer].explanation}
              </p>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}
