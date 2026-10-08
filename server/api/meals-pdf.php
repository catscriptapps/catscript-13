<?php
// /server/api/meals-pdf.php
//
// GET ?plan={encodedId} -> the plan's week as a landscape A4 PDF (inline).
// Any plan — plans are visible to everyone with Meals access.

declare(strict_types=1);

use Mpdf\Mpdf;
use Src\Controller\MealsController;
use Src\Service\AuthService;

$userId = AuthService::userId();
$fail = function (int $status, string $message) {
    header('Content-Type: application/json; charset=UTF-8');
    json_response(['success' => false, 'messages' => [$message]], $status);
};

if (!$userId) {
    $fail(401, 'Authentication required.');
}
if (!AuthService::hasAccess('Meals')) {
    $fail(403, "You don't have access to Meals.");
}

$plan = MealsController::visiblePlan((string) ($_GET['plan'] ?? ''));
if (!$plan) {
    $fail(404, 'Meal plan not found.');
}

try {
    $storage = __DIR__ . '/../storage';
    $tempDir = $storage . '/mpdf-temp';
    if (!is_dir($tempDir)) {
        mkdir($tempDir, 0775, true);
    }

    $defaults = (new \Mpdf\Config\ConfigVariables())->getDefaults();
    $fonts = (new \Mpdf\Config\FontVariables())->getDefaults();

    $mpdf = new Mpdf([
        'mode'          => 'utf-8',
        'format'        => 'A4-L',
        'tempDir'       => $tempDir,
        'margin_left'   => 10,
        'margin_right'  => 10,
        'margin_top'    => 12,
        'margin_bottom' => 12,
        'fontDir'       => array_merge($defaults['fontDir'], [$storage . '/fonts']),
        'fontdata'      => $fonts['fontdata'] + [
            'quicksand' => ['R' => 'Quicksand-Regular.ttf', 'B' => 'Quicksand-Bold.ttf'],
        ],
        'default_font'  => 'quicksand',
    ]);
    $mpdf->SetTitle($plan->plan_title . ' — Meal plan');

    $html = renderView(__DIR__ . '/../../resources/views/components/meals/print.php', [
        'plan' => $plan,
        'data' => MealsController::grid((int) $plan->meal_plan_id),
    ]);
    $mpdf->WriteHTML($html);

    MealsController::logActivity("Exported meal plan to PDF: {$plan->plan_title}", 'Meals', $plan->meal_plan_id);

    $fileName = 'Meal-plan-' . (preg_replace('/[^A-Za-z0-9]+/', '-', (string) $plan->plan_title) ?: 'week') . '.pdf';
    $mpdf->Output($fileName, \Mpdf\Output\Destination::INLINE);
} catch (\Throwable $e) {
    $fail(500, 'Could not build the PDF: ' . $e->getMessage());
}
