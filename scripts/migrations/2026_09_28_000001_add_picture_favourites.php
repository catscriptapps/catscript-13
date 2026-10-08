<?php
// /scripts/migrations/2026_09_28_000001_add_picture_favourites.php
//
// Additive change to the legacy catscript_db:
//
// pictures.is_favourite — the Pictures app's "favourite" star (favourites
// feed the gallery's featured carousel). NOT NULL DEFAULT 0, so existing
// rows are simply "not a favourite" and the legacy app, which never reads
// the column, is unaffected.

declare(strict_types=1);

use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Schema\Blueprint;

return function (): array {
    $schema = Capsule::schema();

    if ($schema->hasColumn('pictures', 'is_favourite')) {
        return ['pictures.is_favourite already exists — skipped'];
    }

    $schema->table('pictures', function (Blueprint $table) {
        $table->boolean('is_favourite')->default(false)->after('pic_caption');
    });

    return ['added pictures.is_favourite (default 0)'];
};
