<?php
// /server/models/User.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * User Model — the legacy catscript_db `users` table (shared with the
 * production legacy app), plus the additive user_type_ids column (see
 * scripts/migrations/2026_09_26_000002_*). The legacy app still reads
 * permitted_apps; this app reads user_type_ids for roles.
 */
class User extends Model
{
    protected $table = 'users';
    protected $primaryKey = 'id';
    public $incrementing = true;
    protected $keyType = 'int';

    protected $fillable = [
        'customer_id',
        'full_name',
        'email',
        'phone',
        'address',
        'city',
        'region_id',
        'country_id',
        'area_code',
        'avatar_url',
        'password',
        'status_id',
        'permitted_apps', // legacy app's per-user app list
        'user_type_ids',  // this app's roles (1 = Admin, 2 = User)
    ];

    protected $hidden = ['password'];

    protected $casts = [
        'id'             => 'integer',
        'country_id'     => 'integer',
        'region_id'      => 'integer',
        'status_id'      => 'integer',
        'permitted_apps' => 'array',
        'user_type_ids'  => 'array',
    ];

    const STATUS_CURRENT  = 1;
    const STATUS_ARCHIVED = 2;

    // ============================================================
    // Relationships
    // ============================================================

    public function country(): BelongsTo
    {
        return $this->belongsTo(Country::class, 'country_id', 'country_id');
    }

    public function region(): BelongsTo
    {
        return $this->belongsTo(Region::class, 'region_id', 'region_id');
    }

    // ============================================================
    // Accessors & Logic
    // ============================================================

    /**
     * Read-only first/last name split of the legacy full_name column, for
     * display code that shows them separately. Write full_name, not these.
     */
    public function getFirstNameAttribute(): string
    {
        return explode(' ', trim((string) $this->full_name), 2)[0] ?? '';
    }

    public function getLastNameAttribute(): string
    {
        return explode(' ', trim((string) $this->full_name), 2)[1] ?? '';
    }

    /**
     * Check for a role in users_types — Admin = 1, User = 2.
     */
    public function hasType(int $typeId): bool
    {
        return is_array($this->user_type_ids) && in_array($typeId, $this->user_type_ids);
    }

    public function scopeCurrent($query)
    {
        return $query->where('status_id', self::STATUS_CURRENT);
    }
}
