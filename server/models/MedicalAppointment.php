<?php
// /server/models/MedicalAppointment.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * An appointment for one person (`medical_appointments`). "to_book" ones
 * have no date yet — they're the family's "remember to book this" list.
 */
class MedicalAppointment extends Model
{
    protected $table = 'medical_appointments';

    /** status => label */
    public const STATUSES = [
        'to_book'   => 'To book',
        'booked'    => 'Booked',
        'done'      => 'Done',
        'cancelled' => 'Cancelled',
        'missed'    => 'Missed',
    ];

    /** kind => label */
    public const KINDS = [
        'checkup'     => 'Check-up',
        'dental'      => 'Dental',
        'vision'      => 'Eye exam',
        'specialist'  => 'Specialist',
        'vaccination' => 'Vaccination',
        'lab'         => 'Lab / tests',
        'therapy'     => 'Therapy',
        'urgent'      => 'Urgent / sick visit',
        'other'       => 'Other',
    ];

    /** How long before to remind (days) */
    public const REMIND = [0, 1, 2, 7];

    protected $fillable = [
        'person_id', 'provider_id', 'title', 'kind', 'status', 'appt_date', 'appt_time', 'duration_min',
        'location', 'notes', 'outcome', 'remind_days', 'follow_up_of', 'orig_user_id',
    ];

    protected $casts = [
        'person_id'    => 'integer',
        'provider_id'  => 'integer',
        'appt_date'    => 'date',
        'duration_min' => 'integer',
        'remind_days'  => 'integer',
        'follow_up_of' => 'integer',
        'orig_user_id' => 'integer',
    ];
}
