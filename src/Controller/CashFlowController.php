<?php
// /src/Controller/CashFlowController.php

declare(strict_types=1);

namespace Src\Controller;

use App\Models\Counter;
use App\Models\Transaction;
use App\Traits\RecentActivityLogger;
use App\Utils\IdEncoder;
use Illuminate\Database\Capsule\Manager as Capsule;

/**
 * Cash Flow — money in / money out (ported from the legacy CatScript Cash
 * Flow app, on the same legacy `transactions` table). Entries are private
 * to their owner, exactly as in legacy.
 *
 * The page loads the owner's whole ledger once (ledger()); every filter,
 * total and chart is then computed in the browser, so they update on the
 * spot. Writes return the saved entry so the client can patch its copy.
 *
 * Every create / update / delete / receipt change is written to
 * recent_activities (entity_type "Cash Flow", entity_id = transaction id).
 */
class CashFlowController
{
    use RecentActivityLogger;

    /** Safety cap on the ledger shipped to the browser. */
    private const LEDGER_LIMIT = 10000;
    private const MAX_AMOUNT = 9999999999999.99; // decimal(15,2)
    public const RECEIPT_DIR = 'images/uploads/receipts/';

    // ============================================================
    // Reads
    // ============================================================

    /**
     * @return array<int, array>
     */
    public static function ledger(int $userId): array
    {
        return Transaction::ownedBy($userId)
            ->orderByDesc('transaction_date')
            ->orderByDesc('id')
            ->limit(self::LEDGER_LIMIT)
            ->get()
            ->map(fn(Transaction $t) => self::present($t))
            ->all();
    }

    /**
     * The owner's past titles, for the form's autocomplete.
     * @return array<int, array{title: string, type: string}>
     */
    public static function suggestTitles(int $userId, string $query): array
    {
        if (mb_strlen($query) < 2) {
            return [];
        }

        return Transaction::ownedBy($userId)
            ->where('title', 'LIKE', "%{$query}%")
            ->selectRaw('title, type, MAX(transaction_date) AS last_used')
            ->groupBy('title', 'type')
            ->orderByDesc('last_used')
            ->limit(8)
            ->get()
            ->map(fn($r) => ['title' => (string) $r->title, 'type' => (string) $r->type])
            ->all();
    }

    public static function present(Transaction $t): array
    {
        $date = $t->transaction_date;

        return [
            'encoded_id'  => IdEncoder::encode((int) $t->id),
            'ref'         => (string) $t->transaction_ref,
            'title'       => (string) $t->title,
            'type'        => (string) $t->type,
            'amount'      => round((float) $t->amount, 2),
            'date'        => $date ? $date->format('Y-m-d') : null,
            'details'     => (string) ($t->details ?? ''),
            'receipt_url' => $t->receipt_pic_name ? getAssetBase() . self::RECEIPT_DIR . rawurlencode($t->receipt_pic_name) : null,
        ];
    }

    // ============================================================
    // Writes
    // ============================================================

    public function save(array $data, int $userId): array
    {
        try {
            $encodedId = trim((string) ($data['encoded_id'] ?? ''));
            $isNew = $encodedId === '';

            $title = trim((string) ($data['title'] ?? ''));
            $type = (string) ($data['type'] ?? '');
            $amountRaw = trim(str_replace([',', '$', ' '], '', (string) ($data['amount'] ?? '')));
            $date = trim((string) ($data['transaction_date'] ?? ''));
            $details = trim((string) ($data['details'] ?? ''));

            $errors = [];
            if (!in_array($type, Transaction::TYPES, true)) {
                $errors[] = 'Choose money in or money out.';
            }
            if ($title === '') {
                $errors[] = 'Give the entry a title.';
            } elseif (mb_strlen($title) > 255) {
                $errors[] = 'The title must be 255 characters or fewer.';
            }
            if (!preg_match('/^\d+(\.\d{1,2})?$/', $amountRaw) || (float) $amountRaw <= 0) {
                $errors[] = 'Enter an amount greater than zero, with up to 2 decimals.';
            } elseif ((float) $amountRaw > self::MAX_AMOUNT) {
                $errors[] = 'That amount is too large.';
            }
            $parsed = \DateTime::createFromFormat('!Y-m-d', $date);
            if (!$parsed || $parsed->format('Y-m-d') !== $date) {
                $errors[] = 'Choose a valid date.';
            }
            if (mb_strlen($details) > 5000) {
                $errors[] = 'Notes must be 5,000 characters or fewer.';
            }
            if ($errors) {
                return ['success' => false, 'messages' => $errors];
            }

            $fields = [
                'title'            => $title,
                'type'             => $type,
                'amount'           => number_format((float) $amountRaw, 2, '.', ''),
                'transaction_date' => $date,
                'details'          => $details !== '' ? $details : null,
            ];

            if ($isNew) {
                $transaction = Capsule::connection()->transaction(function () use ($fields, $userId) {
                    $t = new Transaction($fields);
                    $t->orig_user_id = $userId;
                    $t->status_id = Transaction::STATUS_DEFAULT;
                    $t->transaction_ref = self::nextRef();
                    $t->save();
                    return $t;
                });
            } else {
                $transaction = Transaction::ownedBy($userId)->find(IdEncoder::decode($encodedId) ?? 0);
                if (!$transaction) {
                    return ['success' => false, 'messages' => ['Entry not found.']];
                }
                $transaction->fill($fields)->save();
            }

            $verb = $isNew ? 'Logged' : 'Updated';
            $kind = $type === 'income' ? 'money in' : 'money out';
            static::logActivity("{$verb} {$kind}: {$transaction->title} (" . self::money((float) $transaction->amount) . ')', 'Cash Flow', $transaction->id);

            return [
                'success'     => true,
                'messages'    => [$isNew ? 'Entry recorded.' : 'Entry updated.'],
                'transaction' => self::present($transaction->refresh()),
            ];
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not save the entry: ' . $e->getMessage()]];
        }
    }

    public function delete(string $encodedId, int $userId): array
    {
        try {
            $t = Transaction::ownedBy($userId)->find(IdEncoder::decode($encodedId) ?? 0);
            if (!$t) {
                return ['success' => false, 'messages' => ['Entry not found.']];
            }

            $summary = "{$t->title} (" . self::money((float) $t->amount) . ')';
            $id = $t->id;
            $receipt = $t->receipt_pic_name;

            $t->delete();
            if ($receipt) {
                self::unlinkReceipt($receipt);
            }
            static::logActivity("Deleted entry: {$summary}", 'Cash Flow', $id);

            return ['success' => true, 'messages' => ['Entry deleted.']];
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not delete the entry: ' . $e->getMessage()]];
        }
    }

    /**
     * Attach (or replace) a receipt photo. $fileName is already saved in
     * RECEIPT_DIR by the upload endpoint.
     */
    public static function attachReceipt(Transaction $t, string $fileName): array
    {
        $old = $t->receipt_pic_name;
        $t->receipt_pic_name = $fileName;
        $t->save();
        if ($old && $old !== $fileName) {
            self::unlinkReceipt($old);
        }
        static::logActivity("Attached receipt to {$t->title} ({$t->transaction_ref})", 'Cash Flow', $t->id);

        return ['success' => true, 'messages' => ['Receipt attached.'], 'transaction' => self::present($t)];
    }

    public static function removeReceipt(Transaction $t): array
    {
        if ($t->receipt_pic_name) {
            self::unlinkReceipt($t->receipt_pic_name);
            $t->receipt_pic_name = null;
            $t->save();
            static::logActivity("Removed receipt from {$t->title} ({$t->transaction_ref})", 'Cash Flow', $t->id);
        }

        return ['success' => true, 'messages' => ['Receipt removed.'], 'transaction' => self::present($t)];
    }

    // ============================================================
    // Helpers
    // ============================================================

    /**
     * Next CA-TRX{yy}-{nnnn} reference. Uses (and increments) the same
     * `counters` row as the legacy app, with the row locked for the rest of
     * the surrounding DB transaction, and skips any reference already taken
     * — so the two apps can never hand out the same number.
     */
    private static function nextRef(): string
    {
        $year = date('y');
        $counter = Counter::where('type', 'transaction')->where('year', $year)->lockForUpdate()->first()
            ?? Counter::create(['type' => 'transaction', 'year' => $year, 'last_value' => 0]);

        $n = (int) $counter->last_value;
        do {
            $n++;
            $ref = "CA-TRX{$year}-" . str_pad((string) $n, 4, '0', STR_PAD_LEFT);
        } while (Transaction::where('transaction_ref', $ref)->exists());

        $counter->last_value = $n;
        $counter->save();

        return $ref;
    }

    private static function unlinkReceipt(string $fileName): void
    {
        $dir = realpath(__DIR__ . '/../../public/' . self::RECEIPT_DIR);
        $path = $dir ? realpath($dir . '/' . basename($fileName)) : false;
        if ($path && str_starts_with($path, $dir) && is_file($path)) {
            @unlink($path);
        }
    }

    public static function money(float $amount): string
    {
        return '$' . number_format($amount, 2);
    }
}
