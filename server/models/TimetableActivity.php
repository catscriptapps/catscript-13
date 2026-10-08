<?php
// /server/models/TimetableActivity.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One block in the family timetable (e.g. Monday 16:00–17:15 Reading) — the
 * legacy catscript_db `timetable_activities` table, shared with the
 * production legacy app.
 *
 * `category` is the legacy 5-value ENUM (school / spiritual / reading /
 * routine / leisure) and is still written on every save so the legacy app
 * keeps working; `category_id` (added by migration 2026_09_29_000001) points
 * at timetable_categories and is what this app uses. Rows saved by the
 * legacy app have no category_id — see TimetableController::present().
 */
class TimetableActivity extends Model
{
    protected $table = 'timetable_activities';
    protected $primaryKey = 'activity_id';
    public $incrementing = true;
    protected $keyType = 'int';

    public const STATUS_ACTIVE = 1;
    public const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    public const LEGACY_CATEGORIES = ['school', 'spiritual', 'reading', 'routine', 'leisure'];

    protected $fillable = [
        'orig_user_id',
        'day_of_week',
        'start_time',
        'end_time',
        'activity_name',
        'category',
        'category_id',
        'status_id',
    ];

    protected $casts = [
        'orig_user_id' => 'integer',
        'category_id'  => 'integer',
        'status_id'    => 'integer',
        'created_at'   => 'datetime',
        'updated_at'   => 'datetime',
    ];

    public function categoryRecord(): BelongsTo
    {
        return $this->belongsTo(TimetableCategory::class, 'category_id', 'category_id');
    }

    public function scopeActive($query)
    {
        return $query->where('status_id', self::STATUS_ACTIVE);
    }
}
