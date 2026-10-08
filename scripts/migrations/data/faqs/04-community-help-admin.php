<?php
// /scripts/migrations/data/faqs/04-community-help-admin.php
//
// Help-centre questions: Social Feed, Live chat, Trying as a guest,
// Contact & support, Admin tools. Format: see 01-start-here.php.

return [

    // ------------------------------------------------------------------
    // Social Feed
    // ------------------------------------------------------------------
    ['social-feed', 'What is the Social Feed?', <<<'TXT'
The [Social Feed](/social-feed) is a private feed for the people on the platform. Share updates, photos and videos, like and comment on posts, and follow the people whose posts you want to see. There are no ads and no strangers — only CatScript members.
TXT],

    ['social-feed', 'Whose posts appear in my feed?', <<<'TXT'
Your own posts plus posts from the people **you follow** — never a global stream of everyone. If your feed is quiet, follow a few people from the suggestions on the right, or search for them under **People**.
TXT],

    ['social-feed', 'How do I share a post?', <<<'TXT'
Click **What’s on your mind?**, write your update and, if you like, add a **photo** or a **video** (and emoji from the picker). Then **Share Post**. A post needs some text or something attached.
TXT],

    ['social-feed', 'How big can photos and videos be?', <<<'TXT'
Photos are resized automatically, so any normal phone photo is fine. Videos can be fairly large (up to about 200 MB), but shorter clips upload much faster — on a slow connection, trim long videos first.
TXT],

    ['social-feed', 'How do likes and comments work?', <<<'TXT'
Tap the heart to like a post (tap again to unlike) and open **Comments** to read or write one. Comments appear under the post for everyone who can see it.
TXT],

    ['social-feed', 'How do I follow or unfollow someone?', <<<'TXT'
Use **Follow** on someone’s card in the suggestions or in **People** search; once you follow them the button shows **Following** — click it again to unfollow. You can see your **Followers** and who you’re **Following** from the side panel.
TXT],

    ['social-feed', 'Can I delete a post?', <<<'TXT'
Yes — open the menu on your own post and choose **Delete Post**. It’s removed for everyone, along with its likes and comments. You can only delete your own posts.
TXT],

    // ------------------------------------------------------------------
    // Live chat
    // ------------------------------------------------------------------
    ['live-chat', 'What is the chat bubble in the corner?', <<<'TXT'
It’s **live chat** with the CatScript team, on every page. Click it to open a chat panel and type a question; the reply appears right there. When you scroll down a long page and the “back to top” arrow appears, the bubble moves up to sit above it.
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
    // Trying as a guest
    // ------------------------------------------------------------------
    ['guest-demos', 'How do the guest demos work?', <<<'TXT'
Open any app from the sidebar without signing in (look for **TRY**). It starts with realistic sample data, and you can add, edit and delete freely — everything works as it would for real, except it’s saved **only in your browser**. Nothing reaches our servers, and no one else sees it.
TXT],

    ['guest-demos', 'Which apps can I try as a guest?', <<<'TXT'
All of them: Tasks, Cash Flow, Meals, Timetable, Chores, Pictures, Customers, Invoices, Receipts and the Social Feed. Customers, Invoices and Receipts share one sample business book, so a customer you add appears when you write an invoice, and a payment you record shows up on that invoice.
TXT],

    ['guest-demos', 'How do I reset a demo or start from scratch?', <<<'TXT'
Each demo has a banner at the top with two buttons:

- **Reload sample data** — puts the sample data back.
- **Start empty** — clears everything so you can try it with your own.

Clearing your browser’s site data does the same as Start empty.
TXT],

    ['guest-demos', 'Is anything missing in the demos?', <<<'TXT'
A few things need a real account because they’re built or sent by the server:

- emailing invoices and receipts (use **Print / Save as PDF** in the demo instead),
- Meals PDFs,
- receipt photos in Cash Flow.

Everything else — totals, charts, statuses, planning — works the same.
TXT],

    ['guest-demos', 'Will my demo data carry over if I get an account?', <<<'TXT'
No — demo data stays in your browser and is never uploaded. Your real account starts clean (or with the family’s shared data, for shared apps). Think of the demo as a safe place to practise.
TXT],

    // ------------------------------------------------------------------
    // Contact & support
    // ------------------------------------------------------------------
    ['contact', 'How do I contact the CatScript team?', <<<'TXT'
- **[Contact form](/contact)** — tell us your name, email and message; a real person replies by email, usually within a day.
- **Live chat** — the bubble in the corner of every page.
- **Email** — info@catscriptapps.com.
TXT],

    ['contact', 'How do I report a problem?', <<<'TXT'
Use the [contact form](/contact) and pick **Something isn’t working**. It helps a lot if you tell us:

- which app and page you were on,
- what you did, what you expected and what happened instead,
- whether it happens every time, and on which device / browser.
TXT],

    ['contact', 'Can I suggest a feature?', <<<'TXT'
Please do — use the [contact form](/contact) and pick **Feature idea**. Many of the apps’ best touches started as suggestions.
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
Open [Users](/users) and click **Add user**. Enter their name, email and a starting password, their location, their **role** (User or Admin), and tick the **apps** they should have — plus any extra permissions (Meal Planner, Timetable Editor, Chores Manager). The account is active straight away; share the password with them so they can sign in and change it.
TXT],

    ['admin', 'How do I change what a user can access?', <<<'TXT'
In [Users](/users), open the person and click **Edit**. Under **App access**, tick or untick apps (use **All** / **None** to go quickly) and the extra permissions that ride along with them. Their sidebar changes the next time a page loads.
TXT],

    ['admin', 'What’s the difference between archiving and deleting a user?', <<<'TXT'
- **Archive** (set the account to Archived) — they can no longer use the platform, but their account and history stay. Set them back to Active any time.
- **Delete** — removes the account for good.

The two core family accounts can’t be deleted, and the main admin always keeps the Admin role.
TXT],

    ['admin', 'How do I read and answer contact-form messages?', <<<'TXT'
Click the **envelope** in the header (its red number counts conversations with unread messages) to open [Messages](/messages). Pick a conversation on the left to read it, then type your reply — it’s emailed to the sender and saved in the thread. You can mark conversations unread, archive them, or delete them, and filter by **Unread** or **To reply**.

If email isn’t set up on the server, use **Reply in your email app** instead.
TXT],

    ['admin', 'How do I answer live chats?', <<<'TXT'
As an admin, your chat bubble opens the **live chat inbox** (the red number shows unread messages). Pick a conversation and reply; the visitor sees it within seconds. You can also switch on **AI Autorespond** there and give it instructions — it answers new messages until you reply yourself in that conversation.
TXT],

    ['admin', 'How do I add or edit FAQs?', <<<'TXT'
On this page, as an admin, each topic has **Add question**, and each open answer has **Edit**, move up / down and **Delete**. In the editor, choose the topic and write the answer:

- a blank line starts a new paragraph,
- start lines with “- ” for bullets or “1. ” for numbered steps,
- wrap words in two asterisks on each side for **bold**,
- to link to a page, put the words in square brackets followed by the page’s address in round brackets — that’s how this link to [the Tasks app](/tasks) is written.

The preview shows exactly how it will look. Untick **Published** to hide a question without deleting it.
TXT],

    ['admin', 'What does the DB update button in the header do?', <<<'TXT'
It applies **pending database updates** — new tables, columns and help content that new features need. It’s safe to run more than once: each update only adds what’s missing and skips anything already there, and it never deletes or overwrites your data. Only the main admin account sees it, and it asks for your password first. Back up the database before running it anyway.
TXT],

    ['admin', 'Where can I see what people have changed?', <<<'TXT'
On the [Dashboard](/dashboard), admins see **everyone’s** recent activity — who added, changed or deleted what, and when — across every app.
TXT],
];
