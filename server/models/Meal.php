<?php
// /server/models/Meal.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One slot in a weekly meal plan (e.g. Tuesday dinner) — the legacy
 * catscript_db `meals` table. Private to its owner (orig_user_id). One meal
 * per plan / day / type, as in legacy (enforced by MealsController).
 */
class Meal extends Model
{
    protected $table = 'meals';
    protected $primaryKey = 'meal_id';
    public $incrementing = true;
    protected $keyType = 'int';

    public const STATUS_DEFAULT = 1;

    /** The `day_of_week` enum, in week order. */
    public const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    /** The `meal_type` enum => display label, in day order. */
    public const TYPES = [
        'breakfast' => 'Breakfast',
        'lunch'     => 'Lunch',
        'dinner'    => 'Dinner',
        'snacks'    => 'Snacks',
    ];

    protected $fillable = [
        'orig_user_id',
        'meal_plan_id',
        'day_of_week',
        'meal_type',
        'meal_description',
        'calories',
        'status_id',
    ];

    protected $casts = [
        'orig_user_id' => 'integer',
        'meal_plan_id' => 'integer',
        'calories'     => 'integer',
        'status_id'    => 'integer',
        'created_at'   => 'datetime',
        'updated_at'   => 'datetime',
    ];

    public function plan(): BelongsTo
    {
        return $this->belongsTo(MealPlan::class, 'meal_plan_id', 'meal_plan_id');
    }

    public function scopeOwnedBy($query, int $userId)
    {
        return $query->where('orig_user_id', $userId);
    }
}
