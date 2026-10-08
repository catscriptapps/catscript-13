<?php
// /resources/views/components/invoices/print.php
//
// The printable invoice (mPDF — tables and inline-able CSS only). Line-item
// descriptions arrive already cleaned by Src\Utils\RichText::clean().
//
// @var array $inv  InvoicesController::detail()

use App\Models\Customer;

/** @var array $inv */
/** @var Customer|null $customer */
/** @var Customer|null $sender */
/** @var object|null $customerRegion */
/** @var object|null $customerCountry */
/** @var object|null $senderRegion */
/** @var object|null $senderCountry */
/** @var string $paymentTerm */
/** @var string $deliveryTerm */

$e = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
$money = fn(float $n) => ($n < 0 ? '−' : '') . '$' . number_format(abs($n), 2);
$cityLine = fn(?Customer $c, $r) => trim(implode(', ', array_filter([$c->city ?? '', $r->region_code ?? ''])) . ' ' . ($c->area_code ?? ''));
$statusColors = ['gray' => '#6b7280', 'blue' => '#0284c7', 'orange' => '#d97706', 'green' => '#059669', 'red' => '#dc2626', 'slate' => '#475569'];
$badge = $statusColors[$inv['status']['color']] ?? '#6b7280';
?>
<style>
    body { font-family: quicksand; font-size: 9.5pt; color: #1f2937; line-height: 1.45; }
    b, strong { font-weight: bold; }
    .muted { color: #6b7280; }
    .label { font-size: 7.5pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; }
    .title { font-size: 26pt; font-weight: bold; color: #ea580c; text-transform: uppercase; letter-spacing: 2px; text-align: right; }
    .banner { background: #fff7ed; border-left: 4pt solid #ea580c; padding: 8pt 12pt; margin: 14pt 0 18pt; }
    .items { width: 100%; border-collapse: collapse; margin-top: 16pt; }
    .items th { background: #fff7ed; color: #9a3412; font-size: 8pt; text-transform: uppercase; letter-spacing: 1px; text-align: left; padding: 8pt 6pt; border-bottom: 1.5pt solid #ea580c; }
    .items td { padding: 8pt 6pt; border-bottom: 0.5pt solid #e5e7eb; vertical-align: top; }
    .items td ul, .items td ol { margin: 3pt 0 0 0; padding-left: 14pt; }
    .num { text-align: right; white-space: nowrap; }
    .totals td { padding: 4pt 6pt; }
    .grand td { font-size: 14pt; font-weight: bold; color: #ea580c; border-top: 1.5pt solid #ea580c; padding-top: 8pt; }
    .terms { background: #f9fafb; border: 0.5pt solid #e5e7eb; padding: 8pt 10pt; }
    .status { color: #ffffff; font-size: 8pt; font-weight: bold; padding: 2pt 6pt; }
</style>

<table width="100%">
    <tr>
        <td width="60%" style="vertical-align: top;">
            <div style="font-size: 14pt; font-weight: bold; color: #111827;"><?= $e($sender->company_name ?? 'CatScript Apps') ?></div>
            <div class="muted">
                <?= nl2br($e($sender->address ?? '')) ?><br>
                <?= $e($cityLine($sender, $senderRegion)) ?><?= !empty($senderCountry->country) ? ' · ' . $e($senderCountry->country) : '' ?><br>
                <?= $e(implode('  ·  ', array_filter([$sender->email ?? '', $sender->phone ?? '']))) ?>
            </div>
        </td>
        <td width="40%" style="vertical-align: top;">
            <div class="title">Invoice</div>
            <div style="text-align: right; margin-top: 4pt;"><span class="status" style="background: <?= $badge ?>;"><?= $e(strtoupper($inv['status']['name'])) ?></span></div>
        </td>
    </tr>
</table>

<div class="banner">
    <span class="label" style="color: #9a3412;">Project / reference</span><br>
    <span style="font-size: 11pt; font-weight: bold;"><?= $e($inv['title']) ?></span>
</div>

<table width="100%">
    <tr>
        <td width="55%" style="vertical-align: top;">
            <div class="label">Bill to</div>
            <strong style="font-size: 11pt;"><?= $e($customer->company_name ?? $inv['customer']) ?></strong><br>
            <span class="muted">
                <?= $customer && $customer->address ? nl2br($e($customer->address)) . '<br>' : '' ?>
                <?= $e($cityLine($customer, $customerRegion)) ?><?= !empty($customerCountry->country) ? ' · ' . $e($customerCountry->country) : '' ?><br>
                <?= $e(implode('  ·  ', array_filter([$customer->email ?? '', $customer->phone ?? '']))) ?>
            </span>
        </td>
        <td width="45%" style="vertical-align: top;">
            <table width="100%">
                <tr><td class="label">Invoice #</td><td class="num"><strong><?= $e($inv['number']) ?></strong></td></tr>
                <tr><td class="label">Invoice date</td><td class="num"><strong><?= $inv['created'] ? date('M j, Y', strtotime($inv['created'])) : '' ?></strong></td></tr>
                <tr><td class="label">Due</td><td class="num"><strong><?= $inv['due'] ? date('M j, Y', strtotime($inv['due'])) : 'Upon receipt' ?></strong></td></tr>
                <tr><td class="label">Currency</td><td class="num"><strong><?= $e($inv['currency']) ?></strong></td></tr>
            </table>
        </td>
    </tr>
</table>

<table class="items">
    <thead>
        <tr><th width="5%">#</th><th width="55%">Description</th><th width="10%" class="num">Qty</th><th width="14%" class="num">Rate</th><th width="16%" class="num">Amount</th></tr>
    </thead>
    <tbody>
        <?php foreach ($inv['items'] as $i => $it): ?>
            <tr>
                <td class="muted"><?= $i + 1 ?></td>
                <td><?= $it['description'] /* cleaned by RichText */ ?></td>
                <td class="num"><?= number_format($it['quantity'], 2) ?></td>
                <td class="num"><?= $money($it['unit_price']) ?></td>
                <td class="num"><strong><?= $money($it['amount']) ?></strong></td>
            </tr>
        <?php endforeach; ?>
    </tbody>
</table>

<table width="45%" align="right" class="totals" style="margin-top: 12pt;">
    <tr><td class="muted">Subtotal</td><td class="num"><?= $money($inv['total']) ?></td></tr>
    <?php if ($inv['paid'] > 0): ?>
        <tr><td class="muted">Paid</td><td class="num">−<?= $money($inv['paid']) ?></td></tr>
    <?php endif; ?>
    <tr class="grand"><td><?= $inv['paid'] > 0 ? 'Balance due' : 'Total' ?></td><td class="num"><?= $e($inv['currency']) ?> <?= $money($inv['paid'] > 0 ? $inv['balance'] : $inv['total']) ?></td></tr>
</table>
<div style="clear: both;"></div>

<table width="100%" style="margin-top: 24pt;">
    <tr>
        <td width="49%" class="terms" style="vertical-align: top;"><div class="label">Payment terms</div><?= $e($paymentTerm ?: 'Standard terms') ?></td>
        <td width="2%"></td>
        <td width="49%" class="terms" style="vertical-align: top;"><div class="label">Delivery</div><?= $e($deliveryTerm ?: '—') ?></td>
    </tr>
</table>

<p style="text-align: center; margin-top: 30pt; font-weight: bold;">Thank you for your business.</p>
