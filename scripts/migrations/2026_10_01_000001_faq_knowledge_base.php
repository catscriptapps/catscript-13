<?php
// /scripts/migrations/2026_10_01_000001_faq_knowledge_base.php
//
// The help centre's knowledge base (Src\Controller\FaqsController):
//
// 1. faqs.category — nullable topic key (getting-started, tasks, invoices…).
//    Additive; the legacy app never reads it.
// 2. Seeds every question in scripts/migrations/data/faqs/*.php that isn't
//    there yet (matched on the question text), so re-running only adds
//    what's new — and an admin's edits to an answer are never overwritten.
//    ids are assigned MAX + 1 (the legacy column doesn't auto-increment).
// 3. Archives (status_id 2 — hidden, NOT deleted) the 23 developer-framework
//    FAQs the legacy seed shipped ("What is Catscript-13?", "How secure is
//    authentication?"…), which describe the old template rather than these
//    apps and make claims that aren't true here. Only rows still exactly as
//    seeded are touched: still published, never edited (updated_at =
//    created_at) and without a topic. An admin can re-publish any of them
//    from the FAQs page.

declare(strict_types=1);

use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Schema\Blueprint;

return function (): array {
    $schema = Capsule::schema();
    $log = [];

    // --- 1. Topic column -------------------------------------------------
    if (!$schema->hasColumn('faqs', 'category')) {
        $schema->table('faqs', function (Blueprint $table) {
            $table->string('category', 40)->nullable()->index()->after('answer');
        });
        $log[] = 'added faqs.category (nullable)';
    } else {
        $log[] = 'faqs.category already exists — skipped';
    }

    // --- 2. Knowledge base -------------------------------------------------
    $entries = [];
    foreach (glob(__DIR__ . '/data/faqs/*.php') ?: [] as $file) {
        foreach (require $file as $row) {
            $entries[] = $row;
        }
    }

    $added = Capsule::connection()->transaction(function () use ($entries) {
        $existing = array_flip(array_map(
            fn($q) => mb_strtolower(trim((string) $q)),
            Capsule::table('faqs')->lockForUpdate()->pluck('question')->all()
        ));
        $nextId = (int) Capsule::table('faqs')->max('id') + 1;
        $order = Capsule::table('faqs')->whereNotNull('category')->selectRaw('category, MAX(display_order) AS n')
            ->groupBy('category')->pluck('n', 'category')->map(fn($n) => (int) $n)->all();
        $now = date('Y-m-d H:i:s');

        $added = 0;
        foreach ($entries as [$category, $question, $answer]) {
            $key = mb_strtolower(trim($question));
            if (isset($existing[$key])) {
                continue;
            }
            $order[$category] = ($order[$category] ?? 0) + 1;
            Capsule::table('faqs')->insert([
                'id'            => $nextId++,
                'question'      => trim($question),
                'answer'        => trim($answer),
                'category'      => $category,
                'status_id'     => 1,
                'display_order' => $order[$category],
                'orig_user_id'  => 1,
                'created_at'    => $now,
                'updated_at'    => $now,
            ]);
            $existing[$key] = true;
            $added++;
        }
        return $added;
    });
    $log[] = $added
        ? "added {$added} help-centre questions (" . count($entries) . ' in the knowledge base)'
        : 'every help-centre question is already there — skipped';

    // --- 3. Retire the template's developer FAQs ---------------------------
    $legacyTemplate = [
        'What is Catscript-13?', 'How is Catscript-13 structured?', 'What makes the architecture “clean”?',
        'Does Catscript-13 support partial page loading?', 'Can I use dark mode?', 'Is the interface responsive?',
        'How secure is authentication?', 'What technologies power the frontend?', 'How are routes handled?',
        'What is the primary color theme?', 'How does the scroll-to-top button work?', 'What database system does Catscript-13 use?',
        'Is seeding supported?', 'How are sessions and forms secured?', 'What makes Catscript-13 developer-friendly?',
        'Does Catscript-13 include a modal system?', 'How are invalid form submissions handled?', 'What is the sidebar behavior on mobile?',
        'How do data tables behave on small screens?', 'Why is Catscript-13 called a “philosophy”?', 'Can I extend Catscript-13 for my own app?',
        'Where are uploaded images stored?', 'Does the framework support dark and light themes automatically?',
    ];
    $archived = Capsule::table('faqs')
        ->whereIn('question', $legacyTemplate)
        ->whereNull('category')
        ->where('status_id', 1)
        ->whereColumn('updated_at', 'created_at')
        ->update(['status_id' => 2]);
    $log[] = $archived
        ? "archived {$archived} old developer-template FAQs (hidden, not deleted — re-publish from the FAQs page if wanted)"
        : 'no untouched developer-template FAQs to archive — skipped';

    return $log;
};
