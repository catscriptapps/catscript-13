<?php
// /server/models/MedicalMedication.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A medication one person takes (`medical_medications`). `times` is a
 * comma-separated list of HH:MM dose times ("08:00,20:00"); blank means
 * "as needed".
 */
class MedicalMedication extends Model
{
    protected $table = 'medical_medications';

    protected $fillable = [
        'person_id', 'name', 'dose', 'times', 'instructions', 'prescriber_id', 'pharmacy_id',
        'start_date', 'end_date', 'refill_date', 'active', 'orig_user_id',
    ];

    protected $casts = [
        'person_id'     => 'integer',
        'prescriber_id' => 'integer',
        'pharmacy_id'   => 'integer',
        'start_date'    => 'date',
        'end_date'      => 'date',
        'refill_date'   => 'date',
        'active'        => 'boolean',
        'orig_user_id'  => 'integer',
    ];

    /** @return string[] HH:MM dose times, sorted */
    public function doseTimes(): array
    {
        $times = array_values(array_filter(array_map('trim', explode(',', (string) $this->times)), fn($t) => preg_match('/^\d{2}:\d{2}$/', $t)));
        sort($times);
        return $times;
    }
}
