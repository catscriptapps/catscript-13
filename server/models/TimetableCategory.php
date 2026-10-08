<?php
// /server/models/TimetableCategory.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A Timetable category (School, Chores, Screen time, …) — the
 * `timetable_categories` table added by migration 2026_09_29_000001.
 * Built-in categories have a `slug`; people can add their own. Each one
 * names the legacy ENUM value (legacy_category) written for the legacy app.
 */
class TimetableCategory extends Model
{
    protected $table = 'timetable_categories';
    protected $primaryKey = 'category_id';
    public $incrementing = true;
    protected $keyType = 'int';

    /** Colour keys a category can use (styled in resources/js/pages/timetable-page.js). */
    public const COLORS = [
        'navy', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose', 'red', 'orange', 'amber',
        'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'stone', 'gray',
    ];

    protected $fillable = [
        'slug',
        'name',
        'color',
        'legacy_category',
        'sort_order',
        'created_by',
    ];

    protected $casts = [
        'sort_order' => 'integer',
        'created_by' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
