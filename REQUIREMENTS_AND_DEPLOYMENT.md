# NEW2AN 2026 registration platform

## Verified conference contract

- Event: 26th International Conference on Next Generation Wired/Wireless Networks and Systems.
- Dates and location: 15–17 December 2026, Colombo, Sri Lanka.
- Published registration: one full three-day registration. EUR 400 on or before 31 October 2026. EUR 500 after that date.
- There is no published student rate or discount.
- One full registration may cover up to two accepted papers when both are presented by the same registrant.
- At least one full registration per accepted paper is required by 31 October 2026.
- Included benefits published by NEW2AN: online access to conference sessions and a digital Springer LNCS proceedings copy.
- Registration is generally non-refundable.

Published timing is internally inconsistent: the camera-ready deadline is 30 September 2026 and full registration is stated as due by 31 October 2026, while registration/submission wording also requires payment before camera-ready submission. The participant interface therefore tells accepted authors to confirm their applicable payment deadline with the official contact rather than relying only on the later date.

Sources were rechecked on 25 August 2026: `https://new2an.com/`, `/cfp.html`, `/committees.html`, `/dates.html`, `/hotel.html`, `/organizers.html`, `/panel.html`, `/privacy.html`, `/program.html`, `/refund.html`, `/registration.html`, `/subm.html`, `/terms.html`, `/workshop.html`, `/sponsors.html`, `/history.html`, and `/contacts.html`.

## Deliberately unresolved

The official site does not yet publish the exact Colombo venue, final technical programme, hotel inventory/rates, travel-agency partner, airport-transfer service, excursion itinerary, or an urgent local telephone/WhatsApp contact. The organiser has confirmed an excursion fee of USD 50 per participant, charged separately from conference registration. Terms state that checkout may use PayHere or another identified provider, but no live checkout link or final method is published. The platform therefore collects assistance requests but does not promise bookings, display old bank details, or invent contacts. The official email for paper submission, review, payments and publication is `new2an@crisglobal.org`. The free 21 July 2026 workshop has concluded and is hidden from the registration journey. If an administrator later publishes a workshop with `open` status, the workshop step becomes visible automatically.

## International participant safeguards implemented

- Passport-format name and issuing country only when visa support is needed. Passport number is deliberately not collected yet.
- Arrival/departure dates, flight/airport details, airport-transfer and venue-transport requests.
- Accommodation/room preference, dietary requirements, accessibility needs, and an emergency contact for in-person participants.
- Excursion interest, total passengers, companion names, activity level, mobility, allergies/diet, guide language and provisional-terms acknowledgement.
- Admin-configurable workshop catalogue with draft, open, closed and completed states. Open workshops become selectable without editing the public HTML.
- Stable reference ID, downloadable proforma, payment stage/reference/amount, fixed EUR currency, up to three proof files, and explicit manual-verification status.
- Online participants are not forced to complete travel and excursion fields.

The Admin Excel export contains separate sheets for all registrations, meals, travel logistics, accommodation, excursions, workshops and payments so operational teams do not have to manually filter the master dataset.

## Google deployment

1. Create a new Apps Script project and paste `google-apps-script/Code.gs` into it.
2. Add Script Properties `ADMIN_EMAIL` = `p.cooma@gmail.com` and `ADMIN_PASSWORD` = the private password supplied by the administrator. Do not put the password in GitHub. `MAIN_FOLDER_ID` is optional when starting a new deployment.
3. Run `setupNEW2AN()` once and authorize Drive and Sheets access. If `MAIN_FOLDER_ID` is absent, setup creates `NEW2AN 2026 - Registration Administration` and stores its ID automatically.
4. Confirm that setup reports the master workbook `NEW2AN 2026 - Master Registration Database`, its `Registrations` sheet, `01 - Participant Registration Records`, and `02 - Payment Proofs`.
5. Deploy a new Web app. Execute as the owner and allow access to anyone.
6. Put the resulting `/exec` URL in `CONFIG.apiUrl` in `app.js`.
7. Redeploy after every backend change. An endpoint health response alone does not prove that the latest code is deployed.
8. Submit a test registration, reload it by reference plus email, sign into the direct Admin URL at `https://pcooma.github.io/New2an/#admin`, and export the Excel workbook before publishing the link.

The backend never uses the former SICET folder ID. The master workbook uses a dedicated NEW2AN schema and evolves append-only.

## Items organisers must confirm before launch

- Payment gateway, bank details, invoice/tax wording, and payment confirmation workflow.
- Whether in-person and online registration use the same fee and presentation rights.
- Exact venue, airport-transfer model, travel-agency partner, hotel list, rates, cancellation terms, and booking liability.
- Dedicated registration/payment WhatsApp and email contacts, plus local logistics and emergency contacts.
- Whether visa letters require passport details. Do not collect passport numbers until the necessity, access controls, retention period, and privacy wording are approved.
- Any post-July workshop or social programme. Do not infer it from the 2025 conference.

## Local checks

Run:

```sh
node --check app.js
cp google-apps-script/Code.gs /tmp/new2an-Code.js
node --check /tmp/new2an-Code.js
node tests/new2an-contract.test.js
node tests/new2an-rules.test.js
git diff --check
```
