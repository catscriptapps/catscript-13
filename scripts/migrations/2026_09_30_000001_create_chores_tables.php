<?php
// /scripts/migrations/2026_09_30_000001_create_chores_tables.php
//
// The rebuilt Chores tracker — additive only. The legacy chore tables
// (children, chores, chore_assignments, chore_schedules) are READ once to
// seed the new ones and are never written to:
//
//   chore_children    — the boys who share the chores (seeded from `children`)
//   chore_library     — every possible chore, with room/area, minutes and best
//                       time of day (seeded from legacy `chores` + many more)
//   chore_plan        — who does which chore in which Timetable chore slot.
//                       A slot is identified by day + start time, so it
//                       survives the Timetable's copy / replace (new row ids).
//   chore_done        — ticks: a planned chore done on a given date.
//
// Seeding happens only when a table is first created, so running this again
// (every DB Reset) never duplicates or overwrites anything.

declare(strict_types=1);

use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Schema\Blueprint;

return function (): array {
    $schema = Capsule::schema();
    $now = date('Y-m-d H:i:s');
    $messages = [];

    // --- Children ----------------------------------------------------------
    if (!$schema->hasTable('chore_children')) {
        $schema->create('chore_children', function (Blueprint $table) {
            $table->increments('id');
            $table->string('first_name', 100);
            $table->string('last_name', 100)->default('');
            $table->string('color', 20)->default('orange');
            $table->unsignedInteger('user_id')->nullable()->index(); // optional: their CatScript account
            $table->unsignedInteger('legacy_child_id')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        $palette = ['orange', 'sky', 'emerald', 'violet', 'rose', 'amber', 'teal', 'indigo'];
        $legacy = $schema->hasTable('children')
            ? Capsule::table('children')->where('status_id', 1)->orderBy('child_id')->get()
            : collect();
        foreach ($legacy->values() as $i => $c) {
            Capsule::table('chore_children')->insert([
                'first_name' => trim((string) $c->first_name), 'last_name' => trim((string) $c->last_name),
                'color' => $palette[$i % count($palette)], 'legacy_child_id' => (int) $c->child_id,
                'sort_order' => ($i + 1) * 10, 'created_at' => $now, 'updated_at' => $now,
            ]);
        }
        $messages[] = 'created chore_children (' . $legacy->count() . ' copied from the legacy children table)';
    } else {
        $messages[] = 'chore_children already exists — skipped';
    }

    // --- Library -----------------------------------------------------------
    if (!$schema->hasTable('chore_library')) {
        $schema->create('chore_library', function (Blueprint $table) {
            $table->increments('id');
            $table->string('title', 150);
            $table->string('area', 40)->default('general');
            $table->unsignedSmallInteger('minutes')->default(10);
            $table->string('best_time', 12)->default('any'); // morning | afternoon | evening | any
            $table->text('detail')->nullable();
            $table->unsignedInteger('legacy_chore_id')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        // [title, area, minutes, best time] — legacy titles are matched below
        $library = [
            // Kitchen
            ['Unload the dishwasher', 'kitchen', 10, 'morning'], ['Load the dishwasher', 'kitchen', 10, 'evening'],
            ['Put Washed Dishes Away', 'kitchen', 10, 'any'], ['Wipe kitchen counters', 'kitchen', 5, 'evening'],
            ['Clean the stovetop', 'kitchen', 10, 'evening'], ['Sweep Kitchen', 'kitchen', 10, 'any'],
            ['Mop the kitchen floor', 'kitchen', 15, 'any'], ['Wipe the microwave', 'kitchen', 5, 'any'],
            ['Wipe the fridge door & handles', 'kitchen', 5, 'any'], ['Wash lunch boxes', 'kitchen', 10, 'afternoon'],
            ['Pack lunch boxes', 'kitchen', 10, 'evening'], ['Refill water bottles', 'kitchen', 5, 'morning'],
            // Dining
            ['Sweep Dining Room', 'dining', 10, 'any'], ['Set the table', 'dining', 5, 'evening'],
            ['Clear the table', 'dining', 5, 'evening'], ['Clean The Table Surfaces', 'dining', 5, 'any'],
            // Bedroom
            ['Make Bed', 'bedroom', 5, 'morning'], ['Clean Room', 'bedroom', 15, 'any'],
            ['Put away clean clothes', 'bedroom', 10, 'any'], ['Dirty clothes in the hamper', 'bedroom', 5, 'evening'],
            ['Tidy desk', 'bedroom', 10, 'afternoon'], ['Change bedsheets', 'bedroom', 15, 'any'],
            ['Organize Books', 'bedroom', 10, 'any'], ['Organize the closet', 'bedroom', 20, 'any'],
            // Bathroom
            ["Clean Boys' Washroom", 'bathroom', 20, 'any'], ['Wipe the sink & mirror', 'bathroom', 5, 'morning'],
            ['Scrub the toilet', 'bathroom', 10, 'any'], ['Clean the bathtub & shower', 'bathroom', 15, 'any'],
            ['Hang up & replace towels', 'bathroom', 5, 'morning'], ['Refill toilet paper & soap', 'bathroom', 5, 'any'],
            // Living room
            ['Arrange Living Room Pillows', 'living', 5, 'any'], ['Vacuum the living room', 'living', 15, 'any'],
            ['Dust shelves & TV stand', 'living', 10, 'any'], ['Tidy toys & games', 'living', 10, 'evening'],
            ['Fold the blankets', 'living', 5, 'morning'],
            // Floors, walls & surfaces
            ['Vacuum Floors', 'floors', 20, 'any'], ['Mop Floors', 'floors', 20, 'any'],
            ['Wipe Walls', 'floors', 15, 'any'], ['Clean Stairs', 'floors', 15, 'any'],
            ['Clean Surfaces', 'floors', 10, 'any'], ['Wipe light switches & door handles', 'floors', 5, 'any'],
            // Laundry
            ['Sort the laundry', 'laundry', 10, 'any'], ['Start a load of washing', 'laundry', 5, 'morning'],
            ['Move laundry to the dryer', 'laundry', 5, 'any'], ['Fold laundry', 'laundry', 15, 'any'],
            ['Match socks', 'laundry', 10, 'any'], ['Hang up jackets & bags', 'laundry', 5, 'afternoon'],
            // Garbage & recycling
            ['Take Out Trash', 'garbage', 5, 'evening'], ['Take Out Recycles', 'garbage', 5, 'evening'],
            ['Take Out Composts', 'garbage', 5, 'evening'], ['Empty the small bins', 'garbage', 5, 'any'],
            ['Bins to the curb', 'garbage', 5, 'evening'], ['Bring the bins back in', 'garbage', 5, 'afternoon'],
            // Outdoors
            ['Sweep the porch & steps', 'outdoors', 10, 'any'], ['Water the plants', 'outdoors', 5, 'morning'],
            ['Rake leaves', 'outdoors', 20, 'afternoon'], ['Shovel snow', 'outdoors', 20, 'morning'],
            ['Pull weeds', 'outdoors', 15, 'afternoon'], ['Bring in the mail & parcels', 'outdoors', 5, 'afternoon'],
            ['Tidy the shoes at the door', 'outdoors', 5, 'any'],
            // Pets
            ['Feed the pet', 'pets', 5, 'morning'], ["Refill the pet's water", 'pets', 5, 'any'],
            ['Walk the dog', 'pets', 20, 'afternoon'], ['Clean the litter box or cage', 'pets', 10, 'any'],
            // Car
            ['Clean out the car', 'car', 10, 'afternoon'], ['Wash the car', 'car', 30, 'afternoon'],
            // General
            ['Pack school bag for tomorrow', 'general', 5, 'evening'], ['Charge devices & tidy chargers', 'general', 5, 'evening'],
        ];

        // Legacy chores (matched by title, case-insensitively) keep their id for reference;
        // any legacy chore not in the list above is added as-is.
        $legacy = $schema->hasTable('chores')
            ? Capsule::table('chores')->orderBy('chore_id')->get()->keyBy(fn($c) => mb_strtolower(trim((string) $c->chore_title)))
            : collect();
        $used = [];
        foreach ($library as [$title, $area, $minutes, $when]) {
            $key = mb_strtolower($title);
            $old = $legacy->get($key);
            $used[$key] = true;
            Capsule::table('chore_library')->insert([
                'title' => $title, 'area' => $area, 'minutes' => $minutes, 'best_time' => $when,
                'detail' => $old->chore_detail ?? null, 'legacy_chore_id' => $old ? (int) $old->chore_id : null,
                'active' => $old ? (int) $old->status_id === 1 : true, 'created_at' => $now, 'updated_at' => $now,
            ]);
        }
        $extra = 0;
        foreach ($legacy as $key => $old) {
            if (isset($used[$key])) {
                continue;
            }
            Capsule::table('chore_library')->insert([
                'title' => trim((string) $old->chore_title), 'area' => 'general', 'minutes' => 10, 'best_time' => 'any',
                'detail' => $old->chore_detail, 'legacy_chore_id' => (int) $old->chore_id,
                'active' => (int) $old->status_id === 1, 'created_at' => $now, 'updated_at' => $now,
            ]);
            $extra++;
        }
        $messages[] = 'created chore_library with ' . (count($library) + $extra) . ' chores (' . $legacy->count() . ' from the legacy list)';
    } else {
        $messages[] = 'chore_library already exists — skipped';
    }

    // Personal chores: every child does their own (make bed, tidy room, …),
    // as opposed to shared chores one child does for the house.
    if (!$schema->hasColumn('chore_library', 'per_child')) {
        $schema->table('chore_library', function (Blueprint $table) {
            $table->boolean('per_child')->default(false)->after('best_time');
        });
        $personal = ['make bed', 'clean room', 'put away clean clothes', 'dirty clothes in the hamper', 'tidy desk',
            'change bedsheets', 'organize the closet', 'hang up jackets & bags', 'pack school bag for tomorrow',
            'charge devices & tidy chargers', 'refill water bottles'];
        $n = Capsule::table('chore_library')->whereIn(Capsule::raw('LOWER(title)'), $personal)->update(['per_child' => true]);
        $messages[] = "added chore_library.per_child ({$n} personal chores marked)";
    }

    // --- Plan & ticks ------------------------------------------------------
    if (!$schema->hasTable('chore_plan')) {
        $schema->create('chore_plan', function (Blueprint $table) {
            $table->increments('id');
            $table->string('day_of_week', 10);
            $table->string('slot_start', 5); // HH:MM — the Timetable chore slot's start
            $table->unsignedInteger('child_id')->index();
            $table->unsignedInteger('chore_id')->index();
            $table->unsignedInteger('created_by')->nullable();
            $table->timestamps();
            $table->unique(['day_of_week', 'slot_start', 'child_id', 'chore_id'], 'chore_plan_unique');
        });
        $messages[] = 'created chore_plan';
    } else {
        $messages[] = 'chore_plan already exists — skipped';
    }

    if (!$schema->hasTable('chore_done')) {
        $schema->create('chore_done', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('plan_id')->index();
            $table->date('done_on')->index();
            $table->unsignedInteger('ticked_by')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->unique(['plan_id', 'done_on'], 'chore_done_unique');
        });
        $messages[] = 'created chore_done';
    } else {
        $messages[] = 'chore_done already exists — skipped';
    }

    return $messages;
};
