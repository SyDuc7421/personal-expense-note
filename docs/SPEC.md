# Personal expense note: Spec

> App quản lý chi tiêu cá nhân + sổ nợ bạn bè. Chạy offline hoàn toàn trên iPhone dưới dạng PWA. Dữ liệu làm việc nằm trên máy (local-first), đồng bộ giữa các thiết bị qua một **JSON snapshot** lưu trên Vercel.

## 1. Mục tiêu

- Ghi chi tiêu/thu nhập **cực nhanh** bằng một dòng text.
- Tách bạch **chi tiêu thật của mình** và **tiền trả hộ người khác** (receivable).
- Luôn biết "ai đang nợ mình bao nhiêu, từ bao lâu", và có cách nhắc nợ không ngại.
- 100% dùng được offline. Có mạng thì tự đồng bộ và backup lên Vercel (Vercel Functions + Vercel Blob), không cần VPS.

### Non-goals (không làm ở MVP)
- Không có hệ thống account/đăng ký. Mỗi người dùng có một **mã đồng bộ** (sync secret) do app sinh ngẫu nhiên; mỗi mã là một kho dữ liệu riêng trên server, dùng chung cho mọi thiết bị của người đó.
- Không sync realtime. Sync theo sự kiện (mở app, sau khi ghi, bấm tay), xem mục 9.
- Không multi-currency (chỉ VND).
- Không kết nối ngân hàng.
- Bạn bè không dùng app. Chỉ mình ghi chép.

## 2. Tech stack

| Phần | Lựa chọn |
|---|---|
| Build | Vite + React + TypeScript (strict) |
| UI | Tailwind CSS + shadcn/ui, mobile-first |
| Routing | React Router |
| Storage | IndexedDB qua **Dexie.js** + `dexie-react-hooks` (`useLiveQuery`) |
| PWA / offline | `vite-plugin-pwa` (Workbox), precache toàn bộ asset |
| Chart | Recharts |
| Date | date-fns |
| Test | Vitest (bắt buộc cho parser, balance, merge), fast-check cho property-based test |
| Validation | zod (validate snapshot ở cả client và API) |
| Sync API | Vercel Functions (`/api/snapshot`), Node runtime |
| Sync storage | **Vercel Blob, private store**, một file `snapshot.json` |
| Deploy | Vercel (static frontend + functions) |

Lý do không dùng Next.js: app không cần SSR, API chỉ có một endpoint (đặt ở thư mục `api/` root, Vercel tự nhận là Functions), và `vite-plugin-pwa` là cách làm offline PWA đơn giản và ổn định nhất.

## 3. Quy ước chung

- Tiền lưu dạng **integer VND** (không float). Hiển thị bằng `Intl.NumberFormat('vi-VN')`, ví dụ `35.000 ₫`.
- Ngày lưu dạng ISO string (`YYYY-MM-DD` cho `date`, ISO đầy đủ cho `createdAt`/`updatedAt`/`deletedAt`).
- ID: `crypto.randomUUID()`, sinh ở client. Bắt buộc vì nhiều thiết bị tạo bản ghi offline cùng lúc.
- UI tiếng Việt. Code, tên biến và comment bằng tiếng Anh.

## 4. Data model (Dexie)

Mọi entity đồng bộ (Friend, Transaction, Debt, Settlement) có chung các field:
```ts
interface Syncable {
  id: string;
  createdAt: string;
  updatedAt: string;       // cập nhật ở MỌI lần ghi; dùng cho merge (mục 9)
  deletedAt: string | null; // soft delete (tombstone); KHÔNG xóa thật khỏi DB
}
```

```ts
interface Friend extends Syncable {
  id: string;
  name: string;          // unique (case/dấu-insensitive) trong các friend chưa xóa — enforce ở app, KHÔNG dùng unique index
  archived: boolean;     // ẩn khỏi gợi ý nhưng giữ lịch sử
}

interface Transaction extends Syncable {
  id: string;
  type: 'expense' | 'income';
  amount: number;        // TỔNG số tiền mình đã chi ra / nhận vào
  category: string;      // id trong CATEGORIES
  note: string;
  date: string;          // YYYY-MM-DD
  rawInput?: string;     // dòng quick input gốc, để debug/sửa
}

interface Debt extends Syncable {
  id: string;
  transactionId: string; // FK -> Transaction (expense)
  friendId: string;      // FK -> Friend
  amount: number;        // phần của friend mà mình trả hộ, > 0
}

interface Settlement extends Syncable {
  id: string;
  friendId: string;
  amount: number;        // friend trả lại mình, > 0
  date: string;
  note: string;
  debtIds?: string[];    // có khi đánh dấu trả theo khoản; không có = trả theo số tiền
}

interface Meta {          // KHÔNG đồng bộ, riêng từng thiết bị
  key: string;            // 'deviceId', 'syncSecret', 'lastSyncAt', 'remoteEtag', 'lastExportAt', ...
  value: string;
}
```

Dexie schema:
```ts
db.version(1).stores({
  friends: 'id, name, archived, updatedAt',
  transactions: 'id, date, type, category, updatedAt',
  debts: 'id, transactionId, friendId, updatedAt',
  settlements: 'id, friendId, date, updatedAt',
  meta: 'key',
});
```
- Mọi query đọc dữ liệu (repository) **phải lọc `deletedAt === null`**. Đặt logic này trong repository, không để rải rác ở ViewModel.
- Không dùng unique index trên `friends.name`: hai thiết bị có thể cùng tạo "Nam" offline với id khác nhau, unique index sẽ làm merge thất bại. Xử lý trùng tên ở mục 9.6.

## 5. Business rules

### 5.1 Chi tiêu thật
```
myShare(tx) = tx.amount − Σ debts where debt.transactionId = tx.id
```
- **Mọi báo cáo chi tiêu** (tổng tháng, chart category) chỉ dùng `myShare`, không dùng `amount`.
- Invariant: `0 ≤ Σ debts ≤ tx.amount`.

### 5.2 Số dư với từng bạn
```
balance(friend) = Σ debts(friend) − Σ settlements(friend)
```
- `> 0`: bạn nợ mình. `< 0`: mình đang nợ bạn (do bạn trả dư). `= 0`: hết nợ.
- Không lưu trạng thái "đã trả" trên từng Debt. Mọi thứ tính từ tổng.
- Settlement có thể gắn `debtIds` (trả theo khoản). Field này chỉ đổi cách phân bổ ở 5.3, không đổi công thức balance.

### 5.3 Tuổi nợ (age)
Phân bổ settlements vào từng debt (`allocateSettlements`):
1. Settlement có `debtIds` (theo `date`, rồi `createdAt`) trừ vào đúng các debt đó, mỗi debt tối đa phần còn lại.
2. Phần thừa (debt đã xóa hoặc bị sửa nhỏ đi) cộng với các settlement không có `debtIds` thành một quỹ chung, trừ FIFO vào các debt cũ nhất trước.
3. Mỗi debt có `remaining`: `0` = đã trả, `< amount` = trả một phần, `= amount` = chưa trả.

Không có settlement nào gắn `debtIds` thì kết quả giống FIFO thuần. "Khoản cũ nhất chưa trả" là debt đầu tiên chưa bị trừ hết, và tuổi nợ = số ngày từ `date` của transaction đó tới hôm nay. Đây là giá trị **tính toán**, không lưu.

### 5.4 Chia tiền
- Chia đều, làm tròn xuống tới đơn vị **1.000 ₫**. Phần dư do làm tròn tính vào phần của mình.
- Form chỉnh sửa cho phép override số tiền từng người.

### 5.5 Xóa
- Mọi thao tác xóa là **soft delete**: set `deletedAt` và `updatedAt` = now.
- Xóa Transaction thì soft delete luôn các Debt liên quan (trong một Dexie transaction), có confirm dialog.
- Không cho xóa Friend còn balance ≠ 0, chỉ cho archive.

## 6. Quick input parser

Một ô input duy nhất ở màn hình chính. Parse realtime và hiện **preview** ("Chi 600.000 ₫ · Ăn uống · Nam, Huy, Linh nợ 150.000 ₫ mỗi người · phần bạn 150.000 ₫") trước khi bấm lưu.

### 6.1 Cú pháp

```
[+]<amount> | <note> <amount>  [/N]  [cho]  [@friend ...]  [#category]
```

**Amount:**
- `35k` = 35.000, `1.5tr` hoặc `1,5tr` = 1.500.000, `2tr5` = 2.500.000, `35000` = 35.000, `35.000` = 35.000
- Số trần < 1000 (ví dụ `35`) được hiểu là nghìn: `35` → 35.000
- Không phân biệt hoa thường: `K`, `TR`

**Thu nhập:** bắt đầu bằng `+`, ví dụ `+500k lương`

**Mention:** `@Nam`. Match friend theo tên, không phân biệt hoa thường và không phân biệt dấu (`@huy` khớp "Huy"). Tên chưa tồn tại → preview hỏi "Tạo bạn mới 'Nam'?".

**Quy tắc chia** (mentions = M người):
| Input | Ý nghĩa | Mỗi friend nợ | Phần mình |
|---|---|---|---|
| `cafe 35k` | chi bình thường | – | 35k |
| `cafe 70k @Nam` | chia đều mình + M bạn | 70k/2 | phần còn lại |
| `lẩu 600k /4 @Nam @Huy @Linh` | chia N phần, N ≥ M+1 | 600k/4 | phần còn lại |
| `lẩu 600k /5 @Nam @Huy` | N > M+1: phần của người không mention tính vào mình | 600k/5 | 600k − 2×120k |
| `grab 50k cho @Huy` | trả hộ toàn bộ, mình không chịu phần nào | 50k/M | 0 |

`/N` với N < M+1 → lỗi parse.

**Category:** `#anuong` để chỉ định thủ công. Nếu không có, auto-detect từ keyword trong note (xem 6.3); không khớp thì dùng `khac`.

**Ngày:** mặc định hôm nay. Tùy chọn: `hqua` / `hôm qua`, hoặc `dd/mm`.

### 6.2 Yêu cầu implementation
- Parser là **pure function** `parse(input: string, friends: Friend[]): ParseResult | ParseError`, tách hẳn khỏi UI.
- `ParseResult` gồm: type, amount, note, category, date, splits `{ friendName, friendId?, amount }[]`, myShare.
- Có unit test cho **mọi dòng** trong bảng trên + các case: không có amount, amount = 0, nhiều amount, mention trùng, tên có dấu, `/N` không hợp lệ.

### 6.3 Categories (preset)
```ts
const CATEGORIES = [
  { id: 'anuong',   label: 'Ăn uống',   icon: '🍜', keywords: ['cafe','cà phê','trà sữa','cơm','phở','bún','lẩu','ăn','nhậu'] },
  { id: 'dichuyen', label: 'Di chuyển', icon: '🛵', keywords: ['grab','be','xăng','gửi xe','taxi'] },
  { id: 'muasam',   label: 'Mua sắm',   icon: '🛍️', keywords: ['shopee','lazada','tiki','quần','áo'] },
  { id: 'hoadon',   label: 'Hóa đơn',   icon: '🧾', keywords: ['điện','nước','wifi','net','tiền nhà','4g'] },
  { id: 'giaitri',  label: 'Giải trí',  icon: '🎮', keywords: ['phim','game','netflix','spotify','karaoke'] },
  { id: 'suckhoe',  label: 'Sức khỏe',  icon: '💊', keywords: ['thuốc','khám','gym'] },
  { id: 'hoctap',   label: 'Học tập',   icon: '📚', keywords: ['sách','khóa học','học phí'] },
  { id: 'thunhap',  label: 'Thu nhập',  icon: '💰', keywords: ['lương','thưởng'] },
  { id: 'khac',     label: 'Khác',      icon: '📦', keywords: [] },
];
```
Match keyword không phân biệt hoa thường và dấu.

## 7. Màn hình

Bottom tab bar gồm 4 tab: **Tổng quan · Giao dịch · Nợ · Cài đặt**.

### 7.1 Tổng quan (home)
- Quick input ở trên cùng, autofocus. Preview hiện ngay bên dưới, có nút Lưu. Enter cũng lưu.
- Card **"Chi tháng này"**: tổng `myShare`, so sánh % với tháng trước.
- Card **"Đang có X ngoài kia"**: Σ balance dương của tất cả bạn bè. Bấm vào thì chuyển sang tab Nợ.
- Donut chart chi tiêu theo category trong tháng (theo `myShare`).
- 5 giao dịch gần nhất.

### 7.2 Giao dịch
- List nhóm theo ngày, có tổng mỗi ngày. Infinite scroll hoặc load theo tháng.
- Filter: tháng, category, type, "có trả hộ".
- Mỗi item hiện note, category icon, amount, và badge "trả hộ Nam, Huy" nếu có debt.
- Bấm vào item mở form edit đầy đủ (sửa amount, category, date, note, danh sách split với amount từng người). Validate invariant ở 5.1.
- Nút "+" mở form nhập thủ công (không qua parser).

### 7.3 Nợ
- Header: tổng người ta nợ mình, và tổng mình nợ người ta (nếu có).
- List friend có balance ≠ 0. Sort mặc định theo tuổi nợ cũ nhất, có thể đổi sang sort theo số tiền.
  - Mỗi dòng: tên, balance, "khoản cũ nhất: 23 ngày". Tô màu cảnh báo khi > 30 ngày.
- Chi tiết friend:
  - Timeline gồm debts và settlements, xen kẽ theo ngày. Debt hiện trạng thái: đã trả (gạch ngang, nhãn "đã trả"), trả một phần ("còn X"), chưa trả.
  - Nút **"Chọn"** ở tiêu đề Lịch sử: bật chế độ chọn, các debt còn nợ có ô tick. Đã chọn ≥ 1 khoản thì hai nút dưới thành **"Nhắc (n)"** (chỉ nhắc các khoản đã chọn) và **"Đã trả (n)"** (tạo settlement gắn `debtIds`, amount = tổng phần còn lại; toast có "Hoàn tác").
  - Nút **"Đã trả"**: nhập số tiền, mặc định = toàn bộ balance, có thể nhập một phần.
  - Nút **"Nhắc"**: sinh tin nhắn rồi `navigator.share({ text })` (fallback: copy clipboard + toast).
- Mẫu tin nhắn nhắc nợ (giọng nhẹ nhàng, có thể chỉnh trong Cài đặt):
  ```
  Ê Nam, tổng kết tí nha 😄
  • 12/10 – Lẩu: 150.000đ
  • 15/10 – Grab: 50.000đ
  Tổng: 200.000đ. Rảnh thì chuyển mình nha!
  ```
  Chỉ liệt kê các khoản còn nợ theo phân bổ ở 5.3.

### 7.4 Cài đặt
- Quản lý bạn bè: thêm, đổi tên, archive.
- **Export JSON** (tải file `personal-expense-note-backup-YYYY-MM-DD.json`, đồng thời cập nhật `meta.lastExportAt`).
- **Import JSON**: validate schema, confirm "sẽ ghi đè toàn bộ dữ liệu", import trong một Dexie transaction.
- Sửa mẫu tin nhắn nhắc nợ.
- Xóa toàn bộ dữ liệu (confirm 2 lần).

## 8. PWA & iOS

- `manifest`: `name: "Personal expense note"`, `short_name: "Expense Note"` (nhãn icon trên Home Screen), `display: "standalone"`, `theme_color`, icons 192/512 + `apple-touch-icon` 180×180.
- Precache toàn bộ build. App phải mở được khi bật Airplane mode.
- Hỗ trợ safe area: `viewport-fit=cover` + `env(safe-area-inset-*)` cho bottom tab bar.
- Gọi `navigator.storage.persist()` lúc khởi động (best-effort).
- Banner nhắc backup nếu `lastExportAt` > 14 ngày hoặc chưa export lần nào và đã có ≥ 10 giao dịch.
- Trang hướng dẫn "Thêm vào Màn hình chính" hiện khi chạy trong Safari mà chưa ở chế độ standalone.
- Input số trên mobile: `inputMode="decimal"`. Quick input dùng text thường.
- Dark mode theo hệ thống.

## 9. Đồng bộ: JSON snapshot + merge

### 9.1 Tổng quan
- **Nguồn dữ liệu làm việc luôn là IndexedDB trên máy.** App không bao giờ chờ server để hiển thị hay ghi.
- Server giữ **một file mỗi mã đồng bộ**, `snapshots/<sha256(secret)>.json` trong Vercel Blob **private store**: toàn bộ friends, transactions, debts, settlements (gồm cả tombstone).
- Sync = tải snapshot về → **merge theo từng record** với local → ghi kết quả vào local → upload snapshot đã merge, dùng ETag để không ghi đè thay đổi của thiết bị khác.
- Snapshot đồng thời là bản backup trên server. Export/Import JSON thủ công (mục 7.4) vẫn giữ, dùng cùng format.

### 9.2 Format snapshot
```ts
interface Snapshot {
  format: 'personal-expense-note-snapshot';
  schemaVersion: number;        // tăng khi đổi data model; client cũ gặp version mới hơn thì từ chối merge và báo cập nhật app
  updatedAt: string;
  updatedBy: string;            // deviceId
  friends: Friend[];
  transactions: Transaction[];
  debts: Debt[];
  settlements: Settlement[];
}
```

### 9.3 Merge (pure function, `domain/sync/merge.ts`)
```ts
merge(local: SnapshotData, remote: SnapshotData): SnapshotData
```
Với từng bảng, hợp hai tập theo `id`:
1. Chỉ có một bên → giữ bên đó.
2. Cả hai bên → giữ bản có `updatedAt` lớn hơn (last-write-wins theo record).
3. `updatedAt` bằng nhau → ưu tiên bản có `deletedAt` (xóa thắng); nếu vẫn bằng thì lấy bản có JSON string lớn hơn theo thứ tự từ điển, để kết quả **deterministic** trên mọi thiết bị.

Yêu cầu:
- Merge **commutative và idempotent**: `merge(a,b) == merge(b,a)`, `merge(a, merge(a,b)) == merge(a,b)`. Có property-based test (fast-check) cho hai tính chất này.
- Không bao giờ làm mất record: số `id` sau merge = hợp số `id` hai bên.
- **Clock skew**: khi ghi local, `updatedAt = max(now, record.updatedAt + 1ms)` để bản sửa mới luôn lớn hơn bản cũ dù đồng hồ máy lệch.
- Sau merge, chạy kiểm tra toàn vẹn (`domain/sync/integrity.ts`): debt trỏ tới transaction đã xóa thì cũng coi là đã xóa khi tính toán; Σ debts > amount (do hai máy sửa khác nhau) thì đánh dấu transaction "cần xem lại" để hiện cảnh báo trên UI, không tự sửa dữ liệu.

### 9.4 API (`api/snapshot.ts`, Vercel Function)
| Method | Mô tả |
|---|---|
| `GET /api/snapshot` | Trả về snapshot + header `ETag`. Chưa có thì `404`. Đọc với `useCache: false` để luôn lấy bản mới nhất. |
| `PUT /api/snapshot` | Body là snapshot. Header `If-Match: <etag>` (hoặc `If-None-Match: *` khi tạo lần đầu). Ghi bằng `put(..., { access: 'private', allowOverwrite: true, ifMatch })`. ETag không khớp → `412`. Thành công → trả ETag mới. |

- **Auth / kho dữ liệu**: header `Authorization: Bearer <secret>`. Secret do client sinh: 32 byte ngẫu nhiên, base64url (43 ký tự). Server chỉ nhận secret khớp `^[A-Za-z0-9_-]{43}$`, sai định dạng thì `401`. Pathname blob = `snapshots/<sha256 hex của secret>.json`, nên server không lưu secret và không có env `SYNC_SECRET`. Không có cách khôi phục khi mất mã.
- Validate body (zod): đúng `format`, `schemaVersion`, kích thước < 5 MB.
- Không log nội dung snapshot.
- Token Vercel Blob chỉ nằm ở server (env), **không bao giờ** ra client.

### 9.5 Luồng sync ở client (`data/sync/SyncService.ts`)
```
sync():
  if offline or chưa cấu hình secret → return
  for attempt in 1..3:
    remote, etag = GET /api/snapshot   (404 → remote = rỗng, etag = null)
    merged = merge(localData, remote)
    ghi merged vào Dexie trong MỘT transaction (bulkPut), chỉ những record thay đổi
    res = PUT /api/snapshot (If-Match: etag)
    if 412 → continue          # thiết bị khác vừa ghi, làm lại từ đầu
    if ok → lưu remoteEtag, lastSyncAt; return success
  return error "conflict, thử lại sau"
```
- **Kích hoạt**: khi mở app, khi app quay lại foreground (`visibilitychange`), 5 giây sau lần ghi cuối (debounce), khi có mạng trở lại (`online` event), và nút "Đồng bộ ngay" trong Cài đặt.
- Chỉ một sync chạy tại một thời điểm (mutex trong service).
- Các ghi local xảy ra trong lúc sync vẫn an toàn: merge chỉ thay record khi `updatedAt` của remote lớn hơn, và lần sync kế tiếp sẽ đẩy chúng lên.
- Lỗi mạng hay `5xx` không hiện lỗi đáng sợ, chỉ đổi trạng thái.

### 9.6 Friend trùng tên sau merge
Hai thiết bị cùng tạo "Nam" offline sẽ ra hai friend khác id. Sau sync, nếu có ≥ 2 friend chưa xóa có tên trùng nhau (so sánh không phân biệt hoa thường, không dấu), hiện banner "Có bạn bè bị trùng tên" kèm action **Gộp**: chuyển mọi debt/settlement sang friend cũ hơn (theo `createdAt`), soft delete friend còn lại.

### 9.7 UI sync
- Cài đặt → mục **Đồng bộ**: nút "Tạo mã mới" (tạo kho mới) hoặc dán mã từ thiết bị khác (lưu trong `meta`, không đồng bộ); hiện/ẩn và copy mã đang dùng kèm cảnh báo "mất mã là mất bản sao trên server"; trạng thái (Đã đồng bộ lúc HH:mm / Đang đồng bộ / Offline / Lỗi), nút "Đồng bộ ngay", nút "Tắt đồng bộ".
- Thiết bị mới: dán mã → server phải đã có kho cho mã đó (`404` thì báo "Mã không tồn tại", không lưu mã) → sync lần đầu kéo toàn bộ dữ liệu về.
- Header có indicator nhỏ: chấm xanh (đã sync), xám (offline), cam (có thay đổi chưa sync).
- Banner nhắc backup (mục 8) **chỉ hiện khi chưa bật sync**.

### 9.8 Dọn tombstone
Record có `deletedAt` cũ hơn **180 ngày** được xóa thật khỏi local và khỏi snapshot ở lần sync kế tiếp. Ngưỡng này đủ lớn để mọi thiết bị đã kịp nhận tombstone.

### 9.9 Testing sync
- Unit: merge (bảng case + property-based), integrity check, clock-skew helper.
- Integration: `SyncService` với fake API trong memory, mô phỏng 2 thiết bị: cùng offline ghi, sync lần lượt, kết quả hai bên giống nhau; mô phỏng `412` rồi retry thành công; xóa trên máy A và sửa trên máy B (bên có `updatedAt` mới hơn thắng).
- API: test handler với Blob mock: thiếu/sai secret → 401, sai ETag → 412.

## 10. Mobile-first UI (BẮT BUỘC)

App chỉ dùng trên iPhone. Mọi màn hình **thiết kế, implement và test ở viewport mobile trước**; desktop chỉ cần không vỡ (căn giữa, `max-w-md`).

### 10.1 Viewport mục tiêu
- Chuẩn: **390×844** (iPhone 13/14/15).
- Nhỏ nhất phải hỗ trợ: **375×667** (iPhone SE). Không có horizontal scroll, không cắt chữ.
- Lớn nhất cần kiểm: **430×932** (Pro Max).
- Viết Tailwind mobile-first: class gốc là cho mobile, chỉ dùng `sm:`/`md:` khi thật sự cần.

### 10.2 Quy tắc tương tác
- **Touch target ≥ 44×44 px** cho mọi phần tử bấm được (theo Apple HIG).
- **Font-size input ≥ 16px**, nếu nhỏ hơn iOS Safari sẽ tự zoom khi focus.
- **Thumb zone**: action chính (Lưu, Đã trả, Nhắc, nút "+") nằm ở nửa dưới màn hình. Không đặt action quan trọng ở góc trên.
- Dùng **bottom sheet** (shadcn `Drawer`) thay cho `Dialog` giữa màn hình cho form và confirm.
- Không có tương tác chỉ dựa vào hover. Swipe-to-delete (nếu làm) phải có cách thay thế bằng nút.
- `touch-action: manipulation` để bỏ delay double-tap zoom.
- Không dựa vào `navigator.vibrate` (Safari iOS không hỗ trợ).

### 10.3 Layout & bàn phím
- Dùng `100dvh` / `min-h-dvh`, **không** dùng `100vh` (bị sai trên iOS khi thanh địa chỉ co giãn).
- Safe area: `env(safe-area-inset-*)` cho header và bottom tab bar (mục 8).
- **Bàn phím ảo**: khi quick input được focus, ô input và preview phải luôn nằm trên bàn phím. Dùng `window.visualViewport` nếu cần; bottom tab bar ẩn đi khi bàn phím mở.
- `overscroll-behavior: none` ở body để tránh bounce kéo cả layout. List bên trong vẫn scroll bình thường.
- Số tiền dài (ví dụ `12.500.000 ₫`) không được vỡ dòng xấu ở 375px: dùng `tabular-nums` và cho phép truncate note thay vì truncate số tiền.

### 10.4 Trạng thái UI
Mỗi màn hình phải có đủ: **loading** (skeleton), **empty state** (có hướng dẫn hành động tiếp theo, ví dụ "Gõ `cafe 35k` để ghi khoản đầu tiên"), **error**. `prefers-reduced-motion` thì tắt animation không cần thiết.

### 10.5 Testing mobile
- **E2E bằng Playwright, project chính là WebKit + device iPhone** (`devices['iPhone 13']`), thêm một project 375×667 cho iPhone SE. Không cần chạy Chromium desktop.
- E2E bắt buộc cho các acceptance criteria (mục 13): nhập giao dịch chia tiền, ghi nhận trả nợ, xóa giao dịch, export → import.
- **Offline test**: load app, đợi service worker active, `context.setOffline(true)`, reload, kiểm tra app vẫn chạy (chạy trên production build qua `vite preview`).
- **Visual check**: screenshot mỗi màn hình chính ở 375 và 430 px, lưu vào `e2e/__screenshots__` để review khi đổi UI.
- Test kiểm tra touch target: helper assert mọi `button`, `a`, `[role=button]` hiển thị có bounding box ≥ 44×44.
- **Trước mỗi lần release**: test tay trên iPhone thật qua Safari Web Inspector theo checklist: Add to Home Screen, Airplane mode, bàn phím che input, safe area, dark mode.

## 11. Kiến trúc: MVVM với React hooks (BẮT BUỘC)

### 11.1 Ba tầng

| Tầng | Vị trí | Trách nhiệm | Được phép import |
|---|---|---|---|
| **Model** | `domain/`, `data/` | Types, business logic thuần (parser, balance, FIFO), repositories truy cập Dexie | Chỉ `domain/` ↔ `data/`, không React |
| **ViewModel** | `features/*/viewmodels/use*ViewModel.ts` | Custom hook: lấy data qua repository (`useLiveQuery`), gọi domain logic, quản lý UI state (form, filter, dialog), expose actions | Model, React hooks. **Không JSX** |
| **View** | `features/*/views/`, `components/` | Render thuần từ output của ViewModel, forward event lên action | ViewModel của feature mình, `components/`, `lib/format` |

### 11.2 Quy tắc

1. **View không bao giờ** import `data/`, `db`, `dexie`, `useLiveQuery`, hay gọi function tính toán trong `domain/` (balance, myShare...). Mọi giá trị hiển thị đã được ViewModel tính sẵn.
2. **Mỗi screen có đúng một ViewModel gốc**, ví dụ `useDebtsViewModel`, `useFriendDetailViewModel`, `useTransactionFormViewModel`. Screen component gọi hook này một lần và truyền xuống các view con qua props.
3. **Interface ViewModel tường minh**: mỗi hook trả về object có type riêng, tách `state` và `actions`:
   ```ts
   interface DebtsViewModel {
     state: {
       isLoading: boolean;
       totalOwedToMe: number;
       totalIOwe: number;
       items: DebtListItem[];        // đã sort, đã tính ageDays, isOverdue
       sortBy: 'age' | 'amount';
     };
     actions: {
       setSortBy(s: 'age' | 'amount'): void;
       openFriend(friendId: string): void;
     };
   }
   ```
   View nhận `DebtListItem` (display model), **không** nhận entity Dexie thô.
4. **Repository là interface**, implementation Dexie inject qua React Context (`RepositoryProvider`). Nhờ vậy ViewModel test được với fake repository.
   ```ts
   interface TransactionRepository {
     listByMonth(month: string): Promise<TransactionWithDebts[]>;
     // ViewModel bọc bằng useLiveQuery(() => repo.listByMonth(m), [m]) — Dexie tự track
     // các query bên trong nên vẫn reactive; fake repo trong test chỉ cần trả Promise.
     create(input: NewTransaction): Promise<string>;   // tx + debts trong 1 Dexie transaction
     update(id: string, input: NewTransaction): Promise<void>;
     remove(id: string): Promise<void>;                // cascade debts
   }
   ```
5. **Action là async, xử lý lỗi trong ViewModel**: ViewModel bắt lỗi, set `state.error` hoặc gọi toast. View không có try/catch.
6. **Không global state library** (Redux/Zustand). Data đến từ Dexie live query, UI state là `useState`/`useReducer` trong ViewModel. Chỉ dùng Context cho dependency injection (repositories, settings).
7. **Shared ViewModel logic** (ví dụ friend list dùng ở cả quick input lẫn form) tách thành hook nhỏ trong `features/shared/viewmodels/` và được ViewModel gốc compose lại, không gọi trực tiếp từ View.

### 11.3 Cấu trúc thư mục

```
src/
  domain/                      # MODEL: pure, không React, không Dexie
    types.ts                   # Friend, Transaction, Debt, Settlement
    parser.ts      parser.test.ts
    balance.ts     balance.test.ts     # myShare, balance, FIFO aging
    split.ts       split.test.ts
    categories.ts
    reminder.ts    reminder.test.ts    # sinh tin nhắn nhắc nợ
    sync/
      merge.ts     merge.test.ts       # pure merge (mục 9.3)
      integrity.ts integrity.test.ts
      clock.ts                         # updatedAt monotonic helper
  data/                        # MODEL: persistence
    db.ts                      # Dexie schema
    repositories/
      types.ts                 # repository interfaces
      dexie/                   # implementations
    RepositoryProvider.tsx
    backup.ts                  # export/import JSON (cùng format Snapshot)
    sync/SyncService.ts        # luồng sync (mục 9.5), SyncApi client
  features/
    overview/
      viewmodels/useOverviewViewModel.ts   useOverviewViewModel.test.ts
      views/OverviewScreen.tsx  SummaryCards.tsx  CategoryDonut.tsx
    quick-input/
      viewmodels/useQuickInputViewModel.ts
      views/QuickInput.tsx  ParsePreview.tsx
    transactions/
      viewmodels/useTransactionListViewModel.ts  useTransactionFormViewModel.ts
      views/...
    debts/
      viewmodels/useDebtsViewModel.ts  useFriendDetailViewModel.ts
      views/...
    settings/
      viewmodels/useSettingsViewModel.ts
      views/...
    shared/viewmodels/         # hook dùng chung giữa các feature
  components/                  # shadcn/ui + presentational component dùng chung
  lib/                         # format tiền/ngày, share, clipboard (pure helpers)
  app/                         # router, layout, bottom tab bar, providers
api/
  snapshot.ts                  # Vercel Function (mục 9.4), nằm ở root project
```

### 11.4 Testing theo tầng

- **Model (`domain/`)**: Vitest unit test, bắt buộc, coverage cao nhất.
- **Repository**: test với `fake-indexeddb` (cascade delete, transaction atomic).
- **ViewModel**: `renderHook` từ `@testing-library/react`, inject fake repository; kiểm tra state sau action (ví dụ ghi nhận "Đã trả" thì balance và item list cập nhật đúng).
- **View**: không bắt buộc test; nếu có thì chỉ snapshot/interaction nhẹ với ViewModel mock.

### 11.5 Lint enforcement

Dùng ESLint `no-restricted-imports` để chặn vi phạm tầng:
- Trong `features/*/views/**` và `components/**`: cấm import `@/data/*`, `dexie`, `dexie-react-hooks`, và các module tính toán trong `@/domain/*` (chỉ cho phép import **types** từ `@/domain/types`).
- Trong `domain/**`: cấm import `react`, `dexie`, `@/data/*`, `@/features/*`.

## 12. Kế hoạch triển khai

**Phase 1: MVP**
- [ ] Scaffold Vite + TS + Tailwind + shadcn + Router + vite-plugin-pwa, path alias `@/`
- [ ] ESLint `no-restricted-imports` cho ranh giới tầng (mục 11.5)
- [ ] Playwright (WebKit, iPhone 13 + iPhone SE) + helper check touch target, chạy được trên CI local
- [ ] Dexie schema **có sẵn `updatedAt`/`deletedAt`** + repository interfaces (soft delete, lọc tombstone) + Dexie implementation + `RepositoryProvider`
- [ ] `domain/balance.ts` (myShare, balance, FIFO aging) + tests
- [ ] Form nhập thủ công (có split), list giao dịch, edit/xóa: mỗi screen theo MVVM, có ViewModel test
- [ ] Quản lý bạn bè
- [ ] Tab Nợ: list, chi tiết, "Đã trả"
- [ ] Export / Import JSON
- [ ] E2E cho các flow MVP + offline test (mục 10.5)
- [ ] Deploy Vercel, test tay trên iPhone thật theo checklist 10.5

**Phase 2: Quick input**
- [ ] `domain/parser.ts` + full test suite (mục 6)
- [ ] Quick input + live preview ở home
- [ ] Auto category

**Phase 3: Insight & nhắc nợ**
- [ ] Card tổng quan, donut chart, so sánh tháng
- [ ] Nút "Nhắc" + Web Share + mẫu tin nhắn
- [ ] Banner nhắc backup

**Phase 4: Đồng bộ**
- [x] `domain/sync/merge.ts` + integrity + test (gồm property-based)
- [x] `api/snapshot.ts` + Vercel Blob private store, mỗi mã đồng bộ một kho
- [x] `SyncService` + trigger + mutex + test mô phỏng 2 thiết bị
- [x] UI đồng bộ trong Cài đặt, sync indicator, gộp friend trùng tên
- [x] Dọn tombstone

**Phase 5: Tùy chọn**
- [ ] Budget theo category + cảnh báo
- [ ] Giao dịch định kỳ (tiền nhà, subscription)
- [ ] Ghi nhận "bạn trả hộ mình" (Debt chiều ngược lại)
`
## 13. Acceptance criteria (MVP)

1. Nhập "lẩu 600k, chia 4 với Nam, Huy, Linh" thì chi tiêu tháng tăng 150.000 ₫ và mỗi người nợ 150.000 ₫.
2. Nam trả 100.000 ₫ thì balance Nam = 50.000 ₫, và tuổi nợ vẫn tính từ ngày đi lẩu.
3. Xóa giao dịch lẩu thì các debt liên quan biến mất và balance cập nhật ngay (live query).
4. Bật Airplane mode, mở app từ Home Screen: mọi chức năng vẫn chạy.
5. Export → xóa dữ liệu → Import: dữ liệu khôi phục y hệt.
6. `vitest` pass toàn bộ test trong `domain/`, repositories và ViewModels.
7. `eslint` pass, không View nào import trực tiếp `data/`, Dexie hay logic tính toán của `domain/`.
8. Mọi màn hình dùng được ở 375×667: không horizontal scroll, touch target ≥ 44px, input không bị bàn phím che; Playwright WebKit pass.
9. (Phase 4) Ghi 3 giao dịch trên iPhone offline và 2 giao dịch trên máy khác, rồi sync cả hai: cả hai thiết bị có đủ 5 giao dịch, balance giống nhau.
10. (Phase 4) Xóa một giao dịch trên máy A, sync máy A rồi máy B: giao dịch biến mất trên B.`