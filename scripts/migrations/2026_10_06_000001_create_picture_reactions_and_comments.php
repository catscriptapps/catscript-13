<?php
// /scripts/migrations/2026_10_06_000001_create_picture_reactions_and_comments.php
//
// Pictures — emoji reactions and comments on each photo (PicturesController).
// New tables only; the legacy `pictures` table is untouched and the legacy
// app never reads these:
//
//   picture_reactions  one row per picture + user + emoji (toggled on / off)
//   picture_comments   notes written on a picture, oldest first
//
// picture_id points at pictures.picture_id. Deleting a picture in the app
// deletes its reactions and comments too.
//
// Each table is created only if it's missing, so running this again is safe.

declare(strict_types=1);

use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Schema\Blueprint;

return function (): array {
    $schema = Capsule::schema();
    $log = [];

    if ($schema->hasTable('picture_reactions')) {
        $log[] = 'picture_reactions already exists — skipped';
    } else {
        $schema->create('picture_reactions', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('picture_id');
            $t->unsignedInteger('user_id');
            // Binary collation: utf8mb4_unicode_ci weighs every emoji the
            // same, so 😍 would "equal" 🔥 (and clash on the unique key)
            $t->string('emoji', 32)->charset('utf8mb4')->collation('utf8mb4_bin');
            $t->timestamp('created_at')->nullable();
            $t->unique(['picture_id', 'user_id', 'emoji']);
            $t->index('picture_id');
        });
        $log[] = 'created picture_reactions';
    }

    if ($schema->hasTable('picture_comments')) {
        $log[] = 'picture_comments already exists — skipped';
    } else {
        $schema->create('picture_comments', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('picture_id');
            $t->unsignedInteger('user_id');
            $t->text('body');
            $t->timestamps();
            $t->index('picture_id');
        });
        $log[] = 'created picture_comments';
    }

    return $log;
};
