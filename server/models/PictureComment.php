<?php
// /server/models/PictureComment.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A comment written on a Pictures photo. Table added by migration
 * 2026_10_06_000001.
 */
class PictureComment extends Model
{
    protected $table = 'picture_comments';

    protected $fillable = [
        'picture_id',
        'user_id',
        'body',
    ];

    protected $casts = [
        'picture_id' => 'integer',
        'user_id'    => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
