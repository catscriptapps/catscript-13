<?php
// /scripts/migrate.php
//
// CLI entry point for the additive database updates in scripts/migrations/
// (the same set the header "DB Reset" button applies — see
// scripts/migrations/runner.php for the rules every migration follows).
// Safe to run repeatedly; back up the database first anyway.
//
// Run: php scripts/migrate.php

declare(strict_types=1);

require_once __DIR__ . '/../server/bootstrap.php';
require_once __DIR__ . '/migrations/runner.php';

$result = runMigrations();

foreach ($result['messages'] as $line) {
    echo $line . PHP_EOL;
}

exit($result['success'] ? 0 : 1);
