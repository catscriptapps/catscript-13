<?php
// /server/models/MealPlan.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A named weekly meal plan ("Summer week", "School term") — the legacy
 * catscript_db `meal_plans` table. Visible to everyone with Meals access;
 * only its owner (orig_user_id) can change it — see MealsController.
 */
class MealPlan extends Model
{
    protected $table = 'meal_plans';
    protected $primaryKey = 'meal_plan_id';
    public $incrementing = true;
    protected $keyType = 'int';

    public const STATUS_DEFAULT = 1;

    protected $fillable = [
        'orig_user_id',
        'plan_title',
        'description',
        'status_id',
    ];

    protected $casts = [
        'orig_user_id' => 'integer',
        'status_id'    => 'integer',
        'created_at'   => 'datetime',
        'updated_at'   => 'datetime',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'orig_user_id');
    }

    public function meals(): HasMany
    {
        return $this->hasMany(Meal::class, 'meal_plan_id', 'meal_plan_id');
    }

    public function scopeOwnedBy($query, int $userId)
    {
        return $query->where('orig_user_id', $userId);
    }
}
