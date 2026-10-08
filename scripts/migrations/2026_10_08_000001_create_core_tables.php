<?php
// /scripts/migrations/2026_10_08_000001_create_core_tables.php
//
// The CatScript-13 core schema — every table the base app needs:
//
//   users_types, countries, regions, users     accounts, roles, locations
//   password_resets                             "Forgot password?" links
//   recent_activities                           Dashboard / History log
//   messages                                    contact-form inbox
//   faqs                                        help centre (+ AI chat context)
//   chat_conversations, chat_messages,
//   chat_ai_settings                            live chat widget + console
//
// Each table is created only if it's missing, so this is safe on an empty
// database (fresh install) and on one that already has them (nothing is
// changed or dropped). Data is seeded by the migrations that follow.

declare(strict_types=1);

use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Schema\Blueprint;

return function (): array {
    $schema = Capsule::schema();
    $log = [];

    $tables = [
        'users_types' => function (Blueprint $t) {
            $t->increments('user_type_id');
            $t->string('user_type', 300)->nullable();
        },

        'countries' => function (Blueprint $t) {
            $t->increments('country_id');
            $t->string('country');
            $t->timestamps();
        },

        'regions' => function (Blueprint $t) {
            $t->increments('region_id');
            $t->string('region');
            $t->string('region_code');
            $t->unsignedInteger('country_id')->index();
            $t->timestamps();
        },

        'users' => function (Blueprint $t) {
            $t->increments('id');
            $t->string('full_name');
            $t->string('email')->unique();
            $t->string('phone')->nullable();
            $t->string('password');
            $t->string('address')->nullable();
            $t->string('city')->nullable();
            $t->unsignedInteger('region_id')->default(0);
            $t->unsignedInteger('country_id')->default(1);
            $t->string('area_code')->nullable();
            $t->string('avatar_url')->nullable();
            $t->tinyInteger('status_id')->default(1); // 1 = active, 2 = archived (User::STATUS_*)
            $t->json('permitted_apps')->nullable();   // AuthService::PERMISSIONED_APPS granted to this user
            $t->json('user_type_ids')->nullable();    // users_types ids — 1 = Admin
            $t->timestamps();
        },

        'password_resets' => function (Blueprint $t) {
            $t->string('email')->index();
            $t->string('token');
            $t->timestamp('created_at')->nullable();
        },

        'recent_activities' => function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('user_id')->nullable()->index();
            $t->string('action');
            $t->string('category')->nullable()->index();
            $t->string('entity_type')->nullable();
            $t->unsignedInteger('entity_id')->nullable()->index();
            $t->string('ip_address', 45)->nullable();
            $t->text('user_agent')->nullable();
            $t->boolean('archived')->default(false)->index();
            $t->timestamps();
        },

        'messages' => function (Blueprint $t) {
            $t->increments('id');
            $t->string('conversation_id')->nullable()->index();
            $t->unsignedInteger('parent_id')->nullable()->index();
            $t->string('full_name');
            $t->string('email');
            $t->string('subject');
            $t->text('message');
            $t->boolean('is_read')->default(false);
            $t->boolean('is_sent')->default(false);
            $t->boolean('is_draft')->default(false);
            $t->boolean('is_archived')->default(false);
            $t->timestamps();
        },

        'faqs' => function (Blueprint $t) {
            $t->increments('id');
            $t->string('question');
            $t->text('answer');
            $t->string('category', 40)->nullable()->index();
            $t->unsignedInteger('status_id')->default(1); // 1 = published, 2 = archived (Faq::STATUS_*)
            $t->integer('display_order')->default(0);
            $t->unsignedInteger('orig_user_id')->nullable();
            $t->timestamps();
        },

        'chat_conversations' => function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->unsignedInteger('user_id')->nullable()->index();
            $t->string('guest_token')->nullable()->index();
            $t->string('guest_name')->nullable();
            $t->string('guest_email')->nullable();
            $t->string('status')->default('open')->index();
            $t->timestamp('last_message_at')->nullable();
            $t->timestamps();
        },

        'chat_messages' => function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->unsignedBigInteger('conversation_id')->index();
            $t->string('sender_role'); // visitor | admin
            $t->unsignedInteger('sender_user_id')->nullable();
            $t->boolean('is_ai')->default(false);
            $t->text('body');
            $t->boolean('is_read_by_admin')->default(false);
            $t->boolean('is_read_by_visitor')->default(false);
            $t->timestamps();
        },

        'chat_ai_settings' => function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->boolean('enabled')->default(false);
            $t->text('instructions')->nullable();
            $t->timestamps();
        },
    ];

    foreach ($tables as $name => $definition) {
        if ($schema->hasTable($name)) {
            $log[] = "{$name} already exists — skipped";
            continue;
        }
        $schema->create($name, $definition);
        $log[] = "created {$name}";
    }

    return $log;
};
