# Ladle & Spoon — working notes

Soup and salad delivery for a one-person business in Waterford, MI. Lia cooks, Tony
builds. Roughly 12–25 orders a week, ~170 customers on the books, Monday deliveries.

**This repository is public** (GitHub Pages serves from it). Nothing secret belongs in
this file or in any committed file — see *Known weaknesses* below, which includes one
case where that rule is already broken.

---

## Shape of the thing

| Piece | Where | Notes |
|---|---|---|
| Frontend | `index.html` | One self-contained PWA. Customer app *and* admin panel. |
| Link preview | `share.html` + `og-image.jpg` | Tiny page for social/messaging previews. |
| Backend | Google Apps Script | Single file, confusingly named `Business Analysis.gs`. |
| Database | Google Sheets | Orders, customers, loyalty, photos, gift certs, analytics. |
| Images | Cloudinary + embedded | See *the 4MB problem*. |
| Push | Firebase (`ladle-and-spoon-push-notify`) | |

Apps Script runs as a dedicated Google account, which gives the business its own
100-emails/day quota. Customer-facing mail is sent under a verified send-as alias, so
the From line shows the business address rather than the account that runs the script.

---

## Deploying

**Frontend:** push to `main`. GitHub Pages serves it directly, so the push *is* the
deploy. Hard-refresh afterwards — the PWA caches aggressively.

**Backend:** Apps Script editor → Deploy → Manage deployments → **pencil on the live
deployment** → Version: **New version** → Deploy.

> Use *New version*, not *New deployment*. A new deployment gets a **new URL**, which
> means editing `APPS_SCRIPT_URL` in `index.html` and pushing again. Every outage this
> project has had traced back to the deployment URL moving, or to the live deployment
> being archived during a tidy-up. Give the live one a description so it is not one of
> a dozen identical "Untitled" entries, and leave old deployments alone — they cost
> nothing.

**Verify before pushing frontend changes:** open `<deployment-url>?type=get_menu` and
check `scriptVersion` matches what you just deployed. Editor functions always run the
latest saved code, but the web app serves the last *deployed* version — so a diagnostic
can pass while the live app is still running something older.

---

## Landmines

These are all real bugs that reached production. Each one cost hours.

**Column positions are not stable.** Order data lives in sheet columns whose meaning
depends on position, and the layout is rewritten weekly when the menu is published.
Anything that finds a column must match its header *exactly* — a loose regex once
matched the address column and summed street numbers as delivery fees, inflating
several months by six figures. Never match on a substring.

**Zero is falsy.** `parseFloat(fee) || 5` returns 5 when the fee is legitimately 0 —
which silently charged full delivery to exactly the customers whose loyalty had earned
it free. Check `isNaN`, never `||`, for anything that can legitimately be zero.

**Duplicate function definitions win silently.** The backend once had two
`fixP3Formula` definitions; the later one won and edits to the first did nothing. If a
backend change appears to have no effect, grep for a second definition before
re-debugging it.

**`try/catch` hides runtime errors.** Most backend handlers log and continue, so a
ReferenceError looks identical to "the fix didn't work". When a change seems inert, run
the function directly from the Apps Script editor — it surfaces the real error.

**Field names must match on both sides.** Several bugs were the frontend sending one
key and the backend reading another (`photo`/`photoUrl`, `lastOrderDate`/`lastOrderWeek`).
Nothing warns you; the value is just silently absent.

**Bundles must be expanded into item columns.** The sheet only knows items that have
a column. The Gift Box once went in as one "Gift Box (…)" line, matched nothing, and
its soups never reached the kitchen totals. The frontend now sends the contents as
`box: [{name, size}]` and `buildOrderRow` counts each in its own column.

**The menu payload is cached** for 30 minutes. Anything that changes what customers see
must call `invalidateMenuCache()`, or edits appear to revert on refresh.

**The installed PWA caches `index.html` separately from the browser.** After any change
to the backend URL, an installed app can keep calling a dead deployment while the
browser works fine. Test in a normal browser tab; expect installed users may need to
delete and re-add the home-screen icon.

**Check images actually decode.** The header logo was a truncated PNG — browsers
rendered its top rows and dropped the rest. Two fixes were wasted on CSS before anyone
decoded the file. When an image renders wrong, decode it first.

---

## Conventions

- Frontend version bumps on every change: `APP VERSION` console line **and** the badge
  under the header. Keep them in step — a mismatch has masked real problems.
- Backend version lives in one `SCRIPT_VERSION` constant used by every endpoint. It was
  previously duplicated per-endpoint and drifted, making version checks untrustworthy.
- Syntax-check before shipping. Frontend: extract the main `<script>` and run
  `node --check`. Backend: `node --check` the `.gs` file.
- Date logic gets tested against known dates before it ships. Seasonal themes and the
  delivery-date promotion both have moving holidays and month boundaries that are easy
  to get subtly wrong.

---

## Admin access

The PIN is checked by the backend, never the browser. It lives in Apps Script
**Project Settings → Script properties → `ADMIN_PIN`**; the login code is the
*ADMIN AUTH* section at the end of the backend file. A correct PIN returns a session
token (6 hours, refreshed on use) that the frontend's `fetch` wrapper appends to every
backend request as `?token=`.

- **Any new admin endpoint must be added to `ADMIN_TYPES`** in the backend, or it
  ships readable by anyone who has the deployment URL — which is public.
- Ten wrong PINs lock *all* admin logins for 15 minutes (Apps Script cannot see IPs).
- After changing `ADMIN_PIN`, run `revokeAdminSessions()` to sign out every device.
- Never put customer data in `index.html` as sample or fallback data. It is public.

---

## Money rules

- **Delivery fees** rise and fall with a loyalty streak; week 6+ is free. The server
  always recalculates — the browser's figure is display only.
- **Gift certificates** carry a running balance, not a used/unused flag. Redemption
  happens server-side during order writing; the order sends the amount owed *before*
  the certificate so a tampered browser cannot spend one twice. New certificates stay
  PENDING until payment is confirmed by hand, because the app cannot see a Venmo
  transaction.
- **Promotions** key on the **delivery** date, not the order date. An order placed in
  late September for an October delivery qualifies; one placed in late October for a
  November delivery does not.

---

## Email budget

A consumer Google account allows 100 script-sent emails per day, shared by everything
the account runs. `EMAIL_RESERVE` is held back from bulk sends so order confirmations
always have headroom, and `MAX_REMINDER_EMAILS` caps each blast.

Each order costs **two** emails (customer confirmation + owner notice), plus one more
if an invoice is sent on delivery.

The week is already busy: Tuesday menu announcement, Thursday reminder, Friday last
call, Monday invoices. **Wednesday is the only clear weekday** for a campaign. A bulk
send attempted on a blast day will silently send nothing.

Upgrading the account to Workspace (~$7/month) raises the limit to 1,500/day and makes
this entire section unnecessary.

---

## Known weaknesses

**Customer data is still in git history.** Until v229, `index.html` hardcoded the
admin PIN and sample customer lists (`CUSTS`, `REACT`, `ROUTE_STOPS`) with real names,
emails, phones and addresses. They are gone from the current file but remain in every
earlier commit of this public repo until history is rewritten.

**`index.html` is ~4MB, and ~88% of that is embedded base64 images** — around 75 of
them. The actual code is roughly 330KB. Every visitor downloads all of it. This is why
loads are slow, why the PWA cache is unwieldy, and why a link-preview page had to exist
at all. Extracting those images into files would cut the page by ~90% and is the single
highest-value change available.

**Delivery-fee data starts in Jan 2026.** Earlier weeks genuinely have no per-order fee
recorded, so analytics fall back to a flat $5 for them. That is correct, not a bug.

**Acquisition tracking starts from when it was added.** Pre-existing customers appear as
"unknown" the first time they order after that. Also expected.

---

## Reading the data

The retention analysis, acquisition report and recapture results all live in the admin
panel. Two honest cautions when reading them:

- Recent cohorts always look worse than older ones simply because they have had less
  time to order again. Compare cohorts of similar age.
- Correlations that sort customers by their own order count are usually circular. A
  "salad buyers reorder 4× more" figure turned out to be an artifact — frequent buyers
  simply had more chances to try one. The honest test was whether a salad appeared in
  their *first* order, which showed no meaningful difference.
