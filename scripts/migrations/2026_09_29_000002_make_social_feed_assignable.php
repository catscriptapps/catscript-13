<?php
// /scripts/migrations/2026_09_29_000002_make_social_feed_assignable.php
//
// Social Feed becomes an assigned app (Users → App Access) instead of being
// open to everyone signed in. So that nobody loses it the day this ships,
// every existing account gets "Social Feed" added to users.permitted_apps —
// ONCE. After that, what the admin ticks is what people get, so this must
// never run again (it would re-grant it to anyone the admin has since
// unticked). Every migration runs on each DB Reset, so it records itself in
// `schema_flags` (a small additive table) and skips when the flag is set.
//
// Only adds an entry; never removes or reorders anything else in the list
// (the legacy app reads the same list, one name at a time).

declare(strict_types=1);

use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Schema\Blueprint;

return function (): array {
    $schema = Capsule::schema();
    $flag = 'social_feed_backfilled';
    $messages = [];

    if (!$schema->hasTable('schema_flags')) {
        $schema->create('schema_flags', function (Blueprint $table) {
            $table->string('name', 100)->primary();
            $table->timestamp('applied_at')->nullable();
        });
        $messages[] = 'created schema_flags';
    }

    if (Capsule::table('schema_flags')->where('name', $flag)->exists()) {
        return array_merge($messages, ['Social Feed was already given to existing accounts — skipped']);
    }

    $granted = 0;
    Capsule::connection()->transaction(function () use (&$granted, $flag) {
        foreach (Capsule::table('users')->select('id', 'permitted_apps')->get() as $row) {
            $apps = json_decode((string) ($row->permitted_apps ?? ''), true);
            $apps = is_array($apps) ? array_values($apps) : [];
            if (in_array('Social Feed', $apps, true)) {
                continue;
            }
            $apps[] = 'Social Feed';
            Capsule::table('users')->where('id', $row->id)->update(['permitted_apps' => json_encode($apps)]);
            $granted++;
        }
        Capsule::table('schema_flags')->insert(['name' => $flag, 'applied_at' => date('Y-m-d H:i:s')]);
    });

    $messages[] = "gave Social Feed to {$granted} existing " . ($granted === 1 ? 'account' : 'accounts') . ' (one time only)';
    return $messages;
};
