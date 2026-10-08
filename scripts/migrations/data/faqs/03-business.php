<?php
// /scripts/migrations/data/faqs/03-business.php
//
// Help-centre questions: Customers, Invoices, Receipts.
// Format: see 01-start-here.php.

return [

    // ------------------------------------------------------------------
    // Customers
    // ------------------------------------------------------------------
    ['customers', 'What is the Customers app?', <<<'TXT'
[Customers](/customers) is the business’s customer directory — one shared list for everyone with Customers access. Each customer has their contact details, address, logo, and their **billing picture**: how many invoices they’ve had, how much they’ve been billed, and what’s still outstanding.
TXT],

    ['customers', 'How do I add a customer?', <<<'TXT'
Click **New customer** and fill in what you know:

- **Who they are** — the company or customer name (it goes on their invoices)
- **How to reach them** — email (invoices and receipts are emailed here), phone, website
- **Address** — street, city, country, province / state, postal code (printed on invoices and used for the map)

Names and email addresses must be unique, so the same customer can’t be added twice.
TXT],

    ['customers', 'Can I add a logo for a customer?', <<<'TXT'
Yes — open the customer and upload a logo. It shows in the directory, in the invoice and receipt lists, and at the top of their invoices on screen. You can replace or remove it any time; customers without a logo get coloured initials.
TXT],

    ['customers', 'What’s on a customer’s profile?', <<<'TXT'
Click a customer to open their profile:

- one-tap **call**, **email** and **map** (opens their address in Google Maps),
- their numbers — invoices, total billed, outstanding, last invoice,
- their **invoice history** — click any invoice to open it in Invoices,
- edit, logo, archive / restore and (if they have no invoices) delete.
TXT],

    ['customers', 'What’s the difference between archiving and deleting a customer?', <<<'TXT'
- **Archive** hides a customer you no longer work with from the active list and from the “new invoice” picker, but keeps them and their invoice history. **Restore** brings them back.
- **Delete** removes them for good — and is only allowed for customers who have **no invoices**, so your billing history is never broken.
TXT],

    ['customers', 'Can I export the customer list?', <<<'TXT'
Yes — **Export CSV** downloads the whole directory (contact details, address, status, invoices, billed, outstanding, customer since) as a spreadsheet file that opens in Excel, Numbers or Google Sheets.
TXT],

    // ------------------------------------------------------------------
    // Invoices
    // ------------------------------------------------------------------
    ['invoices', 'What does the Invoices app do?', <<<'TXT'
[Invoices](/invoices) builds itemised invoices for your customers and keeps track of what’s been paid and what’s still owing. The top of the page shows the money picture — what’s **owing**, what’s **overdue**, what’s been **paid this year**, drafts not yet sent, and a chart of what you’ve billed over the last 12 months.
TXT],

    ['invoices', 'How do I create an invoice?', <<<'TXT'
1. Click **New invoice** — it’s given the next number automatically.
2. **Bill to:** choose the customer and give it a **project / reference** title.
3. **Dates & terms:** the due date (or tap **On receipt**, **+15d**, **+30d**, **+60d**), currency (CAD or USD), payment terms and delivery.
4. **Lines:** describe the work, the quantity and the rate — the amount and the total update as you type.
5. Pick a status (usually **Draft** to start) and click **Create invoice**.

The customer isn’t listed? Add them in [Customers](/customers) first.
TXT],

    ['invoices', 'How are invoice numbers chosen?', <<<'TXT'
Automatically, in the format **CA-INV26-0042** — the year, then a running number that never repeats (even if an invoice is deleted, its number isn’t reused). You can see the next number in the header before you start.
TXT],

    ['invoices', 'Can I format line descriptions or add a discount?', <<<'TXT'
Yes. Line descriptions support **bold**, *italics* and bullet lists (use the B, I and • List buttons, or Ctrl+B / Ctrl+I). Pasted text is cleaned to plain text so it can’t bring in odd formatting.

For a **discount**, click **Add discount** (or use a negative quantity): the line turns green and is taken off the total. The total can’t go below zero.

Lines can be moved up and down, and you can have up to 100 per invoice.
TXT],

    ['invoices', 'What do the invoice statuses mean?', <<<'TXT'
- **Draft** — being prepared, not sent yet.
- **Sent** — with the customer.
- **Partially Paid** — some payments recorded, a balance remains.
- **Paid In Full** — nothing left to pay.
- **Overdue** — set by hand if you like; invoices past their due date are also flagged **Overdue** automatically.
- **Cancelled** — no longer owed (and not counted in totals).

You can change the status from the invoice’s **Mark as** buttons. Recording payments in [Receipts](/receipts) moves invoices to Partially Paid / Paid In Full for you.
TXT],

    ['invoices', 'How do I send an invoice to a customer?', <<<'TXT'
Open the invoice and choose:

- **Email** — sends the PDF to the customer’s email (you can change the address and the message). A **Draft** is marked **Sent** once it goes.
- **PDF** to preview it, or **Download** to save it and send it yourself.

If email isn’t set up on the server, the Email button tells you so — download the PDF instead.
TXT],

    ['invoices', 'What’s on the invoice PDF?', <<<'TXT'
An A4 invoice with your business details (from your account’s business profile), the customer’s name and address, the invoice number, date, due date and currency, every line with quantity, rate and amount, the subtotal, any payments and the **balance due**, plus the payment and delivery terms.
TXT],

    ['invoices', 'How do I record that an invoice has been paid?', <<<'TXT'
Open the invoice and click **Record payment** — it takes you to Receipts with the invoice and its balance already filled in. Every payment you record shows on the invoice under **Payments**, and its status and balance update automatically. See [Receipts](/faqs?topic=receipts).
TXT],

    ['invoices', 'Can I duplicate, edit or delete an invoice?', <<<'TXT'
- **Edit** — change anything, including the lines; the total is always recalculated.
- **Duplicate** (copy icon) — makes a new **Draft** with the same customer, title and lines, and a new number. Great for monthly work.
- **Delete** — only while no payments are recorded against it. Once a customer has paid something, mark it **Cancelled** instead so the payment history stays intact.
TXT],

    ['invoices', 'How do I find invoices that are overdue or still owing?', <<<'TXT'
Use the filter chips above the list — **All**, **Owing**, **Overdue**, **Drafts**, **Sent**, **Partially paid**, **Paid**, **Cancelled** — each with its count. Search by number, customer or title, and sort by **newest**, **due soonest**, **largest** or **most owing**.

The **Totals** row at the bottom adds up whatever is showing (per currency), including what’s been collected and what’s still owed.
TXT],

    ['invoices', 'Can I bill in US dollars?', <<<'TXT'
Yes — each invoice is either **CAD** or **USD**. Lists and totals keep the two currencies apart (you’ll see a separate totals row for each), so they never get added together.
TXT],

    // ------------------------------------------------------------------
    // Receipts
    // ------------------------------------------------------------------
    ['receipts', 'What is the Receipts app?', <<<'TXT'
[Receipts](/receipts) is where you record **payments received** against your invoices. Each payment gets a receipt with its own number, which you can print or email to the customer. The page shows what you’ve collected this year and this month, what’s still owing, and a 12-month chart of money coming in.
TXT],

    ['receipts', 'How do I record a payment?', <<<'TXT'
1. Click **Record payment** (or **Record payment** on an invoice).
2. **Applied to:** choose the invoice — only invoices that still have something owing are listed. You’ll see its total, what’s been paid so far, and what’s owing.
3. **Payment:** the amount (it starts at the full balance — or tap **Full balance** / **Half**), the date it was paid (**Today** / **Yesterday**), and how it was paid.
4. **Reference** (optional): a confirmation or cheque number, printed on the receipt.
5. Click **Record payment**.

The bar at the bottom tells you what the invoice will look like afterwards — “paid in full 🎉” or how much will be left.
TXT],

    ['receipts', 'What payment methods can I record?', <<<'TXT'
E-Transfer, Bank Transfer, Cash, Cheque, Credit Card, Wire and Other. You can filter the receipts list by method, too.
TXT],

    ['receipts', 'Can a payment be more than what’s owing?', <<<'TXT'
No — a payment can’t be more than the invoice’s remaining balance, so invoices can never end up overpaid. Payments also can’t be recorded against a **cancelled** invoice. If the customer paid more than one invoice at once, record a separate receipt against each.
TXT],

    ['receipts', 'Does recording a payment update the invoice?', <<<'TXT'
Yes, automatically:

- a payment that leaves something owing marks the invoice **Partially Paid**,
- a payment that clears the balance marks it **Paid In Full**,
- voiding or deleting payments moves it back (to Partially Paid, or **Sent** if nothing is paid any more).

The invoice’s paid amount and balance update everywhere, including the customer’s profile.
TXT],

    ['receipts', 'What’s the difference between voiding and deleting a receipt?', <<<'TXT'
- **Void** keeps the receipt on file (marked VOID, its number crossed through) but it no longer counts as paid — useful for a bounced cheque. You can **Restore** it later if it was a mistake.
- **Delete** removes it for good. Its number isn’t reused.

Either way, the invoice’s balance and status update straight away.
TXT],

    ['receipts', 'How do I give the customer a copy of their receipt?', <<<'TXT'
Open the receipt and choose **Email** (it attaches the PDF and suggests a thank-you message with the remaining balance), or **PDF** / **Download** to send it yourself. The PDF shows the amount received, how and when it was paid, the invoice it was applied to, and the balance remaining. Voided receipts can’t be emailed.
TXT],

    ['receipts', 'How are receipt numbers chosen?', <<<'TXT'
Automatically, in the format **CA-RCP26-0008** — the year, then a running number that never repeats.
TXT],

    ['receipts', 'Can I change a receipt after recording it?', <<<'TXT'
Yes — open it and click **Edit**. You can change the amount, date, method, reference, or even the invoice it’s applied to (both invoices are re-tallied). The same rule applies: the amount can’t be more than what’s owing.
TXT],
];
