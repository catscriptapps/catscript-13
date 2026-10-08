<?php
// /server/models/Task.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Task — the legacy catscript_db `tasks` table (shared with the production
 * legacy app). A dated reminder with an optional time and details. The list
 * is shared between everyone with Tasks access; orig_user_id records who
 * created it.
 */
class Task extends Model
{
    protected $table = 'tasks';
    protected $primaryKey = 'task_id';
    public $incrementing = true;
    protected $keyType = 'int';

    protected $fillable = [
        'orig_user_id',
        'due_date',
        'task_time',
        'task_title',
        'task_detail',
    ];

    protected $casts = [
        'orig_user_id' => 'integer',
        'due_date'     => 'date',
        'created_at'   => 'datetime',
        'updated_at'   => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'orig_user_id');
    }

    /**
     * NULL means "no particular time" (legacy shows it as "All Day").
     * 00:00:00 is a real time — 12:00 AM, the usual due time for bills —
     * which is how the legacy app has always displayed it.
     */
    public function hasTime(): bool
    {
        return $this->task_time !== null && $this->task_time !== '';
    }
}
