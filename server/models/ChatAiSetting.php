<?php
// /server/models/ChatAiSetting.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Singleton settings row for the live chat AI autoresponder — see
 * Src\Service\ChatAutoResponder. Always exactly one row.
 */
class ChatAiSetting extends Model
{
    protected $table = 'chat_ai_settings';

    protected $fillable = [
        'enabled',
        'instructions',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
