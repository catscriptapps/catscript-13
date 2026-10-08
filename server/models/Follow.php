<?php
// /server/models/Follow.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Social follow relationship — the legacy catscript_db `follows` table.
 */
class Follow extends Model
{
    protected $table = 'follows';
    protected $primaryKey = 'follow_id';
    public $incrementing = true;
    protected $keyType = 'int';

    protected $fillable = [
        'follower_id',  // The person doing the following
        'following_id', // The person being followed
    ];

    protected $casts = [
        'follower_id' => 'integer',
        'following_id' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function follower()
    {
        return $this->belongsTo(User::class, 'follower_id');
    }

    public function following()
    {
        return $this->belongsTo(User::class, 'following_id');
    }
}
