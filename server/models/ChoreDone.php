<?php
// /server/models/ChoreDone.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A tick: a planned chore (chore_plan row) done on a given date
 * (`chore_done`, migration 2026_09_30_000001).
 */
class ChoreDone extends Model
{
    protected $table = 'chore_done';
    public const UPDATED_AT = null;

    protected $fillable = ['plan_id', 'done_on', 'ticked_by'];

    protected $casts = [
        'plan_id'   => 'integer',
        'ticked_by' => 'integer',
        'done_on'   => 'date:Y-m-d',
    ];
}
