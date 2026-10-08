<?php
// /server/models/PasswordReset.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * PasswordReset Model
 * Manages the temporary tokens for user password recovery.
 */
class PasswordReset extends Model
{
    /** @var string Table name */
    protected $table = 'password_resets';

    /** @var string Primary key */
    protected $primaryKey = 'email';

    /** @var bool Disable auto-incrementing as we use email as the key */
    public $incrementing = false;

    /** @var bool Only created_at is needed for expiration logic */
    public $timestamps = false;

    /** @var array Fillable attributes for mass assignment */
    protected $fillable = [
        'email',
        'token',
        'created_at'
    ];

    /**
     * Checks if a token has expired.
     * * @param int $minutes Expiration threshold (default 60)
     * @return bool
     */
    public function isExpired(int $minutes = 60): bool
    {
        $createdAt = strtotime($this->created_at);
        return (time() - $createdAt) > ($minutes * 60);
    }
}
