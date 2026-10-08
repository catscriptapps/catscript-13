<?php
// /server/api/login.php

declare(strict_types=1);

use Src\Controller\AuthController;

// Set response header for JSON
header('Content-Type: application/json');

// Decode JSON input or fallback to POST data
$input = json_decode(file_get_contents('php://input'), true) ?? $_POST;

// Delegate login logic to controller
$response = AuthController::login($input);

// Return response using shared json_response helper
json_response($response);
