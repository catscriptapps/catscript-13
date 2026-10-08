<?php
// /server/models/Faq.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A help-centre question — the `faqs` table. `category` is the topic key
 * (FaqsController::CATEGORIES); display_order is the position within its
 * topic.
 */
class Faq extends Model
{
    protected $table = 'faqs';
    public $incrementing = true;
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
