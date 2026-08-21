# Handoff: WoundTrack — wound care management (nurse + clinic admin)

## Overview
WoundTrack is a wound care management system for a clinic (reference tenant: "Al Nakheel Wound Clinic", Riyadh). This bundle contains a clickable HTML prototype covering two roles:

- **Nurse workspace** — patient roster, patient record with photo timeline and healing trend, and the hero flow: a five-step guided wound check-in (identity → guided photo capture with a quality gate → AI-assisted measurements → structured observations → triage & submit). The check-in implements a structured wound-image-assessment model — capture grading, the scale rule, tissue/edge/periwound vocabularies, NERDS/STONEES infection screening, escalation flags and explicit "not obtainable from a photograph" fields. See **The image-assessment model** below; it is the most important section in this document.
- **Clinic administration** — team & tenancy management with MFA state, AI/protocol feature flags, clinician-owned triage thresholds, and an append-only access audit.

The prototype was built for clinical review and nurse usability testing. It is desktop-first and fully responsive down to phone widths.

## About the Design Files
**The files in this bundle are design references created in HTML.** They are prototypes that demonstrate intended layout, copy, colour, states and interaction — they are *not* production code to lift directly.

The task is to **recreate these designs inside the target codebase's existing environment** (React, Vue, SwiftUI, native, whatever the product uses), following its established component library, styling conventions, routing and state patterns. If no environment exists yet, pick the framework that fits the product and implement the designs there.

Specific reasons not to copy the HTML verbatim:
- The prototype is written in a bespoke streaming-template runtime (`support.js` + a `.dc.html` file with a template and a logic class). That runtime is an authoring convenience here, not a dependency you should adopt.
- All styling is **inline** (a constraint of the authoring environment). In a real codebase this should become the codebase's normal styling layer — CSS modules, Tailwind, styled-components, design tokens, etc. See **Design Tokens** below.
- Responsive behaviour is implemented in JS (a `ResizeObserver` swapping style strings) because media queries weren't available. In production this should be **plain CSS media/container queries**.
- All data is hard-coded fixture data at the top of the logic class. Replace with real API calls.

## Fidelity
**High-fidelity.** Colours, typography, spacing, radii, copy and interaction states are final-intent and should be recreated faithfully. Exact values are documented below and are all readable in `WoundTrack.dc.html`.

Two caveats the designer flagged and that are surfaced in-app on the "Design notes" screen:
1. **Field vocabulary follows the assessment model but still needs sign-off.** Tissue, edge, periwound, moisture, NERDS/STONEES and etiology terms now come from the structured model documented below (which draws on NPIAP / WOCN / NERDS-STONEES conventions), but the clinical lead should still confirm them for this clinic before they are treated as final. Build them as versioned, configurable value sets — not string literals.
2. **The guided capture step ideally needs a dedicated phone layout.** The current prototype is one responsive layout across all breakpoints; capture on a real phone (camera viewfinder, one-handed reach, big shutter target) deserves its own design pass. Not yet designed.

---

## Screens / Views

### Global shell
- **Layout:** two columns. Left `<aside>` 238px fixed. Right `<main>` fills remaining width: a 58px header bar, then a scrolling content region.
- **Sidebar (238px, bg `#fffefc`, right border `1px solid rgba(28,25,23,.09)`):**
  - Brand block: 26×26px rounded-8px teal `#1f6f6b` mark with an inset organic blob `#f6c9a8`; "WoundTrack" 14.5px/700, letter-spacing −.2px; clinic name 10px/500 `#8a827b`.
  - Role switch: segmented control in a `#f2efeb` 9px-radius track, 3px padding; active segment `#fffefc` with `0 1px 2px rgba(28,25,23,.08)`, 12px/600 text `#1c1917`; inactive `#8a827b`. Segments: **Nurse** / **Admin**. This is a *prototype affordance* for reviewers — in production, role comes from the session, and the switcher should not ship.
  - Nav list, 6px/10px padding, 2px gaps. Each item: 34px tall, 9px radius, 6px status dot on the left, label 12.5px, right-aligned count badge. Nurse: Patients (14), Check-ins (7), Alerts (3), Design notes. Admin: Team & access, AI controls, Access audit, Design notes. Active item: `#eef4f3` background, `#1f6f6b` dot, 600 weight.
  - Footer: 28px circular avatar `#e6efee` / `#1f6f6b` initials, name 12px/600, role 10.5px `#8a827b`.
- **Header (58px, bg `#fffefc`, bottom border `1px solid rgba(28,25,23,.09)`, 0/24px padding, 14px gap):** breadcrumb ("Nurse workspace / Patients") 12.5px `#8a827b` with the leaf in `#1c1917`/600; spacer; 250px search field (33px tall, `#f2efeb`, 8px radius, placeholder "Search patients, MRN, wound ID"); 33px square alert button with a `#b4362f` count bubble (3) at top-right.
- **Content region:** `overflow: auto`, page padding 25px/28px (44px bottom), max-widths per screen (1240px roster/patient, 1180px check-in, 1140px team & audit, 1080px alerts, 900px flags, 760px notes/stubs).
- **Screen entry animation:** `wtin` — `opacity 0 → 1`, `translateY(6px) → none`, 220ms ease.

### 1. Patient roster (nurse, default)
- **Purpose:** triage overview; pick a patient or start a check-in.
- Page head: H1 "Patients" 25px/700, letter-spacing −.5px; sub "18 active wounds across 14 patients · triage refreshed 4 min ago" 13px `#78716c`; right-aligned buttons **Register patient** (secondary: 36px, 9px radius, `1px solid rgba(28,25,23,.12)`, bg `#fffefc`) and **New check-in** (primary: bg `#1f6f6b`, white text, `0 1px 2px rgba(31,111,107,.4)`).
- **KPI row:** 4 cards, `repeat(4, minmax(210px, 1fr))`, 12px gap, min-width 1000px on desktop. Card: bg `#fffefc`, `1px solid rgba(28,25,23,.09)`, 12px radius, 14/15px padding. Label 11px/600 uppercase with .3px tracking in the state colour; value ~28px/700; caption 11.5px `#8a827b`. Cards: **Urgent** 2 (`#b4362f`) "oldest unacknowledged 41 min" · **Needs review** 5 (`#9a6a1e`) "SLA 24 h · 1 due today" · **Check-ins due** 7 "2 overdue > 48 h" · **Improving** 9 (`#2f6f4f`) "median −18% area / 2 wks".
- **Filter chips:** All / Urgent / Needs review / Improving. 31px tall, 8px radius, 12px/600; active `#eef4f3` bg with `#1f6f6b` border and text, inactive `#fffefc` with `rgba(28,25,23,.12)` border.
- **Table** (card: `#fffefc`, `1px solid rgba(28,25,23,.09)`, 13px radius, min-width 1000px): header row bg `#faf8f5`, 10.5px/600 uppercase `#8a827b`, columns `52px 1.5fr 1.4fr 92px 108px 1fr 128px`, 14px gap. Row: 13/18px padding, bottom border `rgba(28,25,23,.06)`, hover `#faf8f5`, whole row is the click target → patient record.
  - Cells: 38px 9px-radius thumbnail (`#efe9e3` plate + radial-gradient organic wound blob, per-patient tint); patient name 13px/600 + "MRN xxxx-A · W-1" 11px `#8a827b` mono; wound type + site; area in cm² (mono); trend (mono, `#b4362f` if worsening / `#2f6f4f` if improving, with arrow); last check-in (relative); status pill.
  - Status pills: 11.5px/600, 6px radius — Urgent `#fdf1ef`/`#8f2b25`, Needs review `#fcf4e6`/`#7d5514`, Improving `#eef5f0`/`#2f6f4f`, Stable `#f2efeb`/`#57514c`.

### 2. Patient record
- Back link "← All patients" 12px/600 `#1f6f6b`.
- Header: 64px 14px-radius wound thumbnail; name 24px/700 with status pill; meta row (12px `#78716c`, wrapping, 6/16px gaps): MRN (mono), age/sex/DOB, "Assigned: Dr. R. Nasser", "Consent v2.1 · signed 2026-05-14"; risk chips (3/9px, 6px radius, `#f2efeb`, 11px): Type 2 diabetes · HbA1c 9.1, Peripheral neuropathy, Smoker, Reduced mobility. Right: **Clinical summary** (secondary) + **New check-in** (primary).
- **Wound tabs:** one chip per wound — W-1 "Diabetic foot ulcer · R plantar forefoot" (active), W-2 "Healed · L heel · closed 2026-04-02". One wound per check-in; each wound keeps its own identity, site and history.
- **Open-alert banner** (when unacknowledged): bg `#fdf1ef`, border `1px solid rgba(180,54,47,.24)`, 12px radius; 8px `#b4362f` dot; title 13px/700 `#8f2b25`; body 12.5px `#6b4340`; mono footnote 10.5px `#9a6a66` showing rule id, fired time, who was notified and how. Actions: **Acknowledge** (`#b4362f` fill) and **Escalate** (outline).
- **Body:** two columns `1.55fr 1fr`, 16px gap.
  - Left card: **Photo timeline** — horizontally scrolling visit frames (112px tall image, 10px radius, date + area caption); selecting a frame drives the comparison below. **Baseline vs current** side-by-side (`1fr 1fr`, 186px tall plates, same scale, mono caption).
  - Right column: **Area trend** bar chart — 120px tall, one bar per visit, `#1f6f6b` bars with the latest visit highlighted, mono value labels above, visit labels below, caption "cm² · <window>"; **Clinician response** notes list (author + timestamp + note, 12px, dividers `rgba(28,25,23,.07)`).

### 3. Check-in wizard (hero flow, 5 steps)
Header: eyebrow "WEEKLY CHECK-IN · VISIT 6" 11px/600 uppercase `#8a827b`; patient name 24px/700 + wound id in mono; right: **Save draft & exit**.

**Step tracker:** 5 equal segments, each with a 22px numbered disc (done `#1f6f6b` fill with a check, current `#1f6f6b` fill with the number, upcoming `#f2efeb`/`#8a827b`), title 12.5px/600, subtitle 11px `#8a827b`, and a 2px progress rail beneath (`#1f6f6b` filled portion). Steps: 1 Patient & wound · confirm identity / 2 Guided capture · quality gate / 3 Measurements · AI pre-fill / 4 Observations · structured / 5 Triage & submit.

Each step is a `1fr 330px` two-column grid (16px gap, min-width 1000px): work area left, guidance/context panel right.

- **Step 1 — Confirm patient & wound.** Read-only value boxes (min-height 38px, `1px solid rgba(28,25,23,.14)`, 9px radius, 12.5px) in a 2-up grid: PATIENT, WOUND, ANATOMICAL SITE, VISIT TYPE, plus consent/assignment context. Copy: "One wound per check-in. Each wound keeps its own identity, site and history." Right panel explains why identity is confirmed before capture.
- **Step 2 — Guided capture (the hero).** Dark stage: bg `#1c1917`, 14px radius; 392px viewfinder with `radial-gradient(70% 70% at 50% 45%, #3a332e, #221e1b)`, a centred organic wound shape, a dashed white framing rectangle `1.5px dashed rgba(255,255,255,.35)`, crosshair guides, and a sweeping scan line (`wtsweep`, translateY −100% → 320%). Right panel = live quality checklist, one row per check with a state dot (pending pulsing `wtpulse`, pass `#1f6f6b` with ✓, fail `#b4362f` with ✕): scale marker detected, sharpness, angle within 10°, lighting/no glare, wound fully in frame.
  - **Deliberate failure on first attempt:** checks 2 (sharpness) and 4 (angle) fail. Failure overlay: 44px circular `2px solid #e8a09a` "!" glyph, "Image rejected — retake required" 15px/700 white, body 12.5px `#d6cfc8` max-width 380px — "Sharpness below threshold and capture angle 19° off perpendicular. Unreliable input is not clinically usable." — and a white **Retake** button. Retake passes all checks and advances. This is intentional: usability testing needs to see the reject path.
  - Checks resolve sequentially (~staggered timeouts) so the gate feels like it is evaluating, not gating instantly.
- **Step 3 — Measurements & wound bed.** Copy: "AI pre-fills from the marker-calibrated image. Edit any value — your entry is authoritative." 4-up numeric inputs: LENGTH (cm), WIDTH (cm), DEPTH (cm), AREA (computed, mono, read-only). Each AI-suggested field shows a confidence chip; nurse edits override and are recorded as nurse-authored. **Wound bed — must total 100%:** three labelled sliders with colour keys — granulation `#c9705e`, slough `#d8bd7a`, eschar `#57514c` — with live percentages and a validation state when the total ≠ 100. Pain slider 0–10. Right panel: what the AI measured, marker calibration status, and the rule that a clinician confirms every value.
- **Step 2 additions (assessment model).** A capture-grade card (A–D badge + the grade's meaning) sits under the quality checklist with the recorded limitations as chips, plus a control to switch between marker-in-frame and no-marker capture so both paths are reviewable.
- **Step 3 additions (assessment model).** The scale rule as described above: withheld panel, aspect ratio, separate ruler/probe inputs. Wound bed has four bands (granulation `#c9705e`, slough `#d8c08a`, eschar `#4a423c`, epithelial `#e3ae9f`) moving in 10% steps, plus granulation quality, eschar state and exposed-structure chips.
- **Step 4 — Structured observations.** Copy: "Controlled terminology so visits stay comparable. Free text is for context only." Chip groups (single-select: 31px, 8px radius, active `#eef4f3`/`#1f6f6b`): EXUDATE AMOUNT (None / Scant / Moderate / Heavy), EXUDATE TYPE (Serous / Serosanguinous / Sanguinous / Purulent). Multi-select: PERIWOUND & INFECTION SIGNS — "select all present" (erythema, warmth, oedema, maceration, odour, increased pain, friable tissue, delayed healing). TREATMENT THIS VISIT: 2-up select-style rows (dressing type, secondary dressing). Free-text note area last, explicitly non-structured. **Assessment-model additions:** Fitzpatrick skin tone with the pigmented-skin note, wound-edge chips (epibole called out), periwound chips over the 4 cm margin, moisture balance, and a right-column NERDS/STONEES screen where each criterion is tagged image-assessable or bedside-only. Below it, a **"Not obtainable from a photograph"** panel lists depth, undermining, tunnelling, induration, temperature, odour, pain and blanchability, marking each as recorded-at-bedside or not obtainable. **These value sets still await clinical sign-off for this clinic.**
- **Step 5 — Triage & submit.** **Live rule preview** panel: one row per evaluated rule with a state dot and the trigger values that fired or didn't. **AI clinical summary** on a dark teal card: prose summary plus a 3-up metric strip in `rgba(255,255,255,.07)` tiles (10px uppercase `#8fc0ba` labels, mono values), body 13px `#cfe6e3` — e.g. "Area fell 12.4 → 7.6 cm² through week 5, then rose to <current>". **Triage outcome** list: severity band, escalation target, SLA, and who gets notified, each row tinted by band. **Assessment-model additions** in the right column: escalation flags (emergency/urgent/refer with finding + action), a proposed-classification card (etiology + confidence + differential + rationale, the staging-not-applicable note, the hard rules, and a "REQUIRES CLINICIAN CONFIRMATION" stamp), the PUSH score or its missing inputs, and an "Improve the next capture" list. The trend card and the narrative summary both branch on the real delta. Submitting posts the visit, fires the alert, and returns to the record with a toast.

### 4. Alerts (nurse)
- Copy: "Every alert records rule version, trigger values, who was notified and how it closed. Nothing disappears silently."
- Rows: `110px 1fr 150px 132px`, 16px gap, 15/18px padding. Severity pill; title 13px/600 + mono detail line (rule id, trigger values, fired time) 11px `#8a827b`; notified party 11.5px `#57514c`; state (Unacknowledged / Acknowledged / Closed) right-aligned on desktop.

### 5. Admin — Team & access
- Table `1.3fr 1fr 1.2fr 1fr 110px`: Member (30px circular initials avatar + name 12.5px/600 + email 11px `#8a827b`), Role, Scope, Last active, MFA. MFA cell: green "On" chip `#eef5f0`/`#2f6f4f` or amber "Required" chip `#fcf4e6`/`#7d5514`.
- **Pending invitations** card: email, role, expiry, Resend / Revoke links.
- **Invite modal:** 430px wide (max 100%), `#fffefc`, 15px radius, 22px padding, `0 20px 50px rgba(0,0,0,.28)`, `wtin` .18s; scrim `rgba(28,25,23,.42)`. Email field, ROLE chip group (Nurse / Clinician / Clinic admin), copy "Magic-link invitation, scoped to this clinic only. Expires in 72 hours."

### 6. Admin — AI & protocol controls
- Copy: "Regulated clinical-analysis modules stay separable from administrative functions. Changes here are versioned and audited."
- Feature flag rows (16/18px padding, dividers): title 13px/600 + description 12px `#78716c` + a toggle (44×24px track, `#1f6f6b` when on, `#ddd8d2` off, 20px white knob). Flags: vision measurement (on), AI clinical summary (on), risk prediction (off), patient-facing capture (off).
- **Triage thresholds** card — clinician-owned. Copy: "Each edit creates a new rules version; past decisions keep the version that produced them." Three sliders with a 230px label, `accent-color: #1f6f6b`, and a 74px right-aligned mono value: area-increase trigger (%), pain-jump trigger (points), stalled-healing window (days).

### 7. Admin — Access audit
- Copy: "Who viewed or changed a patient record, retained per PDPL policy. Immutable append-only events."
- Table `150px 1fr 1.2fr 1fr 96px`, 12px rows: Time (mono 11px), Actor, Action, Target (mono patient/wound id), Result (Allowed / Denied chip).

### 8. Design notes
An in-prototype page documenting decisions and open questions for the clinical reviewer — including the two gaps listed under **Fidelity**. Not a product screen; do not implement.

### 9. Stubs
"Register patient" and "Clinical summary export" are intentional stubs: a title, an explanation of what would happen, and a back action. Design them properly before build.

---

---

## The image-assessment model (read this before building the check-in)

The check-in flow encodes a set of rules about what a photograph can and cannot establish. These are not cosmetic — they are the reason the flow is shaped the way it is, and a re-implementation that drops them changes the product's clinical safety posture. Three governing principles:

1. Describe what is visible. Propose what is inferable. **Name what is unknowable.**
2. A photograph cannot assess a wound. Depth, undermining, tunnelling, induration, temperature, odour, pain and blanchability are physically unobtainable from an image and are always listed as undeterminable.
3. When ambiguous, state low confidence and give a differential. A stated uncertainty beats a confident guess.

### The scale rule (the single most important behaviour)
If no ruler, fiducial marker or known-size object is visibly in frame **and coplanar with the wound**, the system must not report centimetres — not as estimates, not hedged, not "approximately". Fabricated measurements get charted and poison trend data.

As implemented:
- Capture step exposes the marker state; when absent, the capture grade drops and the measurement step renders a hatched **WITHHELD — NO SCALE REFERENCE** panel instead of AI-derived cm.
- The withheld panel reports **aspect ratio only** and offers separate bedside ruler / probe inputs. These are held in their **own state fields** (`f.rulerL/rulerW/rulerD`) and start empty — they must never inherit AI-derived values, or the "stored as nurse-measured" label is a lie.
- Everything downstream is gated on there actually being an area value: with none, the trend rule reports "area change not quantifiable", the narrative summary drops its cm² sentence, and the PUSH score reports "Not computable. Missing: surface area".
- Values entered by the nurse are stamped **nurse-measured** in the rule trace, not AI-derived.

### Capture quality grade
A single A–D grade with an explicit meaning, shown beside the checklist, plus a list of recorded limitations (missing marker, sharpness, angle, periwound outside frame, pigmented-skin caveat):
- **A** — scale in frame, perpendicular, even light, wound cleansed, margins + 4 cm periwound visible
- **B** — usable, one or two limitations
- **C** — marginal, several findings unreliable
- **D** — not assessable

### Wound bed
Percentages in **10% increments summing to 100% of the wound bed only** — granulation, slough, eschar, epithelial. Plus granulation quality (healthy / pale / dusky / friable / hypergranulation), eschar state (**stable** = dry + adherent vs **unstable** = boggy + draining), and exposed structures (fascia, muscle, tendon, bone probeable).

### Edges, periwound, moisture
Edges: attached, unattached, **epibole (rolled under — epithelialisation has stopped)**, macerated, callused, fibrotic, punched-out, everted. Epibole and everted edges are called out explicitly rather than folded into "unattached". Periwound is assessed over a **4 cm margin**: erythema, maceration, excoriation, callus, hemosiderin staining, atrophie blanche, dryness, satellite lesions. Moisture: desiccated / moist / wet / saturated.

### Pigmented skin
Skin tone is recorded on the Fitzpatrick scale because on **IV–VI, erythema and deep tissue injury present as purple, maroon, blue or subtle darkening relative to surrounding tissue — not red**. Comparison is against adjacent unaffected skin on the same patient. Absence of a red hue must never count as evidence against inflammation, and erythema-dependent findings carry raised uncertainty. The UI surfaces this as an explanatory note that changes with the selected tone.

### Infection screening — NERDS / STONEES
Both screens are shown with each criterion tagged **image-assessable** or **bedside only**:
- NERDS: Non-healing, Exudate, Red friable granulation, Debris, Smell
- STONEES: Size increasing, Temperature, Os (probe-to-bone), New breakdown, Exudate/Erythema/Oedema, Smell

**Infection is never asserted.** The wording is always "features associated with infection; clinical correlation indicated".

### Classification and hard rules
Etiology is proposed by morphology + site with a confidence level and a differential (pressure, venous, arterial, diabetic/neuropathic, moisture-associated, skin tear, surgical). Staging is gated: `stagingApplicable = false` for venous, arterial, diabetic, skin tear and moisture wounds, shown as "Not applicable — NPIAP staging applies to pressure injuries only".

Hard rules that override pattern matching (surfaced in the UI so they survive into the build):
- Never reverse-stage — a healing Stage 4 stays "healing Stage 4"
- Slough or eschar obscuring the bed = **Unstageable**, never a depth-based stage
- Never recommend debriding dry, stable, intact heel eschar — protect and offload
- Never recommend debridement when pyoderma gangrenosum is in the differential (violaceous undermined border, rapid expansion, disproportionate pain) — pathergy worsens it
- Never assert biofilm; it is not visually confirmable
- Never state Stage 1 or DTPI as established from colour alone

### Escalation flags
Three levels — **emergency / urgent / refer** — each with a finding and an action. Emergency examples: dusky-purple skin with bullae or rapid spread (necrotising infection); exposed or probeable bone (osteomyelitis); violaceous undermined border (pyoderma gangrenosum — do not debride); retiform purpura in a dialysis patient (calciphylaxis); heaped everted friable edges non-healing > 3 months (malignancy — biopsy); new deep tissue injury; dry gangrene of a digit (do not debride).

### Trend direction
The trend rule branches on the **actual delta**, and the sign is formatted from the number (never a literal "+"):
- **reducing** → "Area fell from A to B (−N%), within the expected trajectory", rule clear, non-alarming styling; the 4-week benchmark is a **40–50% area reduction**, below which failure to heal by week twelve is predicted across venous, diabetic and pressure ulcers
- **static** → area unchanged; the copy directs attention to the tissue mix, because a static area with slough converting to granulation is real progress the area figure hides
- **increasing** → the needs-review deterioration card
- **unquantifiable** → no rule evaluated (see the scale rule)

### Confounders worth encoding
Before classifying: silver/charcoal dressing residue mimics eschar; iodine mimics slough; gentian violet mimics necrosis; dried blood mimics eschar; cavity shadow mimics necrosis; subcutaneous fat mimics slough; maceration (white) vs epithelialisation (pearly pink); callus vs slough; dependent rubor vs cellulitis; bruising vs deep tissue injury.

### PUSH score
Computed only when its inputs exist; otherwise it reports which inputs are missing rather than producing a number.

### If you wire this to a real model
The reference implementation in `reference/wound-assessment-station.jsx` (see **Files**) shows the API shape this model was derived from: a system prompt carrying the rules above, **two separate calls** (visual survey / clinical interpretation) because one response cannot hold the whole schema inside the token cap, a serial-comparison call for trajectory, and a JSON parser that repairs truncated responses by rewinding to the last cleanly-completed value rather than discarding the whole assessment. Partial results are labelled as partial in the UI, and **missing sections are treated as unassessed, never as negative findings**. Note that the reference calls the Anthropic API directly from the browser with no key handling — in production this must go through your own server.

## Interactions & Behavior
- **Navigation:** sidebar switches screen; role switch swaps the nav set and lands on Patients (nurse) or Team & access (admin). Roster row → patient record. Back link → roster. "New check-in" from roster or record → step 1 with a fresh form.
- **Filters:** roster chips filter rows client-side. Search field filters by name / MRN / wound id.
- **Capture gate:** `startCapture` sets all checks to pending, then resolves them on staggered timers. First attempt fails checks 2 and 4 → reject overlay + Retake. Second attempt passes all → advance. Attempt count is tracked.
- **Wizard:** linear next/back; step 3 blocks advancing while the wound-bed percentages don't total 100. AI-prefilled values are editable and, once edited, are attributed to the nurse.
- **Alerts:** Acknowledge updates the alert state and clears the patient banner; Escalate is designed but stubbed.
- **Toasts:** a transient message (2.6s) confirms submit / acknowledge / draft-save.
- **Animations:** `wtin` (screen enter, 220ms), `wtpulse` (pending check dot, opacity .35↔.9), `wtsweep` (capture scan line), `wtspin` (loading spinner). Drawer slide is a 220ms ease transform.
- **Responsive (implemented, breakpoint 900px on the app container):**
  - Sidebar becomes an **off-canvas drawer**: hamburger (38px, 3 × 17px bars) at the far left of the header opens it; the aside becomes `position: fixed` full-height, `z-index: 60`, `translateX(-102%) → 0`, with a `rgba(28,25,23,.42)` scrim at `z-index: 59`. Tapping the scrim or any nav item closes it.
  - Header search is hidden below 900px; header padding drops to 14px, gap to 10px.
  - Page padding drops to 18px/14px (40px bottom).
  - KPI cards go 2-up; all `1fr 330px` and `1.55fr 1fr` splits collapse to one column; 4-up field grids go 2-up; 2-up and 3-up grids go 1-up.
  - The roster table header hides and rows become a `44px 1fr auto` card grid.
  - Alerts / Team / Audit table headers hide and rows stack as a left-aligned column (`align-items: flex-start`, `text-align: left`; the desktop right-aligned last cell becomes left-aligned).
  - Step tracker and wound tabs scroll horizontally; threshold slider labels go full-width; the invite modal is capped to the viewport.
  - In production express all of this as CSS media or container queries, not JS-swapped style strings.
- **Accessibility to carry over (and improve):** the hamburger has `aria-label="Open menu"`. Not yet done and worth doing properly: focus trapping in the drawer and modal, focus-visible rings on all controls, `aria-current` on the active nav item, live-region announcements for capture-gate results and toasts, real labels on every input, and 44px minimum hit targets on touch (several controls are 30–38px today).

## State Management
Prototype state (single component; map onto the target app's real stores/routes/forms):
- `role` `'nurse' | 'admin'` — session-derived in production; drop the switcher.
- `screen` — `roster | patient | checkin | alerts | notes | team | flags | audit | stub`. Should become routes.
- `pid` — selected patient id. `filter` — roster chip. `query` — search string.
- `step` 0–4 — wizard position. `capture` `idle | scanning | fail | pass`. `attempts` — capture attempt count. `checkStates[]` — per-check `pending | pass | fail`.
- `f` — the check-in form: `length, width, depth, pain, gran, slough, eschar, epi, exudate, exType, signs[]`, plus `rulerL, rulerW, rulerD` for bedside-measured values (kept separate from AI-derived values on purpose). Server-side validation must mirror the 100% wound-bed rule.
- `scaleFound` — whether a coplanar scale marker was detected. Drives the capture grade, the withheld-measurement branch, which fields feed the area calculation, and the provenance stamp on the trend trace.
- `tone` — Fitzpatrick band; changes the pigmented-skin guidance and raises uncertainty on erythema-dependent findings.
- `a` — assessment fields: `granQuality, escharState, exposed[], edges[], periwound[], moisture`.
- `patients[]`, `alerts[]`, `staff[]`, `invites[]`, `audit[]` — fixture arrays; replace with API resources.
- `flags{vision, summary, risk, patient}` — feature flags; belong in a real flag service, versioned and audited.
- `thresholds{area, pain, stall}` — triage rule config; every edit must create a new rules version, and historical decisions must retain the version that produced them.
- `toast`, `inviteOpen`, `inviteRole`, `narrow`, `drawer` — UI-only.

Data/API needs: patient + wound resources with per-wound history; visit/check-in create; image upload with capture-quality metadata; AI measurement + summary services (separable, flag-gated, always clinician-confirmed); rules engine evaluation returning fired rules with trigger values and a rule version; alert create/acknowledge/escalate with notification records; audit event append; team/invite/MFA admin.

## Design Tokens
**Colour**
- Page background `#f6f4f1`; surface `#fffefc`; raised/secondary surface `#faf8f5`; neutral fill `#f2efeb`; image plate `#efe9e3`
- Text: primary `#1c1917`, secondary `#57514c`, tertiary `#78716c`, muted `#8a827b`, disabled `#a8a09a`
- Borders: `rgba(28,25,23,.09)` (card), `rgba(28,25,23,.14)` (input), `rgba(28,25,23,.06)` (row divider), `rgba(28,25,23,.08)` (subtle)
- Brand teal `#1f6f6b`; hover/pressed `#17544f`; tint `#eef4f3`; on-dark teal text `#cfe6e3`, label `#8fc0ba`
- Danger `#b4362f`; danger text `#8f2b25`; danger tint `#fdf1ef`; danger border `rgba(180,54,47,.24)`; on-dark danger `#e8a09a`
- Warning `#9a6a1e`; warning text `#7d5514`; warning tint `#fcf4e6`
- Success `#2f6f4f`; success tint `#eef5f0`
- Dark surface `#1c1917`; viewfinder gradient stops `#3a332e` / `#221e1b`
- Wound/tissue: granulation `#c9705e`, slough `#d8bd7a`, eschar `#57514c`, skin accent `#f6c9a8`; wound blob gradient `#c9705e → #9c4b45 → #7d3a3a`
- Alert badge `#b4362f` on white text

**Type**
- UI: **DM Sans** (400/500/600/700). Numeric / identifiers / timestamps: **IBM Plex Mono** (400/500/600).
- Scale: H1 25px/700 (−.5px), patient name 24px/700 (−.5px), section title 15px/700, card title 14px/700, subhead 13px/700, body 13px, dense body 12.5px, meta 12px, caption 11.5px, micro 11px, eyebrow 10.5px/600 uppercase (.4px tracking). KPI value ~28px/700. Line-height 1.5–1.65 on prose.

**Spacing** 3 · 4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 20 · 22 · 26 · 28 · 40 · 44 px (page padding 25/28/44; card padding 14–22; grid gaps 10–18).

**Radius** 6 (chip) · 8 (small control) · 9 (button/input) · 11 · 12 · 13 (card) · 14 (dark stage / large thumb) · 15 (modal) · 50% (avatar).

**Shadow** primary button `0 1px 2px rgba(31,111,107,.4)`; segmented active `0 1px 2px rgba(28,25,23,.08)`; modal `0 20px 50px rgba(0,0,0,.28)`; drawer `0 12px 40px rgba(28,25,23,.22)`; scrim `rgba(28,25,23,.42)`.

**Motion** 180ms (modal in) · 220ms (screen in, drawer) · staggered ~400–600ms per capture check.

## Assets
No bitmap or vector assets. All imagery — wound photos, thumbnails, viewfinder content — is drawn with CSS gradients and organic `border-radius` shapes as deliberate abstract placeholders. **Real clinical photography (or a licensed medical image set) must replace these**, and the real assets will change perceived contrast and cropping — recheck the capture and timeline layouts once actual images are in. Fonts are Google Fonts (DM Sans, IBM Plex Mono); self-host them in production. Icons in the main prototype are CSS/SVG primitives; substitute the codebase's icon set.

## Files
- `WoundTrack.dc.html` — **the design of record.** Template (markup) followed by a `class Component` logic block holding all fixture data, handlers and the responsive style values. Read this for exact values.
- `support.js` — the prototype runtime that renders `.dc.html`. Reference only; do not port.
- `WoundTrack Prototype (offline).html` — single self-contained file, no network needed. Best for opening in a browser to click through the flows.
- `reference/wound-assessment-station.jsx` — the user-supplied reference implementation the assessment model came from: the full system prompt, the two-call schema split, the serial-comparison prompt, and the truncation-repair JSON parser. **Reference only** — different product, different visual system, and it calls the API from the browser. Read it when wiring the model to a real service.
- `color-explorations/` — earlier visual-direction studies on the roster and a colour-themed variant of the app shell (`WoundTrack Color Directions.dc.html` is the canvas; `WoundApp.dc.html` / `WoundAppModern.dc.html` are the themed shells it embeds). Not the shipping design — kept so the rationale behind the chosen palette is visible. Three directions were explored: pastel colour blocks, one-primary-plus-neutrals, and soft gradient washes; the warm-neutral + teal system in `WoundTrack.dc.html` was chosen.

## Decisions worth preserving
- **Red is reserved for unacknowledged clinical urgency** — nothing decorative uses `#b4362f`. Introducing red elsewhere (nav, branding, generic errors) weakens the one signal a nurse must never miss.
- **The capture quality gate rejects bad input rather than accepting it silently.** Unreliable measurement input is worse than no input. The first-attempt failure in the prototype is deliberate and should survive into testing.
- **AI is assistive and always confirmed.** Measurements and summaries are pre-filled with visible confidence, are editable, and record the nurse as the authority. AI modules are flag-separable from administrative functions.
- **One wound per check-in.** Wounds are first-class entities with their own identity, site and history — not properties of a visit.
- **Triage thresholds are clinician-owned and versioned.** Admins don't silently change clinical behaviour; past decisions keep the rule version that produced them.
- **Everything consequential is auditable** — alerts record rule version, trigger values, notification route and closure; access is an append-only log.

## Open items for whoever picks this up
1. Confirm the assessment vocabularies (tissue, edges, periwound, moisture, NERDS/STONEES, etiology) with the clinical lead and build them as versioned value sets.
2. Design and build a dedicated **phone layout for guided capture** (viewfinder, one-handed shutter, live guidance).
3. Design the two stubs: register patient, clinical summary export.
4. Accessibility pass: focus management, labels, live regions, touch target sizes.
5. Replace placeholder imagery with real clinical photography and re-verify layouts.
6. Decide whether assessment runs on a real model. If so: server-side proxy, the two-call split, truncation-tolerant parsing, partial-result labelling, and a stored model version on every derived value.
7. Add serial-comparison ("trajectory") as a first-class view — comparability check first, then relative-or-absolute area change plus the tissue-composition shift, never a spurious trend from non-comparable captures.
