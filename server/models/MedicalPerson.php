<?php
// /server/models/MedicalPerson.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Someone whose health the family keeps track of (`medical_people`,
 * migration 2026_10_02_000001) — optionally linked to their own CatScript
 * account. Allergies and conditions are free text, one per line.
 */
class MedicalPerson extends Model
{
    protected $table = 'medical_people';

    public const COLORS = ['sky', 'rose', 'emerald', 'violet', 'amber', 'teal', 'indigo', 'orange', 'lime', 'fuchsia'];
    public const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

    protected $fillable = [
        'first_name', 'last_name', 'date_of_birth', 'blood_type', 'color', 'health_number',
        'allergies', 'conditions', 'notes', 'emergency_contact', 'user_id', 'active', 'sort_order', 'orig_user_id',
    ];

    protected $casts = [
        'date_of_birth' => 'date',
        'user_id'       => 'integer',
        'active'        => 'boolean',
        'sort_order'    => 'integer',
        'orig_user_id'  => 'integer',
    ];
}
