<?php
// /server/models/SlideshowPhoto.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One photo in the site-wide slideshow (hero banners and the TV
 * screensavers) — the file lives in public/images/home/, this row holds its
 * place in the order and its caption. Managed by SlideshowController; read
 * by Src\Utils\CuratedPhotos.
 */
class SlideshowPhoto extends Model
{
    protected $table = 'slideshow_photos';

    protected $fillable = ['file_name', 'caption', 'sort_order', 'width', 'height', 'bytes', 'orig_user_id'];

    protected $casts = [
        'id'           => 'integer',
        'sort_order'   => 'integer',
        'width'        => 'integer',
        'height'       => 'integer',
        'bytes'        => 'integer',
        'orig_user_id' => 'integer',
        'created_at'   => 'datetime',
        'updated_at'   => 'datetime',
    ];
}
