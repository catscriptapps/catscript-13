<?php
// /server/models/ChoreChild.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A child who shares the chores (`chore_children`, migration
 * 2026_09_30_000001 — seeded once from the legacy `children` table, which is
 * left untouched). Optionally linked to their own CatScript account.
 */
class ChoreChild extends Model
{
    protected $table = 'chore_children';

    public const COLORS = ['orange', 'sky', 'emerald', 'violet', 'rose', 'amber', 'teal', 'indigo', 'lime', 'fuchsia'];

    protected $fillable = ['first_name', 'last_name', 'color', 'user_id', 'sort_order', 'active'];

    protected $casts = [
        'user_id'    => 'integer',
        'sort_order' => 'integer',
        'active'     => 'boolean',
    ];
}
