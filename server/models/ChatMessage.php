<?php
// /server/models/ChatMessage.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChatMessage extends Model
{
    protected $table = 'chat_messages';

    protected $fillable = [
        'conversation_id',
        'sender_role',
        'sender_user_id',
        'is_ai',
        'body',
        'is_read_by_admin',
        'is_read_by_visitor',
    ];

    protected $casts = [
        'conversation_id' => 'integer',
        'sender_user_id' => 'integer',
        'is_ai' => 'boolean',
        'is_read_by_admin' => 'boolean',
        'is_read_by_visitor' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function conversation()
    {
        return $this->belongsTo(ChatConversation::class, 'conversation_id');
    }
}
