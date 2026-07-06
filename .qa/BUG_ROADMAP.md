# Bug Fix Roadmap
_Generated: 2026-04-28 — Source: .qa/logs/2026-04-28.md_

---

## Phase 1 — Critical Blockers (fix before next deploy)

- [ ] [CRITICAL] **`supabase-types.ts` is corrupted binary** — `src/lib/supabase-types.ts:1` — Est: **S**
  - Delete the file and regenerate with `npx supabase gen types typescript --project-id <id> > src/lib/supabase-types.ts`. Until this is fixed, all database type safety is broken across the entire app.

- [ ] [CRITICAL] **Manual balance top-up ships in production** — `src/pages/BuyerBalance.tsx:56-80` + `src/pages/Balance.tsx:~700` — Est: **XS**
  - Wrap the manual credit / top-up UI sections in `{import.meta.env.DEV && ...}` guards so they never render in production builds. Consider also adding a Supabase RLS policy to reject client-direct `INSERT` into `seller_balance_transactions` for the `credit` type.

- [ ] [CRITICAL] **Client-side fallback marks orders as "paid" without server re-validation** — `src/components/buyer/CheckoutDialog.tsx:300-410` — Est: **M**
  - Remove the client-side `fallbackStatusSync` that writes `payment_status: "paid"` directly from the browser. Move all payment status reconciliation to the backend (Vercel serverless function or Supabase Edge Function) that re-queries the Midtrans status API before updating the DB.

---

## Phase 2 — High Priority (fix within current sprint)

- [ ] [HIGH] **"Ubah Password" button is broken / non-functional** — `src/pages/Settings.tsx:130-165` — Est: **S**
  - Add controlled state for `oldPassword`, `newPassword`, `confirmPassword`. Connect the button's `onClick` to call `supabase.auth.updateUser({ password: newPassword })`, validate that new != old and confirm matches, and show error/success feedback.

- [ ] [HIGH] **Notification toggles are never persisted** — `src/pages/Settings.tsx:335-355` — Est: **S**
  - Either add a `notification_preferences` JSONB column to the `profiles` table (read on load, write on toggle), or store the state in a dedicated `user_preferences` table. Initialize the toggles from the fetched value in a `useEffect`.

- [ ] [HIGH] **Stock decrement race condition — overselling** — `src/components/buyer/CheckoutDialog.tsx:190-210` — Est: **M**
  - Move order creation + stock decrement into a single Supabase Edge Function or PostgreSQL stored procedure so the entire operation is atomic. At minimum, call `decrement_stock` (with a stock-floor check) before creating the order record, and abort if any decrement returns an error.

- [ ] [HIGH] **Cart allows mixed-store items — wrong seller receives order** — `src/components/buyer/CheckoutDialog.tsx:150-165` + `src/contexts/CartContext.tsx` — Est: **M**
  - Either enforce single-store carts in `CartContext.addToCart` (clear cart or warn user when switching stores), or make the checkout query all unique `store_id`s from the cart and create one order per store.

- [ ] [HIGH] **AdminFinance / AdminUsers load all DB rows without pagination** — `src/pages/admin/AdminFinance.tsx:86-130`, `src/pages/admin/AdminUsers.tsx:100-130` — Est: **M**
  - Implement server-side pagination (`.range(offset, offset+pageSize-1)`) for both admin tables. For `AdminFinance`, scope `seller_balance_transactions` to a recent date range by default.

- [ ] [HIGH] **Post-login navigation ignores user role** — `src/pages/Auth.tsx:110-115` — Est: **S**
  - After sign-in, resolve the user's `activeRole` from `localStorage` (`snacktrack_active_role`) and navigate to the correct dashboard: `"penjual"` to `/`, `"pembeli"` to `/toko`, `null` to `/pilih-peran`.

- [ ] [HIGH] **`setMainMutation` is non-atomic** — `src/pages/Balance.tsx:660-680` — Est: **S**
  - Replace the two sequential `UPDATE` calls with a single PostgreSQL function (e.g. `set_main_payout_account(account_id)`) that executes both updates in one transaction, preventing the no-main-account intermediate state.

- [ ] [HIGH] **AdminRoute redirects logged-in non-admins to `/auth`** — `src/components/layout/AdminRoute.tsx:22` — Est: **XS**
  - Change `<Navigate to="/auth" />` to check the user's active role and redirect to their correct dashboard instead of the login page.

---

## Phase 3 — Medium Priority (fix in next sprint)

- [ ] [MEDIUM] **Missing `toast` dep in NotificationContext `useEffect`** — `src/contexts/NotificationContext.tsx:54` — Est: **XS**
- [ ] [MEDIUM] **Missing `queryClient` dep in Balance.tsx `useEffect`** — `src/pages/Balance.tsx:800` — Est: **XS**
- [ ] [MEDIUM] **Missing `defaultMinimized` dep in ChatOverlay `useEffect`** — `src/components/chat/ChatOverlay.tsx:194` — Est: **XS**
- [ ] [MEDIUM] **`productKeys` used before guaranteed population in Analytics** — `src/pages/Analytics.tsx:171` — Est: **XS**
- [ ] [MEDIUM] **`select('*')` overfetch in Products.tsx and BuyerStore.tsx** — `src/pages/Products.tsx:39`, `src/pages/BuyerStore.tsx:52` — Est: **XS**
- [ ] [MEDIUM] **NearestStoreDialog loads all stores with no server-side limit** — `src/components/buyer/NearestStoreDialog.tsx:42` — Est: **S**
- [ ] [MEDIUM] **RoleSelection has no loading guard against double-click** — `src/pages/RoleSelection.tsx:20-35` — Est: **XS**
- [ ] [MEDIUM] **Forecast bearer token sent over plain HTTP in dev** — `src/hooks/useForecast.ts:65-75` — Est: **XS**
- [ ] [MEDIUM] **Settings phone/avatar form initializes from null buyerProfile** — `src/pages/Settings.tsx:335-345` — Est: **S**
- [ ] [MEDIUM] **Auth does not handle `?redirect=` URL param for deep links** — `src/pages/Auth.tsx:108-115` — Est: **S**
- [ ] [MEDIUM] **Settings.tsx panel props typed as `any`** — `src/pages/Settings.tsx:55,110,130,160,200` — Est: **S**

---

## Phase 4 — Low Priority / Tech Debt

- [ ] [LOW] **`URL.createObjectURL` memory leak in Orders.tsx** — `src/pages/Orders.tsx:291` — Est: **XS**
- [ ] [LOW] **Widespread `any` types throughout src/** — multiple files — Est: **L** (blocked on types fix)
- [ ] [LOW] **`@ts-ignore` in BuyerStore.tsx without explanation** — `src/pages/BuyerStore.tsx:67` — Est: **XS**
- [ ] [LOW] **Language toggle in Settings is a dead UI element** — `src/pages/Settings.tsx:370-395` — Est: **L**

---

## Notes

### Systemic Patterns

1. **`supabase-types.ts` corruption is the root cause of widespread `any` usage.** Fixing this one file will restore type inference across all Supabase queries and likely surface additional real type errors that are currently silent.

2. **Testing/debug code in production.** Multiple "Mode Testing" features are conditionally rendered based on UI labels, NOT `import.meta.env.DEV`. Apply a consistent pattern: wrap with `{import.meta.env.DEV && <DevFeature />}` or move to a protected internal admin page.

3. **Client-side trust for financial operations.** Payment status updates and balance credits are executed directly from the browser via the Supabase JS client. These must move to backend functions that verify external payment provider state. RLS is the only safeguard and its policies were not audited in this scan.

4. **Suppressed `react-hooks/exhaustive-deps` warnings are a code-wide pattern.** Each `// eslint-disable-next-line` should be audited individually — most suppress legitimate stale closure bugs, not false positives.

5. **Settings page is the most broken page in the app** — broken password change, unpersisted notification toggles, stale form initialization, dead language selector, and all panel props typed as `any`. Consider rewriting Settings with `react-hook-form` (already in `package.json`) for proper dirty state, validation, and reset-on-cancel.
