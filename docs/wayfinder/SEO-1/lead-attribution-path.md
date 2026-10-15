# Lead capture and attribution path — Maxx Builders

Research date: **2026-10-15**. Method: unauthenticated public GETs to `www.maxxbuilders.com`
and the public GTM container (low volume, robots.txt respected, **no form submitted**);
read-only reading of the sibling repos `maxx-builders-salesforce-ops` and `maxx-sales-genius`
(their never-touch rules obeyed; no `.env` read; nothing run); read-only reading of this repo at
`origin/main` 7e50e22. The Salesforce MCP required authentication and was **skipped**; no
Salesforce, GoHighLevel, GA4 or Google Ads UI/API was inspected. Anything inferred is marked
**UNVERIFIED**. No personal data appears here (field names and aggregate counts only).

## TL;DR

- The website's only lead form is a **GoHighLevel (LeadConnector) form served from the
  white-label host `link.buzzdigital.app`** and embedded as an iframe on
  `/commercial-construction-project-inquiry/`. Submissions go to GHL, not to WordPress.
- Salesforce is the documented system of record for leads and pipeline, and GHL is linked to it
  via `GHL_Contact_ID__c` / `GHL_Opportunity_ID__c`. The live GHL → Salesforce mapping has never
  been inspected by anyone (both sibling repos say so).
- **Salesforce has no UTM, gclid, landing-page or referrer fields.** `LeadSource` has 43 messy
  values on Lead (28% blank) and Opportunity source defaults to "Google Search" on conversion, so
  "organic" cannot be read from the CRM today.
- GA4 does see form submissions: a GTM listener turns the GHL iframe's `set-sticky-contacts`
  message into a `contact_form_submit` dataLayer event → GA4 event **`Lead`** in property
  **G-93353ZE9HH**, plus a Meta `Lead`. But the site runs **four GA4 measurement IDs** and
  which one(s) the repo's `GA4_PROPERTY_ID` reads, and which events are marked as key events,
  is unknown.
- This repo's conversion signal (`organic_conversions`) is GA4's deprecated `conversions`
  metric (all key events) by `landingPage` for Organic Search sessions. If phone, email, Procore
  login or SmartBidNet login clicks are key events, they are counted as "conversions".

## 1. The lead path end to end

| # | Hop | What happens | Evidence | Join keys available | Where keys are lost |
|---|---|---|---|---|---|
| 1 | Search → site | Organic visitor lands on a page (for example the hotel cost guide). | GSC (`scripts/sensor-gsc.mjs`); GA4 session | GSC `page`; GA4 `landingPage`, `sessionDefaultChannelGroup`, `sessionSource`; `gclid` on paid clicks only | GSC has no user or session key, so the GSC→GA4 join is by page only. |
| 2 | Landing page → inquiry page | Every page checked links its CTA to `/commercial-construction-project-inquiry/`. `/get-a-quote/` (Redirection plugin) and `/contact/` (Yoast) both 301 there. Some links omit the trailing slash, which may add a redirect hop. | `home.html`, the hotel guide and the inquiry page fetched 2026-10-15. `curl -D` shows `X-Redirect-By: redirection` and `X-Redirect-By: Yoast SEO Premium`. | GA4 keeps the session's landing page across the navigation. PixelYourSite sets landing-page, traffic-source and UTM cookies (`pysOptions.cookie.*` enabled; `tracking_analytics.TrafficLanding`). | None in GA4. The PYS cookies feed only Meta, not GA4 or the CRM (UNVERIFIED that they go anywhere else). |
| 3 | Inquiry page → form | The form is an iframe: `data-form-id="YcJkapw5GUQ5hCASisx0"`, `data-form-name="01-Website Construction Quote Request Form \| Long"`, `src=https://link.buzzdigital.app/widget/form/YcJkapw5GUQ5hCASisx0`. It is lazy-loaded by WP Rocket and driven by GHL's `form_embed.js`. The page has no native `<form>` (only the site-search form). The `wpcf7` matches are leftover theme CSS. | Inquiry page HTML, lines ~600–636 of the 2026-10-15 fetch | The form is cross-origin, so GA4's and PYS's own form listeners cannot see inside it. `form_embed.js` posts `["query-params", …, parentURL, referrer, …]` into the iframe. `parentURL` is `document.location.href` with stored `url_params` (UTMs, kept per GHL location in localStorage) appended, and `referrer` is the stored or document referrer. | The parent URL is the **inquiry page**, not the organic landing page. Unless the visitor arrived with UTMs, GHL receives only "inquiry page + referrer" (the referrer is usually the site's own previous page). **The organic landing page is effectively lost at this hop** (UNVERIFIED how GHL stores it; see §4). No `gclid` handling appears in `form_embed.js`; it passes through only if present in the parent URL (UNVERIFIED). |
| 4 | Form submit → GHL | Submission goes to the GHL sub-account behind Buzz Digital's white label. | iframe host. `link.buzzdigital.app/robots.txt` is `Disallow: /` for `*`, so the form page itself was **not fetched**, and its field list and hidden fields are unknown. | GHL contact attribution (first/latest source, page URL, UTM) is a vendor feature (UNVERIFIED for this account). GTM tag #243 copies the form inputs into `dataLayer` as `formInputs`. | Same as hop 3. |
| 5 | Form submit → analytics | GTM `GTM-N8Z592` (container version 175, also loaded through a first-party server-side GTM at `sst.maxxbuilders.com`): `message` from origin `link.buzzdigital.app` with `set-sticky-contacts` → `dataLayer {event:"contact_form_submit"}` → GA4 event `Lead` to **G-93353ZE9HH** + Meta pixel template `Lead`. Other lead-ish tags: `/thank-you/` pageview → GA4 `contact_us_form_submission` (G-KP5NVTDJ53) + Google Ads conversions (`AW-1033211685`); `generate_lead` (G-KP5NVTDJ53) fires only on a custom event `nextroll-consent` on a thank-you path, which looks unlikely ever to fire (UNVERIFIED). Click events: `Phone_Click` / `ph_click`, `email_click` / `mail_click`, `client_portal` (Procore login), `smartbidnet_login`, each paired with an Ads conversion. | `https://www.googletagmanager.com/gtm.js?id=GTM-N8Z592` fetched 2026-10-15 and parsed (75 tags, 46 predicates) | GA4 `Lead` event × session `landingPage` × `sessionDefaultChannelGroup`, in G-93353ZE9HH only. Google Ads gets `gclid` (the `__gclidw` conversion linker is on) and enhanced conversions (`__awec`, manual email and phone). | GA4 holds no CRM identifier. The GA4 event and the GHL contact share no key, apart from timestamps and the `formInputs` PII, which must not be used. |
| 6 | Calls | A static `tel:` link (same number on every page checked); no CallRail, WhatConverts or other dynamic number insertion script. RingCentral is integrated with Salesforce. | Page HTML; GTM (no call-tracking tags); `salesforce-inbound-revenue-os-research-2026-09-30.md:172` | GA4 `Phone_Click` / `ph_click` (click intent only). | A call cannot be tied to a session or landing page. The RingCentral log in Salesforce carries no source. |
| 7 | Chat | A GHL chat widget in `emailChat` mode is on every page (LeadConnector WP plugin `lc-public.js`, `widgets.leadconnectorhq.com/loader.js`). | Page HTML | Unknown (UNVERIFIED). | Unknown. |
| 8 | GHL → Salesforce | Website forms "land in Salesforce Leads (often via GHL)". GHL is linked via `GHL_Opportunity_ID__c` / `GHL_Contact_ID__c`. The org also has connected apps "Gravity Forms" and "Pardot + Salesforce Connector" (no Pardot package), and an expired 123FormBuilder package. Web-to-Lead settings and the GHL field map were "not inspected". "Buzz Digital" appears in no file in that repo. | `maxx-builders-salesforce-ops/docs/sales-department-audit-2026-07-23.md:21,23`; `…/salesforce-inbound-revenue-os-research-2026-09-30.md:51,68,170`; `…/salesforce-entitlement-audit-2026-09-30.md:179,269` | `Lead.Forms__c` (boolean; the only active assignment rule routes `Forms__c = true` to one inside-sales user, `…/salesforce-zero-addon-agentic-revenue-os-research-2026-09-30.md:47,267`); `LeadSource`; `GHL_Contact_ID__c`. | **No UTM, gclid, landing-page, referrer, first-touch or last-touch fields exist.** Proposed fields (`Original_Source__c`, `Form_Name__c`, page/UTM) are proposals only (`…inbound-revenue-os-research…-specs.md:13`). Which field GHL maps "source" into is unknown. |
| 9 | Qualification | Lead Status values are New, Contacted, Nurturing, Lost and Converted, with counts on 2026-09-30 of 541, 4,110, 40, 3,903 and 821. A trigger sets non-converted leads to Contacted whenever a task completes. Converting a lead requires Type of Project, Rating and Lead Source. **No MQL or SQL definition exists.** | `…zero-addon…-research-2026-09-30.md:265,268,356` (`LQ-04`) | `LeadSource` (43 values on Lead, 28% blank; normalised to 12 on Opportunity), Lead→Opportunity conversion | **Opportunity source defaults to "Google Search" on conversion**, so "Google Search" is not evidence of organic (`…inbound-revenue-os-research-2026-09-30.md:22`; `verified-findings-2026-07-23.md:43-44`). |
| 10 | Pipeline | Active Opportunity stages: Prospecting 0% → Qualification 10% → Estimating 30% → Discovery 30% → Bid Submitted 50% → Project On Hold 50% (omitted from forecast) → Negotiation 60% → Closed Lost / Won. A workflow sets Won when `Quote_Status__c = Accepted`. Record types are Maxx Builders and Maxx Designers. | `verified-findings-2026-07-23.md:91-94`; `…zero-addon…:262`; `package-2-designers-margin-spec-2026-07-26.md:13` | Opportunity ↔ Lead (converted), ↔ `GHL_Opportunity_ID__c` | Same as hop 9. |

Volume context: about 112 new unconverted leads in 90 days; 776 leads created in 2025 and 521 in
2026 to date; 9,313 leads and 1,106 opportunities in total. Referral is the top source by won
value (29 wins, $20.4M). Sources: `…zero-addon…:47,356`, `sales-department-audit…:17`,
`verified-findings…:31`.

`maxx-sales-genius` (BuildIntelAI) is an **outbound** prospecting platform: TDLR, TABC and
Prospeo data, SmartLead sequences. It pushes leads with hard-coded `LeadSource` values (TDLR
Permit, TABC License, Prospeo Outbound) and does not touch website leads
(`maxx-sales-genius/AGENTS.md:3-4`; `supabase/functions/salesforce-push-lead/index.ts:170-180`).
Its leads are a confound for any "lead count" metric that does not filter by source.

## 2. What this repo already treats as a conversion

- `scripts/collect-outcomes.mjs:96-111`: GA4 Data API `runReport`, dimension `landingPage`,
  metrics `conversions` and `sessions`, filtered to `sessionDefaultChannelGroup = "Organic Search"`,
  last 28 days. Results are written as `organic_conversions` / `organic_sessions` keyed by `SITE_URL` + the
  canonicalised path (`canonicalGa4Path`, `:48`).
- `scripts/sensor-ai-referrals.mjs:37-38`: dimensions `sessionSource` + `landingPagePlusQueryString`,
  metrics `sessions` + `conversions`, filtered by an AI-referrer list (`:20-21`). The list
  includes `bing.com/chat`, which is a path rather than a `sessionSource` value, so that entry
  likely never matches (UNVERIFIED). Results are written as `ai_conversions` keyed by an
  uncanonicalised path (`:80-82`), so they cannot be joined to `organic_conversions` URLs.
- `scripts/attribute-conversions.mjs:16-24,74`: compares `organic_conversions` before and after
  each `decision_log` change (21-day window), joined on exact `url`, and writes the result to
  `learned_patterns_conv`.
- `sql/schema.sql:33-36` (`outcomes.metric` free text) and `sql/ai-search-schema.sql:46-55,117`
  (`ai_referrals`, `learned_patterns_conv`). **No table holds leads, CRM ids, UTMs or gclid.**
- **The `conversions` metric was deprecated in favour of `keyEvents`** (GA4 Data API changelog,
  2024-05-06, <https://developers.google.com/analytics/devguides/reporting/data/v1/changelog>).
  Whether the old name still returns data is UNVERIFIED (`collect-outcomes.mjs:117-119` already
  warns about this). It also counts **every** key event, not just leads, without
  distinguishing between them.
- `GA4_PROPERTY_ID` / `SITE_URL` come from repo variables (`.github/workflows/seo-learn.yml:30-31`,
  `ai-search-sensors.yml:74`). Their values, and which of the four measurement IDs belongs to
  that property, were not inspected.

## 3. Tag inventory (public, 2026-10-15)

| Tag | Where | Note |
|---|---|---|
| GA4 `G-KP5NVTDJ53` | Hard-coded gtag in the theme + GTM `googtag` | Receives `page_view`, `contact_us_form_submission` (/thank-you/), `generate_lead`, `Phone_Click`, `ph_click`, `email_click`, `mail_click`, `client_portal`, `smartbidnet_login`, `form-submit` (fires on an Elementor/other `form-submit` event with a "Send" button, which no longer matches the GHL form; UNVERIFIED) |
| GA4 `G-4T69FJPZD7` | Hard-coded gtag + GTM `gtm.init` | No events of its own found. Possible double-counted page views (UNVERIFIED). |
| GA4 `G-93353ZE9HH` | GTM | Receives `page_view` and **`Lead` on `contact_form_submit`** (the GHL bridge), `lead` on `/thankyou` (404), `Purchase` on a 2025 cost-guide thank-you path |
| GA4 `G-8PCZ1QEPY4` | GTM constant (server-side GTM) | Use unknown |
| UA `UA-60801282-1` | GTM `__gas` variable | Legacy; inert since UA was sunset |
| Google Ads `AW-1033211685` | GTM | 9+ conversion actions: page view, thank-you, phone, email, portal-login clicks; enhanced conversions; conversion linker |
| Meta pixel (PixelYourSite + GTM template, CAPI on) | PYS and GTM | PYS auto "Form" event cannot see the cross-origin GHL form (UNVERIFIED). The GTM Meta `Lead` fires from the bridge. |
| LinkedIn Insight (partner 40925) + conversion | GTM | Thank-you path |
| Microsoft Clarity, CookieYes, Site Kit 1.178.0 (meta tag only; no Site Kit gtag snippet seen) | Page | Site Kit may be connected for reporting only (UNVERIFIED) |
| sGTM | `sst.maxxbuilders.com` / `load.sst.maxxbuilders.com` + a Cloud Run tagging-server URL in GTM | Server-side tagging is in place. Stape-style loader (UNVERIFIED vendor) |

Privacy note: GTM tag #243 pushes the raw form inputs (`formInputs`) into `dataLayer`, and tag
#282 reads name fields on a "REQUEST QUOTE" click. Any tag reading `formInputs` could forward
PII to third parties. This is out of scope here and is flagged for the attribution design
(UNVERIFIED which tags consume it).

## 4. Unknowns (need the user or an authenticated look)

1. Which GA4 property `GA4_PROPERTY_ID` points at, and which of G-KP5NVTDJ53 / G-93353ZE9HH /
   G-4T69FJPZD7 / G-8PCZ1QEPY4 are streams of it. This decides whether `Lead` is even visible to
   the repo.
2. Which events are marked as **key events** in that property (is `Lead` one? are the click
   events?).
3. GHL (Buzz Digital sub-account): form fields and hidden fields; whether contact attribution
   (source, medium, page URL, UTM, gclid, referrer) is captured; the form's redirect target after
   submit (on-page message or `/thank-you/`).
4. The **GHL → Salesforce** sync: native or Zapier/webhook, which GHL fields map to `LeadSource`,
   `Forms__c` and description, and whether it creates a Lead or an Opportunity. Also whether
   Gravity Forms or Web-to-Lead are still live anywhere.
5. Whether GHL or Salesforce stores lead creation time and the GHL contact id, so a timestamp or
   id join to GA4 is possible.
6. The operator definition of a **qualified lead** (none exists in Salesforce), and whether
   pipeline value or Won value is the business outcome to optimise.
7. Who owns GTM `GTM-N8Z592` and the GHL account (presumably the agency Buzz Digital; UNVERIFIED),
   and whether changes are allowed.
8. Call volume and value relative to forms, which decides whether call tracking is worth it.

## 5. Candidate attribution paths

| | A. GA4-only key events | B. GA4 + CRM join via hidden fields | C. Call tracking |
|---|---|---|---|
| What it measures | Organic sessions → `Lead` key events per **landing page** (GA4 carries the session landing page to the inquiry-page event). No qualification and no pipeline. | Lead → qualified lead → Opportunity stage and Won value per **organic landing page and source**. This is the true business outcome. | Calls per landing page/source; with Salesforce logging, calls → leads |
| Changes needed | GA4 admin: confirm the property, mark `Lead` as the key event (and un-mark navigation clicks). Repo: switch `conversions` to `keyEvents` filtered by `eventName = Lead` (or `keyEvents:Lead`), and canonicalise the AI-referral keys. No site change. | Site/GTM: store first-touch landing page, channel, source/medium/campaign, gclid and the GA `client_id` in a first-party cookie, and pass them to the GHL form (hidden fields or URL params read by `form_embed.js`). GHL: custom fields mapped through to new Salesforce Lead fields (e.g. `Original_Source__c`, landing page, UTM, gclid, GA client id), carried over to the Opportunity. Repo: a read-only Salesforce or CSV export → `outcomes` (`organic_qualified_leads`, `organic_pipeline_usd`). | DNI vendor script (for example CallRail); swap numbers per session; integrate with GA4 and Salesforce |
| Effort | Small (hours). Admin access plus a ~10-line repo change. | Medium to large. It touches GTM, GHL, the Salesforce schema (production-gated in the sibling repo, with field governance rules) and the repo. Several owners. | Medium; recurring paid cost (vendor pricing not researched) |
| Gaps | Measures form-submit intent, not quality. Spam and outbound/referral noise are not separable. Phone and email clicks are only intent. The property-split risk remains. | Only covers leads created after go-live, so history cannot be backfilled. GHL→Salesforce mapping must be verified first. `LeadSource` hygiene (43 values) is a separate cleanup. Low volume (~100 leads per quarter, all channels) means per-page stats stay sparse, so aggregate by cluster. | Only valuable if calls are a material lead share (unknown). Adds another vendor and data processor. |
| Credible today? | **Yes, once unknowns 1–2 are answered.** It is the cheapest credible step. | The only path to "qualified organic leads". It is the target state. | Defer until call share is known |

Recommended sequence (for the grilling ticket to confirm): **A now** (it unblocks the
measurement design and makes `organic_conversions` honest), then **B as the destination**, scoped
as cross-owner work. **C only if calls are a material lead share.**

## Decision-relevant conclusions

1. **Website leads go to GoHighLevel first** (white-label `link.buzzdigital.app`, form
   `01-Website Construction Quote Request Form | Long`), then into **Salesforce, the documented
   system of record**. The GHL→Salesforce mapping has never been inspected. *High confidence on
   GHL; medium on the Salesforce hop.*
2. **The CRM cannot attribute organic today.** There are no UTM, gclid, landing-page or referrer
   fields, `LeadSource` is unreliable, and Opportunity source defaults to "Google Search".
   *High confidence (documented in the sibling repo).*
3. **The organic landing page is lost at the form hop.** The GHL iframe sees only the inquiry
   page URL (plus any UTMs) and a referrer. *Medium confidence (code-read of `form_embed.js`).*
4. **GA4 can count website form leads per organic landing page right now**, via the GTM bridge
   → GA4 `Lead` (G-93353ZE9HH), provided the repo reads that property and `Lead` is a key event.
   *Medium confidence.*
5. **This repo's `organic_conversions` is probably mis-specified.** It uses the deprecated
   `conversions` metric across all key events (possibly including portal and login clicks), and the
   property may not receive `Lead` at all. *Medium confidence; needs a GA4 admin look.*
6. **Measurement is fragmented:** four GA4 IDs, a legacy UA, 9+ Ads conversion actions, and a
   dead `/thankyou` trigger. Any attribution design must first pick one property and one lead
   event.
7. **There is no call tracking**, only a static `tel:` link with click events, so phone leads are
   unattributable.
8. **No "qualified lead" definition exists in Salesforce** (no MQL/SQL; only Lead Status and
   Opportunity stages), so the grilling ticket must define it before any lead-quality metric.

## Questions for the user

1. Which GA4 property is the one of record, and does the repo's `GA4_PROPERTY_ID` point at it?
   Is `Lead` (or `contact_us_form_submission`) a key event there?
2. Who controls the GHL account behind `link.buzzdigital.app` and GTM `GTM-N8Z592` (in-house or
   the Buzz Digital agency)? Can we add hidden fields and attribution tags?
3. How does GHL push to Salesforce (native, Zapier or webhook), and does it create a Lead or an
   Opportunity? Can someone export the field map read-only?
4. What counts as a **qualified** lead (e.g. a Lead converted to an Opportunity, Opportunity ≥
   Qualification / Estimating / Bid Submitted, or project size or type)? Is the outcome to
   optimise lead count, qualified count, pipeline $ or Won $?
5. Are Salesforce schema additions for attribution (landing page, UTM, gclid, GA client id,
   original source) acceptable, given the production-gated rules in `maxx-builders-salesforce-ops`?
6. Roughly what share of new business starts with a phone call versus a form? Is call tracking
   worth a recurring cost?
7. Should outbound (TDLR/TABC/Prospeo) and referral leads be excluded from SEO lead metrics by
   `LeadSource` filter?
