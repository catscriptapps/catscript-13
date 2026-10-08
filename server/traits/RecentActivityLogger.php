<?php
// /server/traits/RecentActivityLogger.php
declare(strict_types=1);

namespace App\Traits;

use App\Models\RecentActivity;

/**
 * Trait RecentActivityLogger
 *
 * Provides a simple way to log system events automatically
 * (e.g., when records are created, updated, or deleted).
 */
trait RecentActivityLogger
{
    /**
     * Log a new activity into the database.
     *
     * @param string $action       The action that occurred (e.g. "Created FAQ", "Deleted User").
     * @param string|null $entityType  The type of entity involved (e.g. "FAQ", "User").
     * @param int|string|null $entityId Optional ID of the affected entity.
     * @param int|null $userId     Optional user ID. Defaults to session user if available.
     * @return RecentActivity|null
     */
    public static function logActivity(
        string $action,
        ?string $entityType = null,
        int|string|null $entityId = null,
        ?int $userId = null
    ): ?RecentActivity {
        try {
            // Determine user ID from argument, session, or null
            if ($userId === null && session_status() === PHP_SESSION_ACTIVE && isset($_SESSION['user_id'])) {
                $userId = (int) $_SESSION['user_id'];
            }

            // Capture environment data safely
            $ip = $_SERVER['REMOTE_ADDR'] ?? null;
            $agent = $_SERVER['HTTP_USER_AGENT'] ?? null;

            return RecentActivity::create([
                'user_id'     => $userId,
                'action'      => trim($action),
                'entity_type' => $entityType,
                'entity_id'   => $entityId,
                'ip_address'  => $ip,
                'user_agent'  => $agent,
                'archived'    => false,
            ]);
        } catch (\Throwable $e) {
            error_log("RecentActivityLogger error: " . $e->getMessage());
            return null;
        }
    }
}
