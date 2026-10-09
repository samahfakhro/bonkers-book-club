# Handoff — capacity, waitlist, messaging (from the "capacity management" chat, 2026-10-09)

Samah is moving to one chat. This note is everything the capacity chat built and planned, so the routes/delivery chat can carry on.
Samah's working rule still applies: describe planned changes and get her OK before editing; double-confirm big changes.

## Done and pushed
- **Capacity management** (`1b4e83a`)
  - Rules: `lib/membership/availability.ts`. Order: GLOBAL_PAUSED → ZONE_NOT_OPEN (outside polygons, or zone has no Bonkers Day) → ZONE_PAUSED → GLOBAL_CAP_REACHED → ZONE_CAP_REACHED; any error → CHECK_FAILED (waitlist).
  - **Empty or 0 cap = no limit** (global and per zone). To stop signups, use Pause.
  - A place is held by households with `account_status` active **or paused**. Book/reading-stage data never blocks signup — information only.
  - Checked at pin confirm (`/api/membership/availability`, returns yes/no only), again before account creation, and finally inside `/api/create-household`, which also sets zone + Bonkers Day from the server's own calculation.
  - Customer always sees one message: "Memberships in your area are currently full…". The real reason is stored on the waitlist entry, never shown.
  - Settings: `system_settings` keys `global_membership_cap`, `global_memberships_paused`, `stage_books_per_child_warning`; `zones.membership_cap`, `zones.is_paused`.
- **Admin `/admin/capacity`** (`app/admin/capacity/page.tsx`, `app/api/admin/capacity/route.ts`)
  - Shows memberships, Bonkers Days (edit cap / pause), books, reading stages vs children, waitlist by area/zone/reason, and a warnings strip.
  - Child stage is derived from date of birth: under 5 Hatchling, 5–7 Chick, 8+ Bird. Add Child no longer asks for a stage; the `READING_LEVELS` const in `app/dashboard/children/new/page.tsx` is dead code.
- **Waitlist** (`/api/waitlist`)
  - Saves name/email/mobile already entered at signup step 2, plus pin, zone, internal reason, and area name via Google reverse geocode (neighbourhood → sublocality). One entry per email.
  - Invites (`f227465`): Families table on the Capacity page; Invite via WhatsApp/email opens a prefilled message the admin sends themselves, then confirms → `invited`; Remove / Put back.
  - Signup marks matching entries (same email OR mobile) `joined`. If capacity fails mid-signup, the brand-new auth user is deleted so the email can sign up later.
  - **Not tested end to end** (needs a real signup): an invited family signing up → JOINED.
- **Admin headings** use the plain system font (`.admin-root` rule in `globals.css`).
- **Parent Messages inbox** (`849f442`)
  - Envelope (NOT a bell — the bell is Notify Me on books) left of the profile picture on the dashboard only, with a **green** unread count (red is too alarming).
  - `/dashboard/notifications` page; `notifications.title` + `read_at`; RLS so parents only see/mark their own.
  - Shared sender: `lib/notify.ts` `notifyHousehold()` (already used by missed visits).
  - **Not yet tested in the browser**: needs Samah logged into the dashboard in the app's browser pane. Insert a couple of `[TEST]` rows for her household, check the count, the page, open a message and "Mark all as read", then delete them.

## Agreed next steps, in order
1. **Finish testing the envelope** (above).
2. **Email** via Resend (free tier). Samah creates the account and adds DNS records for bonkersbookclub.com (guide her step by step). Add email to `notifyHousehold()`, respecting `households.notify_email`. WhatsApp later.
3. **Notify Me sending** (bell rows live in `book_availability_notifications`: user_id, child_id, book_id, is_notified).
   - Fire when returns staff press **"Finished inspecting"** for a batch — not at scan. Only copies that end up **available** trigger messages; damaged or withdrawn copies notify nobody. One message per book per batch.
   - **Also fire when a new copy of a book is added** in admin Books (e.g. a replacement bought after damage).
   - Message: "📚 Good news! *[Title]* is back on the Bonkers shelf. It's first come, first served — add it to [child]'s next swap before someone else does!" → link to `/dashboard/library/<bookId>?from=parent`, plus a one-tap "Stop alerts for this book" link (token, no login).
   - Remove a family from a book's list once that book is packed or delivered to them.
4. **Damage history + payment requests**
   - Returns conditions: Good / Worn but fine / Damaged-still lendable / Damaged-withdrawn / Lost, with photos.
   - Keep a per-family damage count even when charging, shown on the household page with a ⚠ flag at a settable level.
   - "Request payment" suggests an amount from settings; admin can edit or waive. Never charge automatically.
   - Status Requested → Paid / Waived / Disputed; mark Paid manually until Stripe is connected. Existing tables: `return_inspections`, `damage_charges`, `payments`.
5. **Admin Settings page**
   - Include: plans + prices (currently hardcoded in `app/signup/page.tsx` PLANS; `subscription_plans` is empty), choose-books deadline (hardcoded "2 days before Bonkers Day" in `app/dashboard/page.tsx`), contact WhatsApp/email shown to parents (hardcoded in `app/dashboard/support/page.tsx`), "How did you hear about us" options, damage charge % (considerable / lost) + damage warning level, default notification prefs.
   - Do NOT build: oops allowances, pause limits, waitlist offer window (all dropped).
   - Ask Samah whether the Buy List belongs here.
6. **Visit tracking**: first-touch source (referrer + `?src=`/utm tags: Instagram, TikTok, Google, ChatGPT, Perplexity, Gemini, Claude, Facebook, WhatsApp, direct), anonymous, attached to waitlist entries and households. Give Samah tagged links for her bios.
7. **Reports**: signups over time, cancellations, children per family, how-heard vs actual source, a funnel by source (visits → waitlist → members), loans per child/stage, time out, most/never borrowed, best reviewed, stock per family vs her "100 books per 10 families" guess, waitlist growth by area, invite → join conversion.
8. **Admin add/remove books in a child's swap** from the household page (damaged copy at packing, parent requests, helping a stuck family). Allowed until packed; only available copies.

## Before launch (flagged to Samah)
- `/admin/*` pages and `/api/admin/*` routes have **no login/admin check** — must be locked down.
- Stripe: once live, a membership place should count on first payment, not at signup.
