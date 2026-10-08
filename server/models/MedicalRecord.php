<?php
// /server/models/MedicalRecord.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A line in someone's health history (`medical_records`): a vaccination,
 * check-up, test result, measurement… `next_due` (optional) is when it's
 * due again — the source of the "time to book" reminders.
 */
class MedicalRecord extends Model
{
    protected $table = 'medical_records';

    /** kind => [label, emoji] */
    public const KINDS = [
        'vaccination' => ['Vaccination', '💉'],
        'checkup'     => ['Check-up', '🩺'],
        'dental'      => ['Dental', '🦷'],
        'vision'      => ['Eye exam', '👓'],
        'test'        => ['Test / lab result', '🧪'],
        'measurement' => ['Measurement', '📏'],
        'condition'   => ['Diagnosis', '📋'],
        'procedure'   => ['Procedure', '🏥'],
        'other'       => ['Note', '📝'],
    ];

    protected $fillable = ['person_id', 'kind', 'title', 'record_date', 'value', 'notes', 'provider_id', 'next_due', 'orig_user_id'];

    protected $casts = [
        'person_id'    => 'integer',
        'record_date'  => 'date',
        'provider_id'  => 'integer',
        'next_due'     => 'date',
        'orig_user_id' => 'integer',
    ];
}
