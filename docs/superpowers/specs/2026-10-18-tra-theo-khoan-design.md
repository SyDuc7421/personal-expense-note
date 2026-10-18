# Nhắc và đánh dấu đã trả theo từng khoản

Ngày: 2026-10-18

## Ý định

Màn hình chi tiết nợ của một bạn (`FriendDetailScreen`) hiện chỉ có:

- **Paid**: nhập một số tiền, không gắn với khoản nào. Tiền được trừ FIFO vào khoản cũ nhất.
- **Remind**: gửi tin nhắc liệt kê *mọi* khoản còn nợ.

Người dùng không biết khoản nào đã trả hay chưa, cũng không thể nhắc hoặc đánh dấu trả riêng một khoản. Ví dụ: A nợ Cafe 16k và một khoản 35k cùng ngày. A trả đúng tiền Cafe, nhưng app không cho đánh dấu Cafe là đã trả. Nếu nhập 16k qua Paid, FIFO có thể trừ vào khoản 35k.

Mục tiêu: chọn một hoặc nhiều khoản để **nhắc** hoặc **đánh dấu đã trả**, và nhìn lịch sử là thấy ngay khoản nào đã trả.

## Mục tiêu

1. Có chế độ chọn khoản trong mục Lịch sử của chi tiết nợ.
2. Nhắc nợ chỉ cho các khoản đã chọn.
3. Đánh dấu các khoản đã chọn là đã trả. Số dư giảm đúng bằng số còn nợ của các khoản đó.
4. Lịch sử hiển thị trạng thái từng khoản: đã trả, trả một phần (còn X), hoặc chưa trả.
5. Hoàn tác được ngay sau khi đánh dấu đã trả.

## Không làm (non-goals)

- Không bỏ cách trả theo số tiền. **Paid** và **Remind** ngoài chế độ chọn giữ nguyên hành vi.
- Không thêm tính năng xóa lần trả từ lịch sử. `removeSettlement` có sẵn ở repository nhưng không đưa ra UI, ngoại trừ nút Hoàn tác.
- Không đổi màn hình danh sách Nợ, ngoài việc tính "khoản cũ nhất" theo cách phân bổ mới.
- Không làm chọn nhiều bạn cùng lúc.

## Phản mục tiêu (sai dù chạy được)

- Số dư (`balance`) thay đổi so với hiện tại với cùng dữ liệu. Công thức `Σ debts − Σ settlements` phải giữ nguyên.
- Dữ liệu cũ hoặc backup cũ bị lỗi, mất, hay đổi số dư sau khi cập nhật.
- Màn hình chi tiết bình thường (ngoài chế độ chọn) rối hơn hiện tại. Người dùng chọn kiểu "bấm Chọn mới hiện ô tick" chính vì muốn giữ màn hình gọn.

## Quyết định của người dùng

- **Giao diện kiểu B**: mặc định không có ô tick. Góc tiêu đề mục Lịch sử có nút **"Chọn"**. Bấm vào thì vào chế độ chọn, nút đổi thành **"Xong"** để thoát. Giống cách chọn ảnh trong app Ảnh trên iOS.
- Trong chế độ chọn:
  - Chỉ khoản nợ (debt) còn nợ (`remaining > 0`) mới có ô tick. Khoản đã trả và các dòng "lần trả" không tick được.
  - Khi đã chọn ≥ 1 khoản, hai nút dưới đổi thành **"Nhắc (n)"** và **"Đã trả (n)"**.
- **Giữ cách nhập tiền như hiện tại** cho Paid, dùng cho các lần trả lẻ không khớp khoản nào.
- Khoản đã trả vẫn nằm trong lịch sử: chữ xám, số tiền gạch ngang, có nhãn "đã trả".
- Người dùng đã đồng ý cách hai kiểu trả cùng tồn tại (mục *Mô hình phân bổ* bên dưới).
- **Bỏ qua dữ liệu cũ đã phân bổ nhầm**. Ví dụ: một lần Paid 16k trước bản cập nhật bị FIFO trừ vào khoản 35k, nên Cafe vẫn hiện là chưa trả. Không có migration, không có cách liên kết lại, không có màn hình sửa. Nếu người dùng tick Cafe rồi bấm "Đã trả" thì số dư bị trừ hai lần, và đây là hành vi được chấp nhận.

## Quyết định của Claude (người dùng chưa xác nhận riêng)

- **Hoàn tác**: sau "Đã trả (n)", hiện toast có nút "Hoàn tác". Bấm thì gọi `removeSettlement(id)`. Đây là **cách duy nhất** để bỏ đánh dấu. Khi toast đã tắt thì không sửa được nữa. Đề xuất cho xóa lần trả từ lịch sử chưa được người dùng chọn, nên không làm.
- Sau "Đã trả (n)" tự thoát chế độ chọn. Sau "Nhắc (n)" giữ nguyên chế độ chọn và các khoản đã chọn, để người dùng có thể đánh dấu đã trả tiếp.
- Ngoài chế độ chọn, khi không chọn gì, Remind/Paid giữ nguyên như cũ.
- Nút "Chọn" ẩn khi không có khoản nào còn nợ.
- Lần trả theo khoản hiển thị trong lịch sử là "Trả: <ghi chú các khoản>". Ví dụ "Trả: Cafe" hoặc "Trả: Cafe, 18/10". Nhãn được **tính lúc hiển thị** từ các khoản liên kết, không lưu vào `note`, để đổi ghi chú giao dịch thì nhãn tự cập nhật. Khoản không có ghi chú thì dùng ngày `dd/MM`. Không tìm được khoản liên kết nào (đã xóa) thì dùng nhãn hiện có `debts.settlementItem`.

## Mô hình dữ liệu

Thêm field tùy chọn vào `Settlement`:

```ts
export interface Settlement extends Syncable {
  friendId: string
  amount: number
  date: string
  note: string
  /** Set when the user marked specific debts paid; absent for amount-only settlements. */
  debtIds?: string[]
}
```

- **Không bump Dexie version**: field không được index.
- **Snapshot**: thêm `debtIds: z.array(z.string()).optional()` vào `settlementSchema`. Giữ `SCHEMA_VERSION = 1`, vì backup cũ không có field này vẫn hợp lệ. *(Claude chọn. Hệ quả: bản app cũ import backup mới sẽ bỏ qua `debtIds`. Số dư vẫn đúng, chỉ có phần phân bổ quay về FIFO.)*
- `LedgerRepository.addSettlement` nhận thêm `debtIds?: string[]`. Validate: không rỗng nếu có, không trùng lặp, mọi id phải là debt còn sống của đúng `friendId`. Sai thì ném `DomainError`, mã lỗi do người build chọn.
- `amount` của lần trả theo khoản = tổng `remaining` của các khoản được chọn **tại thời điểm đánh dấu**.

## Mô hình phân bổ (thay `fifoOutstanding`)

Số dư không đổi: `balance = Σ debts − Σ settlements`. Chỉ thay cách tính **khoản nào còn nợ bao nhiêu**:

1. **Lần trả theo khoản** (có `debtIds`): với mỗi lần trả, theo thứ tự `date` rồi `createdAt`, lấy `amount` trừ vào các debt trong `debtIds`, mỗi debt tối đa phần còn lại của nó. Thứ tự giữa các debt dùng chung quy tắc FIFO: ngày giao dịch, rồi `debtId`.
2. Phần tiền **thừa** của một lần trả theo khoản đi vào quỹ chung. Tiền thừa xuất hiện khi debt liên kết đã bị xóa hoặc bị sửa nhỏ đi sau khi đánh dấu.
3. **Lần trả theo số tiền** (không có `debtIds`) cộng với quỹ chung, rồi trừ FIFO vào các debt còn nợ, cũ nhất trước. Giống hành vi hiện tại.
4. Mỗi debt có kết quả `remaining`:
   - `0`: đã trả.
   - `< amount`: trả một phần.
   - `= amount`: chưa trả.

Hệ quả cần đúng:

- Không có lần trả theo khoản nào thì kết quả giống hệt `fifoOutstanding` hiện tại. Cần test chứng minh.
- Nếu debt bị sửa **lớn hơn** sau khi đánh dấu đã trả, phần chênh hiện là còn nợ.
- Tổng `remaining` của mọi debt = `max(0, balance)` khi không có tiền trả dư. Trả dư thì số dư âm như hiện tại.

Hàm mới nằm trong `src/domain/balance.ts`, là hàm thuần và có test, kể cả property test bằng `fast-check` như các test domain hiện có. Nó trả về mọi debt kèm `remaining`, không chỉ các debt còn nợ, để UI hiện được trạng thái "đã trả". Hai chỗ đang gọi `fifoOutstanding` chuyển sang hàm mới:

- `useFriendDetailViewModel` (outstanding và timeline)
- `useDebtsViewModel` (khoản cũ nhất, tuổi nợ)

Có giữ `fifoOutstanding` hay không là việc của người build.

## Giao diện và hành vi

Màn hình `FriendDetailScreen`:

- Tiêu đề "Lịch sử" có nút "Chọn"/"Xong" bên phải.
- Dòng debt hiển thị trạng thái:
  - Chưa trả: như hiện tại.
  - Trả một phần: thêm "còn 15.000 ₫".
  - Đã trả: chữ muted, số tiền gạch ngang, nhãn "đã trả".
- Chế độ chọn:
  - Ô tick (checkbox) ở đầu các dòng tick được. Chạm vào cả dòng là toggle.
  - Thanh nút dưới: chưa chọn gì thì hai nút disable, nhãn "Nhắc"/"Đã trả". Đã chọn thì "Nhắc (n)"/"Đã trả (n)".
- **Nhắc (n)**: `buildReminder` với các khoản đã chọn, dùng `remaining` của chúng. Share hoặc copy như hiện tại.
- **Đã trả (n)**: gọi ngay `addSettlement({ friendId, amount: Σ remaining, date: today, note: '', debtIds })`, không cần drawer xác nhận. Sau đó toast "Đã đánh dấu n khoản đã trả" kèm action "Hoàn tác", rồi thoát chế độ chọn.
- Touch target ≥ 44px. Test e2e hiện có (`e2e/helpers/touchTargets.ts`) phải tiếp tục pass.
- Chuỗi mới có cả `vi.ts` và `en.ts`.

## Tài liệu cần cập nhật

`docs/SPEC.md`:

- **5.2**: hiện viết "Không lưu trạng thái đã trả trên từng Debt". Vẫn đúng, nhưng thêm ý settlement có thể gắn `debtIds`.
- **5.3 và 7.3**: mô tả mô hình phân bổ mới và chế độ chọn.
- Kiểu `Settlement` ở mục dữ liệu.

## Ràng buộc

- Kiến trúc hiện có: `domain/` thuần, `data/` repository Dexie, viewmodel hook, view chỉ render.
- Field mới phải tương thích với sync sau này (SPEC mục sync). Field tùy chọn trên entity Syncable là đủ.
- Không thêm dependency.

## Để người build quyết định

- Tên hàm phân bổ, mã lỗi validate, cấu trúc state chế độ chọn trong viewmodel.
- Chi tiết style của ô tick và nhãn "đã trả", miễn hợp với design hiện có (amber/muted tokens, `Amount`).
- Có cập nhật screenshot review (`pnpm e2e:screenshots`) cho màn hình nợ hay không.
