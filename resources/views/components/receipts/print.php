<?php
// /resources/views/components/receipts/print.php
//
// The printable receipt (mPDF — tables and inline-able CSS only), in the
// same layout as the invoice but in the receipt's green.
//
// @var array $rc  ReceiptsController::detail()

use App\Models\Customer;

/** @var array $rc */
/** @var Customer|null $sender */
/** @var object|null $senderRegion */

$e = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
$money = fn(float $n) => '$' . number_format($n, 2);
$senderCity = trim(implode(', ', array_filter([$sender->city ?? '', $senderRegion->region_code ?? ''])) . ' ' . ($sender->area_code ?? ''));
?>
<style>
    body { font-family: quicksand; font-size: 9.5pt; color: #1f2937; line-height: 1.45; }
    b, strong { font-weight: bold; }
    .muted { color: #6b7280; }
    .label { font-size: 7.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; }
    .title { font-size: 26pt; font-weight: bold; color: #059669; text-transform: uppercase; letter-spacing: 2px; text-align: right; }
    .amount { background: #ecfdf5; border-left: 4pt solid #059669; padding: 12pt 14pt; margin: 16pt 0 18pt; }
    .num { text-align: right; white-space: nowrap; }
    .applied { width: 100%; border-collapse: collapse; margin-top: 18pt; }
    .applied th { background: #ecfdf5; color: #065f46; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; text-align: left; padding: 8pt 6pt; border-bottom: 1.5pt solid #059669; }
    .applied td { padding: 8pt 6pt; border-bottom: 0.5pt solid #e5e7eb; vertical-align: top; }
    .totals td { padding: 4pt 6pt; }
    .grand td { font-size: 12pt; font-weight: bold; color: #059669; border-top: 1.5pt solid #059669; padding-top: 8pt; }
    .note { background: #f9fafb; border: 0.5pt solid #e5e7eb; padding: 8pt 10pt; margin-top: 22pt; }
    .void { color: #dc2626; border: 2pt solid #dc2626; font-size: 16pt; font-weight: bold; padding: 4pt 10pt; letter-spacing: 3px; }
</style>

<table width="100%">
    <tr>
        <td width="60%" style="vertical-align: top;">
            <div style="font-size: 14pt; font-weight: bold; color: #111827;"><?= $e($sender->company_name ?? 'CatScript Apps') ?></div>
            <div class="muted">
                <?= nl2br($e($sender->address ?? '')) ?><br>
                <?= $e($senderCity) ?><br>
                <?= $e(implode('  ·  ', array_filter([$sender->email ?? '', $sender->phone ?? '']))) ?>
            </div>
        </td>
        <td width="40%" style="vertical-align: top; text-align: right;">
            <div class="title">Receipt</div>
            <div style="text-align: right; margin-top: 4pt;"><strong style="font-size: 11pt;"><?= $e($rc['number']) ?></strong></div>
            <?php if (!$rc['active']): ?>
                <div style="text-align: right; margin-top: 14pt;"><span class="void">VOID</span></div>
            <?php endif; ?>
        </td>
    </tr>
</table>

<div class="amount">
    <table width="100%">
        <tr>
            <td style="vertical-align: middle;">
                <span class="label" style="color: #065f46;">Amount received</span><br>
                <span style="font-size: 22pt; font-weight: bold; color: #065f46;"><?= $e($rc['currency']) ?> <?= $money($rc['amount']) ?></span>
            </td>
            <td class="num" style="vertical-align: middle;">
                <span class="label">Paid by</span><br>
                <strong style="font-size: 11pt;"><?= $e($rc['method'] ?: '—') ?></strong>
            </td>
        </tr>
    </table>
</div>

<table width="100%">
    <tr>
        <td width="55%" style="vertical-align: top;">
            <div class="label">Received from</div>
            <strong style="font-size: 11pt;"><?= $e($rc['customer']) ?></strong><br>
            <span class="muted">
                <?= $rc['customer_place'] ? $e($rc['customer_place']) . '<br>' : '' ?>
                <?= $e($rc['customer_email']) ?>
            </span>
        </td>
        <td width="45%" style="vertical-align: top;">
            <table width="100%">
                <tr><td class="label">Receipt #</td><td class="num"><strong><?= $e($rc['number']) ?></strong></td></tr>
                <tr><td class="label">Payment date</td><td class="num"><strong><?= $rc['date'] ? date('M j, Y', strtotime($rc['date'])) : '' ?></strong></td></tr>
                <tr><td class="label">Method</td><td class="num"><strong><?= $e($rc['method'] ?: '—') ?></strong></td></tr>
                <tr><td class="label">Currency</td><td class="num"><strong><?= $e($rc['currency']) ?></strong></td></tr>
            </table>
        </td>
    </tr>
</table>

<table class="applied">
    <thead>
        <tr><th width="25%">Invoice</th><th width="50%">Project / reference</th><th width="25%" class="num">Amount applied</th></tr>
    </thead>
    <tbody>
        <tr>
            <td><strong><?= $e($rc['invoice_number']) ?></strong></td>
            <td><?= $e($rc['invoice_title']) ?></td>
            <td class="num"><strong><?= $money($rc['amount']) ?></strong></td>
        </tr>
    </tbody>
</table>

<table width="45%" align="right" class="totals" style="margin-top: 12pt;">
    <tr><td class="muted">Invoice total</td><td class="num"><?= $money($rc['invoice_total']) ?></td></tr>
    <tr><td class="muted">Paid to date</td><td class="num">−<?= $money($rc['invoice_paid']) ?></td></tr>
    <tr class="grand"><td><?= $rc['invoice_balance'] > 0 ? 'Balance remaining' : 'Paid in full' ?></td><td class="num"><?= $e($rc['currency']) ?> <?= $money($rc['invoice_balance']) ?></td></tr>
</table>
<div style="clear: both;"></div>

<?php if ($rc['note'] !== ''): ?>
    <div class="note"><div class="label">Reference</div><?= nl2br($e($rc['note'])) ?></div>
<?php endif; ?>

<p style="text-align: center; margin-top: 30pt; font-weight: bold;">Thank you for your payment.</p>
<p style="text-align: center; font-size: 8pt;" class="muted">Generated <?= date('M j, Y') ?> · <?= $e($rc['number']) ?></p>
