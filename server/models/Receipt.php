<?php
// /server/models/Receipt.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A payment received against an invoice — the legacy catscript_db `receipts`
 * table (live production data, shared with the legacy app). receipt_number
 * (CA-RCP{yy}-{nnnn}) comes from the shared `counters` row both apps
 * increment; receipt_id is assigned by ReceiptsController (MAX + 1 under a
 * lock), as for invoices.
 *
 * status_id: 1 = active, 0 = voided (the legacy values). Voided receipts
 * stay on file but no longer count towards what's been paid.
 */
class Receipt extends Model
{
    protected $table = 'receipts';
    protected $primaryKey = 'receipt_id';
    public $incrementing = false;
    protected $keyType = 'int';

    public const ACTIVE = 1;
    public const VOIDED = 0;
    /** The legacy payment methods (the legacy form's list), plus Wire and Other. */
    public const METHODS = ['E-Transfer', 'Bank Transfer', 'Cash', 'Cheque', 'Credit Card', 'Wire', 'Other'];

    protected $fillable = [
        'invoice_id', 'amount_paid', 'payment_date', 'payment_method', 'reference_note', 'status_id',
    ];

    protected $casts = [
        'receipt_id'   => 'integer',
        'invoice_id'   => 'integer',
        'orig_user_id' => 'integer',
        'status_id'    => 'integer',
        'amount_paid'  => 'decimal:2',
        'created_at'   => 'datetime',
        'updated_at'   => 'datetime',
    ];
}
