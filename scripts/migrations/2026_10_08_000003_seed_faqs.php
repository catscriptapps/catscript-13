<?php
// /scripts/migrations/2026_10_08_000003_seed_faqs.php
//
// Seeds the help centre (Src\Controller\FaqsController) with every question
// in scripts/migrations/data/faqs/*.php that isn't there yet (matched on the
// question text), so re-running only adds what's new — and an admin's edits
// to an answer are never overwritten. Add a data file per app you build and
// run the DB reset again to publish its questions.

declare(strict_types=1);

use Illuminate\Database\Capsule\Manager as Capsule;

return function (): array {
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
        $order = Capsule::table('faqs')->whereNotNull('category')->selectRaw('category, MAX(display_order) AS n')
            ->groupBy('category')->pluck('n', 'category')->map(fn($n) => (int) $n)->all();
        $now = date('Y-m-d H:i:s');
        $author = Capsule::table('users')->where('id', 1)->exists() ? 1 : null;

        $added = 0;
        foreach ($entries as [$category, $question, $answer]) {
            $key = mb_strtolower(trim($question));
            if (isset($existing[$key])) {
                continue;
            }
            $order[$category] = ($order[$category] ?? 0) + 1;
            Capsule::table('faqs')->insert([
                'question'      => trim($question),
                'answer'        => trim($answer),
                'category'      => $category,
                'status_id'     => 1,
                'display_order' => $order[$category],
                'orig_user_id'  => $author,
                'created_at'    => $now,
                'updated_at'    => $now,
            ]);
            $existing[$key] = true;
            $added++;
        }
        return $added;
    });

    return [$added
        ? "added {$added} help-centre questions (" . count($entries) . ' in the knowledge base)'
        : 'every help-centre question is already there — skipped'];
};
