<?php
// /server/models/Customer.php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A business customer — the legacy catscript_db `customers` table (live
 * production data; the legacy invoices point at customer_id). One shared
 * directory for everyone with Customers access, as in legacy.
 *
 * status_id: 1 = active, 0 = archived (the legacy values).
 * customer_id is assigned by CustomersController (MAX + 1 inside a locked
 * transaction), so new rows work whether or not the column auto-increments.
 */
class Customer extends Model
{
    protected $table = 'customers';
    protected $primaryKey = 'customer_id';
    public $incrementing = false;
    protected $keyType = 'int';

    public const ACTIVE = 1;
    public const ARCHIVED = 0;

    protected $fillable = [
        'company_name', 'email', 'phone', 'website_url', 'address', 'city',
        'region_id', 'country_id', 'area_code', 'avatar_url', 'status_id',
    ];

    protected $casts = [
        'customer_id'  => 'integer',
        'orig_user_id' => 'integer',
        'region_id'    => 'integer',
        'country_id'   => 'integer',
        'status_id'    => 'integer',
        'created_at'   => 'datetime',
        'updated_at'   => 'datetime',
    ];
}
