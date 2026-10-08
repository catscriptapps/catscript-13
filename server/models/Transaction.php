<?php
// /server/models/Transaction.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Cash Flow entry — the legacy catscript_db `transactions` table (shared with
 * the production legacy app). Private to its owner (orig_user_id).
 * transaction_ref is unique (CA-TRX{yy}-{nnnn}) and comes from the shared
 * `counters` row both apps increment — see CashFlowController::nextRef().
 */
class Transaction extends Model
{
    protected $table = 'transactions';
    protected $primaryKey = 'id';
    public $incrementing = true;
    protected $keyType = 'int';

    public const TYPES = ['income', 'expense'];
    public const STATUS_DEFAULT = 1; // legacy default; not surfaced in the UI

    protected $fillable = [
        'orig_user_id',
        'transaction_ref',
        'title',
        'type',
        'amount',
        'transaction_date',
        'details',
        'receipt_pic_name',
        'status_id',
    ];

    protected $casts = [
        'orig_user_id'     => 'integer',
        'amount'           => 'decimal:2',
        'transaction_date' => 'date',
        'status_id'        => 'integer',
        'created_at'       => 'datetime',
        'updated_at'       => 'datetime',
    ];

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'orig_user_id');
    }

    public function scopeOwnedBy($query, int $userId)
    {
        return $query->where('orig_user_id', $userId);
    }
}
