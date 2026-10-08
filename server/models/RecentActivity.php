<?php
// /server/models/RecentActivity.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class RecentActivity extends Model
{
    use HasFactory;

    protected $table = 'recent_activities';

    protected $fillable = [
        'user_id',
        'action',
        'entity_type',
        'entity_id',
        'ip_address',
        'user_agent',
        'archived',
    ];

    protected $casts = [
        'archived'   => 'boolean',
        'entity_id'  => 'integer',
        'user_id'    => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function scopeActive($query)
    {
        return $query->where('archived', false);
    }

    public static function log(
        ?int $userId,
        string $action,
        ?string $entityType = null,
        ?int $entityId = null
    ): self {
        $ip = $_SERVER['REMOTE_ADDR'] ?? null;
        $agent = $_SERVER['HTTP_USER_AGENT'] ?? null;

        return static::create([
            'user_id'     => $userId,
            'action'      => trim($action),
            'entity_type' => $entityType,
            'entity_id'   => $entityId,
            'ip_address'  => $ip,
            'user_agent'  => $agent,
            'archived'    => false,
        ]);
    }
}
