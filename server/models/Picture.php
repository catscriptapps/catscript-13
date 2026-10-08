<?php
// /server/models/Picture.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A photo in the Pictures gallery — the legacy catscript_db `pictures` table
 * (shared with the production legacy app). Private to its owner
 * (orig_user_id). The file lives in public/images/uploads/gallery/{pic_name}.
 * is_favourite is added by migration 2026_09_28_000001.
 */
class Picture extends Model
{
    protected $table = 'pictures';
    protected $primaryKey = 'picture_id';
    public $incrementing = true;
    protected $keyType = 'int';

    public const STATUS_DEFAULT = 1; // legacy default; not surfaced in the UI

    protected $fillable = [
        'orig_user_id',
        'pic_name',
        'pic_caption',
        'is_favourite',
        'status_id',
    ];

    protected $casts = [
        'orig_user_id' => 'integer',
        'is_favourite' => 'boolean',
        'status_id'    => 'integer',
        'created_at'   => 'datetime',
        'updated_at'   => 'datetime',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'orig_user_id');
    }

    public function scopeOwnedBy($query, int $userId)
    {
        return $query->where('orig_user_id', $userId);
    }
}
