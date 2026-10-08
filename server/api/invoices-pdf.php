<?php
// /server/api/invoices-pdf.php
//
// GET ?id={encodedId}[&download=1] -> the invoice as an A4 PDF (inline, or as a download).

declare(strict_types=1);

use Src\Controller\InvoicesController;
use Src\Service\AuthService;

$fail = function (int $status, string $message) {
    header('Content-Type: application/json; charset=UTF-8');
    json_response(['success' => false, 'messages' => [$message]], $status);
};

if (!AuthService::userId()) {
    $fail(401, 'Authentication required.');
}
if (!AuthService::hasAccess('Invoices')) {
    $fail(403, "You don't have access to Invoices.");
}

try {
    $pdf = InvoicesController::pdf((string) ($_GET['id'] ?? ''));
    if (!$pdf) {
        $fail(404, 'Invoice not found.');
    }
    $disposition = !empty($_GET['download']) ? 'attachment' : 'inline';
    header('Content-Type: application/pdf');
    header("Content-Disposition: {$disposition}; filename=\"{$pdf['name']}\"");
    header('Content-Length: ' . strlen($pdf['bytes']));
    echo $pdf['bytes'];
    InvoicesController::logActivity("Downloaded the PDF of invoice {$pdf['invoice']['number']}", 'Invoices');
} catch (\Throwable $e) {
    $fail(500, 'Could not build the PDF: ' . $e->getMessage());
}
