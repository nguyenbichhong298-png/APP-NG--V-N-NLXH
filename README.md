# AI Ngữ Văn – Đánh giá đồng đẳng & chẩn đoán lỗi (NLXH 200 chữ)

Ứng dụng luyện viết đoạn văn nghị luận xã hội 200 chữ theo quy trình sư phạm 5 bước:
công khai rubric → đọc bài của bạn → chấm theo rubric & chẩn đoán mã lỗi → phản hồi 3 bước → người viết tiếp nhận và viết lại.
AI (Claude) chấm độc lập theo rubric; giáo viên quản lí đợt, ghép cặp, chấm đối chiếu và xem thống kê.

Công nghệ: Next.js 16 (App Router) · Supabase (Postgres + Auth) · Claude API · Vercel.

## Chạy thử trên máy

```bash
npm install
npm run dev
```

Mở http://localhost:3000. Khi chưa cấu hình Supabase, ứng dụng chạy **chế độ thử nghiệm**: dữ liệu lưu ở `.data/db.json`, đăng nhập bằng tài khoản mẫu (1 giáo viên, 6 học sinh).
Để AI chấm bài, đặt `ANTHROPIC_API_KEY` trong `.env.local`.

```bash
npm test          # kiểm thử đơn vị (rubric, tính điểm, ghép cặp, thống kê, hậu xử lí AI)
npm run build     # build production
```

## Triển khai

1. Tạo dự án Supabase, chạy `supabase/migrations/0001_peer_review.sql` trong SQL Editor.
2. Trên Vercel, nhập repo và đặt biến môi trường theo `.env.example` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TEACHER_EMAILS`, `ANTHROPIC_API_KEY`).
3. Giáo viên đăng kí bằng email có trong `TEACHER_EMAILS`; học sinh tự tạo tài khoản ở trang đăng nhập.

Chế độ thử nghiệm không dùng được trên Vercel (hệ thống tệp chỉ đọc) — production luôn cần Supabase.

## Đối chiếu tài liệu gốc → chức năng

| Tài liệu gốc | Chức năng | Mã nguồn |
|---|---|---|
| Rubric 2026: 4 tiêu chí × 4 mức, điểm từng mức | Rubric số (giữ nguyên mô tả và điểm) | `src/lib/rubric.ts` |
| Phiếu: 11 mã lỗi theo 4 nhóm | Bảng mã lỗi + giải thích, dấu hiệu, cách sửa, ví dụ (nội dung bổ sung chờ GV duyệt) | `src/lib/error-codes.ts` |
| Phiếu phần I – Bảng ghi điểm & chẩn đoán lỗi | `PeerReviewForm`, `RubricLevelSelector`, `DiagnosticErrorSelector` | `src/components/` |
| Phiếu phần II – Phản hồi 3 bước | `ThreeStepFeedback` (+ AI kiểm tra, không viết thay) | `src/components/ThreeStepFeedback.tsx` |
| Phiếu phần III – Phản hồi từ người viết | `WriterResponseForm`, `EssayRevisionEditor`, `RevisionComparison` | `src/components/` |
| Xuất phiếu giấy | `PeerAssessmentReport` (in / lưu PDF) | `/reports/[id]` |
| AI chấm độc lập | `AIGradingReport`, `src/lib/server/ai.ts` | `/ai/[versionId]` |
| Giáo viên | `TeacherPeerReviewDashboard`, quản lí đợt, thống kê | `/teacher`, `/teacher/rounds/[id]` |

### Mức điểm (đúng Rubric gốc)

| Tiêu chí | Tối đa | Mức 4 | Mức 3 | Mức 2 | Mức 1 |
|---|---|---|---|---|---|
| 1. Xác định vấn đề nghị luận | 0,25 | 0,25 | 0,25 | 0,25 | 0,00 |
| 2. Nội dung giải pháp / ý kiến | 1,00 | 1,00 | 0,75 | 0,50 | 0,25 |
| 3. Kĩ năng lập luận & Bằng chứng | 0,50 | 0,50 | 0,25 | 0,00 | 0,00 |
| 4. Hình thức & Diễn đạt | 0,25 | 0,25 | 0,25 | 0,25 | 0,00 |

### Điểm tài liệu gốc chưa thống nhất (chờ giáo viên xác nhận)

Các điểm này **không làm thay đổi điểm số**. Chúng được hiển thị dưới bảng rubric, và giáo viên ghi quyết định khi xác nhận rubric (`/teacher/rubric`):

1. Tiêu chí 3 chưa có mức cho trường hợp đáp ứng 02/03 yêu cầu (đề xuất: Mức 3).
2. Tiêu chí 4: vế thứ hai của Mức 2 và Mức 1 trùng nội dung.
3. Tiêu chí 2: một số tổ hợp số ý chưa được quy định. Bảng tra hiển thị “GV quyết định” cho các tổ hợp này; hệ thống không tự quy đổi.
4. Các ý 1.1–2.3 lấy từ Đáp án của đề 2026; đề mẫu có ô để giáo viên nhập. Với đề mới, giáo viên nhập và **xác nhận** yêu cầu nội dung trước khi AI chấm.

## Nguyên tắc nghiệp vụ đã cài đặt

- Điểm = điểm của mức theo rubric; máy chủ tính lại, không tin điểm client gửi. Số lượng mã lỗi không trừ thêm điểm.
- Tiêu chí chưa đạt tối đa ⇒ bắt buộc chọn mã lỗi hoặc giải thích nguyên nhân. Có mã lỗi ⇒ phải chọn một lỗi chính trong các mã đã tích.
- Học sinh chỉ chấm được sau khi giáo viên công khai rubric. Điểm AI bị ẩn cho đến khi học sinh nộp xong phiếu của mình và giáo viên cho công bố.
- Bài gốc và bản sửa là hai phiên bản độc lập (`essay_versions`). Mỗi phiếu gắn đúng người viết, người đánh giá, đề, phiên bản rubric và phiên bản bài.
- AI trích dẫn được đối chiếu nguyên văn với bài; trích dẫn không khớp bị gắn cờ. Lỗi theo mã được tách khỏi gợi ý nâng cao diễn đạt.
