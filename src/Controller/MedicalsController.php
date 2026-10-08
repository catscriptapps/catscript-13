<?php
// /src/Controller/MedicalsController.php

declare(strict_types=1);

namespace Src\Controller;

use App\Models\MedicalAppointment;
use App\Models\MedicalDose;
use App\Models\MedicalMedication;
use App\Models\MedicalPerson;
use App\Models\MedicalProvider;
use App\Models\MedicalRecord;
use App\Models\User;
use App\Traits\RecentActivityLogger;
use Illuminate\Database\Capsule\Manager as Capsule;

/**
 * Medicals — the family's health in one place (new tables, migration
 * 2026_10_02_000001; legacy has no medical app):
 *
 *  - people: who's looked after, with date of birth, blood type, allergies,
 *    conditions, health card and an emergency contact;
 *  - providers: family doctor, dentist, pharmacy, specialists…;
 *  - appointments: "to book" (no date yet), booked, done (with what
 *    happened), cancelled or missed — each with a reminder lead time;
 *  - medications: dose and dose times, with today's doses ticked off
 *    (medical_doses) and refill / end dates;
 *  - records: vaccinations, check-ups, tests… with an optional "next due"
 *    that turns into a "time to book" reminder.
 *
 * Shared by everyone with Medicals access (like Tasks). Every write returns
 * the whole (small) state, so the page simply re-renders. Activity is logged
 * to recent_activities ("Medicals") in general terms only — never a
 * medication, condition or result — because the dashboard's feed is seen by
 * everyone.
 */
class MedicalsController
{
    use RecentActivityLogger;

    private const MAX_NAME = 150;
    private const MAX_TEXT = 5000;
    private const DOSE_DAYS = 14; // dose history sent to the page

    // ============================================================
    // Reads
    // ============================================================

    public static function state(): array
    {
        $people = MedicalPerson::where('active', true)->orderBy('sort_order')->orderBy('id')->get();
        $ids = $people->pluck('id')->all();

        return [
            'people'       => $people->map(fn(MedicalPerson $p) => self::presentPerson($p))->values()->all(),
            'providers'    => MedicalProvider::orderBy('name')->get()->map(fn(MedicalProvider $p) => self::presentProvider($p))->values()->all(),
            'appointments' => MedicalAppointment::whereIn('person_id', $ids)->orderBy('appt_date')->orderBy('appt_time')->orderBy('id')->get()
                ->map(fn(MedicalAppointment $a) => self::presentAppointment($a))->values()->all(),
            'medications'  => MedicalMedication::whereIn('person_id', $ids)->orderBy('name')->get()
                ->map(fn(MedicalMedication $m) => self::presentMedication($m))->values()->all(),
            'doses'        => MedicalDose::where('dose_date', '>=', date('Y-m-d', strtotime('-' . self::DOSE_DAYS . ' days')))->get()
                ->map(fn(MedicalDose $d) => ['medication_id' => (int) $d->medication_id, 'date' => $d->dose_date->format('Y-m-d'), 'time' => (string) $d->dose_time])
                ->values()->all(),
            'records'      => MedicalRecord::whereIn('person_id', $ids)->orderByDesc('record_date')->orderByDesc('id')->get()
                ->map(fn(MedicalRecord $r) => self::presentRecord($r))->values()->all(),
            'today'        => date('Y-m-d'),
        ] + self::lookups();
    }

    /** The fixed lists the page needs (also given to guests). */
    public static function lookups(): array
    {
        return [
            'provider_kinds' => MedicalProvider::KINDS,
            'appt_kinds'     => MedicalAppointment::KINDS,
            'statuses'       => MedicalAppointment::STATUSES,
            'remind_options' => MedicalAppointment::REMIND,
            'record_kinds'   => array_map(fn($k) => ['label' => $k[0], 'icon' => $k[1]], MedicalRecord::KINDS),
            'colors'         => MedicalPerson::COLORS,
            'blood_types'    => MedicalPerson::BLOOD_TYPES,
        ];
    }

    /** Accounts a person can be linked to (their own CatScript sign-in). */
    public static function accounts(): array
    {
        return User::orderBy('full_name')->get(['id', 'full_name'])
            ->map(fn($u) => ['id' => (int) $u->id, 'name' => (string) $u->full_name])->values()->all();
    }

    private static function lines(?string $text): array
    {
        return array_values(array_filter(array_map('trim', preg_split('/\r\n|\r|\n|,/', (string) $text) ?: [])));
    }

    public static function presentPerson(MedicalPerson $p): array
    {
        return [
            'id'                => (int) $p->id,
            'first_name'        => (string) $p->first_name,
            'last_name'         => (string) ($p->last_name ?? ''),
            'date_of_birth'     => $p->date_of_birth?->format('Y-m-d'),
            'blood_type'        => (string) ($p->blood_type ?? ''),
            'color'             => in_array($p->color, MedicalPerson::COLORS, true) ? $p->color : 'sky',
            'health_number'     => (string) ($p->health_number ?? ''),
            'allergies'         => self::lines($p->allergies),
            'conditions'        => self::lines($p->conditions),
            'notes'             => (string) ($p->notes ?? ''),
            'emergency_contact' => (string) ($p->emergency_contact ?? ''),
            'user_id'           => $p->user_id ? (int) $p->user_id : null,
        ];
    }

    public static function presentProvider(MedicalProvider $p): array
    {
        return [
            'id'        => (int) $p->id,
            'name'      => (string) $p->name,
            'kind'      => isset(MedicalProvider::KINDS[$p->kind]) ? $p->kind : 'other',
            'specialty' => (string) ($p->specialty ?? ''),
            'phone'     => (string) ($p->phone ?? ''),
            'email'     => (string) ($p->email ?? ''),
            'address'   => (string) ($p->address ?? ''),
            'website'   => (string) ($p->website ?? ''),
            'notes'     => (string) ($p->notes ?? ''),
        ];
    }

    public static function presentAppointment(MedicalAppointment $a): array
    {
        return [
            'id'           => (int) $a->id,
            'person_id'    => (int) $a->person_id,
            'provider_id'  => $a->provider_id ? (int) $a->provider_id : null,
            'title'        => (string) $a->title,
            'kind'         => isset(MedicalAppointment::KINDS[$a->kind]) ? $a->kind : 'other',
            'status'       => isset(MedicalAppointment::STATUSES[$a->status]) ? $a->status : 'booked',
            'date'         => $a->appt_date?->format('Y-m-d'),
            'time'         => $a->appt_time ? substr((string) $a->appt_time, 0, 5) : '',
            'duration'     => (int) $a->duration_min,
            'location'     => (string) ($a->location ?? ''),
            'notes'        => (string) ($a->notes ?? ''),
            'outcome'      => (string) ($a->outcome ?? ''),
            'remind_days'  => (int) $a->remind_days,
            'follow_up_of' => $a->follow_up_of ? (int) $a->follow_up_of : null,
        ];
    }

    public static function presentMedication(MedicalMedication $m): array
    {
        return [
            'id'            => (int) $m->id,
            'person_id'     => (int) $m->person_id,
            'name'          => (string) $m->name,
            'dose'          => (string) ($m->dose ?? ''),
            'times'         => $m->doseTimes(),
            'instructions'  => (string) ($m->instructions ?? ''),
            'prescriber_id' => $m->prescriber_id ? (int) $m->prescriber_id : null,
            'pharmacy_id'   => $m->pharmacy_id ? (int) $m->pharmacy_id : null,
            'start_date'    => $m->start_date?->format('Y-m-d'),
            'end_date'      => $m->end_date?->format('Y-m-d'),
            'refill_date'   => $m->refill_date?->format('Y-m-d'),
            'active'        => (bool) $m->active,
        ];
    }

    public static function presentRecord(MedicalRecord $r): array
    {
        return [
            'id'          => (int) $r->id,
            'person_id'   => (int) $r->person_id,
            'kind'        => isset(MedicalRecord::KINDS[$r->kind]) ? $r->kind : 'other',
            'title'       => (string) $r->title,
            'date'        => $r->record_date?->format('Y-m-d'),
            'value'       => (string) ($r->value ?? ''),
            'notes'       => (string) ($r->notes ?? ''),
            'provider_id' => $r->provider_id ? (int) $r->provider_id : null,
            'next_due'    => $r->next_due?->format('Y-m-d'),
        ];
    }

    // ============================================================
    // Validation helpers
    // ============================================================

    private static function date(mixed $v): ?string
    {
        $v = trim((string) ($v ?? ''));
        if ($v === '') {
            return null;
        }
        $d = \DateTime::createFromFormat('!Y-m-d', $v);
        return $d && $d->format('Y-m-d') === $v ? $v : 'invalid';
    }

    private static function time(mixed $v): ?string
    {
        $v = trim((string) ($v ?? ''));
        if ($v === '') {
            return null;
        }
        return preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $v) ? $v : 'invalid';
    }

    private static function text(mixed $v, int $max = self::MAX_TEXT): string
    {
        return mb_substr(trim((string) ($v ?? '')), 0, $max);
    }

    private static function person(int $id): ?MedicalPerson
    {
        return $id ? MedicalPerson::where('active', true)->find($id) : null;
    }

    private static function providerOk(?int $id): bool
    {
        return !$id || MedicalProvider::whereKey($id)->exists();
    }

    private static function fail(array|string $messages): array
    {
        return ['success' => false, 'messages' => (array) $messages];
    }

    private static function ok(string $message, array $extra = []): array
    {
        return ['success' => true, 'messages' => [$message]] + $extra + self::state();
    }

    // ============================================================
    // People
    // ============================================================

    public function savePerson(array $d, int $userId): array
    {
        try {
            $id = (int) ($d['id'] ?? 0);
            $first = self::text($d['first_name'] ?? '', 100);
            $dob = self::date($d['date_of_birth'] ?? '');
            $color = (string) ($d['color'] ?? 'sky');
            $blood = (string) ($d['blood_type'] ?? '');
            $linked = (int) ($d['user_id'] ?? 0) ?: null;

            $errors = [];
            if ($first === '') {
                $errors[] = 'Enter a first name.';
            }
            if ($dob === 'invalid') {
                $errors[] = 'Choose a valid date of birth (or leave it blank).';
            } elseif ($dob && $dob > date('Y-m-d')) {
                $errors[] = 'The date of birth can’t be in the future.';
            }
            if (!in_array($color, MedicalPerson::COLORS, true)) {
                $errors[] = 'Pick a colour.';
            }
            if ($blood !== '' && !in_array($blood, MedicalPerson::BLOOD_TYPES, true)) {
                $errors[] = 'Choose a blood type from the list.';
            }
            if ($linked && !User::find($linked)) {
                $errors[] = 'That account no longer exists.';
            }
            if ($errors) {
                return self::fail($errors);
            }

            $fields = [
                'first_name'        => $first,
                'last_name'         => self::text($d['last_name'] ?? '', 100) ?: null,
                'date_of_birth'     => $dob,
                'blood_type'        => $blood ?: null,
                'color'             => $color,
                'health_number'     => self::text($d['health_number'] ?? '', 60) ?: null,
                'allergies'         => self::text($d['allergies'] ?? '') ?: null,
                'conditions'        => self::text($d['conditions'] ?? '') ?: null,
                'notes'             => self::text($d['notes'] ?? '') ?: null,
                'emergency_contact' => self::text($d['emergency_contact'] ?? '', 255) ?: null,
                'user_id'           => $linked,
            ];

            if ($id) {
                $p = self::person($id);
                if (!$p) {
                    return self::fail('Not found.');
                }
                $p->fill($fields)->save();
                static::logActivity("Medicals: updated {$first}’s health profile", 'Medicals', $p->id);
            } else {
                $p = MedicalPerson::create($fields + ['active' => true, 'orig_user_id' => $userId, 'sort_order' => (int) MedicalPerson::max('sort_order') + 10]);
                static::logActivity("Medicals: added {$first} to the family", 'Medicals', $p->id);
            }
            return self::ok($id ? 'Saved.' : "{$first} added.", ['saved' => (int) $p->id]);
        } catch (\Throwable $e) {
            return self::fail('Could not save: ' . $e->getMessage());
        }
    }

    /** Take someone off Medicals (kept for history — their appointments etc. stay in the database). */
    public function removePerson(int $id): array
    {
        $p = self::person($id);
        if (!$p) {
            return self::fail('Not found.');
        }
        $p->active = false;
        $p->save();
        static::logActivity("Medicals: removed {$p->first_name}", 'Medicals', $id);
        return self::ok("{$p->first_name} has been removed from Medicals.");
    }

    // ============================================================
    // Providers
    // ============================================================

    public function saveProvider(array $d, int $userId): array
    {
        try {
            $id = (int) ($d['id'] ?? 0);
            $name = self::text($d['name'] ?? '', self::MAX_NAME);
            $kind = (string) ($d['kind'] ?? 'doctor');
            $email = self::text($d['email'] ?? '', 150);
            $errors = [];
            if ($name === '') {
                $errors[] = 'Enter the name of the doctor, clinic or pharmacy.';
            }
            if (!isset(MedicalProvider::KINDS[$kind])) {
                $errors[] = 'Choose what kind of provider this is.';
            }
            if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $errors[] = 'That email address doesn’t look right.';
            }
            if ($errors) {
                return self::fail($errors);
            }
            $fields = [
                'name'      => $name,
                'kind'      => $kind,
                'specialty' => self::text($d['specialty'] ?? '', 120) ?: null,
                'phone'     => self::text($d['phone'] ?? '', 50) ?: null,
                'email'     => $email ?: null,
                'address'   => self::text($d['address'] ?? '', 255) ?: null,
                'website'   => self::text($d['website'] ?? '', 255) ?: null,
                'notes'     => self::text($d['notes'] ?? '') ?: null,
            ];
            if ($id) {
                $p = MedicalProvider::find($id);
                if (!$p) {
                    return self::fail('Not found.');
                }
                $p->fill($fields)->save();
            } else {
                $p = MedicalProvider::create($fields + ['orig_user_id' => $userId]);
            }
            static::logActivity(($id ? 'Medicals: updated provider ' : 'Medicals: added provider ') . $name, 'Medicals', $p->id);
            return self::ok($id ? 'Saved.' : "{$name} added.", ['saved' => (int) $p->id]);
        } catch (\Throwable $e) {
            return self::fail('Could not save: ' . $e->getMessage());
        }
    }

    /** Delete a provider — anything that pointed at them simply loses the link. */
    public function deleteProvider(int $id): array
    {
        $p = MedicalProvider::find($id);
        if (!$p) {
            return self::fail('Not found.');
        }
        Capsule::connection()->transaction(function () use ($id, $p) {
            MedicalAppointment::where('provider_id', $id)->update(['provider_id' => null]);
            MedicalRecord::where('provider_id', $id)->update(['provider_id' => null]);
            MedicalMedication::where('prescriber_id', $id)->update(['prescriber_id' => null]);
            MedicalMedication::where('pharmacy_id', $id)->update(['pharmacy_id' => null]);
            $p->delete();
        });
        static::logActivity("Medicals: removed provider {$p->name}", 'Medicals', $id);
        return self::ok("“{$p->name}” deleted.");
    }

    // ============================================================
    // Appointments
    // ============================================================

    public function saveAppointment(array $d, int $userId): array
    {
        try {
            $id = (int) ($d['id'] ?? 0);
            $person = self::person((int) ($d['person_id'] ?? 0));
            $title = self::text($d['title'] ?? '', self::MAX_NAME);
            $kind = (string) ($d['kind'] ?? 'checkup');
            $status = (string) ($d['status'] ?? 'booked');
            $date = self::date($d['date'] ?? '');
            $time = self::time($d['time'] ?? '');
            $duration = (int) ($d['duration'] ?? 30);
            $remind = (int) ($d['remind_days'] ?? 1);
            $provider = (int) ($d['provider_id'] ?? 0) ?: null;

            $errors = [];
            if (!$person) {
                $errors[] = 'Choose who the appointment is for.';
            }
            if ($title === '') {
                $errors[] = 'Say what the appointment is for (e.g. “Dental cleaning”).';
            }
            if (!isset(MedicalAppointment::KINDS[$kind])) {
                $errors[] = 'Choose the type of appointment.';
            }
            if (!isset(MedicalAppointment::STATUSES[$status])) {
                $errors[] = 'Choose a status.';
            }
            if ($date === 'invalid') {
                $errors[] = 'Choose a valid date.';
            } elseif (!$date && $status !== 'to_book') {
                $errors[] = 'Choose the date — or set the status to “To book” if it isn’t booked yet.';
            }
            if ($time === 'invalid') {
                $errors[] = 'Choose a valid time (or leave it blank).';
            }
            if ($duration < 5 || $duration > 600) {
                $errors[] = 'The length must be between 5 minutes and 10 hours.';
            }
            if (!in_array($remind, MedicalAppointment::REMIND, true)) {
                $errors[] = 'Choose when to be reminded.';
            }
            if (!self::providerOk($provider)) {
                $errors[] = 'That provider no longer exists.';
            }
            if ($errors) {
                return self::fail($errors);
            }

            $fields = [
                'person_id'    => (int) $person->id,
                'provider_id'  => $provider,
                'title'        => $title,
                'kind'         => $kind,
                'status'       => $status,
                'appt_date'    => $date,
                'appt_time'    => $time,
                'duration_min' => $duration,
                'location'     => self::text($d['location'] ?? '', 255) ?: null,
                'notes'        => self::text($d['notes'] ?? '') ?: null,
                'outcome'      => self::text($d['outcome'] ?? '') ?: null,
                'remind_days'  => $remind,
                'follow_up_of' => (int) ($d['follow_up_of'] ?? 0) ?: null,
            ];

            if ($id) {
                $a = MedicalAppointment::find($id);
                if (!$a) {
                    return self::fail('Appointment not found.');
                }
                $a->fill($fields)->save();
                static::logActivity("Medicals: updated an appointment for {$person->first_name}", 'Medicals', $a->id);
            } else {
                $a = MedicalAppointment::create($fields + ['orig_user_id' => $userId]);
                static::logActivity($status === 'to_book'
                    ? "Medicals: noted an appointment to book for {$person->first_name}"
                    : "Medicals: booked an appointment for {$person->first_name}", 'Medicals', $a->id);
            }
            return self::ok($id ? 'Appointment saved.' : ($status === 'to_book' ? 'Added to “To book”.' : 'Appointment booked.'), ['saved' => (int) $a->id]);
        } catch (\Throwable $e) {
            return self::fail('Could not save the appointment: ' . $e->getMessage());
        }
    }

    /** Done / cancelled / missed / booked again — with what happened, when done. */
    public function setAppointmentStatus(int $id, string $status, ?string $outcome): array
    {
        $a = MedicalAppointment::find($id);
        if (!$a || !isset(MedicalAppointment::STATUSES[$status])) {
            return self::fail('Appointment or status not found.');
        }
        if ($status !== 'to_book' && !$a->appt_date) {
            return self::fail('Give the appointment a date first (Edit).');
        }
        if (in_array($status, ['done', 'missed'], true) && $a->appt_date->format('Y-m-d') > date('Y-m-d')) {
            return self::fail('That appointment hasn’t happened yet — you can mark it once the day comes (or Cancel it).');
        }
        $a->status = $status;
        if ($outcome !== null) {
            $a->outcome = self::text($outcome) ?: null;
        }
        $a->save();
        $who = MedicalPerson::find($a->person_id)?->first_name ?? 'someone';
        static::logActivity("Medicals: marked {$who}’s appointment " . strtolower(MedicalAppointment::STATUSES[$status]), 'Medicals', $id);
        return self::ok('Marked ' . strtolower(MedicalAppointment::STATUSES[$status]) . '.');
    }

    public function deleteAppointment(int $id): array
    {
        $a = MedicalAppointment::find($id);
        if (!$a) {
            return self::fail('Appointment not found.');
        }
        MedicalAppointment::where('follow_up_of', $id)->update(['follow_up_of' => null]);
        $a->delete();
        static::logActivity('Medicals: deleted an appointment', 'Medicals', $id);
        return self::ok('Appointment deleted.');
    }

    // ============================================================
    // Medications & doses
    // ============================================================

    public function saveMedication(array $d, int $userId): array
    {
        try {
            $id = (int) ($d['id'] ?? 0);
            $person = self::person((int) ($d['person_id'] ?? 0));
            $name = self::text($d['name'] ?? '', self::MAX_NAME);
            $times = array_values(array_unique(array_filter(array_map('trim', (array) ($d['times'] ?? [])))));
            $start = self::date($d['start_date'] ?? '');
            $end = self::date($d['end_date'] ?? '');
            $refill = self::date($d['refill_date'] ?? '');
            $prescriber = (int) ($d['prescriber_id'] ?? 0) ?: null;
            $pharmacy = (int) ($d['pharmacy_id'] ?? 0) ?: null;

            $errors = [];
            if (!$person) {
                $errors[] = 'Choose who takes it.';
            }
            if ($name === '') {
                $errors[] = 'Enter the medication’s name.';
            }
            foreach ($times as $t) {
                if (self::time($t) === 'invalid') {
                    $errors[] = "“{$t}” isn’t a valid dose time.";
                }
            }
            if (count($times) > 8) {
                $errors[] = 'Up to 8 dose times a day.';
            }
            foreach (['start' => $start, 'end' => $end, 'refill' => $refill] as $label => $v) {
                if ($v === 'invalid') {
                    $errors[] = "Choose a valid {$label} date (or leave it blank).";
                }
            }
            if ($start && $end && $start !== 'invalid' && $end !== 'invalid' && $end < $start) {
                $errors[] = 'The end date must be after the start date.';
            }
            if (!self::providerOk($prescriber) || !self::providerOk($pharmacy)) {
                $errors[] = 'That provider no longer exists.';
            }
            if ($errors) {
                return self::fail($errors);
            }
            sort($times);

            $fields = [
                'person_id'     => (int) $person->id,
                'name'          => $name,
                'dose'          => self::text($d['dose'] ?? '', 100) ?: null,
                'times'         => $times ? implode(',', $times) : null,
                'instructions'  => self::text($d['instructions'] ?? '', 255) ?: null,
                'prescriber_id' => $prescriber,
                'pharmacy_id'   => $pharmacy,
                'start_date'    => $start,
                'end_date'      => $end,
                'refill_date'   => $refill,
                'active'        => filter_var($d['active'] ?? true, FILTER_VALIDATE_BOOLEAN),
            ];
            if ($id) {
                $m = MedicalMedication::find($id);
                if (!$m) {
                    return self::fail('Medication not found.');
                }
                $m->fill($fields)->save();
            } else {
                $m = MedicalMedication::create($fields + ['orig_user_id' => $userId]);
            }
            static::logActivity("Medicals: updated {$person->first_name}’s medications", 'Medicals', $m->id);
            return self::ok($id ? 'Medication saved.' : 'Medication added.', ['saved' => (int) $m->id]);
        } catch (\Throwable $e) {
            return self::fail('Could not save the medication: ' . $e->getMessage());
        }
    }

    public function deleteMedication(int $id): array
    {
        $m = MedicalMedication::find($id);
        if (!$m) {
            return self::fail('Medication not found.');
        }
        Capsule::connection()->transaction(function () use ($m) {
            MedicalDose::where('medication_id', $m->id)->delete();
            $m->delete();
        });
        $who = MedicalPerson::find($m->person_id)?->first_name ?? 'someone';
        static::logActivity("Medicals: updated {$who}’s medications", 'Medicals', $id);
        return self::ok('Medication removed.');
    }

    /** Tick (or untick) one dose: today or the two days before. */
    public function toggleDose(int $medicationId, string $date, string $time, int $userId): array
    {
        $m = MedicalMedication::find($medicationId);
        if (!$m || !self::person((int) $m->person_id)) {
            return self::fail('Medication not found.');
        }
        if (self::date($date) === 'invalid' || $date > date('Y-m-d') || $date < date('Y-m-d', strtotime('-2 days'))) {
            return self::fail('Doses can be ticked off for today and the two days before.');
        }
        // Scheduled medications: one of their dose times. "As needed" ones
        // (no dose times): the time it was given, so it can be several a day.
        $scheduled = $m->doseTimes();
        if ($scheduled ? !in_array($time, $scheduled, true) : self::time($time) === null || self::time($time) === 'invalid') {
            return self::fail($scheduled ? 'That isn’t one of its dose times.' : 'Give the time the dose was taken.');
        }
        $existing = MedicalDose::where(['medication_id' => $m->id, 'dose_date' => $date, 'dose_time' => $time])->first();
        if ($existing) {
            $existing->delete();
            return ['success' => true, 'given' => false];
        }
        MedicalDose::create(['medication_id' => $m->id, 'dose_date' => $date, 'dose_time' => $time, 'given_by' => $userId]);
        return ['success' => true, 'given' => true];
    }

    // ============================================================
    // Records
    // ============================================================

    public function saveRecord(array $d, int $userId): array
    {
        try {
            $id = (int) ($d['id'] ?? 0);
            $person = self::person((int) ($d['person_id'] ?? 0));
            $kind = (string) ($d['kind'] ?? 'checkup');
            $title = self::text($d['title'] ?? '', self::MAX_NAME);
            $date = self::date($d['date'] ?? '');
            $due = self::date($d['next_due'] ?? '');
            $provider = (int) ($d['provider_id'] ?? 0) ?: null;

            $errors = [];
            if (!$person) {
                $errors[] = 'Choose who it’s for.';
            }
            if (!isset(MedicalRecord::KINDS[$kind])) {
                $errors[] = 'Choose the type of record.';
            }
            if ($title === '') {
                $errors[] = 'Give it a title (e.g. “Flu shot” or “Blood test”).';
            }
            if ($date === 'invalid') {
                $errors[] = 'Choose a valid date (or leave it blank).';
            }
            if ($due === 'invalid') {
                $errors[] = 'Choose a valid “next due” date (or leave it blank).';
            }
            if (!self::providerOk($provider)) {
                $errors[] = 'That provider no longer exists.';
            }
            if ($errors) {
                return self::fail($errors);
            }
            $fields = [
                'person_id'   => (int) $person->id,
                'kind'        => $kind,
                'title'       => $title,
                'record_date' => $date,
                'value'       => self::text($d['value'] ?? '', 150) ?: null,
                'notes'       => self::text($d['notes'] ?? '') ?: null,
                'provider_id' => $provider,
                'next_due'    => $due,
            ];
            if ($id) {
                $r = MedicalRecord::find($id);
                if (!$r) {
                    return self::fail('Record not found.');
                }
                $r->fill($fields)->save();
            } else {
                $r = MedicalRecord::create($fields + ['orig_user_id' => $userId]);
            }
            static::logActivity("Medicals: updated {$person->first_name}’s health records", 'Medicals', $r->id);
            return self::ok($id ? 'Record saved.' : 'Record added.', ['saved' => (int) $r->id]);
        } catch (\Throwable $e) {
            return self::fail('Could not save the record: ' . $e->getMessage());
        }
    }

    public function deleteRecord(int $id): array
    {
        $r = MedicalRecord::find($id);
        if (!$r) {
            return self::fail('Record not found.');
        }
        $who = MedicalPerson::find($r->person_id)?->first_name ?? 'someone';
        $r->delete();
        static::logActivity("Medicals: updated {$who}’s health records", 'Medicals', $id);
        return self::ok('Record deleted.');
    }
}
