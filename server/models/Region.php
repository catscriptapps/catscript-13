<?php
// /server/models/Region.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Region Model — the legacy catscript_db `regions` table.
 */
class Region extends Model
{
    protected $table = 'regions';
    protected $primaryKey = 'region_id';
    public $incrementing = true;
    protected $keyType = 'int';

    protected $fillable = [
        'region',
        'region_code',
        'country_id',
    ];

    public $timestamps = true;

    public function country()
    {
        return $this->belongsTo(Country::class, 'country_id', 'country_id');
    }
}
