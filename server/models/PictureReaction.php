<?php
// /server/models/PictureReaction.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * An emoji on a Pictures photo (one row per picture + user + emoji).
 * Table added by migration 2026_10_06_000001.
 */
class PictureReaction extends Model
{
    protected $table = 'picture_reactions';
    public const UPDATED_AT = null;

    protected $fillable = [
        'picture_id',
        'user_id',
        'emoji',
    ];

    protected $casts = [
        'picture_id' => 'integer',
        'user_id'    => 'integer',
        'created_at' => 'datetime',
    ];
}
