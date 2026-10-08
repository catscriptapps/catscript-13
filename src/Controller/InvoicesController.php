<?php
// /src/Controller/InvoicesController.php

declare(strict_types=1);

namespace Src\Controller;

use App\Models\Counter;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Traits\RecentActivityLogger;
use App\Utils\IdEncoder;
use Illuminate\Database\Capsule\Manager as Capsule;
use Src\Service\AuthService;
use Src\Service\MailService;
use Src\Utils\RichText;

/**
 * Invoices — itemised invoices for business customers (ported from the
 * legacy CatScript Invoices app, on the same legacy `invoices` /
 * `invoice_items` tables, which hold live production data).
 *
 * Kept from legacy: invoice numbers CA-INV{yy}-{nnnn} from the shared
 * `counters` row (so the two apps never hand out the same number), rich-text
 * line items, negative lines for discounts, payment / delivery terms, the six
 * statuses, and the "From" block taken from the sender's own business
 * profile (users.customer_id). Fixed from legacy: line-item HTML is cleaned
 * (RichText) instead of printed raw, totals are always recomputed on the
 * server, and an invoice with payments recorded can't be deleted.
 *
 * Payments come from the legacy `receipts` table (read-only here — they're
 * recorded in Receipts, which also keeps the invoice's status in step), so
 * each invoice shows what's paid and the balance. Changes are logged to
 * recent_activities (entity_type "Invoices").
 */
class InvoicesController
{
    use RecentActivityLogger;

    private const MAX_ITEMS = 100;
    private const MAX_AMOUNT = 9999999999999.99; // decimal(15,2)
    /** Statuses that no longer count towards the balance owed */
    private const CLOSED = [Invoice::PAID, Invoice::CANCELLED];

    // ============================================================
    // Reads
    // ============================================================

    public static function state(): array
    {
        $paid = self::paidByInvoice();
        $customers = Customer::orderBy('company_name')->get()->keyBy('customer_id');
        $statuses = self::statuses();

        $invoices = Invoice::orderByDesc('created_at')->orderByDesc('invoice_id')->get()
            ->map(fn(Invoice $i) => self::presentSummary($i, $customers->get($i->customer_id), (float) ($paid[$i->invoice_id] ?? 0), $statuses))
            ->values()->all();

        return [
            'invoices'  => $invoices,
            'customers' => $customers->values()->map(fn(Customer $c) => [
                'id'     => IdEncoder::encode((int) $c->customer_id),
                'name'   => (string) $c->company_name,
                'city'   => (string) ($c->city ?? ''),
                'email'  => (string) ($c->email ?? ''),
                'active' => (int) $c->status_id === Customer::ACTIVE,
                'logo'   => $c->avatar_url ? getAssetBase() . CustomersController::LOGO_DIR . rawurlencode((string) $c->avatar_url) : null,
            ])->all(),
            'statuses'       => array_values($statuses),
            'payment_terms'  => self::terms('payment_terms', 'payment_term_id', 'payment_term'),
            'delivery_terms' => self::terms('delivery_terms', 'delivery_term_id', 'delivery_term'),
            'currencies'     => Invoice::CURRENCIES,
            'next_number'    => self::peekNumber(),
            'today'          => date('Y-m-d'),
            'can_email'      => MailService::isConfigured(),
        ];
    }

    /** @return array<int, array{id: int, name: string, color: string}> keyed by id */
    private static function statuses(): array
    {
        $out = [];
        foreach (Capsule::table('invoice_statuses')->orderBy('invoice_status_id')->get() as $s) {
            $out[(int) $s->invoice_status_id] = ['id' => (int) $s->invoice_status_id, 'name' => (string) $s->status_name, 'color' => (string) $s->status_color];
        }
        return $out;
    }

    private static function terms(string $table, string $idCol, string $labelCol): array
    {
        return Capsule::table($table)->where('status_id', 1)->orderBy($idCol)->get()
            ->map(fn($t) => ['id' => (int) $t->$idCol, 'name' => (string) $t->$labelCol])->values()->all();
    }

    /** @return \Illuminate\Support\Collection invoice_id => amount paid */
    private static function paidByInvoice()
    {
        return Capsule::schema()->hasTable('receipts')
            ? Capsule::table('receipts')->where('status_id', '<>', 0)->groupBy('invoice_id')->selectRaw('invoice_id, SUM(amount_paid) AS paid')->pluck('paid', 'invoice_id')
            : collect();
    }

    private static function presentSummary(Invoice $i, ?Customer $c, float $paid, array $statuses): array
    {
        $total = round((float) $i->invoice_total, 2);
        $status = $statuses[$i->status_id] ?? ['id' => (int) $i->status_id, 'name' => 'Unknown', 'color' => 'gray'];
        $open = !in_array((int) $i->status_id, self::CLOSED, true);
        $due = $i->due_date ? substr((string) $i->due_date, 0, 10) : null;

        return [
            'id'          => IdEncoder::encode((int) $i->invoice_id),
            'number'      => (string) $i->invoice_number,
            'title'       => (string) ($i->invoice_title ?? ''),
            'customer_id' => $c ? IdEncoder::encode((int) $c->customer_id) : null,
            'customer'    => $c ? (string) $c->company_name : 'Unknown customer',
            'due'         => $due,
            'created'     => $i->created_at ? $i->created_at->format('Y-m-d') : null,
            'total'       => $total,
            'paid'        => round($paid, 2),
            'balance'     => $open ? round(max(0, $total - $paid), 2) : 0.0,
            'currency'    => in_array($i->currency_id, Invoice::CURRENCIES, true) ? $i->currency_id : 'CAD',
            'status'      => $status,
            'open'        => $open,
            // Past due and still unpaid (whatever status was last set by hand)
            'overdue'     => $open && (int) $i->status_id !== Invoice::DRAFT && $due && $due < date('Y-m-d'),
        ];
    }

    /** Everything for the invoice view / editor. */
    public static function detail(string $encodedId): ?array
    {
        $invoice = Invoice::find(IdEncoder::decode($encodedId) ?? 0);
        if (!$invoice) {
            return null;
        }
        $customer = Customer::find($invoice->customer_id);
        $paid = (float) (self::paidByInvoice()[$invoice->invoice_id] ?? 0);

        $items = InvoiceItem::where('invoice_id', $invoice->invoice_id)->orderBy('order_index')->orderBy('item_id')->get()
            ->map(fn(InvoiceItem $it) => [
                'description' => RichText::clean((string) $it->description),
                'quantity'    => round((float) $it->quantity, 2),
                'unit_price'  => round((float) $it->unit_price, 2),
                'amount'      => round((float) $it->quantity * (float) $it->unit_price, 2),
            ])->values()->all();

        $receipts = Capsule::schema()->hasTable('receipts')
            ? Capsule::table('receipts')->where('invoice_id', $invoice->invoice_id)->where('status_id', '<>', 0)->orderBy('payment_date')->get()
                ->map(fn($r) => [
                    'id'     => IdEncoder::encode((int) $r->receipt_id), // opens it in Receipts
                    'number' => (string) $r->receipt_number,
                    'amount' => round((float) $r->amount_paid, 2),
                    'date'   => $r->payment_date ? substr((string) $r->payment_date, 0, 10) : null,
                    'method' => (string) ($r->payment_method ?? ''),
                    'note'   => (string) ($r->reference_note ?? ''),
                ])->values()->all()
            : [];

        return self::presentSummary($invoice, $customer, $paid, self::statuses()) + [
            'payment_term_id'  => $invoice->payment_term_id ? (int) $invoice->payment_term_id : null,
            'delivery_term_id' => $invoice->delivery_term_id ? (int) $invoice->delivery_term_id : null,
            'items'            => $items,
            'receipts'         => $receipts,
            'customer_email'   => (string) ($customer->email ?? ''),
        ];
    }

    // ============================================================
    // Writes
    // ============================================================

    /**
     * Create or update. Items are replaced as a whole; the total is always
     * recomputed here from quantity × rate (the client's figures are ignored).
     */
    public function save(array $data, int $userId): array
    {
        try {
            $encodedId = trim((string) ($data['id'] ?? ''));
            $isNew = $encodedId === '';

            $customer = Customer::find(IdEncoder::decode((string) ($data['customer_id'] ?? '')) ?? 0);
            $title = trim((string) ($data['title'] ?? ''));
            $due = trim((string) ($data['due'] ?? ''));
            $currency = strtoupper(trim((string) ($data['currency'] ?? 'CAD')));
            $paymentTerm = (int) ($data['payment_term_id'] ?? 0) ?: null;
            $deliveryTerm = (int) ($data['delivery_term_id'] ?? 0) ?: null;
            $status = (int) ($data['status_id'] ?? Invoice::DRAFT);

            $errors = [];
            if (!$customer) {
                $errors[] = 'Choose who the invoice is for.';
            }
            if ($title === '') {
                $errors[] = 'Give the invoice a title (the project or reference).';
            } elseif (mb_strlen($title) > 255) {
                $errors[] = 'The title must be 255 characters or fewer.';
            }
            if ($due !== '') {
                $d = \DateTime::createFromFormat('!Y-m-d', $due);
                if (!$d || $d->format('Y-m-d') !== $due) {
                    $errors[] = 'Choose a valid due date (or leave it for "upon receipt").';
                }
            }
            if (!in_array($currency, Invoice::CURRENCIES, true)) {
                $errors[] = 'Choose CAD or USD.';
            }
            if ($paymentTerm && !Capsule::table('payment_terms')->where('payment_term_id', $paymentTerm)->exists()) {
                $errors[] = 'Choose payment terms from the list.';
            }
            if ($deliveryTerm && !Capsule::table('delivery_terms')->where('delivery_term_id', $deliveryTerm)->exists()) {
                $errors[] = 'Choose delivery terms from the list.';
            }
            if (!isset(self::statuses()[$status])) {
                $errors[] = 'Choose a status.';
            }

            // Lines
            $lines = [];
            foreach (array_slice((array) ($data['items'] ?? []), 0, self::MAX_ITEMS + 1) as $n => $raw) {
                $desc = RichText::clean((string) ($raw['description'] ?? ''));
                $qty = str_replace([',', ' '], '', (string) ($raw['quantity'] ?? ''));
                $rate = str_replace([',', ' ', '$'], '', (string) ($raw['unit_price'] ?? ''));
                if (RichText::text($desc) === '' && $qty === '' && $rate === '') {
                    continue; // an empty row
                }
                $row = $n + 1;
                if (RichText::text($desc) === '') {
                    $errors[] = "Line {$row}: describe the work.";
                }
                if (!preg_match('/^-?\d+(\.\d{1,2})?$/', $qty) || (float) $qty == 0.0) {
                    $errors[] = "Line {$row}: enter a quantity (use a negative number for a discount).";
                }
                if (!preg_match('/^\d+(\.\d{1,2})?$/', $rate)) {
                    $errors[] = "Line {$row}: enter a rate like 80 or 80.50.";
                }
                if (mb_strlen($desc) > 20000) {
                    $errors[] = "Line {$row}: the description is too long.";
                }
                $lines[] = ['description' => $desc, 'quantity' => round((float) $qty, 2), 'unit_price' => round((float) $rate, 2)];
            }
            if (!$lines) {
                $errors[] = 'Add at least one line.';
            } elseif (count($lines) > self::MAX_ITEMS) {
                $errors[] = 'An invoice can have up to ' . self::MAX_ITEMS . ' lines.';
            }
            $total = round(array_sum(array_map(fn($l) => $l['quantity'] * $l['unit_price'], $lines)), 2);
            if (!$errors && $total < 0) {
                $errors[] = 'The total can’t be below zero — check the discount lines.';
            }
            if (abs($total) > self::MAX_AMOUNT) {
                $errors[] = 'That total is too large.';
            }
            if ($errors) {
                return ['success' => false, 'messages' => $errors];
            }

            $fields = [
                'customer_id'      => (int) $customer->customer_id,
                'invoice_title'    => $title,
                'due_date'         => $due !== '' ? $due : null,
                'invoice_total'    => number_format($total, 2, '.', ''),
                'currency_id'      => $currency,
                'payment_term_id'  => $paymentTerm,
                'delivery_term_id' => $deliveryTerm,
                'status_id'        => $status,
            ];

            $invoice = Capsule::connection()->transaction(function () use ($isNew, $encodedId, $fields, $lines, $userId) {
                if ($isNew) {
                    $invoice = new Invoice($fields);
                    // The legacy tables may not auto-increment: next ids under a lock
                    $invoice->invoice_id = (int) Capsule::table('invoices')->lockForUpdate()->max('invoice_id') + 1;
                    $invoice->invoice_number = self::nextNumber();
                    $invoice->orig_user_id = $userId;
                    $invoice->save();
                } else {
                    $invoice = Invoice::find(IdEncoder::decode($encodedId) ?? 0);
                    if (!$invoice) {
                        return null;
                    }
                    $invoice->fill($fields)->save();
                    InvoiceItem::where('invoice_id', $invoice->invoice_id)->delete();
                }

                $nextItem = (int) Capsule::table('invoice_items')->lockForUpdate()->max('item_id') + 1;
                foreach ($lines as $i => $l) {
                    $item = new InvoiceItem([
                        'invoice_id'  => $invoice->invoice_id,
                        'description' => $l['description'],
                        'quantity'    => number_format($l['quantity'], 2, '.', ''),
                        'unit_price'  => number_format($l['unit_price'], 2, '.', ''),
                        'subtotal'    => number_format($l['quantity'] * $l['unit_price'], 2, '.', ''),
                        'order_index' => $i,
                    ]);
                    $item->item_id = $nextItem++;
                    $item->save();
                }
                return $invoice;
            });

            if (!$invoice) {
                return ['success' => false, 'messages' => ['Invoice not found.']];
            }

            $who = $customer->company_name;
            static::logActivity(($isNew ? 'Created' : 'Updated') . " invoice {$invoice->invoice_number} for {$who} ({$currency} " . number_format($total, 2) . ')', 'Invoices', $invoice->invoice_id);

            return ['success' => true, 'messages' => [$isNew ? "Invoice {$invoice->invoice_number} created." : 'Invoice saved.'], 'saved' => IdEncoder::encode((int) $invoice->invoice_id)] + self::state();
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not save the invoice: ' . $e->getMessage()]];
        }
    }

    public function setStatus(string $encodedId, int $status): array
    {
        try {
            $invoice = Invoice::find(IdEncoder::decode($encodedId) ?? 0);
            $statuses = self::statuses();
            if (!$invoice || !isset($statuses[$status])) {
                return ['success' => false, 'messages' => ['Invoice or status not found.']];
            }
            $invoice->status_id = $status;
            $invoice->save();
            static::logActivity("Marked invoice {$invoice->invoice_number} as {$statuses[$status]['name']}", 'Invoices', $invoice->invoice_id);

            return ['success' => true, 'messages' => ["Marked as {$statuses[$status]['name']}."]] + self::state();
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not update the invoice: ' . $e->getMessage()]];
        }
    }

    /** A new draft with the same customer, title and lines. */
    public function duplicate(string $encodedId, int $userId): array
    {
        $d = self::detail($encodedId);
        if (!$d) {
            return ['success' => false, 'messages' => ['Invoice not found.']];
        }
        return $this->save([
            'customer_id' => $d['customer_id'], 'title' => $d['title'], 'due' => '', 'currency' => $d['currency'],
            'payment_term_id' => $d['payment_term_id'], 'delivery_term_id' => $d['delivery_term_id'], 'status_id' => Invoice::DRAFT,
            'items' => $d['items'],
        ], $userId);
    }

    /** Delete — not once payments have been recorded against it (cancel it instead). */
    public function delete(string $encodedId): array
    {
        try {
            $invoice = Invoice::find(IdEncoder::decode($encodedId) ?? 0);
            if (!$invoice) {
                return ['success' => false, 'messages' => ['Invoice not found.']];
            }
            if (Capsule::schema()->hasTable('receipts') && Capsule::table('receipts')->where('invoice_id', $invoice->invoice_id)->exists()) {
                return ['success' => false, 'messages' => ["{$invoice->invoice_number} has payments recorded, so it can't be deleted — mark it Cancelled instead."]];
            }
            $number = (string) $invoice->invoice_number;
            $id = (int) $invoice->invoice_id;
            Capsule::connection()->transaction(function () use ($id) {
                InvoiceItem::where('invoice_id', $id)->delete();
                Invoice::where('invoice_id', $id)->delete();
            });
            static::logActivity("Deleted invoice {$number}", 'Invoices', $id);

            return ['success' => true, 'messages' => ["{$number} deleted."]] + self::state();
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not delete the invoice: ' . $e->getMessage()]];
        }
    }

    // ============================================================
    // PDF & email
    // ============================================================

    /** The invoice as PDF bytes (+ its data), or null. */
    public static function pdf(string $encodedId): ?array
    {
        $d = self::detail($encodedId);
        if (!$d) {
            return null;
        }
        $invoice = Invoice::find(IdEncoder::decode($encodedId));
        $customer = Customer::find($invoice->customer_id);
        $senderId = (int) (AuthService::currentUser()->customer_id ?? 0) ?: 1;
        $sender = Customer::find($senderId);

        $region = fn(?Customer $c) => $c && $c->region_id ? Capsule::table('regions')->where('region_id', $c->region_id)->first() : null;
        $country = fn(?Customer $c) => $c && $c->country_id ? Capsule::table('countries')->where('country_id', $c->country_id)->first() : null;
        $term = fn(string $t, string $idc, string $lc, ?int $id) => $id ? (string) (Capsule::table($t)->where($idc, $id)->value($lc) ?? '') : '';

        $storage = __DIR__ . '/../../server/storage';
        $temp = $storage . '/mpdf-temp';
        if (!is_dir($temp)) {
            mkdir($temp, 0775, true);
        }
        $defaults = (new \Mpdf\Config\ConfigVariables())->getDefaults();
        $fonts = (new \Mpdf\Config\FontVariables())->getDefaults();
        $mpdf = new \Mpdf\Mpdf([
            'mode' => 'utf-8', 'format' => 'A4', 'tempDir' => $temp,
            'margin_left' => 12, 'margin_right' => 12, 'margin_top' => 14, 'margin_bottom' => 14,
            'fontDir' => array_merge($defaults['fontDir'], [$storage . '/fonts']),
            'fontdata' => $fonts['fontdata'] + ['quicksand' => ['R' => 'Quicksand-Regular.ttf', 'B' => 'Quicksand-Bold.ttf']],
            'default_font' => 'quicksand',
        ]);
        $mpdf->SetTitle("Invoice {$d['number']}");
        $mpdf->WriteHTML(renderView(__DIR__ . '/../../resources/views/components/invoices/print.php', [
            'inv' => $d,
            'customer' => $customer, 'customerRegion' => $region($customer), 'customerCountry' => $country($customer),
            'sender' => $sender, 'senderRegion' => $region($sender), 'senderCountry' => $country($sender),
            'paymentTerm' => $term('payment_terms', 'payment_term_id', 'payment_term', $d['payment_term_id']),
            'deliveryTerm' => $term('delivery_terms', 'delivery_term_id', 'delivery_term', $d['delivery_term_id']),
        ]));

        $name = 'Invoice-' . preg_replace('/[^A-Za-z0-9-]+/', '-', $d['number']) . '.pdf';
        return ['bytes' => $mpdf->Output($name, \Mpdf\Output\Destination::STRING_RETURN), 'name' => $name, 'invoice' => $d, 'sender' => $sender];
    }

    /** Email the PDF to the customer (and mark a draft as Sent). */
    public function email(string $encodedId, string $to, string $message): array
    {
        try {
            if (!MailService::isConfigured()) {
                return ['success' => false, 'messages' => ['Email isn’t set up on this server yet — download the PDF and send it yourself.']];
            }
            $to = trim($to);
            if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
                return ['success' => false, 'messages' => ['Enter the email address to send it to.']];
            }
            $pdf = self::pdf($encodedId);
            if (!$pdf) {
                return ['success' => false, 'messages' => ['Invoice not found.']];
            }
            $d = $pdf['invoice'];
            $from = (string) ($pdf['sender']->company_name ?? 'CatScript Apps');
            $amount = $d['currency'] . ' ' . number_format($d['total'], 2);
            $body = '<p>' . nl2br(htmlspecialchars(trim($message) !== '' ? trim($message) : "Hello,\n\nPlease find invoice {$d['number']} attached.\n\nThank you for your business.")) . '</p>'
                . '<p style="color:#6b7280;font-size:13px">' . htmlspecialchars("{$d['number']} · {$d['title']} · {$amount}" . ($d['due'] ? ' · due ' . date('M j, Y', strtotime($d['due'])) : '')) . '</p>'
                . '<p>— ' . htmlspecialchars($from) . '</p>';

            $ok = MailService::send($to, "Invoice {$d['number']} from {$from}", $body,
                [['content' => $pdf['bytes'], 'name' => $pdf['name'], 'type' => 'application/pdf']],
                $pdf['sender']->email ?? null);
            if (!$ok) {
                return ['success' => false, 'messages' => ['The email could not be sent. Please try again, or download the PDF.']];
            }

            $invoice = Invoice::find(IdEncoder::decode($encodedId));
            if ((int) $invoice->status_id === Invoice::DRAFT) {
                $invoice->status_id = Invoice::SENT;
                $invoice->save();
            }
            static::logActivity("Emailed invoice {$d['number']} to {$to}", 'Invoices', $invoice->invoice_id);

            return ['success' => true, 'messages' => ["Sent to {$to}."]] + self::state();
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not send the invoice: ' . $e->getMessage()]];
        }
    }

    // ============================================================
    // Numbering (shared with the legacy app)
    // ============================================================

    /** What the next invoice number will be (display only — not reserved). */
    private static function peekNumber(): string
    {
        $year = date('y');
        $n = (int) (Counter::where('type', 'invoice')->where('year', $year)->value('last_value') ?? 0);
        return "CA-INV{$year}-" . str_pad((string) ($n + 1), 4, '0', STR_PAD_LEFT);
    }

    /**
     * Next CA-INV{yy}-{nnnn}: takes (and increments) the same `counters` row
     * as the legacy app, locked for the surrounding transaction, skipping any
     * number already used — so the two apps can never collide.
     */
    private static function nextNumber(): string
    {
        $year = date('y');
        $find = fn() => Counter::where('type', 'invoice')->where('year', $year)->lockForUpdate()->first();
        $counter = $find();
        if (!$counter) {
            // A new year. counters.counter_id doesn't auto-increment in the legacy schema.
            Capsule::table('counters')->insert([
                'counter_id' => (int) Capsule::table('counters')->lockForUpdate()->max('counter_id') + 1,
                'type' => 'invoice', 'year' => $year, 'last_value' => 0,
                'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s'),
            ]);
            $counter = $find();
        }

        $n = (int) $counter->last_value;
        do {
            $n++;
            $number = "CA-INV{$year}-" . str_pad((string) $n, 4, '0', STR_PAD_LEFT);
        } while (Invoice::where('invoice_number', $number)->exists());

        $counter->last_value = $n;
        $counter->save();
        return $number;
    }
}
