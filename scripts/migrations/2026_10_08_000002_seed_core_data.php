<?php
// /scripts/migrations/2026_10_08_000002_seed_core_data.php
//
// Reference data the core app can't run without — each part only fills a
// table that's still empty, so re-running never duplicates or overwrites:
//
// 1. users_types: 1 = Admin, 2 = User.
// 2. countries + regions: Canada (provinces / territories) and the United
//    States (states) — the location pickers in the user and profile forms.
// 3. chat_ai_settings: the single settings row (AI autorespond off).
// 4. The first admin account (user #1 — the only account that sees the
//    header DB Reset button), from .env:
//      ADMIN_NAME      optional, defaults to "Administrator"
//      ADMIN_EMAIL     required
//      ADMIN_PASSWORD  optional — if blank, a random one is generated and
//                      shown once in this log; sign in and change it.
//    Skipped (with a note) if the users table already has anyone in it.

declare(strict_types=1);

use Illuminate\Database\Capsule\Manager as Capsule;

return function (): array {
    $log = [];
    $now = date('Y-m-d H:i:s');

    // --- 1. Roles ---------------------------------------------------------
    if (Capsule::table('users_types')->exists()) {
        $log[] = 'users_types already has roles — skipped';
    } else {
        Capsule::table('users_types')->insert([
            ['user_type_id' => 1, 'user_type' => 'Admin'],
            ['user_type_id' => 2, 'user_type' => 'User'],
        ]);
        $log[] = 'added roles: 1 = Admin, 2 = User';
    }

    // --- 2. Countries & regions --------------------------------------------
    if (Capsule::table('countries')->exists()) {
        $log[] = 'countries already filled — skipped';
    } else {
        Capsule::table('countries')->insert([
            ['country_id' => 1, 'country' => 'Canada', 'created_at' => $now, 'updated_at' => $now],
            ['country_id' => 2, 'country' => 'United States', 'created_at' => $now, 'updated_at' => $now],
        ]);
        $log[] = 'added 2 countries (Canada, United States)';
    }

    if (Capsule::table('regions')->exists()) {
        $log[] = 'regions already filled — skipped';
    } else {
        $regions = [
            1 => [
                'AB' => 'Alberta', 'BC' => 'British Columbia', 'MB' => 'Manitoba', 'NB' => 'New Brunswick',
                'NL' => 'Newfoundland and Labrador', 'NS' => 'Nova Scotia', 'ON' => 'Ontario',
                'PE' => 'Prince Edward Island', 'QC' => 'Quebec', 'SK' => 'Saskatchewan',
                'NT' => 'Northwest Territories', 'NU' => 'Nunavut', 'YT' => 'Yukon',
            ],
            2 => [
                'AL' => 'Alabama', 'AK' => 'Alaska', 'AZ' => 'Arizona', 'AR' => 'Arkansas', 'CA' => 'California',
                'CO' => 'Colorado', 'CT' => 'Connecticut', 'DE' => 'Delaware', 'FL' => 'Florida', 'GA' => 'Georgia',
                'HI' => 'Hawaii', 'ID' => 'Idaho', 'IL' => 'Illinois', 'IN' => 'Indiana', 'IA' => 'Iowa',
                'KS' => 'Kansas', 'KY' => 'Kentucky', 'LA' => 'Louisiana', 'ME' => 'Maine', 'MD' => 'Maryland',
                'MA' => 'Massachusetts', 'MI' => 'Michigan', 'MN' => 'Minnesota', 'MS' => 'Mississippi',
                'MO' => 'Missouri', 'MT' => 'Montana', 'NE' => 'Nebraska', 'NV' => 'Nevada', 'NH' => 'New Hampshire',
                'NJ' => 'New Jersey', 'NM' => 'New Mexico', 'NY' => 'New York', 'NC' => 'North Carolina',
                'ND' => 'North Dakota', 'OH' => 'Ohio', 'OK' => 'Oklahoma', 'OR' => 'Oregon', 'PA' => 'Pennsylvania',
                'RI' => 'Rhode Island', 'SC' => 'South Carolina', 'SD' => 'South Dakota', 'TN' => 'Tennessee',
                'TX' => 'Texas', 'UT' => 'Utah', 'VT' => 'Vermont', 'VA' => 'Virginia', 'WA' => 'Washington',
                'WV' => 'West Virginia', 'WI' => 'Wisconsin', 'WY' => 'Wyoming',
            ],
        ];
        $rows = [];
        foreach ($regions as $countryId => $list) {
            foreach ($list as $code => $name) {
                $rows[] = ['region' => $name, 'region_code' => $code, 'country_id' => $countryId, 'created_at' => $now, 'updated_at' => $now];
            }
        }
        Capsule::table('regions')->insert($rows);
        $log[] = 'added ' . count($rows) . ' regions';
    }

    // --- 3. Live chat AI settings ------------------------------------------
    if (Capsule::table('chat_ai_settings')->exists()) {
        $log[] = 'chat_ai_settings already set — skipped';
    } else {
        Capsule::table('chat_ai_settings')->insert(['enabled' => false, 'instructions' => '', 'created_at' => $now, 'updated_at' => $now]);
        $log[] = 'added live chat AI settings (autorespond off)';
    }

    // --- 4. First admin ----------------------------------------------------
    if (Capsule::table('users')->exists()) {
        $log[] = 'users already has accounts — admin not created';
        return $log;
    }

    $email = trim((string) ($_ENV['ADMIN_EMAIL'] ?? ''));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $log[] = 'NO ADMIN CREATED — set ADMIN_EMAIL (and ideally ADMIN_PASSWORD) in .env, then run the DB reset again';
        return $log;
    }

    $password = (string) ($_ENV['ADMIN_PASSWORD'] ?? '');
    $generated = $password === '';
    if ($generated) {
        $password = bin2hex(random_bytes(6));
    }

    Capsule::table('users')->insert([
        'id'             => 1,
        'full_name'      => trim((string) ($_ENV['ADMIN_NAME'] ?? '')) ?: 'Administrator',
        'email'          => $email,
        'password'       => password_hash($password, PASSWORD_DEFAULT),
        'region_id'      => 0,
        'country_id'     => 1,
        'status_id'      => 1,
        'permitted_apps' => json_encode([]),
        'user_type_ids'  => json_encode([1, 2]),
        'created_at'     => $now,
        'updated_at'     => $now,
    ]);
    $log[] = $generated
        ? "created admin {$email} with the generated password <strong>{$password}</strong> — copy it now, sign in and change it (it won't be shown again)"
        : "created admin {$email} (password from ADMIN_PASSWORD in .env — you can remove it from .env now)";

    return $log;
};
