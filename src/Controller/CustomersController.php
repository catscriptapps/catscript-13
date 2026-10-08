<?php
// /src/Controller/CustomersController.php

declare(strict_types=1);

namespace Src\Controller;

use App\Models\Customer;
use App\Traits\RecentActivityLogger;
use App\Utils\IdEncoder;
use Illuminate\Database\Capsule\Manager as Capsule;

/**
 * Customers — the business customer directory (ported from the legacy
 * CatScript Customers app, on the same legacy `customers` table, which
 * holds live production data and is what the legacy invoices point at).
 *
 * One shared directory for everyone with Customers access, as in legacy,
 * with legacy's rules: company names and emails are unique. Each customer
 * carries their billing picture from the legacy invoices / receipts tables
 * (read-only here): invoices, total billed, and what's still outstanding.
 *
 * Changes are logged to recent_activities (entity_type "Customers").
 */
class CustomersController
{
    use RecentActivityLogger;

    public const LOGO_DIR = 'images/uploads/customers/';
    /** invoice_statuses: Paid In Full, Cancelled — everything else still counts as open */
    private const CLOSED_STATUSES = [4, 6];

    // ============================================================
    // Reads
    // ============================================================

    /**
     * Every customer with their billing stats, plus lookups for the form.
     */
    public static function state(): array
    {
        $billing = self::billing();
        $regions = Capsule::table('regions')->orderBy('region')->get(['region_id', 'region', 'region_code', 'country_id']);
        $countries = Capsule::table('countries')->orderBy('country_id')->get(['country_id', 'country']);
        $regionName = $regions->keyBy('region_id');
        $countryName = $countries->keyBy('country_id');

        $customers = Customer::orderBy('company_name')->get()
            ->map(fn(Customer $c) => self::present($c, $billing[$c->customer_id] ?? null, $regionName, $countryName))
            ->values()->all();

        return [
            'customers' => $customers,
            'countries' => $countries->map(fn($c) => ['id' => (int) $c->country_id, 'name' => (string) $c->country])->values()->all(),
            'regions'   => $regions->map(fn($r) => ['id' => (int) $r->region_id, 'name' => (string) $r->region, 'code' => (string) $r->region_code, 'country_id' => (int) $r->country_id])->values()->all(),
            'year'      => (int) date('Y'),
        ];
    }

    /**
     * Per-customer invoice totals from the legacy invoices / receipts tables.
     * @return array<int, array{invoices: int, billed: float, open: int, outstanding: float, last: ?string}>
     */
    private static function billing(): array
    {
        if (!Capsule::schema()->hasTable('invoices')) {
            return [];
        }
        $paid = Capsule::schema()->hasTable('receipts')
            ? Capsule::table('receipts')->where('status_id', '<>', 0)->groupBy('invoice_id')->selectRaw('invoice_id, SUM(amount_paid) paid')->pluck('paid', 'invoice_id')
            : collect();

        $out = [];
        foreach (Capsule::table('invoices')->get(['invoice_id', 'customer_id', 'invoice_total', 'status_id', 'created_at']) as $inv) {
            $cid = (int) $inv->customer_id;
            $out[$cid] ??= ['invoices' => 0, 'billed' => 0.0, 'open' => 0, 'outstanding' => 0.0, 'last' => null];
            $total = (float) $inv->invoice_total;
            $out[$cid]['invoices']++;
            if ((int) $inv->status_id !== 6) {
                $out[$cid]['billed'] += $total;
            }
            if (!in_array((int) $inv->status_id, self::CLOSED_STATUSES, true)) {
                $out[$cid]['open']++;
                $out[$cid]['outstanding'] += max(0, $total - (float) ($paid[$inv->invoice_id] ?? 0));
            }
            $date = $inv->created_at ? substr((string) $inv->created_at, 0, 10) : null;
            if ($date && (!$out[$cid]['last'] || $date > $out[$cid]['last'])) {
                $out[$cid]['last'] = $date;
            }
        }
        foreach ($out as &$b) {
            $b['billed'] = round($b['billed'], 2);
            $b['outstanding'] = round($b['outstanding'], 2);
        }
        return $out;
    }

    public static function present(Customer $c, ?array $billing = null, $regions = null, $countries = null): array
    {
        $region = $regions?->get($c->region_id);
        $country = $countries?->get($c->country_id);

        return [
            'id'          => IdEncoder::encode((int) $c->customer_id),
            'name'        => (string) $c->company_name,
            'email'       => (string) ($c->email ?? ''),
            'phone'       => (string) ($c->phone ?? ''),
            'website'     => (string) ($c->website_url ?? ''),
            'address'     => (string) ($c->address ?? ''),
            'city'        => (string) ($c->city ?? ''),
            'region_id'   => $c->region_id ?: null,
            'region'      => $region ? (string) $region->region : '',
            'region_code' => $region ? (string) $region->region_code : '',
            'country_id'  => $c->country_id ?: null,
            'country'     => $country ? (string) $country->country : '',
            'postal'      => (string) ($c->area_code ?? ''),
            'logo'        => $c->avatar_url ? getAssetBase() . self::LOGO_DIR . rawurlencode((string) $c->avatar_url) : null,
            'active'      => (int) $c->status_id === Customer::ACTIVE,
            'since'       => $c->created_at ? $c->created_at->format('Y-m-d') : null,
            'billing'     => $billing ?? ['invoices' => 0, 'billed' => 0, 'open' => 0, 'outstanding' => 0, 'last' => null],
        ];
    }

    /**
     * One customer's invoices (newest first) for the detail view.
     */
    public static function invoices(string $encodedId): array
    {
        $id = IdEncoder::decode($encodedId);
        if (!$id || !Capsule::schema()->hasTable('invoices')) {
            return [];
        }
        $paid = Capsule::schema()->hasTable('receipts')
            ? Capsule::table('receipts')->where('status_id', '<>', 0)->groupBy('invoice_id')->selectRaw('invoice_id, SUM(amount_paid) paid')->pluck('paid', 'invoice_id')
            : collect();
        $statuses = Capsule::schema()->hasTable('invoice_statuses')
            ? Capsule::table('invoice_statuses')->get()->keyBy('invoice_status_id')
            : collect();

        return Capsule::table('invoices')->where('customer_id', $id)->orderByDesc('created_at')->orderByDesc('invoice_id')->get()
            ->map(function ($i) use ($paid, $statuses) {
                $s = $statuses->get($i->status_id);
                return [
                    'id'       => IdEncoder::encode((int) $i->invoice_id), // opens it in Invoices
                    'number'   => (string) $i->invoice_number,
                    'title'    => (string) ($i->invoice_title ?? ''),
                    'due'      => $i->due_date ? (string) $i->due_date : null,
                    'created'  => $i->created_at ? substr((string) $i->created_at, 0, 10) : null,
                    'total'    => round((float) $i->invoice_total, 2),
                    'paid'     => round((float) ($paid[$i->invoice_id] ?? 0), 2),
                    'currency' => (string) ($i->currency_id ?: 'CAD'),
                    'status'   => $s ? (string) $s->status_name : 'Unknown',
                    'color'    => $s ? (string) $s->status_color : 'gray',
                ];
            })->values()->all();
    }

    // ============================================================
    // Writes
    // ============================================================

    public function save(array $data, int $userId): array
    {
        try {
            $encodedId = trim((string) ($data['id'] ?? ''));
            $isNew = $encodedId === '';

            $f = [
                'company_name' => trim((string) ($data['name'] ?? '')),
                'email'        => mb_strtolower(trim((string) ($data['email'] ?? ''))),
                'phone'        => trim((string) ($data['phone'] ?? '')),
                'website_url'  => trim((string) ($data['website'] ?? '')),
                'address'      => trim((string) ($data['address'] ?? '')),
                'city'         => trim((string) ($data['city'] ?? '')),
                'area_code'    => mb_strtoupper(trim((string) ($data['postal'] ?? ''))),
                'country_id'   => (int) ($data['country_id'] ?? 0) ?: null,
                'region_id'    => (int) ($data['region_id'] ?? 0) ?: null,
            ];
            $id = $isNew ? 0 : (int) (IdEncoder::decode($encodedId) ?? 0);

            $errors = [];
            if ($f['company_name'] === '') {
                $errors[] = 'Enter the customer or company name.';
            } elseif (mb_strlen($f['company_name']) > 255) {
                $errors[] = 'The name must be 255 characters or fewer.';
            } elseif (Customer::whereRaw('LOWER(company_name) = ?', [mb_strtolower($f['company_name'])])->where('customer_id', '<>', $id)->exists()) {
                $errors[] = "There's already a customer called “{$f['company_name']}”.";
            }
            if ($f['email'] !== '' && !filter_var($f['email'], FILTER_VALIDATE_EMAIL)) {
                $errors[] = 'That email address doesn’t look right.';
            } elseif ($f['email'] !== '' && Customer::whereRaw('LOWER(email) = ?', [$f['email']])->where('customer_id', '<>', $id)->exists()) {
                $errors[] = 'Another customer already uses that email address.';
            }
            if (mb_strlen($f['phone']) > 50) {
                $errors[] = 'The phone number is too long.';
            }
            if ($f['website_url'] !== '' && !filter_var(preg_match('#^https?://#i', $f['website_url']) ? $f['website_url'] : 'https://' . $f['website_url'], FILTER_VALIDATE_URL)) {
                $errors[] = 'That website address doesn’t look right.';
            }
            foreach (['address' => 'address', 'city' => 'city'] as $k => $label) {
                if (mb_strlen($f[$k]) > 255) {
                    $errors[] = "The {$label} is too long.";
                }
            }
            if (mb_strlen($f['area_code']) > 16) {
                $errors[] = 'The postal / ZIP code is too long.';
            }
            if ($f['country_id'] && !Capsule::table('countries')->where('country_id', $f['country_id'])->exists()) {
                $errors[] = 'Choose a country from the list.';
            }
            if ($f['region_id'] && !Capsule::table('regions')->where('region_id', $f['region_id'])->where('country_id', $f['country_id'] ?? 0)->exists()) {
                $errors[] = 'Choose a province / state in that country.';
            }
            if ($errors) {
                return ['success' => false, 'messages' => $errors];
            }
            foreach (['email', 'phone', 'website_url', 'address', 'city', 'area_code'] as $k) {
                $f[$k] = $f[$k] !== '' ? $f[$k] : null;
            }

            if ($isNew) {
                $customer = Capsule::connection()->transaction(function () use ($f, $userId) {
                    // The legacy table may not auto-increment: take the next id under a lock
                    $next = (int) Capsule::table('customers')->lockForUpdate()->max('customer_id') + 1;
                    $c = new Customer($f);
                    $c->customer_id = $next;
                    $c->orig_user_id = $userId;
                    $c->status_id = Customer::ACTIVE;
                    $c->save();
                    return $c;
                });
                static::logActivity("Added customer: {$customer->company_name}", 'Customers', $customer->customer_id);
            } else {
                $customer = Customer::find($id);
                if (!$customer) {
                    return ['success' => false, 'messages' => ['Customer not found.']];
                }
                $customer->fill($f)->save();
                static::logActivity("Updated customer: {$customer->company_name}", 'Customers', $customer->customer_id);
            }

            return ['success' => true, 'messages' => [$isNew ? 'Customer added.' : 'Customer saved.']] + self::state() + ['saved' => IdEncoder::encode((int) $customer->customer_id)];
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not save the customer: ' . $e->getMessage()]];
        }
    }

    public function setActive(string $encodedId, bool $active): array
    {
        try {
            $customer = Customer::find(IdEncoder::decode($encodedId) ?? 0);
            if (!$customer) {
                return ['success' => false, 'messages' => ['Customer not found.']];
            }
            $customer->status_id = $active ? Customer::ACTIVE : Customer::ARCHIVED;
            $customer->save();
            static::logActivity(($active ? 'Restored customer: ' : 'Archived customer: ') . $customer->company_name, 'Customers', $customer->customer_id);

            return ['success' => true, 'messages' => [$active ? 'Customer restored.' : 'Customer archived.']] + self::state();
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not update the customer: ' . $e->getMessage()]];
        }
    }

    /** Delete — only customers with no invoices (otherwise archive them). */
    public function delete(string $encodedId): array
    {
        try {
            $customer = Customer::find(IdEncoder::decode($encodedId) ?? 0);
            if (!$customer) {
                return ['success' => false, 'messages' => ['Customer not found.']];
            }
            if (Capsule::schema()->hasTable('invoices') && Capsule::table('invoices')->where('customer_id', $customer->customer_id)->exists()) {
                return ['success' => false, 'messages' => ["{$customer->company_name} has invoices, so they can't be deleted — archive them instead."]];
            }
            $name = (string) $customer->company_name;
            $logo = $customer->avatar_url;
            $cid = (int) $customer->customer_id;
            Customer::where('customer_id', $cid)->delete();
            self::unlinkLogo($logo);
            static::logActivity("Deleted customer: {$name}", 'Customers', $cid);

            return ['success' => true, 'messages' => ["“{$name}” deleted."]] + self::state();
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not delete the customer: ' . $e->getMessage()]];
        }
    }

    /** Attach (or replace) a customer's logo; $fileName is already in LOGO_DIR. */
    public static function attachLogo(string $encodedId, string $fileName): array
    {
        $customer = Customer::find(IdEncoder::decode($encodedId) ?? 0);
        if (!$customer) {
            return ['success' => false, 'messages' => ['Customer not found.']];
        }
        $old = $customer->avatar_url;
        $customer->avatar_url = $fileName;
        $customer->save();
        if ($old && $old !== $fileName) {
            self::unlinkLogo($old);
        }
        static::logActivity("Updated the logo for {$customer->company_name}", 'Customers', $customer->customer_id);
        return ['success' => true, 'messages' => ['Logo updated.'], 'logo' => getAssetBase() . self::LOGO_DIR . rawurlencode($fileName)];
    }

    public function removeLogo(string $encodedId): array
    {
        $customer = Customer::find(IdEncoder::decode($encodedId) ?? 0);
        if (!$customer) {
            return ['success' => false, 'messages' => ['Customer not found.']];
        }
        self::unlinkLogo($customer->avatar_url);
        $customer->avatar_url = null;
        $customer->save();
        static::logActivity("Removed the logo for {$customer->company_name}", 'Customers', $customer->customer_id);
        return ['success' => true, 'messages' => ['Logo removed.']] + self::state();
    }

    /** CSV of the directory (as currently stored). */
    public static function csv(): string
    {
        $s = self::state();
        $rows = [['Customer', 'Email', 'Phone', 'Website', 'Address', 'City', 'Province / State', 'Country', 'Postal code', 'Status', 'Invoices', 'Billed', 'Outstanding', 'Customer since']];
        foreach ($s['customers'] as $c) {
            $rows[] = [$c['name'], $c['email'], $c['phone'], $c['website'], $c['address'], $c['city'], $c['region'], $c['country'], $c['postal'],
                $c['active'] ? 'Active' : 'Archived', $c['billing']['invoices'], number_format((float) $c['billing']['billed'], 2, '.', ''),
                number_format((float) $c['billing']['outstanding'], 2, '.', ''), $c['since'] ?? ''];
        }
        $fh = fopen('php://temp', 'r+');
        foreach ($rows as $r) {
            // Neutralise spreadsheet formulas in user-entered text
            fputcsv($fh, array_map(fn($v) => is_string($v) && preg_match('/^[=+\-@]/', $v) ? "'" . $v : $v, $r));
        }
        rewind($fh);
        return "\xEF\xBB\xBF" . stream_get_contents($fh);
    }

    private static function unlinkLogo(?string $file): void
    {
        $name = basename((string) $file);
        if ($name === '' || Customer::where('avatar_url', $name)->exists()) {
            return;
        }
        $path = __DIR__ . '/../../public/' . self::LOGO_DIR . $name;
        if (is_file($path)) {
            @unlink($path);
        }
    }
}
