<?php
// /server/api/history-delete.php

declare(strict_types=1);

use App\Models\RecentActivity;
use Src\Controller\RecentActivitiesController;

// JSON response header
header('Content-Type: application/json');

// --------------------------------------------------
// Security Checks & Initialization
// --------------------------------------------------
// Note: delete-factory usually sends POST even for logical deletions
if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'DELETE') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method Not Allowed']);
    exit;
}

// Read raw JSON input because delete-factory sends application/json
$input = json_decode(file_get_contents('php://input'), true);
$id = $input['id'] ?? $_POST['id'] ?? null;

if (!$id) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Missing activity record ID.']);
    exit;
}

// --------------------------------------------------
// Deletion Process
// --------------------------------------------------
try {
    $activity = RecentActivity::find((int)$id);

    if (!$activity) {
        throw new RuntimeException('Activity record not found.');
    }

    // Capture details for a potential system log before deletion
    $actionTitle = $activity->action;
    $entity = $activity->entity_type;

    // Execute deletion via controller logic
    $deleted = RecentActivitiesController::delete((int)$id);

    if ($deleted) {
        // We don't usually log the deletion of a log (infinite loop risk), 
        // but we return the standard success structure for the factory.
        echo json_encode([
            'success' => true,
            'message' => 'Activity record permanently deleted.',
            'messages' => ['Activity record permanently deleted.']
        ]);
        exit;
    } else {
        throw new RuntimeException('Failed to delete the record from the database.');
    }
} catch (\Throwable $e) {
    error_log('History deletion failed: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
        'messages' => [$e->getMessage()]
    ]);
}
exit;
