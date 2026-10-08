<?php
// /scripts/migrations/data/faqs/01-start-here.php
//
// Help-centre questions: Getting started, Account & sign-in, Privacy & access.
// Each entry: [topic key (FaqsController::CATEGORIES), question, answer].
// Answer format: blank line = paragraph, "- " bullet, "1. " step, **bold**,
// [label](/path) link. Seeded by 2026_10_01_000001_faq_knowledge_base.php.

return [

    // ------------------------------------------------------------------
    // Getting started
    // ------------------------------------------------------------------
    ['getting-started', 'What is CatScript Apps?', <<<'TXT'
CatScript Apps is one place for the everyday things a family (and a small business) has to keep on top of. Each job has its own app, and they all share one sign-in, one look and one sidebar.

**Workspace (home & family)**
- **Tasks** — the shared to-do and bill-reminder list
- **Cash Flow** — your private money in / money out ledger
- **Meals** — weekly meal plans with calories
- **Timetable** — the family’s week, hour by hour
- **Chores** — who does which chore, and ticking them off
- **Medicals** — appointments, medications, vaccinations and health records, with reminders
- **Pictures** — your private photo gallery

**Business**
- **Customers**, **Invoices** and **Receipts** — bill customers and track what’s been paid

**Community**
- **Social Feed** — posts, photos and videos from people you follow
- **Live chat** — the chat bubble in the corner of every page

Have a look at [About](/about) for a tour of every app.
TXT],

    ['getting-started', 'Do I need an account to use it?', <<<'TXT'
No — not to try it. Every app has a **guest demo**: open any app from the sidebar without signing in and you can add, edit and delete as much as you like. Demo data is kept only in your browser and never reaches our servers.

To use the apps for real (so your data is saved and shared with your family), you need a CatScript account. Accounts are created by an admin — there’s no public sign-up. If you’d like one, [get in touch](/contact).
TXT],

    ['getting-started', 'How do I find my way around?', <<<'TXT'
- **The sidebar** (left) lists every app you can open, grouped into Workspace, Business, Community and Help. On a phone, tap the ☰ menu at the top to open it.
- **The header** (top) has the light / dark switch, your account, and — for admins — Messages, Settings and the admin dashboard.
- **The Dashboard** (once you’re signed in) shows the apps you have, a few live numbers and your recent activity.
- **Breadcrumbs** at the top of each page (Home › …) take you back up a level.

Pages change instantly without reloading, so moving between apps is quick.
TXT],

    ['getting-started', 'What’s on the Dashboard?', <<<'TXT'
The [Dashboard](/dashboard) is your home once you’re signed in:

- a welcome card with a few real figures from your apps,
- a tile for every app you have access to, grouped like the sidebar (apps still being built show as “Soon”),
- your **recent activity** — what you’ve added, changed or deleted, and when. Admins see everyone’s activity here.
TXT],

    ['getting-started', 'Can I use CatScript Apps on my phone or tablet?', <<<'TXT'
Yes. Every page is built to work on a phone as well as a desktop:

- the sidebar slides away behind the ☰ menu,
- wide tables turn into easy-to-tap cards,
- grids like the Timetable and the meal plan switch to a day-by-day view,
- two-pane screens (like the Messages inbox) show one pane at a time with a back arrow.

There’s nothing to install — just open the site in your phone’s browser. Tip: use your browser’s “Add to Home Screen” to get an app-like icon.
TXT],

    ['getting-started', 'How do I switch between light and dark mode?', <<<'TXT'
Click the sun / moon button in the header. Your choice is remembered on that device, and every app — charts, forms, the lot — follows it.
TXT],

    ['getting-started', 'Can I collapse the sidebar to get more room?', <<<'TXT'
Yes. On a computer, click **Collapse** at the bottom of the sidebar (or the ☰ button in the header) to shrink it to icons only — hover an icon to see its name. Click again to expand it. On phones the sidebar is hidden until you open it with ☰.
TXT],

    ['getting-started', 'What do the little badges in the sidebar mean?', <<<'TXT'
- **TRY** (guests only) — this app has a guest demo you can play with.
- **A number on Tasks** — how many tasks are due today.
- **A number on Messages** (admins) — contact-form conversations with unread messages.
- **Soon** — an app that’s still being built; it’ll light up when it’s ready.
TXT],

    ['getting-started', 'How do I search for something?', <<<'TXT'
Each app has its own search box at the top of its list — Tasks searches titles and details, Invoices searches numbers, customers and titles, Cash Flow searches entries, and so on. Results update as you type.

The help centre you’re reading has its own search too (press **/** to jump to it).
TXT],

    ['getting-started', 'Why does a page say “Access denied”?', <<<'TXT'
Each person only sees the apps an admin has given them. If you open an app you haven’t been given (for example from an old link), you’ll see “Access denied”. Ask an admin to add it under **Users → App access** — see [Privacy & access](/faqs?topic=privacy) for how access works.
TXT],

    ['getting-started', 'Is my information shared with anyone outside CatScript Apps?', <<<'TXT'
No. Your data lives in the CatScript database and is only shown to the people inside the platform who are allowed to see it (see [Privacy & access](/faqs?topic=privacy)). Emails you send from the apps — invoices, receipts, replies — go only to the address you choose.
TXT],

    ['getting-started', 'What happens to my changes — do I need to press Save?', <<<'TXT'
Everything is saved the moment you confirm it: when you press **Save**, **Add**, **Record** or tick something off, it’s stored straight away and the page updates on the spot — totals, charts and counts included. There’s no separate “save everything” step, and no need to refresh.
TXT],

    // ------------------------------------------------------------------
    // Account & sign-in
    // ------------------------------------------------------------------
    ['account', 'How do I sign in?', <<<'TXT'
Click **Sign in** (top right, or at the bottom of the sidebar) and enter the email address and password for your CatScript account. You’ll land on your Dashboard, and the sidebar will show every app you have access to.

You stay signed in on that device until you sign out.
TXT],

    ['account', 'How do I get an account?', <<<'TXT'
Accounts are created by an admin — there’s no self sign-up, which keeps the platform private to the family and the people who work with it. Ask an admin to create one for you, or [contact us](/contact).

When the admin creates your account they also choose which apps you can use.
TXT],

    ['account', 'I forgot my password. What do I do?', <<<'TXT'
1. Click **Sign in**, then **Forgot password?**
2. Enter the email address on your account.
3. Open the email we send you and click the reset link.
4. Choose a new password.

The link works for **60 minutes**. If it has expired, just ask for a new one. Can’t find the email? Check your spam folder, or [contact us](/contact).
TXT],

    ['account', 'How do I change my password?', <<<'TXT'
Open [Settings](/settings) and choose **Change Password**. Enter your current password and the new one twice. (Admins can also reach Settings from the cog in the header.)

If you can’t remember your current password, sign out and use **Forgot password?** on the sign-in screen instead.
TXT],

    ['account', 'How do I change my profile photo?', <<<'TXT'
Go to your [Profile](/profile) and choose **Change Photo**. Pick a picture — it’s resized automatically — and it appears straight away in the header, the sidebar and anywhere your name shows up. **Remove Photo** goes back to your initial.
TXT],

    ['account', 'How do I update my name, email or location?', <<<'TXT'
Open your [Profile](/profile) and click **Edit profile**. Change what you need and save — it updates everywhere straight away.

Your **email address** is what you sign in with, so make sure it’s one you can receive mail at — password resets go there.
TXT],

    ['account', 'How do I sign out?', <<<'TXT'
Click your name or photo in the top-right corner of the header (it says **Sign Out** underneath) and confirm. Do this on shared computers so the next person can’t open your apps.
TXT],

    ['account', 'Can I delete my account?', <<<'TXT'
Accounts are managed by an admin. Ask an admin (or [contact us](/contact)) and they can archive or delete it. The two core family accounts can’t be deleted.
TXT],

    ['account', 'Why can’t I see an app my family uses?', <<<'TXT'
Apps are given per person. If someone else can see an app and you can’t, an admin hasn’t added it to your account yet — ask them to tick it under **Users → App access**. It appears in your sidebar the next time a page loads.
TXT],

    // ------------------------------------------------------------------
    // Privacy & access
    // ------------------------------------------------------------------
    ['privacy', 'Who can see my data?', <<<'TXT'
It depends on the app — some are shared with everyone who has that app, others are strictly yours.

**Private to you (no one else, not even admins, sees your entries in the app)**
- **Cash Flow** — your ledger
- **Pictures** — your gallery

**Shared with everyone who has the app**
- **Tasks** — one family to-do list
- **Meals** — everyone can view every plan
- **Timetable** — one family week
- **Chores** — the plan and today’s ticks
- **Customers, Invoices, Receipts** — one business book

**Social Feed** shows your posts to the people who follow you.
TXT],

    ['privacy', 'How does app access work?', <<<'TXT'
An admin decides which apps each person can use, under **Users → edit a user → App access**. Each app is a tick-box. Anything not ticked doesn’t appear in that person’s sidebar or Dashboard, and opening it directly shows “Access denied”. Admins can open every app.

Your Profile, Settings and the Dashboard are always available once you’re signed in.
TXT],

    ['privacy', 'What are Meal Planner, Timetable Editor and Chores Manager?', <<<'TXT'
They’re **extra permissions** that ride along with an app — an admin ticks them under the app in **Users → App access**:

- **Meal Planner** (with Meals) — can create meal plans, duplicate plans, and edit the plans they own. Without it, Meals is view-only.
- **Timetable Editor** (with Timetable) — can add, change, copy and clear activities and manage categories. Without it, the Timetable is view-only.
- **Chores Manager** (with Chores) — can plan who does what, edit the chore library and manage the children. Everyone with Chores can still tick chores off.

Admins always have all three.
TXT],

    ['privacy', 'Can admins see my Cash Flow or Pictures?', <<<'TXT'
No. Cash Flow entries and Pictures belong to the person who added them, and the apps only ever show you your own — admins included. (Admins do see a log of activity — e.g. “Recorded an entry” — on their Dashboard, but not your private ledger or photos inside those apps.)
TXT],

    ['privacy', 'What is the activity history?', <<<'TXT'
Most changes you make — adding a task, recording a payment, uploading a picture — are written to an activity log with the time. You see your own on the [Dashboard](/dashboard); admins see everyone’s, which helps answer “who changed this?” in the shared apps.
TXT],

    ['privacy', 'Is the guest demo private?', <<<'TXT'
Completely. Guest demo data is stored only in your own browser (its local storage). Nothing you type in a demo is sent to our servers, and other people can’t see it. Clearing your browser data — or pressing **Start empty** — wipes it.
TXT],

    ['privacy', 'What can an admin do?', <<<'TXT'
Admins look after the platform. They can:

- create, edit, archive and delete user accounts, and choose each person’s apps and extra permissions,
- open every app,
- read and reply to contact-form messages in **Messages**, and answer live chats in the chat inbox,
- add and edit these FAQs,
- see everyone’s recent activity on the Dashboard.

See [Admin tools](/faqs?topic=admin) for the details.
TXT],
];
