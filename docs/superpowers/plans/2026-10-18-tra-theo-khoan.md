# Trả theo khoản Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a friend's debt screen, let the user select individual debts to remind about or mark as paid, and show each debt's paid / partial / unpaid status.

**Architecture:** `Settlement` gains an optional `debtIds`. A new pure function `allocateSettlements` (in `src/domain/balance.ts`) replaces `fifoOutstanding`. It applies targeted settlements to their debts first, then pools the overflow with amount-only settlements and applies the pool FIFO. Balance math (`Σ debts − Σ settlements`) is untouched. The friend-detail viewmodel gets a selection mode, and the view renders it.

**Tech Stack:** React 19, TypeScript, Dexie 4, zod 4, sonner, i18next, Vitest + fake-indexeddb, Playwright, fast-check.

**Spec:** `docs/superpowers/specs/2026-10-18-tra-theo-khoan-design.md`

## Global Constraints

- `balance = Σ debts − Σ settlements` must not change for any existing data.
- No Dexie version bump. `SCHEMA_VERSION` stays `1`. Backups without `debtIds` remain valid.
- With no targeted settlements, the allocation result must equal today's FIFO.
- Paid / Remind outside selection mode keep their current behavior.
- Old mis-allocated settlements are left as-is: no migration and no relink UI.
- Undo toast is the only way to un-mark. No delete-from-history UI.
- Every new string goes in both `src/i18n/locales/vi.ts` and `en.ts`. `vi` is typed against `en`.
- Touch targets ≥ 44px. `expectTouchTargets` must keep passing.
- No new dependencies. Follow the existing layers: `domain/` is pure, `data/` holds Dexie repos, viewmodel hooks carry the logic, views only render.

## Review Focus

1. A debt linked to a targeted settlement is later deleted or edited down. The overflow must flow into the FIFO pool so the balance and the remaining amounts stay consistent. Test in Task 1.
2. A debt linked to a targeted settlement is later edited up. The difference must show as remaining. Test in Task 1.
3. A partially paid debt (FIFO covered part of it) is selected and marked paid. The settlement amount must be its `remaining`, not its full amount. Test in Task 3.
4. Undo after mark-paid restores the exact prior state: balance, statuses, and the timeline without the settlement row. Test in Task 3.
5. `debtIds` belonging to another friend, or to a deleted debt, are rejected by the repo. Without this check, a stale selection could corrupt the totals. Test in Task 2.

---

### Task 1: Domain — `debtIds` on Settlement and `allocateSettlements`

**Files:**
- Modify: `src/domain/types.ts` (add `debtIds?: string[]` to `Settlement`, with the doc comment from the spec)
- Modify: `src/domain/balance.ts` (add `allocateSettlements`; leave `fifoOutstanding` for now, Task 3 removes it)
- Test: `src/domain/balance.test.ts`
- Modify: `docs/SPEC.md` (§ Settlement type, §5.2, §5.3, §7.3: per-debt settlements, the allocation rule and selection mode; keep the Vietnamese style)

**Interfaces:**
- Produces:
  ```ts
  export type DebtAllocation = DebtEntry & { remaining: number }
  /** All entries oldest-first (date, then debtId) with what is still owed on each. */
  export function allocateSettlements(
    entries: DebtEntry[],
    settlements: Pick<Settlement, 'amount' | 'date' | 'createdAt' | 'debtIds'>[],
  ): DebtAllocation[]
  ```

- [ ] **Step 1: Write failing tests** in `balance.test.ts`, reusing the existing `entries` fixture (d1 lẩu 150k 10/12, d2 grab 50k 10/15). Add a helper `paid(amount, debtIds?, date = '2026-10-20', createdAt = base.createdAt)`.
  - `allocate: amount-only matches fifo`: for settled totals 0, 100000, 150000, 200000, `allocateSettlements(entries, [paid(x)]).filter(e => e.remaining > 0)` equals `fifoOutstanding(entries, x)`.
  - `allocate: targeted settlement pays the named debt, not the oldest`: `[paid(50000, ['d2'])]` → remaining `{d1: 150000, d2: 0}`.
  - `allocate: returns paid debts too, oldest first`: the result above has length 2, in order `['d1','d2']`.
  - `allocate: targeted first, then amount-only fifo on the rest`: `[paid(100000), paid(50000, ['d2'])]` → `{d1: 50000, d2: 0}`. Order the settlement list amount-only first to prove that targeted ones are applied first regardless of order.
  - `allocate: overflow when linked debt was deleted goes to fifo`: entries `[d1]` only, `[paid(50000, ['d2'])]` → `{d1: 100000}`.
  - `allocate: overflow when linked debt shrank goes to fifo`: d2 edited to 30000, `[paid(50000, ['d2'])]` → `{d1: 130000, d2: 0}`.
  - `allocate: linked debt grew after marking shows the difference`: d2 edited to 80000, `[paid(50000, ['d2'])]` → `{d1: 150000, d2: 30000}`.
  - `allocate: property — total remaining = max(0, balance) when nothing is overpaid`: use fast-check. Generate 1–6 entries (amount 1000–500000, dates within one month, unique ids) and settlements whose total ≤ total debts, each optionally targeting a random subset of entry ids. Assert `Σ remaining === Σ entries − Σ settlements` and every `0 ≤ remaining ≤ amount`.
- [ ] **Step 2: Run** `pnpm vitest run src/domain/balance.test.ts`. Expected: FAIL, `allocateSettlements` is not exported.
- [ ] **Step 3: Implement** `allocateSettlements` per the spec's "Mô hình phân bổ":
  - Sort entries by date, then debtId.
  - Process targeted settlements in (date, createdAt) order. Each pays its listed debts in entry order, up to each debt's remaining.
  - Unspent targeted money plus all amount-only amounts form one pool, applied FIFO.
- [ ] **Step 4: Run** `pnpm vitest run src/domain/balance.test.ts`. Expected: PASS.
- [ ] **Step 5: Update `docs/SPEC.md`** sections listed above.
- [ ] **Step 6: Commit**
  ```bash
  git add src/domain/types.ts src/domain/balance.ts src/domain/balance.test.ts docs/SPEC.md
  git commit -m "feat(domain): allocate settlements to specific debts before FIFO"
  ```

### Task 2: Data — persist and validate `debtIds`; backup schema

**Files:**
- Modify: `src/domain/errors.ts` (add code `'invalidDebtSelection'`)
- Modify: `src/i18n/locales/vi.ts`, `en.ts` (`errors.invalidDebtSelection`: vi `'Khoản đã chọn không còn hợp lệ.'`, en `'The selected items are no longer valid.'`)
- Modify: `src/data/repositories/types.ts` (`addSettlement` input gains `debtIds?: string[]`)
- Modify: `src/data/repositories/dexie/ledger.ts`
- Modify: `src/domain/snapshot.ts` (`settlementSchema` gains `debtIds: z.array(z.string()).optional()`)
- Test: `src/data/repositories/dexie/repositories.test.ts`, `src/data/backup.test.ts`

**Interfaces:**
- Consumes: `Settlement.debtIds` (Task 1).
- Produces: `ledger.addSettlement({ friendId, amount, date, note, debtIds? }): Promise<string>`. `debtIds` is stored only when provided. It throws `DomainError('invalidDebtSelection')` when `debtIds` is empty, has duplicates, or names a debt that is not alive or not owned by `friendId`.

- [ ] **Step 1: Write failing tests** in the `ledger` describe block of `repositories.test.ts`:
  - `targeted settlement stores debtIds`: create lẩu split with Nam, take the debtId from `listDebtEntries(nam)`, `addSettlement({..., amount: 150000, debtIds: [id]})` → `listSettlements(nam)[0].debtIds` equals `[id]`.
  - `amount-only settlement has no debtIds key`: `'debtIds' in settlement` is `false`.
  - `rejects bad debtIds`: `codeOf(...)` is `'invalidDebtSelection'` for `[]`, for `[id, id]`, for Huy's debt id passed with `friendId: nam`, and for the id of a debt whose transaction was removed.
  - In `backup.test.ts`, `round-trips settlement debtIds`: export after a targeted settlement, `importSnapshot`, and `debtIds` survives. Also check that a v1 snapshot without `debtIds` still passes `validateSnapshot` (an existing fixture may already cover this; assert it explicitly).
- [ ] **Step 2: Run** `pnpm vitest run src/data`. Expected: FAIL.
- [ ] **Step 3: Implement.** In `addSettlement`, validate inside a `db.transaction('rw', db.settlements, db.debts, …)` by reading the debts with `bulkGet` and checking `isAlive` and `friendId`. Spread `debtIds` only when defined. Update the schema and the error code.
- [ ] **Step 4: Run** `pnpm vitest run src/data && pnpm exec tsc -b`. Expected: PASS, no type errors (the i18n typing forces both locales).
- [ ] **Step 5: Commit**
  ```bash
  git add src/domain/errors.ts src/domain/snapshot.ts src/data src/i18n/locales
  git commit -m "feat(data): store and validate settlement debtIds"
  ```

### Task 3: Viewmodels — allocation everywhere; selection, remind, mark paid, undo

**Files:**
- Modify: `src/features/debts/viewmodels/useFriendDetailViewModel.ts`
- Modify: `src/features/debts/viewmodels/useDebtsViewModel.ts` (oldest = first `allocateSettlements(...)` entry with `remaining > 0`)
- Modify: `src/domain/balance.ts`, `balance.test.ts` (delete `fifoOutstanding` and its tests once there are no callers; keep the Task 1 equivalence test by inlining the expected arrays)
- Modify: `src/i18n/locales/vi.ts`, `en.ts` (keys below)
- Test: `src/features/debts/viewmodels/useFriendDetailViewModel.test.ts`, `useDebtsViewModel.test.ts`

**Interfaces:**
- Consumes: `allocateSettlements` (Task 1), `ledger.addSettlement({... debtIds})` and `ledger.removeSettlement(id)` (Task 2).
- Produces (`FriendDetailViewModel`):
  ```ts
  export interface TimelineEntry {
    id: string                      // debtId or settlement id
    kind: 'debt' | 'settlement'
    date: string
    dateLabel: string
    note: string                    // settlement with debtIds: t('debts.paidFor', { items }), see below
    amountLabel: string
    status?: 'unpaid' | 'partial' | 'paid'   // debts only
    remainingLabel?: string                  // set only when status === 'partial'
    selectable: boolean             // debt with remaining > 0
  }
  state.selection: { active: boolean; ids: string[] }   // ids = selected debtIds
  state.canSelect: boolean          // outstanding.length > 0
  actions.toggleSelectMode(): void  // entering or leaving clears ids
  actions.toggleSelected(debtId: string): void   // ignored when not selectable
  actions.remindSelected(): Promise<void>        // reminder of selected items' remaining; stays in selection mode
  actions.markSelectedPaid(): Promise<void>
  ```
  - `markSelectedPaid`:
    - Calls `addSettlement({ friendId, amount: Σ remaining of selected, date: todayISO(opts.today), note: '', debtIds: ids })`.
    - Then leaves selection mode and shows `toast.success(t('debts.markedPaid', { count }), { duration: 5000, action: { label: t('debts.undo'), onClick: () => void ledger.removeSettlement(id) } })`. The app Toaster defaults to 2000 ms, too short for Undo.
    - On error: `toast.error(t(errorKey(e)))`.
  - `paidFor` items:
    - Join the linked debts' notes with `', '`, oldest first.
    - A debt with an empty note uses its `dd/MM` label.
    - If no linked debt is alive, fall back to `''`. The view already renders an empty settlement note as `debts.settlementItem`.
- New i18n keys under `debts` (vi / en):
  - `select`: `'Chọn'` / `'Select'`
  - `done`: `'Xong'` / `'Done'`
  - `remindCount`: `'Nhắc ({{count}})'` / `'Remind ({{count}})'`
  - `markPaidCount`: `'Đã trả ({{count}})'` / `'Paid ({{count}})'`
  - `paidBadge`: `'đã trả'` / `'paid'`
  - `remainingOf`: `'còn {{amount}}'` / `'{{amount}} left'`
  - `paidFor`: `'Trả: {{items}}'` / `'Paid: {{items}}'`
  - `markedPaid`: `'Đã đánh dấu {{count}} khoản đã trả'` / `'Marked {{count}} as paid'`
  - `undo`: `'Hoàn tác'` / `'Undo'`
  - `selectItem`: `'Chọn {{note}}'` / `'Select {{note}}'`. This is the checkbox's aria-label.

- [ ] **Step 1: Write failing tests** in `useFriendDetailViewModel.test.ts`, reusing `seed()` (lẩu 150k 10/12, grab 50k 10/15). Mock `sonner` the way the settings test does.
  - `debt rows carry status after a partial amount-only payment`: `addSettlement` 170000 amount-only → lẩu `status 'paid'`, grab `status 'partial'` with `remainingLabel` = `formatVND(30000)`, `selectable` false/true.
  - `select mode toggles and only selectable debts can be selected`: `toggleSelectMode` → `active` true. Toggling a paid debt's id leaves `ids` empty. Toggling grab twice selects then deselects it. `toggleSelectMode` again → `active` false, `ids` `[]`.
  - `mark selected paid pays only those debts, exits select mode, offers undo`: select grab → `markSelectedPaid`:
    - `listSettlements` has one settlement with `amount 50000`, `debtIds [grabId]`.
    - `balance` 150000. lẩu `unpaid`, grab `paid`.
    - Timeline settlement note is `'Trả: grab'`.
    - `selection.active` false.
    - `toast.success` was called with `'Đã đánh dấu 1 khoản đã trả'` and an `action`. Calling `action.onClick()` restores `balance` 200000 and removes the settlement row.
  - `mark paid on a partial debt uses its remaining`: amount-only 170000, then select grab → settlement `amount 30000`, `balance 0`.
  - `remind selected lists only selected items and stays in select mode`: mock `@/lib/share` `shareText`. Select lẩu → `remindSelected` → the text contains `Lẩu: 150.000đ`, does not contain `Grab`, and `selection.active` is still true.
  - `canSelect is false when everything is paid`.
  - In `useDebtsViewModel.test.ts`, `oldest age ignores a debt paid by a targeted settlement`: pay the oldest debt via `debtIds`, and `ageDays` is now measured from the next debt's date.
- [ ] **Step 2: Run** `pnpm vitest run src/features/debts`. Expected: FAIL.
- [ ] **Step 3: Implement** the viewmodel changes and i18n keys. Switch both viewmodels to `allocateSettlements`, then delete `fifoOutstanding` and its tests.
- [ ] **Step 4: Run** `pnpm test && pnpm exec tsc -b && pnpm lint`. Expected: all green.
- [ ] **Step 5: Commit**
  ```bash
  git add src/features/debts src/domain/balance.ts src/domain/balance.test.ts src/i18n/locales
  git commit -m "feat(debts): select debts to remind or mark paid, with undo"
  ```

### Task 4: View — selection UI on the friend detail screen; e2e

**Files:**
- Modify: `src/features/debts/views/FriendDetailScreen.tsx`
- Test: `e2e/phase23.spec.ts` (new test), plus the existing `e2e/mvp.spec.ts` must still pass unchanged

**Interfaces:**
- Consumes: the `FriendDetailViewModel` additions from Task 3.

Rendering (from the spec):
- **History heading row:** the existing `<h3>`, plus a ghost button on the right labelled `debts.select` / `debts.done`. Render it only when `canSelect || selection.active`.
- **Debt rows in selection mode:** when `selectable`, render a checkbox `<button role="checkbox" aria-checked aria-label={t('debts.selectItem', { note })}>`, and the whole row toggles. Selected rows get the `bg-accent` tint.
- **Statuses:**
  - `paid`: muted text, `line-through` on the amount, plus a small outline badge `debts.paidBadge` (use the existing `Badge`).
  - `partial`: a muted `debts.remainingOf` under or after the note.
- **Bottom bar:**
  - In selection mode the buttons read `remindCount` / `markPaidCount` with `count = ids.length`. With 0 selected, both are disabled and show the plain `debts.remind` / `debts.settle` labels.
  - Outside selection mode: unchanged.
- [ ] **Step 1: Write the failing e2e** `select one debt, mark it paid, undo` in `e2e/phase23.spec.ts`:
  - Quick-input `cafe 32k /2 @Nam` and `taxi 70k /2 @Nam`.
  - Go to `/debts`, open Nam.
  - Click `getByRole('button', { name: 'Chọn', exact: true })`, then click `getByRole('checkbox', { name: 'Chọn cafe' })`.
  - Expect the button `Đã trả (1)`, then click it.
  - Expect the text `Đã đánh dấu 1 khoản đã trả`, the balance `35.000 ₫`, the text `Trả: cafe`, and the text `đã trả`.
  - Click `Hoàn tác`, and expect the balance `51.000 ₫`.
  - Call `expectTouchTargets(page)` while in selection mode.
- [ ] **Step 2: Run** `pnpm e2e -g "select one debt"`. Expected: FAIL.
- [ ] **Step 3: Implement** the view.
- [ ] **Step 4: Run** `pnpm e2e && pnpm lint`. Expected: all pass, including `mvp.spec.ts`. Its `'Đã trả'` button must still resolve uniquely outside selection mode.
- [ ] **Step 5: Commit**
  ```bash
  git add src/features/debts/views e2e/phase23.spec.ts
  git commit -m "feat(debts): selection mode UI with paid status on history rows"
  ```
