<?php
// /server/models/ChatConversation.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChatConversation extends Model
{
    protected $table = 'chat_conversations';

    protected $fillable = [
        'user_id',
        'guest_token',
        'guest_name',
        'guest_email',
        'status',
        'last_message_at',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'last_message_at' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function messages()
    {
        return $this->hasMany(ChatMessage::class, 'conversation_id');
    }

    public function scopeOpen($query)
    {
        return $query->where('status', 'open');
    }

    public function scopeClosed($query)
    {
        return $query->where('status', 'closed');
    }

    /**
     * Display label for the admin inbox — account name if logged in,
     * otherwise whatever the guest supplied on the pre-chat form.
     */
    public function displayName(): string
    {
        return $this->user->full_name ?? $this->guest_name ?? ('Guest #' . $this->id);
    }
}
