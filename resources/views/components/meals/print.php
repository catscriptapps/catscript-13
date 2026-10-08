<?php
// /resources/views/components/meals/print.php
//
// Printable week for the PDF export (server/api/meals-pdf.php). Plain tables
// and inline styles only — this is rendered by mPDF, not the browser.
//
// @var \App\Models\MealPlan $plan
// @var array{grid: array, dayTotals: array<string, int>, weekTotal: int} $data

use App\Models\Meal;

/** @var \App\Models\MealPlan $plan */
/** @var array{grid: array, dayTotals: array<string, int>, weekTotal: int} $data */

$e =fn($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
$hasCalories = $data['weekTotal'] > 0;
$dayWidth = round(88 / count(Meal::DAYS), 2);
?>
<style>
    body { font-family: quicksand; color: #1f2937; font-size: 9pt; }
    .head td { vertical-align: bottom; }
    .title { font-size: 18pt; font-weight: bold; color: #111827; }
    .sub { font-size: 9pt; color: #6b7280; }
    .brand { font-size: 9pt; color: #f97316; font-weight: bold; text-align: right; }
    table.week { width: 100%; border-collapse: collapse; margin-top: 10pt; }
    table.week th { background: #1e2a4a; color: #ffffff; font-size: 9pt; padding: 6pt 4pt; text-align: center; }
    table.week td { border: 0.5pt solid #e5e7eb; padding: 5pt; vertical-align: top; height: 62pt; }
    td.type { background: #fff7ed; color: #c2410c; font-weight: bold; font-size: 8pt; text-transform: uppercase; vertical-align: middle; text-align: center; height: auto; }
    .meal { font-size: 8.5pt; color: #111827; }
    .kcal { font-size: 7.5pt; color: #ea580c; font-weight: bold; margin-top: 3pt; }
    .empty { color: #d1d5db; font-size: 8pt; }
    tr.totals td { background: #f9fafb; font-weight: bold; font-size: 8pt; text-align: center; height: auto; color: #374151; }
    .foot { margin-top: 8pt; font-size: 7.5pt; color: #9ca3af; }
</style>

<table class="head" width="100%">
    <tr>
        <td>
            <div class="title"><?= $e($plan->plan_title) ?></div>
            <?php if (!empty($plan->description)): ?>
                <div class="sub"><?= $e($plan->description) ?></div>
            <?php endif; ?>
        </td>
        <td class="brand">CatScript Apps · Meals</td>
    </tr>
</table>

<table class="week">
    <thead>
        <tr>
            <th style="width: 12%;"></th>
            <?php foreach (Meal::DAYS as $day): ?>
                <th style="width: <?= $dayWidth ?>%;"><?= $e($day) ?></th>
            <?php endforeach; ?>
        </tr>
    </thead>
    <tbody>
        <?php foreach (Meal::TYPES as $type => $label): ?>
            <tr>
                <td class="type"><?= $e($label) ?></td>
                <?php foreach (Meal::DAYS as $day): ?>
                    <?php $m = $data['grid'][$day][$type]; ?>
                    <td>
                        <?php if ($m): ?>
                            <div class="meal"><?= nl2br($e($m['description'])) ?></div>
                            <?php if ($m['calories'] !== null): ?>
                                <div class="kcal"><?= number_format($m['calories']) ?> kcal</div>
                            <?php endif; ?>
                        <?php else: ?>
                            <span class="empty">—</span>
                        <?php endif; ?>
                    </td>
                <?php endforeach; ?>
            </tr>
        <?php endforeach; ?>
        <?php if ($hasCalories): ?>
            <tr class="totals">
                <td>Day total</td>
                <?php foreach (Meal::DAYS as $day): ?>
                    <td><?= $data['dayTotals'][$day] ? number_format($data['dayTotals'][$day]) . ' kcal' : '—' ?></td>
                <?php endforeach; ?>
            </tr>
        <?php endif; ?>
    </tbody>
</table>

<div class="foot">
    <?php if ($hasCalories): ?>
        <?php $daysWithCalories = count(array_filter($data['dayTotals'])); ?>
        Week total: <?= number_format($data['weekTotal']) ?> kcal · average <?= number_format((int) round($data['weekTotal'] / $daysWithCalories)) ?> kcal a day
        (over <?= $daysWithCalories ?> <?= $daysWithCalories === 1 ? 'day' : 'days' ?> with calories) ·
    <?php endif; ?>
    Printed <?= date('F j, Y') ?>
</div>
