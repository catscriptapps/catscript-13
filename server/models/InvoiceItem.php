<?php
// /server/models/InvoiceItem.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One line on an invoice — the legacy `invoice_items` table. `description`
 * is rich text (bold, lists, line breaks), cleaned by Src\Utils\RichText on
 * every save. A negative quantity makes a discount line, as in legacy.
 * item_id is assigned by InvoicesController (MAX + 1 under a lock).
 */
class InvoiceItem extends Model
{
    protected $table = 'invoice_items';
    protected $primaryKey = 'item_id';
    public $incrementing = false;
    protected $keyType = 'int';

    protected $fillable = ['invoice_id', 'description', 'quantity', 'unit_price', 'subtotal', 'order_index'];

    protected $casts = [
        'item_id'     => 'integer',
        'invoice_id'  => 'integer',
        'quantity'    => 'decimal:2',
        'unit_price'  => 'decimal:2',
        'subtotal'    => 'decimal:2',
        'order_index' => 'integer',
    ];
}
