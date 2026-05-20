# CT1 Visualizer — UX & Quality Review

**Reviewer brief:** fresh-eyes pass for a betterhomes broker on a phone, mid-viewing in CT1, one-handed, possibly weak signal. North-star test: any common tenant question answered in under 10 seconds without leaving the screen, without hunting hover / modals / tabs. Diagnose only, no code changes.

Scope: mobile is the primary user surface (`CT1 Visualizer Mobile.html`, 3554 lines), desktop secondary (`CT1 Visualiser.html`, 3951 lines). Both ride on a tiny Next.js shell (`middleware.ts`, `app/`, PIN gate).

---

## Quick wins (each under 30 minutes)

1. **Drop "Connecting…" from the Overview sync stripe once live.** A fresh broker landing while the gviz request is in flight sees a confusing "Connecting…" in the Available card before the number paints; once live the same row sits dead-weight. Hide on success; only show in offline / connecting.
2. **Surface a floor input on Browse.** Add a "Floor" number input (or compact "5–93" range) next to the price / size sliders. Right now there is no way to filter Browse by floor, the broker has to bounce to the Tower tab.
3. **Inline "cheapest 2BR" hint** on the bedroom strip cards (Overview tab 1304 area). Each bed-card already shows the available count — add the cheapest rent below the count, single line. Removes one tap and one sort for a near-universal question.
4. **Collapse the filter bar by default** on Browse. Today the sticky filter eats ~67% of viewport on a 390 × 844 iPhone before any unit card is visible. Expose only search + bedroom chips + sort + count by default, hide type / view / extras / price / size behind a "More filters" toggle.
5. **Fix two brand-naming violations on desktop** (`CT1 Visualiser.html`):
   - Line 1613: `<span class="legend-arrow">BH won</span>` → `bh won`
   - Line 3056: `<span>BH Broker owner</span>` → `bh broker owner`
   - Line 37 comment: `/* MASTHEAD — BH left, CT1 right ... */` → lowercase if you care about comments too.
6. **Add backdrop tap + swipe-down to dismiss the unit / floorplan / booking modals.** Today the only exit is the small × in the topbar. On a one-handed phone, a thumb sweep down is more natural than reaching for a 36 × 36 target at the top-left.
7. **Make Recently-viewed visible by default on landing, not buried in the Browse tab.** A broker walking floor-to-floor reopens the same three or four units; the recent strip is the single best shortcut and it's hidden one tab away. Mirror it onto the Overview tab below the bedroom strip.
8. **Empty-state copy on Browse** already says "No units match these filters" with a clear button — good. But it should also tell the broker which filter is the most restrictive (e.g. "Try widening Rent — current range is AED 220k – 260k").
9. **Live result count on the filter bar is good** (#list-count), but it doesn't update in the filter chips themselves. Add the count to the active bedroom chip — "2 Bed · 47" — so the broker doesn't have to scroll to the meta row to see the number.
10. **`stat-pill` element is defined in CSS (line 217) but I can't find a place it's rendered** — quick grep / delete if confirmed dead.
11. **Increase touch target on `.live-pill`** in the topbar (line 66) — current padding is 5 × 9 px, total height ~24 px including the dot. Below the 44 px Apple HIG minimum. Same for `.search-clear` 24 × 24.
12. **The "Connecting" pill is also the retry button** but there is no visual affordance for that (no caret, no underline). Label says "Snapshot" when offline — change to "Retry · offline" or wrap in a chip with a refresh glyph.

---

## Findings, by severity

### CRITICAL

#### C1. There is no way to compare two units side-by-side
**What it is.** The brief lists "compare two specific units" as a north-star broker task. There is no compare flow — no multi-select on cards or tower cells, no compare drawer, no second pane. The only workaround is to open one unit modal, close it, open another and rely on memory or the recently-viewed strip.

**Why it hurts mid-viewing.** A tenant standing in unit 31-04 asks "and how does this differ from 35-04?" The broker has to memorise rent / size / PSF / view / balcony for the first, then mentally diff against the second. PSF is shown with one decimal, balcony as a string with units — easy to mis-remember. The PSF on a 3-bed varies meaningfully floor-to-floor and is a closing tool.

**Fix.** Long-press on a unit card / tower tile to "pin" it, then opening a second unit shows a two-column hero (rent · size · PSF · view · balcony · parking). Mobile constraint: stack vertically with the two units' hero rows above the rest of the modal. Effort: ~1 day.

#### C2. The whole app is one HTML file with no virtualisation and the FALLBACK_UNITS snapshot is inlined
**What it is.** The mobile HTML is 414 KB on disk. ~95% of that is the inlined `FALLBACK_UNITS` snapshot of all 695 units (line 1696 onward). Every render of the Browse list and every render of the Tower view writes the full filtered set to a single `.innerHTML` string — no virtualisation, no DOM recycling.

**Why it hurts mid-viewing.** The first-paint payload is large for a broker on a weak in-building signal (CT1's reinforced concrete kills LTE — confirmed pattern in DXB high-rises). On the open Browse tab with all filters cleared, the renderer puts 695 `.unit-card` nodes in the DOM; on filter-bar scroll the layout is fine on a recent iPhone but starts to jank on older Androids. Tower-viz renders 695 `<button>` cells — fine because they're cheap, but every filter change re-renders the whole thing via `innerHTML.map().join('')`.

**Fix.**
- Move FALLBACK_UNITS out of the HTML and into a separate `/snapshot.json` fetched in parallel with the live sheet. Cuts first paint by ~400 KB.
- For the Browse list, slice to the first 100 rendered + IntersectionObserver to lazy-render the rest.
- Add the `Cache-Control` header on `/mobile.html` in `next.config.mjs` so the broker's repeated visits over a day come from cache.

Effort: 2–3 hours to split snapshot, half-day to add lazy list rendering.

#### C3. PIN gate is a single hardcoded value and `/api/pin` has no rate limiting
**What it is.** `middleware.ts:7` and `app/api/pin/route.ts:4` both hardcode `PIN = "1986"`. No backoff, no IP rate limit, no lock-out, no audit. The PIN sits in two places that must be kept in sync. A four-digit PIN is 10,000 combinations — a script can brute-force it in seconds.

**Why it hurts.** Not a viewing-time issue, but a leak-time issue: the moment one broker shares their link with a tenant who then shares it with a sub-agent, the whole stock list (including reserved, signed, occupied, broker ownership column on desktop) is exfiltrated. Competitive intelligence risk is real.

**Fix.** Move PIN to an env var on Vercel (`CT1_BROKER_PIN`), keep middleware reading it; add a sliding-window rate limit on `/api/pin` (e.g. `@upstash/ratelimit`, 5 attempts per 10 min per IP); consider a longer passphrase or per-broker token. Effort: 1–2 hours.

### HIGH

#### H1. The Overview "Available" big number is the only landing affordance, but it hides Listed-vs-In-house
**What it is.** The Available KPI (line 1264) shows the combined `available + marketing` count. The fact that some of those are "Listed on portals" and some are "in-house only" appears as a sub-text run-on string ("28 listed on portals · 4 reserved · 3 show flats · Tap to browse"). That sub-text is light grey on dark, ~11px, easy to skip.

**Why it hurts.** A broker showing a sub-agent the building wants to say "only n of these are on Bayut, the rest are bh-exclusive" — which is a closing pitch. Today they cannot read that without squinting.

**Fix.** Split the big "Available" number into two stacked pills: "n in-house" + "n listed". Effort: 30–60 minutes.

#### H2. No floor filter in Browse
**What it is.** Task 3 from the brief is "what is still available on a single floor." The only way to answer is to scroll the Tower tab, find the floor row, tap one tile — but a single tile only reveals one unit. There is no "show me all units on floor 31" view.

**Why it hurts.** This is the most common mid-viewing question. A tenant on the 31st floor about to look at 31-04 will ask "and what else is on this floor?" Today the broker scrolls the Browse list looking for `31-xx` patterns, or hits the Tower tab and reads tile-by-tile.

**Fix.** Either add a floor-range slider next to the price slider, or make the tower-floor labels (the `.tw-num` left of each row) tappable so a tap on floor "31" deep-links to Browse with a floor filter applied. Effort: half a day; lots of value.

#### H3. Hover-only affordances exist on desktop, none on mobile (good), but the tower preview-tooltip on mobile requires touch-and-hold
**What it is.** Mobile: there is NO `:hover` reveal of unit data — good. But the tower-viz tooltip (`.tw-tip`) only appears on `touchstart` and follows `touchmove` (line 2553 area). A tap (without hold) opens the unit modal immediately; a hold-and-drag shows the tooltip.

**Why it hurts.** Brokers don't naturally hold; they tap. So they get the modal every time, which costs three taps to compare two units (open A, close A, open B). The preview tooltip is a powerful tool but undiscovered. The only hint is the tooltip itself once it appears ("Release to open"), which is a chicken-and-egg.

**Fix.** Either:
- Make tooltip the default on tap, with the modal opening on second tap or via a button in the tooltip. (Risk: extra friction.)
- Add a one-time onboarding overlay on first Tower tab visit: "Tap to open · Hold to preview." Tie to `localStorage`.

Effort: 1–2 hours for the onboarding overlay.

#### H4. The viewport chrome eats ~67% of a 390 × 844 iPhone before any unit card is visible on Browse
**What it is.** Topbar (60 px) + sticky filter bar (~450–500 px when all rows are visible: search + bed chips + type chips + view chips + extras + 2 sliders + sort + meta) + tabbar (60 px) ≈ 570–620 px of 844 px = 67–73% chrome. Only ~220–270 px is left for the unit list.

**Why it hurts.** Broker has to scroll past their own filters to see anything. On a 700-row list this is fine; on a filtered list of 4 it's a comic mismatch.

**Fix.** Collapse the type / view / extras / sliders behind a "More filters" disclosure (quick win 4). Once a filter is applied, show a compact chip with the active filter and a × so it can be cleared individually. Effort: half a day.

#### H5. No swipe-down or backdrop dismissal on the modals
**What it is.** Confirmed by code: `.um-modal`, `.fp-modal`, `.bk-modal` only close via the `×` button. No backdrop click handler, no swipe-down gesture, no Android hardware-back interception.

**Why it hurts.** One-handed thumb reach: the × button is top-left on the modal topbar, which is the hardest corner on a right-handed user holding a phone bottom-right. On Android, hardware back behaves browser-default — it'll navigate away from the page entirely instead of closing the modal, which is jarring.

**Fix.**
- Add `<modal>.addEventListener('click', e => { if (e.target === modal) close(); })` for backdrop tap.
- Add swipe-down gesture (touchstart Y, touchend Y, threshold ~80 px).
- On Android, `history.pushState` when opening a modal and intercept `popstate` to close it instead of leaving the page.

Effort: ~3 hours total.

#### H6. Reservation Form, Tenancy Contract, and Etihad Credit Bureau are all on the Info tab, three taps from Overview
**What it is.** The three Drive / web docs that a broker hands a tenant during the "we're moving forward" moment are stacked on the Info tab. A broker has to: tap Info → scroll past Opening & viewing → past Fees → past Parking → tap the doc card.

**Why it hurts.** These are closing actions, executed in the lobby right after a tenant says yes. Speed matters.

**Fix.** Add a sticky bottom "Share" or "Reserve" CTA inside the unit-detail modal that opens a small action sheet: { Copy unit for WhatsApp · Book viewing · Reservation form · Tenancy contract · Etihad CB }. Effort: 2–3 hours.

### MEDIUM

#### M1. "Connecting…" status pill is duplicated in two places and shows for 3 seconds even on fast networks
**What it is.** `.live-pill` (topbar) + `.stat-sync` (inside the Available card, line 1268) both render "Connecting…" on first paint. The watchdog timer waits 3 s before declaring offline (line 1892). On a fast network the live data lands in 200–600 ms, so the pill cycles Connecting → Live almost instantly — but on weak signal you sit at "Connecting" for the full 3 s.

**Fix.** Once `setLive('live', ...)` fires, hide `.stat-sync` entirely (no need for two indicators). Reduce the watchdog to 1.5 s and show a different inline message ("Loading live stock…") so it doesn't look stuck.

#### M2. The Tower legend is hidden behind an accordion that has no obvious affordance
**What it is.** `#legend-toggle` is a small "Legend ▾" button below the tower stage (line 1346). Tapping expands the swatch key. The colours are non-obvious without the legend: the powder-blue cell could mean "Available" OR "Reserved · H&H" depending on whether it's filled or has an inset border. Brokers will mis-read.

**Fix.** Open the legend by default on first tab visit. Persist dismissal in localStorage so power-users see it collapsed.

#### M3. The bedroom strip on Overview is a horizontal scroll — Studio + 1 + 2 + 3 + 4 = five cards, all fit on screen, so the scroll is unnecessary
**What it is.** `.bed-strip` is `flex; overflow-x: auto; scroll-snap-type: x mandatory` (line 290). On a 390 px iPhone the five 96-min-width cards fit (5 × 96 + 4 × 10 gap = 520 px, exceeds 358 px content width). So the scroll IS needed on small phones. But the cards are different widths visually and the bedroom counts vary wildly in scale (Studio 12, 3 Bed 240) — a horizontal scroll obscures the relative scale.

**Fix.** A 2-column grid (Studio · 1 Bed on top row, 2 · 3 · 4 below) avoids horizontal scroll and lets the broker compare at a glance.

#### M4. Sort menu is a popover with 6 options — but the default sort is Floor low → high, which is the wrong default for a viewing broker
**What it is.** Default sort is `floor-asc`, so 695 unfiltered units start at floor 5. A broker just landed in the lobby is much more likely to want "what's available, cheapest first" or "highest floor first" for the view-conscious tenant.

**Fix.** Default to `price-asc` for the Available bedroom strip's deep-link (so "tap 2 Bed → see cheapest 2 Beds first"), and keep `floor-asc` only when a specific floor or floor-range filter is active.

#### M5. The recently-viewed strip persists across sessions but has no visual cue that it's tappable
**What it is.** `.recent-card` has `cursor: pointer` and an `:active` transform but no underline / chevron. On mobile, `cursor: pointer` is invisible.

**Fix.** Add a small "↗" or ">" arrow inside each recent card, matching the same affordance used on the Info doc cards (`.info-doc-arrow`).

#### M6. The Info tab's two calculator cards (Effective rent, Agency fee) duplicate the unit-modal calculator
**What it is.** `#ic-rent / ic-term / ic-free` (line 1544) and `#fc-rent / fc-term` (line 1560) are nearly identical to the per-unit `c-rent / c-term / c-free` in the modal. A broker on a call needs the standalone version; a broker with a unit open uses the modal one. Both exist. OK so far.

**But** the modal calculator's "Discount vs asking" is rounded to 1 decimal; the standalone one (Info tab `ic-disc`) might use a different rounding. Worth a one-line audit to confirm parity.

**Fix.** Quick parity test: type the same inputs in both and confirm outputs match exactly.

#### M7. The KPI sub-labels say "Signed + Occupied" — a tenant or sub-agent reading over the broker's shoulder won't know what that means
**What it is.** `#kpi-bh-sub` and `#kpi-hh-sub` read "Signed + Occupied · 12.4%" (line 2050).

**Why it hurts.** "Signed" and "Occupied" are internal pipeline states. A tenant glancing at the screen sees jargon. The number itself is the deals-done count, which is the right metric.

**Fix.** Rename to "Deals closed" or just "Let" (already on the tally line). Drop the redundant "Signed + Occupied" descriptor.

#### M8. KPI tally values can collide with labels on narrow screens
**What it is.** `.kpi-half .kpi-tally` is `display: flex; justify-content: space-between` (line 271). When the values are 3-digit (e.g. 240) and the label "Reserved" sits on the same line, the layout breaks on iPhone SE / iPhone 12 mini (375 × 667).

**Fix.** Stack `.kpi-tally` lbl above val on widths below 400 px. Quick CSS media query.

### LOW

#### L1. Salmon (#FF787A) on paper background — borderline contrast for body text
**What it is.** Used for `.bk-error` text (line 753), the offline pill color, and "Wrong PIN" message on the PIN page. Salmon on paper (#F7F4F1) computes to roughly 3.1:1 — fails WCAG AA for body text (needs 4.5:1).

**Fix.** Switch error text to terra (#A06767) which is darker and reads well on paper. Keep salmon for the offline pill on dark background where contrast is fine.

#### L2. The .conn-help panel only appears after a 3 s watchdog — it doesn't appear if the sheet is responding slowly but not failing
**What it is.** If the request takes 2.9 s, the user sees no help message and might think the app is just slow.

**Fix.** Either show a low-key "Loading live stock…" after 1 s, or accept current behaviour as a debounce.

#### L3. Tower-viz uses `<button>` cells with `aria-label="Unit 31-04"` — labels are unique but lack status / rent
**What it is.** Screen reader announces "Unit 31-04 button" with no info about whether it's Available, Reserved, what it costs, what view. A blind broker is hypothetical but the codebase pretends to support a11y partially.

**Fix.** Append `${STATUS_LABEL[u.s]} · ${m.label} · ${fmtAED(u.pr)}` to the aria-label. Effort: 5 min.

#### L4. The PIN page's error message "Network error — try again" hides the underlying state
**What it is.** `app/pin/page.tsx:142–145`. Any fetch failure shows "Network error" — including a 500 from the server.

**Fix.** Discriminate between status 401 ("Wrong PIN") and network failure / 5xx ("Server error, try again"). Effort: 5 min.

#### L5. The pulse-card / guide-card on overview is dismissible but its dismissal isn't persisted
**What it is.** Tapping × on `.guide-card` (line 1247) hides it for the session. On the next page load it reappears. Brokers will dismiss it daily.

**Fix.** Persist dismissal in localStorage (key e.g. `ct1.guide_dismissed_v1`). Effort: 10 min.

#### L6. Inline `<script>` block is 1860 lines (lines 1692–3551) — one of the largest functions is `openUnit` at 130 lines
**What it is.** Single file, no component boundaries. Long-term cost is editing pain: a small change requires reading hundreds of lines to find the right spot.

**Fix.** Optional refactor: split into modules (data, render, modals, calculators), build with esbuild/vite into a single bundle. Don't do this until it actively blocks a feature. Effort: 1–2 days.

#### L7. `predev` and `prebuild` both run `copy-html.mjs` but the file isn't watched in dev mode
**What it is.** A developer edits `CT1 Visualizer Mobile.html`, but the dev server is serving `public/mobile.html` which is a stale copy. Reload doesn't pick it up; you need to restart `npm run dev`.

**Fix.** Add a `chokidar` watcher in dev, or rename to `mobile.html` directly in `public/` and skip the copy.

#### L8. Comment at top of `CT1 Visualiser.html:37` says "MASTHEAD — BH left, CT1 right" — comment convention violation
Minor.

#### L9. middleware.ts user-agent regex doesn't catch all Android devices
**What it is.** Regex `Android.*Mobile` — Android tablets and Chromebooks in tablet mode lack "Mobile" in UA. They'll land on desktop. Probably intentional, but iPad-mini-in-mobile-mode also lands on desktop because iPad UAs are now Mac-like.

**Fix.** Document the intent in middleware.ts as a comment. If you want iPads on mobile, sniff for touch-capable narrow viewports client-side and redirect.

---

## Test plan

Concrete scenarios to walk through yourself.

### A. One-handed timing test (Overview → Browse → close → Tower)
- Stand. Hold phone right-handed, thumb only.
- **Task 1:** Find cheapest available 2BR and read its rent.
- **Task 2:** Find a high-floor (60+) 3BR under AED 400k.
- **Task 3:** What is still available on floor 31?
- **Task 4:** Compare unit 31-04 vs 35-04 (rent, size, view).
- Time each, count taps. Anything > 10 s or > 2 taps is a finding.
- Specifically watch: can your thumb reach the × in the modal topbar? Can you switch tabs without re-gripping?

### B. Glare test
- Step outside in full sun. Open the app.
- Can you read `.uc-rent` (Georgia, 17 px, slate on white)? Yes, fine.
- Can you read `.uc-mid` (13 px, slate)? Yes.
- Can you read `.b-sub` "available" on the bed cards (10 px, denim)? Marginal.
- Can you read `.kpi-half-sub` "Signed + Occupied · 12.4%" (10 px, sun on dark)? **Likely no.** Note this — it's the sub-line of the KPI you want at-a-glance.

### C. Slow / dropped signal test
- Chrome DevTools → Network → Slow 3G. Reload.
- Watch the topbar pill cycle Connecting → Snapshot → Live (or just Connecting → Live).
- Force the gviz endpoint to return 502 (block `/api/units` in DevTools). Confirm: `.conn-help` panel appears with the "Open in Safari" copy.
- Tap the live-pill to retry. Confirm: refetch starts.
- Open the unit modal while offline. Confirm: calculator still works, "Copy for WhatsApp" still works.
- Floorplan modal: tap "View floorplan". With `/api/floorplans` blocked, confirm the modal shows the "fp-empty" state, not a white screen.

### D. Screen-reader pass (VoiceOver, iOS)
- Triple-click home / side button to toggle VoiceOver.
- Swipe through Overview tab. Listen for: each KPI is announced by name + value; bedroom cards announce "Studio, 12 available"; show-flat cards announce the unit ID.
- Switch to Tower tab. Tap into the grid. Confirm: cells announce "Unit 31-04 button" — but with no status / rent. (Finding L3.)
- Switch to Browse tab. Swipe through filters. Confirm: each chip is announced with active state ("2 Bed, selected").
- Try the sort menu — does VO announce "Sort, button, collapsed" then "expanded" on tap? (#sort-trigger has aria-expanded — check.)
- Open a unit modal. Confirm: focus moves into the modal? (Currently no — `aria-hidden` is set but focus isn't trapped.) This is a moderate a11y gap not yet listed; add to L-level findings if relevant.

### E. Late-campaign state test (~250 units already reserved / signed)
- Edit the Google Sheet `07_HTML_Export` tab in a staging copy to mark 250 units as `Signed` with `agency_won = BH` and 50 as `Reserved`.
- Open the app.
- Confirm: Available KPI drops to ~395; bh "Let" KPI shows 250.
- Browse list, "All bedrooms": confirm the empty bedrooms (e.g. studio sold out) show 0 in the bedroom strip rather than disappearing.
- Tower-viz with "Available focus" toggle on: confirm the saturated-green cells are visually dominant over the dimmed slate / powder cells. Confirm there is no visual confusion between "Available" (green) and "Reserved · bh" (white-with-slate-border).
- League tab: confirm broker names render correctly when there are 250+ deals to aggregate. Confirm no broker rank-1 row overflows on a 390 px viewport.
- Edge: mark all 695 as reserved/signed/occupied. Confirm Available KPI is 0; confirm the bedroom strip doesn't crash; confirm Browse shows the empty state.

### F. Brand-naming pass
- Search the rendered DOM (not source — DOM) for the strings `BH `, `Betterhomes`, `BetterHomes`. Right now desktop has two: legend "BH won" and the unit-detail "BH Broker owner".
- Confirm Mobile has zero.

### G. PIN-gate pass
- Open in a private window. Confirm: redirected to `/pin`.
- Enter wrong PIN 20 times rapidly. Confirm there is NO lockout (this is the gap from C3).
- Enter `1986`. Confirm cookie is set and `/` resolves.
- Clear cookies in DevTools. Confirm: next request rewrites back to `/pin`.

---

## Highest-leverage single change

**Add a floor filter and a compact "compare two units" pin gesture on the unit-detail modal.**

Floor filter alone covers task 3 ("what is still available on a single floor"), which is the most common viewing question and currently has no answer in the Browse tab. Combined with the pin-to-compare gesture, you cover task 4 ("compare two units") with one tap each. Both are absent today and both are within a day's work; together they convert this from a "snapshot dashboard" into a "viewing tool." Every other finding in this review can wait behind those two.
