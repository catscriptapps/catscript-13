<?php
// /server/models/MedicalDose.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One dose ticked off (`medical_doses`): a medication, a date and the dose
 * time ("08:00"; for an as-needed medication, the time it was given).
 */
class MedicalDose extends Model
{
    protected $table = 'medical_doses';

    protected $fillable = ['medication_id', 'dose_date', 'dose_time', 'given_by'];

    protected $casts = [
        'medication_id' => 'integer',
        'dose_date'     => 'date',
        'given_by'      => 'integer',
    ];
}
