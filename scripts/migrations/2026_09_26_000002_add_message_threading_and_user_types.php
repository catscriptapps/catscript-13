<?php
// /scripts/migrations/2026_09_26_000002_add_message_threading_and_user_types.php
//
// Additive changes to the legacy catscript_db:
//
// 1. messages.conversation_id / messages.parent_id — reply threading for
//    Src\Controller\MessagesController. Both nullable, so existing rows and
//    the legacy app (which never reads them) are unaffected. No self-FK on
//    parent_id, to keep the change to this shared production table minimal.
// 2. users_types table (1 = Admin, 2 = User) + nullable users.user_type_ids
//    JSON list — the role model used by AuthService::isAdmin(). The legacy
//    app keeps using users.permitted_apps and ignores this column. Backfill:
//    user #1 (legacy's hard-coded admin) gets [1, 2], everyone else [2];
//    only rows that don't have roles yet are touched.

declare(strict_types=1);

use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Schema\Blueprint;

return function (): array {
    $schema = Capsule::schema();
    $messages = [];

    // --- 1. Message threading -------------------------------------------
    foreach (['conversation_id', 'parent_id'] as $column) {
        if ($schema->hasColumn('messages', $column)) {
            $messages[] = "messages.$column already exists — skipped";
            continue;
        }
        $schema->table('messages', function (Blueprint $table) use ($column) {
            if ($column === 'conversation_id') {
                $table->string('conversation_id')->nullable()->index()->after('id');
            } else {
                $table->unsignedInteger('parent_id')->nullable()->index()->after('conversation_id');
            }
        });
        $messages[] = "added messages.$column (nullable)";
    }

    // --- 2. User types ----------------------------------------------------
    if (!$schema->hasTable('users_types')) {
        $schema->create('users_types', function (Blueprint $table) {
            $table->increments('user_type_id');
            $table->string('user_type', 300)->nullable();
        });
        Capsule::table('users_types')->insert([
            ['user_type_id' => 1, 'user_type' => 'Admin'],
            ['user_type_id' => 2, 'user_type' => 'User'],
        ]);
        $messages[] = 'created users_types (1 = Admin, 2 = User)';
    } else {
        $messages[] = 'users_types already exists — skipped';
    }

    if (!$schema->hasColumn('users', 'user_type_ids')) {
        $schema->table('users', function (Blueprint $table) {
            $table->json('user_type_ids')->nullable()->after('permitted_apps');
        });
        $messages[] = 'added users.user_type_ids (nullable)';
    } else {
        $messages[] = 'users.user_type_ids already exists — skipped';
    }

    $admins = Capsule::table('users')->where('id', 1)->whereNull('user_type_ids')->update(['user_type_ids' => json_encode([1, 2])]);
    $others = Capsule::table('users')->where('id', '<>', 1)->whereNull('user_type_ids')->update(['user_type_ids' => json_encode([2])]);
    $messages[] = "backfilled user_type_ids: $admins admin, $others user";

    return $messages;
};
