<?php
// /server/models/PostLike.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Social feed like — the legacy catscript_db `post_likes` table.
 */
class PostLike extends Model
{
    protected $table = 'post_likes';
    protected $primaryKey = 'like_id';
    public $incrementing = true;
    protected $keyType = 'int';

    protected $fillable = [
        'post_id',
        'orig_user_id',
    ];

    protected $casts = [
        'post_id' => 'integer',
        'orig_user_id' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function post()
    {
        return $this->belongsTo(Post::class, 'post_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'orig_user_id');
    }
}
