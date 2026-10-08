<?php
// /server/models/Invoice.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * An invoice — the legacy catscript_db `invoices` table (live production
 * data, shared with the legacy app). invoice_number (CA-INV{yy}-{nnnn})
 * comes from the shared `counters` row both apps increment; invoice_id is
 * assigned by InvoicesController (MAX + 1 under a lock), so new rows work
 * whether or not the column auto-increments.
 *
 * status_id -> invoice_statuses: 1 Draft, 2 Sent, 3 Partially Paid,
 * 4 Paid In Full, 5 Overdue, 6 Cancelled.
 */
class Invoice extends Model
{
    protected $table = 'invoices';
    protected $primaryKey = 'invoice_id';
    public $incrementing = false;
    protected $keyType = 'int';

    public const DRAFT = 1;
    public const SENT = 2;
    public const PARTIAL = 3;
    public const PAID = 4;
    public const OVERDUE = 5;
    public const CANCELLED = 6;
    public const CURRENCIES = ['CAD', 'USD'];

    protected $fillable = [
        'customer_id', 'invoice_title', 'due_date', 'invoice_total', 'currency_id',
        'payment_term_id', 'delivery_term_id', 'status_id',
    ];

    protected $casts = [
        'invoice_id'       => 'integer',
        'customer_id'      => 'integer',
        'payment_term_id'  => 'integer',
        'delivery_term_id' => 'integer',
        'status_id'        => 'integer',
        'orig_user_id'     => 'integer',
        'invoice_total'    => 'decimal:2',
        'created_at'       => 'datetime',
        'updated_at'       => 'datetime',
    ];
}
