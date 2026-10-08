<?php
// /server/models/Counter.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Legacy catscript_db `counters` table — yearly running numbers shared with
 * the production legacy app (e.g. type "transaction", year "26" -> the next
 * CA-TRX26-nnnn reference).
 */
class Counter extends Model
{
    protected $table = 'counters';
    protected $primaryKey = 'counter_id';
    public $incrementing = true;
    protected $keyType = 'int';

    protected $fillable = ['type', 'year', 'last_value'];

    protected $casts = [
        'last_value' => 'integer',
    ];
}
