<?php
// /src/Controller/ReceiptsController.php

declare(strict_types=1);

namespace Src\Controller;

use App\Models\Counter;
use App\Models\Customer;
use App\Models\Invoice;
use App\Models\Receipt;
use App\Traits\RecentActivityLogger;
use App\Utils\IdEncoder;
use Illuminate\Database\Capsule\Manager as Capsule;
use Src\Service\AuthService;
use Src\Service\MailService;

/**
 * Receipts — payments received against invoices (ported from the legacy
 * CatScript Receipts app, on the same legacy `receipts` table, which holds
 * live production data).
 *
 * Kept from legacy: receipt numbers CA-RCP{yy}-{nnnn} from the shared
 * `counters` row (so the two apps never hand out the same number), the
 * payment method / date / reference note, voided receipts (status_id 0)
 * staying on file, the A4 PDF, and the invoice's status following its
 * payments. Fixed from legacy: a payment can't be more than what's still
 * owing, nothing can be recorded against a cancelled invoice, the invoice
 * status uses the real invoice_statuses ids (Partially Paid / Paid In Full),
 * the number is taken inside the same locked transaction as the save, and
 * moving a receipt to another invoice re-tallies both.
 *
 * Changes are logged to recent_activities (entity_type "Receipts").
 */
class ReceiptsController
{
    use RecentActivityLogger;

    private const MAX_NOTE = 255;

    // ============================================================
    // Reads
    // ============================================================

    public static function state(): array
    {
        $statuses = self::invoiceStatuses();
        $customers = Customer::orderBy('company_name')->get()->keyBy('customer_id');
        $invoices = Invoice::orderByDesc('created_at')->orderByDesc('invoice_id')->get()->keyBy('invoice_id');
        $paid = self::paidByInvoice();

        $receipts = Receipt::orderByDesc('payment_date')->orderByDesc('receipt_id')->get()
            ->map(function (Receipt $r) use ($invoices, $customers, $statuses, $paid) {
                $i = $invoices->get($r->invoice_id);
                return self::present($r, $i, $i ? $customers->get($i->customer_id) : null, $statuses, (float) ($paid[$r->invoice_id] ?? 0));
            })->values()->all();

        return [
            'receipts' => $receipts,
            // Every invoice (the editor offers the ones still owing)
            'invoices' => $invoices->values()->map(function (Invoice $i) use ($customers, $statuses, $paid) {
                $c = $customers->get($i->customer_id);
                return [
                    'id'          => IdEncoder::encode((int) $i->invoice_id),
                    'number'      => (string) $i->invoice_number,
                    'title'       => (string) ($i->invoice_title ?? ''),
                    'customer_id' => $c ? IdEncoder::encode((int) $c->customer_id) : null,
                    'customer'    => $c ? (string) $c->company_name : 'Unknown customer',
                    'total'       => round((float) $i->invoice_total, 2),
                    'paid'        => round((float) ($paid[$i->invoice_id] ?? 0), 2),
                    'currency'    => self::currency($i),
                    'due'         => $i->due_date ? substr((string) $i->due_date, 0, 10) : null,
                    'status'      => $statuses[$i->status_id] ?? ['id' => (int) $i->status_id, 'name' => 'Unknown', 'color' => 'gray'],
                ];
            })->all(),
            'customers' => $customers->values()->map(fn(Customer $c) => [
                'id'   => IdEncoder::encode((int) $c->customer_id),
                'name' => (string) $c->company_name,
                'logo' => $c->avatar_url ? getAssetBase() . CustomersController::LOGO_DIR . rawurlencode((string) $c->avatar_url) : null,
            ])->all(),
            'methods'     => Receipt::METHODS,
            'next_number' => self::peekNumber(),
            'today'       => date('Y-m-d'),
            'can_email'   => MailService::isConfigured(),
        ];
    }

    /** @return array<int, array{id: int, name: string, color: string}> keyed by id */
    private static function invoiceStatuses(): array
    {
        $out = [];
        foreach (Capsule::table('invoice_statuses')->orderBy('invoice_status_id')->get() as $s) {
            $out[(int) $s->invoice_status_id] = ['id' => (int) $s->invoice_status_id, 'name' => (string) $s->status_name, 'color' => (string) $s->status_color];
        }
        return $out;
    }

    /** @return \Illuminate\Support\Collection invoice_id => amount paid (active receipts) */
    private static function paidByInvoice()
    {
        return Receipt::where('status_id', '<>', Receipt::VOIDED)->groupBy('invoice_id')
            ->selectRaw('invoice_id, SUM(amount_paid) AS paid')->pluck('paid', 'invoice_id');
    }

    private static function paidOn(int $invoiceId, int $exceptReceiptId = 0): float
    {
        return round((float) Receipt::where('invoice_id', $invoiceId)->where('status_id', '<>', Receipt::VOIDED)
            ->where('receipt_id', '<>', $exceptReceiptId)->sum('amount_paid'), 2);
    }

    private static function currency(?Invoice $i): string
    {
        return $i && in_array($i->currency_id, Invoice::CURRENCIES, true) ? $i->currency_id : 'CAD';
    }

    private static function present(Receipt $r, ?Invoice $i, ?Customer $c, array $statuses, float $invoicePaid): array
    {
        $total = $i ? round((float) $i->invoice_total, 2) : 0.0;
        $cancelled = $i && (int) $i->status_id === Invoice::CANCELLED;

        return [
            'id'              => IdEncoder::encode((int) $r->receipt_id),
            'number'          => (string) $r->receipt_number,
            'amount'          => round((float) $r->amount_paid, 2),
            'date'            => $r->payment_date ? substr((string) $r->payment_date, 0, 10) : null,
            'method'          => (string) ($r->payment_method ?? ''),
            'note'            => (string) ($r->reference_note ?? ''),
            'active'          => (int) $r->status_id !== Receipt::VOIDED,
            'created'         => $r->created_at ? $r->created_at->format('Y-m-d') : null,
            'currency'        => self::currency($i),
            'invoice_id'      => $i ? IdEncoder::encode((int) $i->invoice_id) : null,
            'invoice_number'  => $i ? (string) $i->invoice_number : 'Missing invoice',
            'invoice_title'   => $i ? (string) ($i->invoice_title ?? '') : '',
            'invoice_total'   => $total,
            'invoice_paid'    => round($invoicePaid, 2),
            'invoice_balance' => $i && !$cancelled ? round(max(0, $total - $invoicePaid), 2) : 0.0,
            'invoice_status'  => $i ? ($statuses[$i->status_id] ?? ['id' => (int) $i->status_id, 'name' => 'Unknown', 'color' => 'gray']) : ['id' => 0, 'name' => 'Missing', 'color' => 'gray'],
            'customer_id'     => $c ? IdEncoder::encode((int) $c->customer_id) : null,
            'customer'        => $c ? (string) $c->company_name : 'Unknown customer',
        ];
    }

    /** Everything for the receipt view. */
    public static function detail(string $encodedId): ?array
    {
        $r = Receipt::find(IdEncoder::decode($encodedId) ?? 0);
        if (!$r) {
            return null;
        }
        $i = Invoice::find($r->invoice_id);
        $c = $i ? Customer::find($i->customer_id) : null;
        $region = $c && $c->region_id ? Capsule::table('regions')->where('region_id', $c->region_id)->value('region_code') : null;

        return self::present($r, $i, $c, self::invoiceStatuses(), $i ? self::paidOn((int) $i->invoice_id) : 0.0) + [
            'customer_email' => (string) ($c->email ?? ''),
            'customer_place' => implode(', ', array_filter([(string) ($c->city ?? ''), (string) ($region ?? '')])),
            'invoice_due'    => $i && $i->due_date ? substr((string) $i->due_date, 0, 10) : null,
        ];
    }

    // ============================================================
    // Writes
    // ============================================================

    /** Record a payment, or update one. The invoice's status follows. */
    public function save(array $data, int $userId): array
    {
        try {
            $encodedId = trim((string) ($data['id'] ?? ''));
            $isNew = $encodedId === '';
            $existing = $isNew ? null : Receipt::find(IdEncoder::decode($encodedId) ?? 0);
            if (!$isNew && !$existing) {
                return ['success' => false, 'messages' => ['Receipt not found.']];
            }

            $invoice = Invoice::find(IdEncoder::decode((string) ($data['invoice_id'] ?? '')) ?? 0);
            $amountRaw = str_replace([',', ' ', '$'], '', (string) ($data['amount'] ?? ''));
            $date = trim((string) ($data['date'] ?? ''));
            $method = trim((string) ($data['method'] ?? ''));
            $note = trim((string) ($data['note'] ?? ''));
            $sameInvoice = $existing && $invoice && (int) $existing->invoice_id === (int) $invoice->invoice_id;

            $errors = [];
            if (!$invoice) {
                $errors[] = 'Choose the invoice this payment is for.';
            } elseif ((int) $invoice->status_id === Invoice::CANCELLED && !$sameInvoice) {
                $errors[] = "{$invoice->invoice_number} is cancelled, so payments can't be recorded against it.";
            }
            $amountOk = (bool) preg_match('/^\d+(\.\d{1,2})?$/', $amountRaw) && (float) $amountRaw > 0;
            if (!$amountOk) {
                $errors[] = 'Enter the amount received, like 250 or 250.50.';
            }
            $d = \DateTime::createFromFormat('!Y-m-d', $date);
            if (!$d || $d->format('Y-m-d') !== $date) {
                $errors[] = 'Choose the date the payment was received.';
            }
            // Legacy receipts may carry a method that's not on the list — keep it on edit
            if (!in_array($method, Receipt::METHODS, true) && !($existing && $method !== '' && $method === (string) $existing->payment_method)) {
                $errors[] = 'Choose how it was paid.';
            }
            if (mb_strlen($note) > self::MAX_NOTE) {
                $errors[] = 'The reference note must be ' . self::MAX_NOTE . ' characters or fewer.';
            }
            // Never more than what's still owing (a voided receipt doesn't count, so isn't checked)
            if ($invoice && $amountOk && ($isNew || (int) $existing->status_id !== Receipt::VOIDED)) {
                $error = self::overpaid($invoice, round((float) $amountRaw, 2), $existing ? (int) $existing->receipt_id : 0);
                if ($error) {
                    $errors[] = $error;
                }
            }
            if ($errors) {
                return ['success' => false, 'messages' => $errors];
            }

            $amount = round((float) $amountRaw, 2);
            $fields = [
                'invoice_id'     => (int) $invoice->invoice_id,
                'amount_paid'    => number_format($amount, 2, '.', ''),
                'payment_date'   => $date,
                'payment_method' => $method,
                'reference_note' => $note !== '' ? $note : null,
            ];

            $receipt = Capsule::connection()->transaction(function () use ($isNew, $existing, $fields, $userId) {
                $previousInvoice = $existing ? (int) $existing->invoice_id : 0;
                if ($isNew) {
                    $receipt = new Receipt($fields + ['status_id' => Receipt::ACTIVE]);
                    // Next id under a lock (as for invoices — whether or not the column auto-increments)
                    $receipt->receipt_id = (int) Capsule::table('receipts')->lockForUpdate()->max('receipt_id') + 1;
                    $receipt->receipt_number = self::nextNumber();
                    $receipt->orig_user_id = $userId;
                    $receipt->save();
                } else {
                    $receipt = $existing;
                    $receipt->fill($fields)->save();
                }
                self::syncInvoice((int) $receipt->invoice_id);
                if ($previousInvoice && $previousInvoice !== (int) $receipt->invoice_id) {
                    self::syncInvoice($previousInvoice);
                }
                return $receipt;
            });

            $cur = self::currency($invoice);
            static::logActivity(($isNew ? 'Recorded' : 'Updated') . " receipt {$receipt->receipt_number} for invoice {$invoice->invoice_number} ({$cur} " . number_format($amount, 2) . ')', 'Receipts', $receipt->receipt_id);

            return ['success' => true, 'messages' => [$isNew ? "Payment recorded — receipt {$receipt->receipt_number}." : 'Receipt saved.'], 'saved' => IdEncoder::encode((int) $receipt->receipt_id)] + self::state();
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not save the receipt: ' . $e->getMessage()]];
        }
    }

    /** Void (keeps it on file, stops it counting) or restore a receipt. */
    public function setActive(string $encodedId, bool $active): array
    {
        try {
            $receipt = Receipt::find(IdEncoder::decode($encodedId) ?? 0);
            if (!$receipt) {
                return ['success' => false, 'messages' => ['Receipt not found.']];
            }
            $invoice = Invoice::find($receipt->invoice_id);
            if ($active) {
                if (!$invoice) {
                    return ['success' => false, 'messages' => ['Its invoice no longer exists, so the receipt can’t be restored.']];
                }
                if ((int) $invoice->status_id === Invoice::CANCELLED) {
                    return ['success' => false, 'messages' => ["{$invoice->invoice_number} is cancelled, so the receipt can’t be restored."]];
                }
                $error = self::overpaid($invoice, round((float) $receipt->amount_paid, 2), (int) $receipt->receipt_id);
                if ($error) {
                    return ['success' => false, 'messages' => [$error . ' Restoring it would overpay the invoice.']];
                }
            }

            Capsule::connection()->transaction(function () use ($receipt, $active) {
                $receipt->status_id = $active ? Receipt::ACTIVE : Receipt::VOIDED;
                $receipt->save();
                self::syncInvoice((int) $receipt->invoice_id);
            });
            static::logActivity(($active ? 'Restored' : 'Voided') . " receipt {$receipt->receipt_number}" . ($invoice ? " for invoice {$invoice->invoice_number}" : ''), 'Receipts', $receipt->receipt_id);

            return ['success' => true, 'messages' => [$active ? "{$receipt->receipt_number} restored." : "{$receipt->receipt_number} voided — it no longer counts as paid."]] + self::state();
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not update the receipt: ' . $e->getMessage()]];
        }
    }

    /** Delete for good (its number isn't reused). The invoice's status follows. */
    public function delete(string $encodedId): array
    {
        try {
            $receipt = Receipt::find(IdEncoder::decode($encodedId) ?? 0);
            if (!$receipt) {
                return ['success' => false, 'messages' => ['Receipt not found.']];
            }
            $number = (string) $receipt->receipt_number;
            $id = (int) $receipt->receipt_id;
            $invoiceId = (int) $receipt->invoice_id;
            Capsule::connection()->transaction(function () use ($id, $invoiceId) {
                Receipt::where('receipt_id', $id)->delete();
                self::syncInvoice($invoiceId);
            });
            static::logActivity("Deleted receipt {$number}", 'Receipts', $id);

            return ['success' => true, 'messages' => ["{$number} deleted."]] + self::state();
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not delete the receipt: ' . $e->getMessage()]];
        }
    }

    /** An error if $amount is more than what's still owing on the invoice (ignoring receipt $exceptId). */
    private static function overpaid(Invoice $invoice, float $amount, int $exceptId): ?string
    {
        $owing = round((float) $invoice->invoice_total - self::paidOn((int) $invoice->invoice_id, $exceptId), 2);
        if ($owing <= 0) {
            return "{$invoice->invoice_number} is already paid in full.";
        }
        if ($amount - $owing > 0.004) {
            return 'That’s more than the ' . self::currency($invoice) . ' ' . number_format($owing, 2) . " still owing on {$invoice->invoice_number}.";
        }
        return null;
    }

    /**
     * Point the invoice's status at what's been paid: Paid In Full, Partially
     * Paid, or back to Sent once its payments are voided / deleted. Cancelled
     * invoices, and unpaid ones that were never part-paid, are left alone.
     */
    private static function syncInvoice(int $invoiceId): void
    {
        $invoice = Invoice::find($invoiceId);
        if (!$invoice || (int) $invoice->status_id === Invoice::CANCELLED) {
            return;
        }
        $paid = self::paidOn($invoiceId);
        $status = (int) $invoice->status_id;
        if ($paid > 0 && $paid >= round((float) $invoice->invoice_total, 2)) {
            $status = Invoice::PAID;
        } elseif ($paid > 0) {
            $status = Invoice::PARTIAL;
        } elseif (in_array($status, [Invoice::PARTIAL, Invoice::PAID], true)) {
            $status = Invoice::SENT;
        }
        if ($status !== (int) $invoice->status_id) {
            $invoice->status_id = $status;
            $invoice->save();
        }
    }

    // ============================================================
    // PDF & email
    // ============================================================

    /** The receipt as PDF bytes (+ its data), or null. */
    public static function pdf(string $encodedId): ?array
    {
        $d = self::detail($encodedId);
        if (!$d) {
            return null;
        }
        $senderId = (int) (AuthService::currentUser()->customer_id ?? 0) ?: 1;
        $sender = Customer::find($senderId);
        $senderRegion = $sender && $sender->region_id ? Capsule::table('regions')->where('region_id', $sender->region_id)->first() : null;

        $storage = __DIR__ . '/../../server/storage';
        $temp = $storage . '/mpdf-temp';
        if (!is_dir($temp)) {
            mkdir($temp, 0775, true);
        }
        $defaults = (new \Mpdf\Config\ConfigVariables())->getDefaults();
        $fonts = (new \Mpdf\Config\FontVariables())->getDefaults();
        $mpdf = new \Mpdf\Mpdf([
            'mode' => 'utf-8', 'format' => 'A4', 'tempDir' => $temp,
            'margin_left' => 14, 'margin_right' => 14, 'margin_top' => 14, 'margin_bottom' => 14,
            'fontDir' => array_merge($defaults['fontDir'], [$storage . '/fonts']),
            'fontdata' => $fonts['fontdata'] + ['quicksand' => ['R' => 'Quicksand-Regular.ttf', 'B' => 'Quicksand-Bold.ttf']],
            'default_font' => 'quicksand',
        ]);
        $mpdf->SetTitle("Receipt {$d['number']}");
        $mpdf->WriteHTML(renderView(__DIR__ . '/../../resources/views/components/receipts/print.php', [
            'rc' => $d, 'sender' => $sender, 'senderRegion' => $senderRegion,
        ]));

        $name = 'Receipt-' . preg_replace('/[^A-Za-z0-9-]+/', '-', $d['number']) . '.pdf';
        return ['bytes' => $mpdf->Output($name, \Mpdf\Output\Destination::STRING_RETURN), 'name' => $name, 'receipt' => $d, 'sender' => $sender];
    }

    /** Email the receipt PDF to the customer. */
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
                return ['success' => false, 'messages' => ['Receipt not found.']];
            }
            $d = $pdf['receipt'];
            if (!$d['active']) {
                return ['success' => false, 'messages' => ['This receipt is voided — restore it before sending it.']];
            }
            $from = (string) ($pdf['sender']->company_name ?? 'CatScript Apps');
            $amount = $d['currency'] . ' ' . number_format($d['amount'], 2);
            $body = '<p>' . nl2br(htmlspecialchars(trim($message) !== '' ? trim($message) : "Hello,\n\nThank you for your payment. Receipt {$d['number']} is attached.")) . '</p>'
                . '<p style="color:#6b7280;font-size:13px">' . htmlspecialchars("{$d['number']} · {$amount} · invoice {$d['invoice_number']}" . ($d['date'] ? ' · received ' . date('M j, Y', strtotime($d['date'])) : '')) . '</p>'
                . '<p>— ' . htmlspecialchars($from) . '</p>';

            $ok = MailService::send($to, "Receipt {$d['number']} from {$from}", $body,
                [['content' => $pdf['bytes'], 'name' => $pdf['name'], 'type' => 'application/pdf']],
                $pdf['sender']->email ?? null);
            if (!$ok) {
                return ['success' => false, 'messages' => ['The email could not be sent. Please try again, or download the PDF.']];
            }
            static::logActivity("Emailed receipt {$d['number']} to {$to}", 'Receipts', IdEncoder::decode($encodedId));

            return ['success' => true, 'messages' => ["Sent to {$to}."]] + self::state();
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not send the receipt: ' . $e->getMessage()]];
        }
    }

    // ============================================================
    // Numbering (shared with the legacy app)
    // ============================================================

    /** What the next receipt number will be (display only — not reserved). */
    private static function peekNumber(): string
    {
        $year = date('y');
        $n = (int) (Counter::where('type', 'receipt')->where('year', $year)->value('last_value') ?? 0);
        return "CA-RCP{$year}-" . str_pad((string) ($n + 1), 4, '0', STR_PAD_LEFT);
    }

    /**
     * Next CA-RCP{yy}-{nnnn}: takes (and increments) the same `counters` row
     * as the legacy app, locked for the surrounding transaction, skipping any
     * number already used — so the two apps can never collide.
     */
    private static function nextNumber(): string
    {
        $year = date('y');
        $find = fn() => Counter::where('type', 'receipt')->where('year', $year)->lockForUpdate()->first();
        $counter = $find();
        if (!$counter) {
            // A new year. counters.counter_id doesn't auto-increment in the legacy schema.
            Capsule::table('counters')->insert([
                'counter_id' => (int) Capsule::table('counters')->lockForUpdate()->max('counter_id') + 1,
                'type' => 'receipt', 'year' => $year, 'last_value' => 0,
                'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s'),
            ]);
            $counter = $find();
        }

        $n = (int) $counter->last_value;
        do {
            $n++;
            $number = "CA-RCP{$year}-" . str_pad((string) $n, 4, '0', STR_PAD_LEFT);
        } while (Receipt::where('receipt_number', $number)->exists());

        $counter->last_value = $n;
        $counter->save();
        return $number;
    }
}
