<?php
// /server/models/Faq.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A help-centre question — the legacy catscript_db `faqs` table (shared with
 * the legacy app). `category` is the topic key (FaqsController::CATEGORIES),
 * added by the 2026_10_01 migration; display_order is the position within
 * its topic. `id` doesn't auto-increment in the legacy schema, so
 * FaqsController assigns it (MAX + 1 under a lock).
 */
class Faq extends Model
{
    protected $table = 'faqs';
    public $incrementing = false;
    protected $keyType = 'int';

    public const STATUS_ACTIVE = 1;
    public const STATUS_ARCHIVED = 2;

    protected $fillable = ['question', 'answer', 'category', 'status_id', 'display_order', 'orig_user_id'];

    protected $casts = [
        'id'            => 'integer',
        'status_id'     => 'integer',
        'display_order' => 'integer',
        'orig_user_id'  => 'integer',
        'created_at'    => 'datetime',
        'updated_at'    => 'datetime',
    ];

    /** Only the published questions. */
    public function scopeActive($query)
    {
        return $query->where('status_id', self::STATUS_ACTIVE);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'orig_user_id');
    }
}
