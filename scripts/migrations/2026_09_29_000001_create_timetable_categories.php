<?php
// /scripts/migrations/2026_09_29_000001_create_timetable_categories.php
//
// Additive changes to the legacy catscript_db for the rebuilt Timetable:
//
// 1. timetable_categories — the Timetable's categories (was a hard-coded
//    5-value ENUM on timetable_activities.category). Seeded once, when the
//    table is first created, with the built-in set; people can add more.
//    Each category names the legacy ENUM value (legacy_category) written
//    alongside it, so the legacy app keeps reading valid rows. The five
//    original categories carry their ENUM value as `slug`, which is how
//    existing rows (no category_id) are shown in their old category.
// 2. timetable_activities.category_id — nullable; existing rows are NOT
//    touched (they keep category_id NULL and are mapped through `slug`).
//
// The legacy `category` ENUM column is left exactly as it is.

declare(strict_types=1);

use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Schema\Blueprint;

return function (): array {
    $schema = Capsule::schema();
    $messages = [];

    if (!$schema->hasTable('timetable_categories')) {
        $schema->create('timetable_categories', function (Blueprint $table) {
            $table->increments('category_id');
            $table->string('slug', 40)->nullable()->unique();
            $table->string('name', 60);
            $table->string('color', 20);
            $table->string('legacy_category', 20)->default('routine');
            $table->unsignedInteger('sort_order')->default(0);
            $table->unsignedInteger('created_by')->nullable();
            $table->timestamps();
        });

        // [slug, name, colour, legacy ENUM value]
        $presets = [
            ['school', 'School', 'navy', 'school'],
            ['homework', 'Homework', 'indigo', 'school'],
            ['lessons', 'Lessons & tutoring', 'violet', 'school'],
            ['reading', 'Reading', 'orange', 'reading'],
            ['spiritual', 'Prayer & spiritual', 'amber', 'spiritual'],
            ['chores', 'Chores', 'teal', 'routine'],
            ['routine', 'Routine', 'sky', 'routine'],
            ['hygiene', 'Getting ready', 'cyan', 'routine'],
            ['meals', 'Meals', 'lime', 'routine'],
            ['sleep', 'Sleep & rest', 'purple', 'routine'],
            ['travel', 'Travel & school run', 'stone', 'routine'],
            ['appointments', 'Appointments', 'yellow', 'routine'],
            ['exercise', 'Sports & exercise', 'green', 'leisure'],
            ['outdoor', 'Outdoor play', 'emerald', 'leisure'],
            ['music', 'Music & arts', 'pink', 'leisure'],
            ['family', 'Family time', 'fuchsia', 'leisure'],
            ['screen', 'Screen time', 'rose', 'leisure'],
            ['leisure', 'Leisure', 'gray', 'leisure'],
        ];
        $now = date('Y-m-d H:i:s');
        foreach ($presets as $i => [$slug, $name, $color, $legacy]) {
            Capsule::table('timetable_categories')->insert([
                'slug' => $slug, 'name' => $name, 'color' => $color, 'legacy_category' => $legacy,
                'sort_order' => ($i + 1) * 10, 'created_at' => $now, 'updated_at' => $now,
            ]);
        }
        $messages[] = 'created timetable_categories with ' . count($presets) . ' built-in categories';
    } else {
        $messages[] = 'timetable_categories already exists — skipped';
    }

    if (!$schema->hasColumn('timetable_activities', 'category_id')) {
        $schema->table('timetable_activities', function (Blueprint $table) {
            $table->unsignedInteger('category_id')->nullable()->after('category')->index();
        });
        $messages[] = 'added timetable_activities.category_id (nullable; existing rows untouched)';
    } else {
        $messages[] = 'timetable_activities.category_id already exists — skipped';
    }

    return $messages;
};
