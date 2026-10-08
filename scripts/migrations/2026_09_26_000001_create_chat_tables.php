<?php
// /scripts/migrations/2026_09_26_000001_create_chat_tables.php
//
// Live chat tables (Src\Controller\ChatController, Src\Service\ChatAutoResponder)
// — new to catscript_db, the legacy database this app shares with
// production. Additive only: each table is created if it's missing and
// left alone if it already exists. User-id columns are unsigned INT to
// match the legacy users.id column.

declare(strict_types=1);

use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Schema\Blueprint;

return function (): array {
    $schema = Capsule::schema();
    $messages = [];

    if (!$schema->hasTable('chat_conversations')) {
        $schema->create('chat_conversations', function (Blueprint $table) {
            $table->bigIncrements('id');

            $table->unsignedInteger('user_id')->nullable()->index();
            $table->string('guest_token')->nullable()->index();
            $table->string('guest_name')->nullable();
            $table->string('guest_email')->nullable();

            // open | closed
            $table->string('status')->default('open')->index();

            $table->timestamp('last_message_at')->nullable();

            $table->timestamps();
        });
        $messages[] = 'created chat_conversations';
    } else {
        $messages[] = 'chat_conversations already exists — skipped';
    }

    if (!$schema->hasTable('chat_messages')) {
        $schema->create('chat_messages', function (Blueprint $table) {
            $table->bigIncrements('id');

            $table->unsignedBigInteger('conversation_id')->index();

            // visitor | admin
            $table->string('sender_role')->index();
            $table->unsignedInteger('sender_user_id')->nullable();

            // True for AI-generated admin replies — how the autoresponder
            // knows a human has taken over a conversation.
            $table->boolean('is_ai')->default(false);

            $table->text('body');

            $table->boolean('is_read_by_admin')->default(false)->index();
            $table->boolean('is_read_by_visitor')->default(false)->index();

            $table->timestamps();

            $table->index(['conversation_id', 'created_at']);
        });
        $messages[] = 'created chat_messages';
    } else {
        $messages[] = 'chat_messages already exists — skipped';
    }

    if (!$schema->hasTable('chat_ai_settings')) {
        $schema->create('chat_ai_settings', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->boolean('enabled')->default(false);
            $table->text('instructions')->nullable();
            $table->timestamps();
        });
        Capsule::table('chat_ai_settings')->insert([
            'enabled' => false,
            'instructions' => '',
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
        $messages[] = 'created chat_ai_settings (seeded one disabled row)';
    } else {
        $messages[] = 'chat_ai_settings already exists — skipped';
    }

    return $messages;
};
