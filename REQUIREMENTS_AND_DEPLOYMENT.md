# NEW2AN 2026 registration platform

## Evidence baseline — 24 September 2026

The implementation was reconciled against the current official NEW2AN pages, the organiser-operated CRIS page, the files in `24.10.2026 update/`, and the organiser's travel follow-up form in `28.10.2026 update/`.

Source priority for operational rules:

1. Current NEW2AN pages for conference dates, categories, fees, paper rules, deadlines and policies.
2. The 22 September 2026 organiser email and its screenshot for the exact PayHere links.
3. The CRIS organiser page as corroboration of the published Sri Lankan, gala and 3MT amounts.
4. `NEW2AN Registration Shared.xlsx` as an internal planning sheet. Conflicts in that workbook do not override corroborated organiser or public information.

## Deployment state observed — 24 September 2026

- The repository contains the form/API contract version 4 implementation documented below. The spreadsheet migration remains append-only and preserves earlier columns.
- `https://pcooma.github.io/New2an/` still serves the earlier frontend (`style.css?v=3` and `app.js?v=8`) and does not yet expose the new category or separate-events workflow.
- The repository backend now uses `schemaVersion: 4`. The new travel/passport follow-up fields and upload workflow require an Apps Script redeployment before the page can be used live. Verify the `/exec` health response reports version 4 after deployment.

## Travel and excursion follow-up

`excursion.html` is a separate protected follow-up page for participants whose saved registration has `Excursion_Interest = Yes`. The participant must first load the record with the existing reference ID and registration email; the resulting two-hour edit token is required by `submitTravelDetails`.

The page keeps the organiser's new Google Form as a requirements source, but deliberately removes duplicate questions. Name, email, phone, title/designation, institution, country, nationality, passport name, excursion choice and the request for travel assistance are reused from the existing registration. The follow-up opens only when the participant selected the excursion and already requested flight options. It collects only the missing flight itinerary, passport number, birth/issue/expiry details, birthplace and one PDF/image passport bio page of no more than 5 MB.

Passport files are appended, never overwritten, in `01 - Participant Registration Records/<Reference ID>/Travel Documents/`. The master sheet stores the travel fields and Drive URLs, while the participant lookup response redacts those URLs and returns only an on-file marker. The admin Excel export includes a separate `Air Ticket Requests` sheet.
- The live version-2 public settings currently return issuer, tax, telephone and bank-transfer wording that resembles simulation or placeholder data. Those values have not been accepted as genuine operational evidence and must not be used on a participant-facing invoice without organiser verification.

The revised frontend and backend are therefore complete in the repository but are not yet confirmed live. Publish both layers and complete the controlled acceptance test before describing the revised process as operational.

Confirmed conference contract:

- NEW2AN 2026 is in Colombo from 15–17 December 2026.
- International author and non-author registration is EUR 400 on or before 31 October 2026 and EUR 500 afterward.
- Sri Lankan-affiliated author and non-presenting-attendee registration is LKR 40,000. The official page applies a 25% late surcharge specifically to Sri Lanka-based authors after 31 October, so the system calculates LKR 50,000 for that author category while retaining the published LKR 40,000 non-presenting-attendee fee.
- An international full registration may cover up to two accepted papers when the same registered author presents both. Each Sri Lankan-affiliated author registration covers one paper.
- At least one full author registration per accepted paper is required by 31 October 2026.
- Online presentation may be requested only by international authors, requires case-by-case approval, and must be requested by 15 November 2026 through `new2an@crisglobal.org`.
- Author registration transfers requested after 15 November 2026 incur a EUR 50 penalty. Transfer processing is an organiser workflow and is not automated by this form.
- The published full-registration benefits are online access to conference sessions and a digital Springer LNCS proceedings copy.
- Registration fees are generally non-refundable.

The official dates page now lists full-paper submission on 30 September 2026, notification on 15 October 2026, and camera-ready submission on 25 October 2026. The registration page also states that author registration must be completed before camera-ready submission while separately naming 31 October as the author-registration deadline. The participant interface flags this sequence for confirmation instead of inventing a resolution.

## Separate activities

- The Global Undergraduate Hackathon is free and has an official information page, but the official page still says that the registration and competition-guideline links will be added. The registration platform links to the official page and does not invent a submission route.
- The 3MT Competition has already launched as a separate operation. Management has excluded it from the conference registration form, backend schema, administration table, and Excel exports. The events page may identify the separate external operation and its official checkout links, but this platform does not collect or reconcile 3MT participant or payment data.
- The organiser email, screenshot and CRIS page consistently give 3MT fees as LKR 5,000 for local scholars and USD 30 for foreign scholars. The internal workbook’s `30 EUR` entry is treated as a source discrepancy, not as the operational amount.
- The internal workbook names an Industry Forum and Excellence Award but provides no dates, eligibility rules or registration links. These are not published in the platform until an official release supplies an actionable process.

## Main registration flow

The browser and Apps Script backend enforce the same category rules:

1. The participant chooses one of four categories: international author, international non-author, Sri Lankan-affiliated author, or Sri Lankan-affiliated non-presenting attendee.
2. The participant role is limited to `Author / presenting author`, `Non-author attendee`, or `Industry professional`. The former `Invited or keynote speaker`, `Committee member / chair`, and `Non-author academic / researcher` values are no longer offered; existing records using them are mapped to `Non-author attendee` when reloaded.
3. The selected category determines the fee, currency, paper limit, online-presentation eligibility and applicable PayHere link. Dietary preference is limited to Vegetarian, Non-vegetarian, or Halal.
4. The participant completes paper, attendance, visit and excursion information. Travel, hotel, transfer and visa answers are requests, not bookings. Selecting `Maybe — send details when available` for the excursion records interest only; participant details, acknowledgement, conversion-rate validation and charges apply only after selecting `Yes`.
5. The participant saves the record or generates a proforma. The backend creates the reference ID, returns a signed two-hour edit token, and returns the authoritative saved pricing used to render the proforma.
6. A Sri Lankan-affiliated early registration exposes the category-specific official PayHere link supplied by the organiser. International payment continues to use verified invoice/payment instructions because no official EUR checkout link was supplied in the update bundle.
7. The participant returns with the gateway or transfer reference, declared registration amount and currency, and proof. Backend comparison uses the server-calculated amount and currency. A mismatch remains `PROOF_SUBMITTED_AMOUNT_MISMATCH` for manual review.
8. Payment upload is evidence for review; it is not automatic confirmation.

The official PayHere registration links are:

- Sri Lankan-affiliated registering author, LKR 40,000: `https://payhere.lk/pay/ob0887ec5`
- Sri Lankan-affiliated non-presenting attendee, LKR 40,000: `https://payhere.lk/pay/oc78f4e53`

No verified PayHere checkout for the LKR 50,000 Sri Lankan-author late amount was supplied. After the deadline, the interface displays that calculated author fee but withholds the early author link and directs the participant to the organiser. The non-presenting-attendee category retains its published LKR 40,000 link because the official late-surcharge sentence names authors only.

## Gala dinner

The gala dinner is a separate ticket for Sri Lankan-affiliated categories and is excluded from the conference-registration total:

- Registering author: LKR 12,000 — `https://payhere.lk/pay/o573053c2`
- Non-presenting attendee: LKR 15,000 — `https://payhere.lk/pay/o20376354`

The internal workbook incorrectly shows LKR 12,000 for both categories. The official registration page, organiser email, screenshot and CRIS page all support LKR 15,000 for the non-presenting category.

The registration record stores whether a gala ticket was selected, its category-derived fee/currency and the participant-entered payment reference. Gala payment remains visibly separate on the proforma and in the admin export.

## Storage, ownership and evidence

- Each reference uses `01 - Participant Registration Records/<Reference ID>/registration.json`, `Invoices/`, and `Payment Proofs/`.
- Invoice and proof versions append; they do not overwrite prior evidence.
- Reference IDs are generated by the backend.
- Existing updates, invoice archiving and proof uploads require the stored email and a signed two-hour edit token.
- Invoice archive requests require an existing registration, a valid PDF signature and the per-reference rate limit.
- The spreadsheet schema is append-only. Version 2 added `Registration_Category` and the gala fields without deleting or reordering prior columns. Contract version 3 changes allowed role/dietary values and the API pricing response without removing columns.

The admin dashboard and export separate registration, payment, gala, travel, accommodation, excursion, workshop, certificate and support-request views. 3MT data is deliberately absent.

## WhatsApp inquiry routing

The floating WhatsApp help panel uses the organiser-supplied `Contact Details.jpeg` routing list. Committee numbers are stored in WhatsApp-compatible digits-only international form and displayed with `+94`:

- Conference Registration — Oshadhi Gunathilake — `+94 71 139 0292`
- Global Undergraduate Hackathon — Dr. Nushara Wedasingha — `+94 76 449 2051`
- 3MT Competition — Dr. K. T. Hemachandra — `+94 71 895 7734`
- Excellence Award — Dr. Hansani Weeratunge — `+94 74 377 2290`
- Travel, Accommodation & Excursion — Mr. Ashen Wanniarachchi — `+94 77 974 7973`
- Industry Forum & Workshops — Dr. Pasan Maduranga — `+94 77 141 7275`
- Panel Discussion — Ms. Anushka Panawenna — `+94 76 770 6612`
- Wrong invoice values, billing defects and registration-system problems — Mr. Pramuditha Coomasaru — `+94 77 772 8081`

The source leaves the Technical Program Committee contact name and number blank. The platform therefore does not invent a WhatsApp route for paper-review or technical-programme decisions and instead shows the official `new2an@crisglobal.org` email. “Other registration query” falls back to the Conference Registration contact.

The panel collects the participant name, international-format reply number and email, plus optional registration reference, paper/CMT ID and payment reference. A predefined question may be sent without repeating it in free text; the question/details field becomes mandatory whenever an `Other` topic is selected. The panel displays the responsible recipient and a plain-text preview before opening `wa.me`. The website does not store or transmit the inquiry itself, and the participant is warned not to include passwords or card details.

## Proforma boundary

The proforma contains verified issuer details, participant or institutional billing identity, category-derived conference fee/currency, paper information, tax wording, payment instructions, due date and document-status warning. It is a pre-payment document, not proof of payment, a tax invoice or a receipt.

Contract version 3 fails closed on invoice configuration. Until an authenticated administrator enters the organiser-verified legal issuer, address, tax wording, contact details, payment/bank instructions and exchange rate and checks the explicit approval confirmation, the API does not expose those stored fields and the browser cannot generate or archive a proforma. Deploying version 3 therefore does not silently legitimise the currently stored version-2 values.

The gala dinner and excursion appear as separate-pay items and are excluded from `TOTAL DUE NOW`. The excursion is an estimated approximately USD 50 per participant, payable on the excursion day, with an administrator-set indicative USD-to-EUR conversion when selected. It includes transport and evening refreshment; lunch is not included. The final amount and operational details remain subject to organiser confirmation.

The proforma uses the pricing returned by the backend after saving the registration rather than trusting the browser clock or pre-save calculations. If a deployed backend does not return authoritative pricing, invoice generation fails closed after displaying the saved reference instead of downloading a potentially inconsistent proforma.

## Google deployment

1. Copy the updated `google-apps-script/Code.gs` into the Apps Script project.
2. Preserve Script Properties `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `MAIN_FOLDER_ID` and `EDIT_TOKEN_SECRET`. Never commit private credentials. Treat the existing issuer/payment properties as unverified inputs, not approved values.
3. Run `setupNEW2AN()` once after deploying. `ensureSchema()` preserves and appends the existing version-2 columns; the health response should then advertise contract version 3.
4. Sign in to the administration view and replace every invoice setting with evidence-checked organiser values. Verify the legal issuer name and address, any registration identifier, tax statement, email, telephone, payment/bank instructions, payment period and USD-to-EUR rate. Check the approval confirmation only after that review; this writes `INVOICE_SETTINGS_APPROVED=true`.
5. If `WORKSHOPS_JSON` already exists, add the completed 11 September `AI-Based Communications Towards 6G` workshop through the admin workshop manager; code defaults do not overwrite stored settings.
6. Create a new web-app deployment. Execute as the owner and allow access to anyone.
7. Update `CONFIG.apiUrl` only if the deployment URL changes.
8. Publish the frontend separately. A backend health response, local tests or a frontend publication alone does not prove the combined live workflow.

## Required live acceptance test

Use controlled test records and remove or clearly identify them afterward:

1. International author, two papers, EUR early fee, in-person attendance.
2. International author requesting online presentation; verify the approval warning.
3. Sri Lankan-affiliated author, one paper, LKR 40,000, LKR 12,000 gala ticket and author PayHere link.
4. Sri Lankan-affiliated non-presenting attendee, no papers, LKR 40,000, LKR 15,000 gala ticket and non-presenting PayHere link.
5. Confirm a Sri Lankan-affiliated author cannot attach two papers and a non-author cannot attach papers.
6. Before approval, confirm that public invoice settings are blank and proforma generation/archive is blocked. Then enter evidence-checked settings, explicitly approve them, submit, reload by reference plus email, download two proforma versions, upload proof twice, sign into admin and export Excel.
7. Confirm the Drive history is preserved, the master sheet contains all version-4 columns, the endpoint reports version 4, category/currency amounts reconcile, and 3MT is absent from the registration dataset and exports.
8. With a controlled registration that has `Excursion_Interest = Yes` and `Travel_Agency_Assistance = Yes — flight options`, open `excursion.html`, verify the reference/email gate, and submit the organiser-arranged path with a harmless test passport image. Confirm the sheet fields, `Travel Documents` history, `registration.json`, reload marker, and `Air Ticket Requests` export. Confirm that an excursion registration without flight assistance is told that no extra passport data is required. Remove the test identity/document according to the approved test-data procedure.
9. Confirm invalid or expired edit tokens, wrong emails, cross-reference tokens, invalid PDFs and amount/currency mismatches fail safely.
10. Confirm the retired participant roles are rejected on new submissions and migrated to `Non-author attendee` only when an old record is reloaded; verify that the three dietary choices are enforced and the excursion is described as approximate with transport and evening refreshment included and lunch excluded.
11. On desktop and mobile, open the floating WhatsApp panel from the registration, events and admin views. Verify all ten issue routes, their recipient names and normalized `+94` numbers, the invoice/system route to Mr. Pramuditha Coomasaru, the selectable topic list, `Other` path, identifier auto-fill, plain-text preview and final `wa.me` destination without sending a production test message.

## Deliberately unresolved

- Exact Colombo venue, final technical programme, hotel inventory/rates, travel partner, airport-transfer service, final excursion price and excursion itinerary.
- A verified international EUR checkout link and a Sri Lankan late-fee PayHere link.
- The authoritative sequence between camera-ready submission on 25 October and author registration by 31 October.
- Registration or submission routes for the Industry Forum and Excellence Award.
- The live hackathon registration link promised by the official hackathon page.
- Production persistence and payment reconciliation until the controlled live acceptance test passes.

## Local checks

```sh
node --check app.js
cp google-apps-script/Code.gs /tmp/new2an-Code.js
node --check /tmp/new2an-Code.js
node tests/new2an-contract.test.js
node tests/new2an-rules.test.js
node tests/new2an-security.test.js
node tests/new2an-whatsapp.test.js
git diff --check
```
