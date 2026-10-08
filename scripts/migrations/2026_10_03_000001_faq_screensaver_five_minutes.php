<?php
// /scripts/migrations/2026_10_03_000001_faq_screensaver_five_minutes.php
//
// The TV screensaver now starts after 5 idle minutes (it was 10). The
// help-centre answers seeded by 2026_10_01_000001 say "10 idle minutes";
// this corrects them — only in answers still exactly as seeded (never
// edited: updated_at = created_at), so an admin's own wording is never
// touched. Running it again finds nothing left to change.

declare(strict_types=1);

use Illuminate\Database\Capsule\Manager as Capsule;

return function (): array {
    if (!Capsule::schema()->hasTable('faqs')) {
        return ['faqs table missing — skipped'];
    }

    $n = Capsule::table('faqs')
        ->where('answer', 'like', '%10 idle minutes%')
        ->whereColumn('updated_at', 'created_at')
        ->update([
            'answer'     => Capsule::raw("REPLACE(answer, '10 idle minutes', '5 idle minutes')"),
            'updated_at' => Capsule::raw('updated_at'), // keep it "as seeded"
        ]);

    return [$n ? "updated {$n} help-centre answer(s) to say 5 idle minutes" : 'no seeded answers mention 10 idle minutes — skipped'];
};
