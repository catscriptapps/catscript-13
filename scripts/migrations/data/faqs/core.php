<?php
// /scripts/migrations/data/faqs/core.php
//
// Starter help-centre questions for the CatScript-13 core: Getting started,
// Account & sign-in, Privacy & access, Live chat, Contact & support, Admin.
// Each entry: [topic key (FaqsController::CATEGORIES), question, answer].
// Answer format: blank line = paragraph, "- " bullet, "1. " step, **bold**,
// [label](/path) link. Seeded by 2026_10_08_000003_seed_faqs.php — add a file
// alongside this one (e.g. reports.php) for each app you build.

return [

    // ------------------------------------------------------------------
    // Getting started
    // ------------------------------------------------------------------
    ['getting-started', 'What is this site?', <<<'TXT'
It’s a private suite of small apps that share one sign-in, one look and one sidebar. Once you’re signed in, the [Dashboard](/dashboard) shows every app you have access to.

Have a look at [About](/about) for a tour of what’s here.
TXT],

    ['getting-started', 'Do I need an account to use it?', <<<'TXT'
You can read the public pages — Home, About, these FAQs and Contact — without one. To use the apps you need an account, and accounts are created by an admin: there’s no public sign-up. If you’d like one, [get in touch](/contact).
TXT],

    ['getting-started', 'How do I find my way around?', <<<'TXT'
- **The sidebar** (left) lists every page you can open, grouped into sections. On a phone, tap the ☰ menu at the top to open it.
- **The header** (top) has the light / dark switch, your account, and — for admins — Messages, Settings and the admin dashboard.
- **The Dashboard** (once you’re signed in) shows your apps, a few live numbers and your recent activity.
- **Breadcrumbs** at the top of some pages (Home › …) take you back up a level.

Pages change instantly without reloading, so moving around is quick.
TXT],

    ['getting-started', 'What’s on the Dashboard?', <<<'TXT'
The [Dashboard](/dashboard) is your home once you’re signed in:

- a welcome card with a few live figures,
- a tile for every app you have access to, grouped like the sidebar,
- your **recent activity** — what you’ve added, changed or deleted, and when. Admins see everyone’s activity here.
TXT],

    ['getting-started', 'Can I use it on my phone or tablet?', <<<'TXT'
Yes. Every page is built to work on a phone as well as a desktop: the sidebar slides away behind the ☰ menu, wide tables turn into easy-to-tap cards, and two-pane screens (like the Messages inbox) show one pane at a time with a back arrow.

There’s nothing to install — just open the site in your phone’s browser. Tip: use your browser’s “Add to Home Screen” to get an app-like icon.
TXT],

    ['getting-started', 'How do I switch between light and dark mode?', <<<'TXT'
Click the sun / moon button in the header. Your choice is remembered on that device, and every page follows it.
TXT],

    ['getting-started', 'Can I collapse the sidebar to get more room?', <<<'TXT'
Yes. On a computer, click **Collapse** at the bottom of the sidebar (or the ☰ button in the header) to shrink it to icons only — hover an icon to see its name. Click again to expand it. On phones the sidebar is hidden until you open it with ☰.
TXT],

    ['getting-started', 'Why does a page say “Access denied”?', <<<'TXT'
Each person only sees the apps an admin has given them, and some pages are for admins only. If you open one of those (for example from an old link), you’ll see “Access denied”. Ask an admin if you think you should have it — see [Privacy & access](/faqs?topic=privacy).
TXT],

    // ------------------------------------------------------------------
    // Account & sign-in
    // ------------------------------------------------------------------
    ['account', 'How do I sign in?', <<<'TXT'
Click **Sign in** (top right, or at the bottom of the sidebar) and enter your email address and password. You’ll land on your Dashboard, and the sidebar will show every app you have access to.

You stay signed in on that device for two weeks after your last visit, or until you sign out.
TXT],

    ['account', 'How do I get an account?', <<<'TXT'
Accounts are created by an admin — there’s no self sign-up. Ask an admin to create one for you, or [contact us](/contact). When the admin creates your account they also choose which apps you can use.
TXT],

    ['account', 'I forgot my password. What do I do?', <<<'TXT'
1. Click **Sign in**, then **Forgot password?**
2. Enter the email address on your account.
3. Open the email we send you and click the reset link.
4. Choose a new password.

The link works for **60 minutes**. If it has expired, just ask for a new one. Can’t find the email? Check your spam folder, or [contact us](/contact).
TXT],

    ['account', 'How do I change my password?', <<<'TXT'
Open [Settings](/settings) and choose **Change Password**. Enter your current password and the new one twice.

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
Accounts are managed by an admin. Ask an admin (or [contact us](/contact)) and they can archive or delete it. The main admin account can’t be deleted.
TXT],

    // ------------------------------------------------------------------
    // Privacy & access
    // ------------------------------------------------------------------
    ['privacy', 'How does app access work?', <<<'TXT'
Your Dashboard, Profile and Settings are always available once you’re signed in. Apps that are granted per person appear under **Users → edit a user → App access** as tick-boxes; anything not ticked doesn’t appear in that person’s sidebar or Dashboard, and opening it directly shows “Access denied”. Admins can open everything.
TXT],

    ['privacy', 'What is the activity history?', <<<'TXT'
Most changes — signing in, updating a profile, adding a user — are written to an activity log with the time. You see your own on the [Dashboard](/dashboard); admins see everyone’s, which helps answer “who changed this?”.
TXT],

    ['privacy', 'What can an admin do?', <<<'TXT'
Admins look after the site. They can:

- create, edit, archive and delete user accounts, and choose each person’s role and apps,
- open every app,
- read and reply to contact-form messages in **Messages**, and answer live chats,
- add and edit these FAQs,
- see everyone’s recent activity on the Dashboard.

See [Admin tools](/faqs?topic=admin) for the details.
TXT],

    // ------------------------------------------------------------------
    // Live chat
    // ------------------------------------------------------------------
    ['live-chat', 'What is the chat bubble in the corner?', <<<'TXT'
It’s **live chat** with our team, on every page. Click it to open a chat panel and type a question; the reply appears right there. When you scroll down a long page and the “back to top” arrow appears, the bubble moves up to sit above it.
TXT],

    ['live-chat', 'Do I need to sign in to use live chat?', <<<'TXT'
No. Guests are asked for their **name** (and, optionally, an email) the first time, so we know who we’re talking to. If you’re signed in, we already know.
TXT],

    ['live-chat', 'How will I know when someone replies?', <<<'TXT'
Replies appear in the chat panel within a couple of seconds while it’s open. If it’s closed, a red **number** appears on the bubble when there’s something new. Your conversation is remembered on that browser, so you can close the panel, browse around and come back to it.
TXT],

    ['live-chat', 'Will I be chatting with a person or a bot?', <<<'TXT'
Usually a person. The team can switch on an **AI assistant** to answer straight away when nobody’s free; its messages are clearly labelled “AI Assistant”, it can’t look up your account or change anything, and as soon as a real person replies in your conversation, the assistant stops for good.
TXT],

    ['live-chat', 'Live chat or the contact form — which should I use?', <<<'TXT'
- **Live chat** — quick questions while you’re using the site.
- **The [contact form](/contact)** — anything longer, or when you’d like a reply by **email** (for example, if you won’t be around to watch the chat).
TXT],

    // ------------------------------------------------------------------
    // Contact & support
    // ------------------------------------------------------------------
    ['contact', 'How do I contact you?', <<<'TXT'
- **[Contact form](/contact)** — tell us your name, email and message; a real person replies by email.
- **Live chat** — the bubble in the corner of every page.
TXT],

    ['contact', 'How do I report a problem?', <<<'TXT'
Use the [contact form](/contact) and pick **Something isn’t working**. It helps a lot if you tell us:

- which page you were on,
- what you did, what you expected and what happened instead,
- whether it happens every time, and on which device / browser.
TXT],

    ['contact', 'Can I suggest a feature?', <<<'TXT'
Please do — use the [contact form](/contact) and pick **Feature idea**.
TXT],

    ['contact', 'Why did the contact form say to wait a few minutes?', <<<'TXT'
To keep spam out, the form only accepts a handful of messages from one browser or email address in a short space of time. If you see that message, wait a few minutes — or, if it’s urgent, use live chat.
TXT],

    ['contact', 'How will you reply to my message?', <<<'TXT'
By email, to the address you gave on the form. You can simply reply to that email to carry on the conversation.
TXT],

    // ------------------------------------------------------------------
    // Admin tools
    // ------------------------------------------------------------------
    ['admin', 'How do I add a new user?', <<<'TXT'
Open [Users](/users) and click **Add user**. Enter their name, email and a starting password, their location, their **role** (User or Admin), and tick any **apps** they should have. The account is active straight away; share the password with them so they can sign in and change it.
TXT],

    ['admin', 'What’s the difference between archiving and deleting a user?', <<<'TXT'
- **Archive** (set the account to Archived) — they can no longer sign in, but their account and history stay. Set them back to Active any time.
- **Delete** — removes the account for good.

The main admin account can’t be deleted and always keeps the Admin role.
TXT],

    ['admin', 'How do I read and answer contact-form messages?', <<<'TXT'
Click the **envelope** in the header (its red number counts conversations with unread messages) to open [Messages](/messages). Pick a conversation on the left to read it, then type your reply — it’s emailed to the sender and saved in the thread. You can mark conversations unread, archive them, or delete them, and filter by **Unread** or **To reply**.

If email isn’t set up on the server, use **Reply in your email app** instead.
TXT],

    ['admin', 'How do I answer live chats?', <<<'TXT'
As an admin, your chat bubble opens the **live chat inbox** (the red number shows unread messages); the [Live Chats](/live-chat) page has the full console. Pick a conversation and reply; the visitor sees it within seconds. You can also switch on **AI Autorespond** there and give it instructions — it answers new messages until you reply yourself in that conversation.
TXT],

    ['admin', 'How do I add or edit FAQs?', <<<'TXT'
On this page, as an admin, each topic has **Add question**, and each open answer has **Edit**, move up / down and **Delete**. In the editor, choose the topic and write the answer:

- a blank line starts a new paragraph,
- start lines with “- ” for bullets or “1. ” for numbered steps,
- wrap words in two asterisks on each side for **bold**,
- to link to a page, put the words in square brackets followed by the page’s address in round brackets — that’s how this link to [the Dashboard](/dashboard) is written.

The preview shows exactly how it will look. Untick **Published** to hide a question without deleting it.
TXT],

    ['admin', 'What does the DB update button in the header do?', <<<'TXT'
It applies **pending database updates** — new tables, columns and help content that new features need. It’s safe to run more than once: each update only adds what’s missing and skips anything already there, and it never deletes or overwrites your data. Only the main admin account sees it, and it asks for your password first. Back up the database before running it anyway.
TXT],

    ['admin', 'Where can I see what people have changed?', <<<'TXT'
On the [Dashboard](/dashboard), admins see **everyone’s** recent activity — who added, changed or deleted what, and when — and [History](/history) has the full, searchable log.
TXT],
];
