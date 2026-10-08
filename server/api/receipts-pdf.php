<?php
// /server/api/receipts-pdf.php
//
// GET ?id={encodedId}[&download=1] -> the receipt as an A4 PDF (inline, or as a download).

declare(strict_types=1);

use Src\Controller\ReceiptsController;
use Src\Service\AuthService;

$fail = function (int $status, string $message) {
    header('Content-Type: application/json; charset=UTF-8');
    json_response(['success' => false, 'messages' => [$message]], $status);
};

if (!AuthService::userId()) {
    $fail(401, 'Authentication required.');
}
if (!AuthService::hasAccess('Receipts')) {
    $fail(403, "You don't have access to Receipts.");
}

try {
    $pdf = ReceiptsController::pdf((string) ($_GET['id'] ?? ''));
    if (!$pdf) {
        $fail(404, 'Receipt not found.');
    }
    $disposition = !empty($_GET['download']) ? 'attachment' : 'inline';
    header('Content-Type: application/pdf');
    header("Content-Disposition: {$disposition}; filename=\"{$pdf['name']}\"");
    header('Content-Length: ' . strlen($pdf['bytes']));
    echo $pdf['bytes'];
    ReceiptsController::logActivity("Downloaded the PDF of receipt {$pdf['receipt']['number']}", 'Receipts');
} catch (\Throwable $e) {
    $fail(500, 'Could not build the PDF: ' . $e->getMessage());
}
