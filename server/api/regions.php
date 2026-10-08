<?php
// /server/api/regions.php

declare(strict_types=1);

use Src\Controller\RegionsController;

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        $countryId = isset($_GET['country_id']) ? intval($_GET['country_id']) : null;

        // Optional: Force a countryId requirement
        if (!$countryId) {
            json_response([
                'success' => false,
                'messages' => ['Country ID is required']
            ], 400);
        }

        $regions = RegionsController::list($countryId);

        json_response([
            'success' => true,
            'data' => $regions
        ]);
    }

    json_response([
        'success' => false,
        'messages' => ['Method not allowed']
    ], 405);
} catch (Throwable $e) {
    json_response([
        'success' => false,
        'messages' => ['Server error: ' . $e->getMessage()]
    ], 500);
}
