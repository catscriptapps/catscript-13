<?php
// /server/models/ChoreLibraryItem.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One chore in the library of every possible chore (`chore_library`,
 * migration 2026_09_30_000001): where it's done, roughly how long it takes,
 * and the best time of day for it.
 */
class ChoreLibraryItem extends Model
{
    protected $table = 'chore_library';

    /** key => label (display order) */
    public const AREAS = [
        'kitchen'  => 'Kitchen',
        'dining'   => 'Dining room',
        'bedroom'  => 'Bedroom',
        'bathroom' => 'Bathroom',
        'living'   => 'Living room',
        'floors'   => 'Floors & walls',
        'laundry'  => 'Laundry',
        'garbage'  => 'Garbage & recycling',
        'outdoors' => 'Outdoors',
        'pets'     => 'Pets',
        'car'      => 'Car',
        'general'  => 'General',
    ];

    public const TIMES = ['morning', 'afternoon', 'evening', 'any'];

    protected $fillable = ['title', 'area', 'minutes', 'best_time', 'per_child', 'detail', 'active'];

    protected $casts = [
        'minutes'   => 'integer',
        'per_child' => 'boolean', // personal: every child does their own (make bed, …)
        'active'    => 'boolean',
    ];
}
