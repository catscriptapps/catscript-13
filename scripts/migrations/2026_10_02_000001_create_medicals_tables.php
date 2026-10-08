<?php
// /scripts/migrations/2026_10_02_000001_create_medicals_tables.php
//
// Medicals — the family's health in one place (MedicalsController). New
// tables only (legacy has no medical app and never reads them):
//
//   medical_people        who's being looked after (a child, a parent, Grandma…)
//   medical_providers     family doctor, dentist, clinic, pharmacy, specialist…
//   medical_appointments  booked / to-book / done / cancelled / missed visits
//   medical_medications   what each person takes, when, and when to refill
//   medical_doses         doses ticked off (one row per medication + date + time)
//   medical_records       vaccinations, check-ups, tests, conditions, allergies —
//                         with an optional "next due" that drives the
//                         "time to book" reminders
//
// Each table is created only if it's missing, so running this again is safe.

declare(strict_types=1);

use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Schema\Blueprint;

return function (): array {
    $schema = Capsule::schema();
    $log = [];

    $create = function (string $name, callable $define) use ($schema, &$log) {
        if ($schema->hasTable($name)) {
            $log[] = "{$name} already exists — skipped";
            return;
        }
        $schema->create($name, $define);
        $log[] = "created {$name}";
    };

    $create('medical_people', function (Blueprint $t) {
        $t->increments('id');
        $t->string('first_name', 100);
        $t->string('last_name', 100)->nullable();
        $t->date('date_of_birth')->nullable();
        $t->string('blood_type', 4)->nullable();
        $t->string('color', 20)->default('sky');
        $t->string('health_number', 60)->nullable();
        $t->text('allergies')->nullable();
        $t->text('conditions')->nullable();
        $t->text('notes')->nullable();
        $t->string('emergency_contact', 255)->nullable();
        $t->unsignedInteger('user_id')->nullable();
        $t->boolean('active')->default(true);
        $t->unsignedInteger('sort_order')->default(0);
        $t->unsignedInteger('orig_user_id')->nullable();
        $t->timestamps();
    });

    $create('medical_providers', function (Blueprint $t) {
        $t->increments('id');
        $t->string('name', 150);
        $t->string('kind', 20)->default('doctor');
        $t->string('specialty', 120)->nullable();
        $t->string('phone', 50)->nullable();
        $t->string('email', 150)->nullable();
        $t->string('address', 255)->nullable();
        $t->string('website', 255)->nullable();
        $t->text('notes')->nullable();
        $t->unsignedInteger('orig_user_id')->nullable();
        $t->timestamps();
    });

    $create('medical_appointments', function (Blueprint $t) {
        $t->increments('id');
        $t->unsignedInteger('person_id')->index();
        $t->unsignedInteger('provider_id')->nullable()->index();
        $t->string('title', 150);
        $t->string('kind', 20)->default('checkup');
        $t->string('status', 12)->default('booked')->index();
        $t->date('appt_date')->nullable()->index();   // null while "to book"
        $t->time('appt_time')->nullable();
        $t->unsignedSmallInteger('duration_min')->default(30);
        $t->string('location', 255)->nullable();
        $t->text('notes')->nullable();                // what to bring / ask
        $t->text('outcome')->nullable();              // what happened (after)
        $t->unsignedSmallInteger('remind_days')->default(1);
        $t->unsignedInteger('follow_up_of')->nullable();
        $t->unsignedInteger('orig_user_id')->nullable();
        $t->timestamps();
    });

    $create('medical_medications', function (Blueprint $t) {
        $t->increments('id');
        $t->unsignedInteger('person_id')->index();
        $t->string('name', 150);
        $t->string('dose', 100)->nullable();          // "5 ml", "1 tablet"
        $t->string('times', 100)->nullable();         // "08:00,20:00" — blank = as needed
        $t->string('instructions', 255)->nullable();  // "with food"
        $t->unsignedInteger('prescriber_id')->nullable();
        $t->unsignedInteger('pharmacy_id')->nullable();
        $t->date('start_date')->nullable();
        $t->date('end_date')->nullable();
        $t->date('refill_date')->nullable();
        $t->boolean('active')->default(true);
        $t->unsignedInteger('orig_user_id')->nullable();
        $t->timestamps();
    });

    $create('medical_doses', function (Blueprint $t) {
        $t->increments('id');
        $t->unsignedInteger('medication_id')->index();
        $t->date('dose_date')->index();
        $t->string('dose_time', 5);                   // a dose time "08:00" (as-needed: when it was given)
        $t->unsignedInteger('given_by')->nullable();
        $t->timestamps();
        $t->unique(['medication_id', 'dose_date', 'dose_time'], 'medical_doses_unique');
    });

    $create('medical_records', function (Blueprint $t) {
        $t->increments('id');
        $t->unsignedInteger('person_id')->index();
        $t->string('kind', 20)->default('checkup');
        $t->string('title', 150);
        $t->date('record_date')->nullable();
        $t->string('value', 150)->nullable();         // "120/80", "Negative", "Dose 2 of 3"
        $t->text('notes')->nullable();
        $t->unsignedInteger('provider_id')->nullable();
        $t->date('next_due')->nullable()->index();
        $t->unsignedInteger('orig_user_id')->nullable();
        $t->timestamps();
    });

    return $log;
};
