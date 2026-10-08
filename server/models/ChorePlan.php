<?php
// /server/models/ChorePlan.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * "This child does this chore in this chore slot" (`chore_plan`, migration
 * 2026_09_30_000001). A slot is a Timetable chore activity, identified by
 * day + start time so it survives the Timetable's copy / replace.
 */
class ChorePlan extends Model
{
    protected $table = 'chore_plan';

    protected $fillable = ['day_of_week', 'slot_start', 'child_id', 'chore_id', 'created_by'];

    protected $casts = [
        'child_id'   => 'integer',
        'chore_id'   => 'integer',
        'created_by' => 'integer',
    ];
}
