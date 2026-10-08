<?php
// /scripts/migrations/data/faqs/05-medicals.php
//
// Help-centre questions: Medicals.
// Each entry: [topic key (FaqsController::CATEGORIES), question, answer].
// Answer format: blank line = paragraph, "- " bullet, "1. " step, **bold**,
// [label](/path) link. Seeded by 2026_10_01_000001_faq_knowledge_base.php.

return [

    ['medicals', 'What is Medicals for?', <<<'TXT'
[Medicals](/medicals) keeps everything medical for the family in one place:

- **Appointments** — booked visits with a reminder, plus a “To book” list for the ones you still need to call about
- **Medications** — who takes what, the dose times, and today’s doses to tick off
- **Records** — vaccinations, check-ups, tests and results, each with an optional “next due” date
- **Family** — everyone’s date of birth, blood type, allergies, conditions, health card and emergency contact
- **Providers** — the family doctor, dentist, pharmacy and specialists, with tap-to-call
TXT],

    ['medicals', 'How do I book an appointment?', <<<'TXT'
1. Press **Book appointment** (or **Book** next to a reminder).
2. Choose who it’s for, what it is, the provider, the date and time.
3. Pick when you’d like to be reminded — on the day, a day before, two days before or a week before.

Not booked yet? Set the status to **To book** and leave the date empty. It waits on the “To book” list until you’ve made the call, then edit it and add the date.
TXT],

    ['medicals', 'What happens after an appointment?', <<<'TXT'
Open it and press **Done**. You can write down what happened (the doctor’s advice, a new prescription, results to wait for) and, if needed, press **Book a follow-up** — the new appointment starts filled in for the same person and provider.

Appointments that pass without being marked show up as “Did this happen?” so nothing gets forgotten. You can also mark one **Missed** or **Cancelled**.
TXT],

    ['medicals', 'How do the reminders work?', <<<'TXT'
Medicals works out the reminders for you — there’s nothing to set up beyond the dates:

- **Coming up** — appointments inside their reminder window
- **To book** — appointments you’ve noted but not booked yet
- **Due** — vaccinations and check-ups whose “next due” date is close (within 30 days) or past, with a **Book** button
- **Refills** — medications whose refill date is within a week
- **Ending** — courses of medication about to finish
- **Doses** — today’s doses that are due or overdue

They show on the Medicals page, in its banner and on its TV screensaver.
TXT],

    ['medicals', 'How do I tick off a dose?', <<<'TXT'
On the **Today** tab, every dose due today is listed by time. Tap it to tick it off (tap again to undo). You can tick off doses for today and the two days before, in case you forgot.

Medications with no dose times are “as needed” — tap **Given now** each time one is taken.
TXT],

    ['medicals', 'Who can see our medical information?', <<<'TXT'
Only people an admin has given **Medicals** access to (Users → App access). Everyone with access sees the whole family’s Medicals, the same way Tasks is shared.

The dashboard’s activity feed only ever says things like “Medicals: booked an appointment for Sam” — never a medication, condition or result.
TXT],

    ['medicals', 'Can I print a medical summary for someone?', <<<'TXT'
Yes — open the person on the **Family** tab and press **Print summary**. You get one page with their allergies, conditions, blood type, current medications, upcoming appointments, recent vaccinations and emergency contact — handy for a new doctor, a babysitter or a trip to emergency. Use your browser’s print dialog to save it as a PDF.
TXT],

    ['medicals', 'Can I add an appointment to my phone’s calendar?', <<<'TXT'
Yes — open the appointment and press **Add to calendar**. It downloads a calendar file (.ics) that your phone or computer’s calendar opens, with the time, place and a reminder.
TXT],
];
