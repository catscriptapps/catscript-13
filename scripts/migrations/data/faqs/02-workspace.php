<?php
// /scripts/migrations/data/faqs/02-workspace.php
//
// Help-centre questions: Tasks, Cash Flow, Meals, Timetable, Chores, Pictures.
// Format: see 01-start-here.php.

return [

    // ------------------------------------------------------------------
    // Tasks
    // ------------------------------------------------------------------
    ['tasks', 'What is the Tasks app for?', <<<'TXT'
[Tasks](/tasks) is the family’s shared to-do and reminder list — bills to pay, appointments, things to buy, anything with a date. Everyone who has Tasks sees and manages the same list, and each task remembers who added it.
TXT],

    ['tasks', 'How do I add a task?', <<<'TXT'
1. Click **Add task**.
2. Give it a **title** — as you type, titles from earlier tasks are suggested (handy for repeating bills like “Pay Enbridge Gas”); use ↑ / ↓ and Enter to pick one.
3. Choose the **due date** — or tap **Today**, **Tomorrow** or **In a week**.
4. Optionally set a **time** (or **Clear time** for “any time”) and add **details**.
5. Click **Add task**.

New tasks start at 12:00 AM, which suits bills that are due “on the day”.
TXT],

    ['tasks', 'What are the Current, Today, Next 7 days and Past tabs?', <<<'TXT'
- **Current** (the default) — the last 10 days plus everything coming up, so nothing recent slips out of sight.
- **Today** — only what’s due today.
- **Next 7 days** — today and the six days after.
- **Past** — everything before today, newest first.

Each tab shows how many tasks it holds. Searching looks across **every** task, whatever tab you’re on.
TXT],

    ['tasks', 'What do the colours on tasks mean?', <<<'TXT'
They show urgency at a glance: tasks that are **past due** are red, ones coming up **soon** are amber, and the rest are calm. The Tasks badge in the sidebar counts what’s due **today**.
TXT],

    ['tasks', 'How do I edit or delete a task?', <<<'TXT'
Click a task to open it, then **Edit** to change anything (title, date, time, details) or use the bin icon to delete it. Deleting asks you to confirm first. Editing never changes who originally added the task.
TXT],

    ['tasks', 'Can I leave Tasks open on a TV or kitchen screen?', <<<'TXT'
Yes — it’s designed for it. When nobody has touched the page for a little while it quietly re-syncs every so often, so tasks added on other devices show up. After 5 idle minutes a gentle, TV-safe screensaver takes over (a slowly drifting clock and what’s due), so nothing burns into the screen. Any key, tap or mouse movement brings the list back.
TXT],

    ['tasks', 'Does Tasks send reminders?', <<<'TXT'
Not by email or notification at the moment. The reminders are visual: the **Today** tab, the red / amber colours, and the number on the Tasks item in the sidebar, which you’ll see whenever you open the platform.
TXT],

    // ------------------------------------------------------------------
    // Cash Flow
    // ------------------------------------------------------------------
    ['cash-flow', 'What is Cash Flow?', <<<'TXT'
[Cash Flow](/cash-flow) is your personal money in / money out ledger. Record what comes in and what goes out, and it shows your **net** (what’s left), how much of your income you spent, where the money went, and how your balance moved over time.

Your ledger is **private** — nobody else sees your entries, not even admins.
TXT],

    ['cash-flow', 'How do I record an entry?', <<<'TXT'
1. Click **Record entry**.
2. Choose **Money in** or **Money out**.
3. Enter the **amount**, a **title** (e.g. “BMO – Mortgage” — earlier titles are suggested as you type) and the **date** (**Today** / **Yesterday** shortcuts).
4. Add notes if you like.

As you type, a panel shows the **impact** — what this entry does to that period’s totals — before you save.
TXT],

    ['cash-flow', 'How do the period and type filters work?', <<<'TXT'
The buttons above the totals scope **everything** on the page — totals, charts and the list:

- **Period:** This month, Last month, 3 months, This year, All time.
- **Type:** All, Money in, Money out.
- **Search:** narrows to entries whose title or notes match.

Totals compare against the previous period (e.g. “up 12% on last month”), and everything updates instantly — no loading.
TXT],

    ['cash-flow', 'What do the charts show?', <<<'TXT'
- **Money in vs money out** — bars for each day (this / last month), week (3 months) or month (longer), with a line for the net.
- **Where the money went** — your biggest money-out entries, grouped by title.
- **Running net** — money in minus money out, added up across the period, so you can see the trend.

The **“Spent of what came in”** meter in the big net card shows what share of your income went back out.
TXT],

    ['cash-flow', 'Can I attach a receipt photo to an entry?', <<<'TXT'
Yes. Open the entry and choose **Attach a receipt photo**. You can **Replace** or **Remove** it later, and the photo opens full size when you view the entry. (Receipt photos need a signed-in account — the guest demo doesn’t store files.)
TXT],

    ['cash-flow', 'How do I change or delete an entry?', <<<'TXT'
Click the entry to view it, then **Edit entry** to change the amount, type, title, date or notes, or **Delete** to remove it (you’ll be asked to confirm). Totals and charts update immediately.
TXT],

    ['cash-flow', 'Is Cash Flow the same as Invoices and Receipts?', <<<'TXT'
No. Cash Flow is **your own** household ledger. [Invoices](/invoices) and [Receipts](/receipts) are the shared **business** book — what customers owe and what they’ve paid. Nothing is copied between them automatically.
TXT],

    // ------------------------------------------------------------------
    // Meals
    // ------------------------------------------------------------------
    ['meals', 'What is the Meals app?', <<<'TXT'
[Meals](/meals) holds the family’s **meal plans**. A plan is one week — breakfast, lunch, dinner and snacks for each day — with optional calories, so you can see each day’s total and the week’s average. Make one for a normal week and others for holidays, school terms or special diets.

Everyone with Meals can see every plan.
TXT],

    ['meals', 'Who can create and edit meal plans?', <<<'TXT'
- **Viewing** — everyone with Meals can view every plan and download its PDF.
- **Creating and duplicating** — people with the **Meal Planner** permission (and admins).
- **Editing** — a plan’s meals can only be changed by the person who created it, while they’re still a Meal Planner.

Plans you can’t edit simply show read-only.
TXT],

    ['meals', 'How do I add a meal?', <<<'TXT'
Open your plan and click an empty spot in the grid (a day and meal type — breakfast, lunch, dinner or snacks). Type the dish — dishes you’ve planned before are suggested as you type — and optionally the **calories**. Each day can hold one entry per meal type. Click a meal again to change or remove it.
TXT],

    ['meals', 'How do I make a new plan, or copy an existing one?', <<<'TXT'
- **New plan** — give it a title (e.g. “School-term week”) and an optional description (“who or what it’s for” — it’s printed on the PDF too).
- **Duplicate plan** — copies one of your plans with all its meals, ready to tweak.
- **Copy to my plans** — on someone else’s plan, copies it into a plan of your own that you can edit.

Use the plan picker at the top to switch between plans.
TXT],

    ['meals', 'Can I print a meal plan?', <<<'TXT'
Yes — open the plan and choose **PDF**. You get a tidy A4 page of the week with the plan’s title and description, ready to print or stick on the fridge. (PDFs are built from saved plans, so they need a signed-in account.)
TXT],

    ['meals', 'How do I clear a week or delete a plan?', <<<'TXT'
- **Clear the week** empties every meal from the plan but keeps the plan itself.
- **Delete plan** removes the plan and its meals.

Both ask you to confirm, and both are only available on plans you can edit.
TXT],

    ['meals', 'How do the calorie figures work?', <<<'TXT'
Calories are optional. Wherever you’ve entered them, each day shows its total and the plan shows the week’s figures. Meals without calories simply don’t count towards the totals.
TXT],

    // ------------------------------------------------------------------
    // Timetable
    // ------------------------------------------------------------------
    ['timetable', 'What is the Timetable?', <<<'TXT'
The [Timetable](/timetable) is the family’s **weekly routine** — school, reading, sports, chores, meals, bedtime — hour by hour, Monday to Sunday. There’s one shared timetable that everyone with the app can see.

On a wide screen it’s a grid with blocks sized by how long each activity lasts (overlapping activities sit side by side) and a line showing **now**. On a phone it becomes a day-by-day list.
TXT],

    ['timetable', 'Who can change the Timetable?', <<<'TXT'
Anyone with the **Timetable Editor** permission, and admins. Everyone else with Timetable access sees it read-only. An admin can tick Timetable Editor under **Users → App access**.
TXT],

    ['timetable', 'How do I add an activity?', <<<'TXT'
Click an empty spot in the grid (it fills in that day and time), or use the add button. Choose the **activity** name, its **category**, when it **starts** and **how long** it lasts.

To add the same thing to several days at once, pick the days — or tap **Every day**, **Weekdays** or **Weekend** — and it’s added to each of them in one go.
TXT],

    ['timetable', 'What are categories?', <<<'TXT'
Categories group and colour activities — e.g. School, Reading, Sports, Chores, Meals. Editors can open **Categories** to add new ones, rename them or change their colour. Every activity in the **Chores** category becomes a chore slot in the [Chores](/chores) app.
TXT],

    ['timetable', 'How do I copy a day or clear a day?', <<<'TXT'
- **Copy a day** — copy everything on one day to other days. If a target day already has activities, choose **Keep it** (add alongside) or **Replace it**.
- **Clear day** — remove every activity on a day (you’ll be asked to confirm).

Handy for setting up Monday once and copying it to the rest of the school week.
TXT],

    ['timetable', 'Can I leave the Timetable on a TV?', <<<'TXT'
Yes. It keeps itself current, the **now** line moves through the day, and after a while without anyone touching it a TV-safe screensaver takes over, showing the time and what’s on. Any key, tap or mouse movement wakes it.
TXT],

    ['timetable', 'How does the Timetable connect to Chores?', <<<'TXT'
The Chores app takes its **chore slots** straight from the Timetable: every activity in the Chores category (or with “chore” in its name) — e.g. Mon–Fri 6:30–6:50 — becomes a slot that chores can be shared out into. Change the slot’s time in the Timetable and Chores follows.
TXT],

    // ------------------------------------------------------------------
    // Chores
    // ------------------------------------------------------------------
    ['chores', 'How does the Chores app work?', <<<'TXT'
[Chores](/chores) answers “who does what, and is it done?” It’s built from four things:

- **Chore slots** — taken live from the Timetable (activities in the Chores category, e.g. weekdays 6:30–6:50).
- **The chore library** — every possible chore, with its area (kitchen, laundry, pets…), roughly how many minutes it takes and the best time of day.
- **Children** — who shares the chores.
- **The plan** — which child does which chores in each slot, sized so their minutes fit inside the slot.

Then everyone ticks chores off on the **Today** board.
TXT],

    ['chores', 'What are the Today, The week, Chore library and Children views?', <<<'TXT'
- **Today** — the tick-off board: each child’s chores for today’s slots. Tap a chore to mark it done.
- **The week** — the planner: every slot for the week and who has what, with each child’s minutes against the slot’s length.
- **Chore library** — every chore you can hand out.
- **Children** — the people the chores are shared between.
TXT],

    ['chores', 'Who can plan chores and who can tick them off?', <<<'TXT'
Everyone with Chores access can **view** the plan and **tick chores off**. Changing the plan, the library or the children needs the **Chores Manager** permission (admins always have it).
TXT],

    ['chores', 'What does “Share out chores” do?', <<<'TXT'
It plans for you. Pick the chore slots and the chores you want covered, and it hands them out fairly:

- it gives out the longest chores first and keeps each child’s total minutes **balanced**,
- it rotates who’s first in line from slot to slot,
- it only gives a child chores that **fit** in the slot’s time,
- **Personal** chores (like “make your bed”) go to every child.

Choose to **add** to what’s already planned, or **Start over** to clear those slots first. Anything that couldn’t fit is listed at the end so you can adjust.
TXT],

    ['chores', 'How do I add a chore to the library?', <<<'TXT'
In **Chore library**, add a chore with its **title**, **area** (kitchen, dining, bedroom, bathroom, living room, floors, laundry, garbage, outdoors, pets, car or general), **about how long** it takes, the **best time of day** (morning, evening or any time) and optional notes.

Tick **Personal — everyone does their own** for chores each child does for themselves.
TXT],

    ['chores', 'How do I add a child?', <<<'TXT'
In **Children**, add their **first and last name** and pick a **colour** (it marks their chores everywhere). You can also link **their CatScript account** if they have one. Taking a child off the chores removes their planned chores too — you’ll be asked first.
TXT],

    ['chores', 'Why does Chores say there are no chore slots?', <<<'TXT'
Chore slots come from the Timetable. Add an activity in the **Chores** category (or with “chore” in its name) to the [Timetable](/timetable) — e.g. “Morning chores, Mon–Fri, 6:30–6:50” — and it appears in Chores as a slot straight away.
TXT],

    ['chores', 'What is “Chore champions”?', <<<'TXT'
A friendly scoreboard of how many chores each child has ticked off **this week so far**. When every chore for the day is done you’ll see a celebration message.
TXT],

    ['chores', 'Can the Chores board run on a TV?', <<<'TXT'
Yes. Left open, the board re-syncs about once a minute when nobody is using it (so ticks made on phones appear), the photo slideshow keeps running, and after 5 idle minutes a TV-safe screensaver takes over. Touch, click or press a key to bring the board back.
TXT],

    // ------------------------------------------------------------------
    // Pictures
    // ------------------------------------------------------------------
    ['pictures', 'What is the Pictures app?', <<<'TXT'
[Pictures](/pictures) is your **private** photo gallery. Upload photos, add captions, mark favourites and browse them grouped by month, with a full-screen viewer. Only you can see your pictures.
TXT],

    ['pictures', 'How do I upload pictures?', <<<'TXT'
Click the upload button and choose one or more photos — or drag them onto the upload window. iPhone **HEIC** photos are converted automatically, and very large photos are resized so they load quickly while still looking sharp.
TXT],

    ['pictures', 'How do favourites and the featured strip work?', <<<'TXT'
Tap the heart on any picture to make it a **favourite**. The featured carousel at the top shows up to 8 favourites (or your newest pictures if you haven’t picked any), and the **Favourites** filter shows only those.
TXT],

    ['pictures', 'How do I add or change a caption?', <<<'TXT'
Open a picture in the viewer and type in the caption box (**Add a caption…**). Captions are searchable — use **Search captions…** above the gallery to find a photo by its caption.
TXT],

    ['pictures', 'How do I use the full-screen viewer?', <<<'TXT'
Click any picture. Move between photos with the arrows, by **swiping** on a phone, or with the **← / →** keys; **Esc** closes it. From the viewer you can edit the caption, favourite it, **download** the original, or delete it.
TXT],

    ['pictures', 'How do I delete several pictures at once?', <<<'TXT'
Switch to selecting, tick the pictures you want (or **Select all**), then **Delete**. You’ll be asked to confirm — deleted pictures can’t be recovered.
TXT],

    ['pictures', 'Can I sort my gallery?', <<<'TXT'
Yes — **Newest** or **Oldest** first. Either way, pictures are grouped under the month they were added.
TXT],
];
