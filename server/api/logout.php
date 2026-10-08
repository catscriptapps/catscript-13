<?php
// /server/api/logout.php
declare(strict_types=1);

use Src\Controller\AuthController;

// Set response header for JSON
header('Content-Type: application/json');

// Call logout logic from AuthController
$response = AuthController::logout();

// Return response using shared json_response helper
json_response($response);
