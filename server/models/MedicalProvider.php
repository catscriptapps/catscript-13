<?php
// /server/models/MedicalProvider.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A doctor, dentist, clinic, pharmacy… the family uses (`medical_providers`).
 */
class MedicalProvider extends Model
{
    protected $table = 'medical_providers';

    /** kind => label */
    public const KINDS = [
        'doctor'      => 'Family doctor',
        'dentist'     => 'Dentist',
        'specialist'  => 'Specialist',
        'clinic'      => 'Clinic / walk-in',
        'hospital'    => 'Hospital',
        'pharmacy'    => 'Pharmacy',
        'optometrist' => 'Eye care',
        'therapist'   => 'Therapist',
        'other'       => 'Other',
    ];

    protected $fillable = ['name', 'kind', 'specialty', 'phone', 'email', 'address', 'website', 'notes', 'orig_user_id'];

    protected $casts = ['orig_user_id' => 'integer'];
}
