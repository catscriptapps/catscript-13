<?php
// /server/models/Message.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A contact-form message or an admin's reply — the `messages` table. Rows
 * sharing a conversation_id form one thread; a row without one is a thread
 * of its own. is_sent = 1 marks an admin reply (emailed to the visitor);
 * is_read only matters for incoming rows.
 */
class Message extends Model
{
    protected $table = 'messages';
    public $incrementing = true;
    protected $keyType = 'int';

    protected $fillable = [
        'conversation_id', 'parent_id', 'full_name', 'email', 'subject', 'message',
        'is_read', 'is_sent', 'is_draft', 'is_archived',
    ];

    protected $casts = [
        'id'          => 'integer',
        'parent_id'   => 'integer',
        'is_read'     => 'boolean',
        'is_sent'     => 'boolean',
        'is_draft'    => 'boolean',
        'is_archived' => 'boolean',
        'created_at'  => 'datetime',
        'updated_at'  => 'datetime',
    ];
}
