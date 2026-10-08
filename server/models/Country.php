<?php
// /server/models/Country.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Country Model — the legacy catscript_db `countries` table.
 */
class Country extends Model
{
    protected $table = 'countries';
    protected $primaryKey = 'country_id';
    public $incrementing = true;
    protected $keyType = 'int';

    protected $fillable = [
        'country',
    ];

    public $timestamps = true;
}
