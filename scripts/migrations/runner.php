<?php
// /scripts/migrations/runner.php
//
// Shared migration runner — used by the CLI (scripts/migrate.php) and by
// the header "DB Reset" button (server/api/reset.php), so both always apply
// exactly the same changes.
//
// This app shares its database (catscript_db) with the legacy app in
// production, so every migration must be ADDITIVE and IDEMPOTENT: create a
// table or column only if it's missing, never drop, rename, truncate, or
// rewrite legacy data. Running the full set again is always safe — each
// step checks first and reports "already exists — skipped".
//
// Migration files are named YYYY_MM_DD_NNNNNN_description.php and each
// returns a callable that returns an array of log lines.

declare(strict_types=1);

/**
 * Runs every migration in filename order. A failing migration is reported
 * and stops the run (later migrations may depend on it).
 *
 * @return array{success: bool, messages: string[]}
 */
function runMigrations(): array
{
    $files = glob(__DIR__ . '/[0-9]*.php') ?: [];
    sort($files);

    $messages = [];

    foreach ($files as $file) {
        $name = basename($file, '.php');
        try {
            $migration = require $file;
            foreach ($migration() as $line) {
                $messages[] = "{$name}: {$line}";
            }
        } catch (\Throwable $e) {
            $messages[] = "{$name}: FAILED — " . $e->getMessage();
            return ['success' => false, 'messages' => $messages];
        }
    }

    if (!$files) {
        $messages[] = 'No migrations found.';
    }

    return ['success' => true, 'messages' => $messages];
}
