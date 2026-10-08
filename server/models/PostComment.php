<?php
// /server/models/PostComment.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Social feed comment — the legacy catscript_db `post_comments` table.
 */
class PostComment extends Model
{
    protected $table = 'post_comments';
    protected $primaryKey = 'comment_id';
    public $incrementing = true;
    protected $keyType = 'int';

    protected $fillable = [
        'post_id',
        'orig_user_id',
        'comment_text',
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
