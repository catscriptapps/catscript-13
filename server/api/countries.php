<?php
// /server/api/countries.php

declare(strict_types=1);

use Src\Controller\CountriesController;

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    if ($method === 'GET') {
        // Fetches: id, country, country_code, currency, etc.
        $countries = CountriesController::list();

        json_response([
            'success' => true,
            'data' => $countries
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
