<?php
// /src/Controller/RecentActivitiesController.php

declare(strict_types=1);

namespace Src\Controller;

use App\Models\RecentActivity;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Src\Service\AuthService;

/**
 * RecentActivitiesController
 * Handles retrieval, pagination, and management (archive/delete)
 * of user activity logs for the Catscript-13 dashboard.
 */
class RecentActivitiesController
{
    /**
     * Prepare data for the History List Page
     */
    public function index(): void
    {
        $search = $_GET['q'] ?? null;

        // Ensure we hide archived items from the main view unless specified
        $paginator = self::paginate($search, false, 15);

        // AJAX response for search/pagination
        if (isset($_GET['q']) || isset($_GET['page'])) {
            header('Content-Type: application/json');
            echo json_encode([
                'success' => true,
                'data' => array_map(fn($item) => ['rowHtml' => self::renderRow($item)], $paginator->items()),
                'total' => $paginator->total()
            ]);
            exit;
        }

        $html = '';
        foreach ($paginator as $activity) {
            $html .= self::renderRow($activity);
        }

        $GLOBALS['historyRows'] = $html;
        $GLOBALS['title'] = "History";
    }

    /**
     * Render individual activity row HTML via component file
     */
    public static function renderRow(RecentActivity $activity): string
    {
        $user = $activity->user;

        // Pull assetBase into the local scope so the included view can see it
        $GLOBALS['assetBase'] = getAssetBase();
        $assetBase = getAssetBase();

        // Prepare data array for the component
        $row = $activity->toArray();
        $row['user_name'] = $user ? $user->full_name : 'System';
        $row['user_avatar'] = $user ? $user->avatar_url : null;

        // Date formatting using Carbon (assuming created_at is cast to datetime)
        $row['date_formatted'] = $activity->created_at->format('M j, Y');
        $row['time_formatted'] = $activity->created_at->format('H:i');

        // Logic for icon selection
        $row['icon'] = match ($activity->entity_type) {
            'Users'     => '👤',
            'Cash Flow' => '💰',
            'CashFlow'  => '💰',
            'Invoices'  => '📄',
            'FAQ'       => '❓',
            default     => '⚙️'
        };

        $path = __DIR__ . '/../../resources/views/components/history/data-row.php';

        ob_start();
        try {
            include $path;
        } catch (\Throwable $e) {
            ob_end_clean();
            return "<tr><td colspan='5' class='p-4 text-center text-rose-500 font-bold'>History Render Error: " . $e->getMessage() . "</td></tr>";
        }
        return ob_get_clean();
    }

    /**
     * Paginate recent activities with optional search or archived filter.
     *
     * @param string|null $search Optional search term (matches action, entity_type).
     * @param bool|null $archived Filter by archived state.
     * @param int $perPage Number of results per page.
     * @return LengthAwarePaginator
     */
    public static function paginate(?string $search = null, ?bool $archived = null, int $perPage = 10): LengthAwarePaginator
    {
        $query = RecentActivity::with('user')
            ->orderBy('created_at', 'desc');

        // --- PRIVACY LAYER ---
        if (!AuthService::isAdmin()) {
            $query->where('user_id', AuthService::userId());
        }

        if (!empty($search)) {
            $query->where(function ($sub) use ($search) {
                $sub->where('action', 'like', "%{$search}%")
                    ->orWhere('entity_type', 'like', "%{$search}%")
                    // Search by user's name in the related 'users' table
                    ->orWhereHas('user', function ($userQuery) use ($search) {
                        $userQuery->where('full_name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        if ($archived !== null) {
            $query->where('archived', $archived);
        }

        return $query->paginate($perPage);
    }

    /**
     * Retrieve the most recent N activity records (for dashboard widget).
     *
     * @param int $limit Number of activities to retrieve.
     * @return Collection
     */
    public static function latest(int $limit = 10): Collection
    {
        $query = RecentActivity::with('user')
            ->where('archived', false)
            ->orderBy('created_at', 'desc')
            ->limit($limit);

        // --- PRIVACY LAYER ---
        if (!AuthService::isAdmin()) {
            $query->where('user_id', AuthService::userId());
        }

        return $query->get();
    }

    /**
     * Find a specific activity record by its ID.
     *
     * @param int $id
     * @return RecentActivity|null
     */
    public static function find(int $id): ?RecentActivity
    {
        return RecentActivity::find($id);
    }

    /**
     * Archive an activity (soft hide from main lists).
     *
     * @param int $id
     * @return bool
     */
    public static function archive(int $id): bool
    {
        $activity = RecentActivity::find($id);
        if (!$activity) {
            return false;
        }

        $activity->archived = true;
        return $activity->save();
    }

    /**
     * Unarchive an activity (restore to active list).
     *
     * @param int $id
     * @return bool
     */
    public static function unarchive(int $id): bool
    {
        $activity = RecentActivity::find($id);
        if (!$activity) {
            return false;
        }

        $activity->archived = false;
        return $activity->save();
    }

    /**
     * Permanently delete an activity.
     *
     * @param int $id
     * @return bool
     */
    public static function delete(int $id): bool
    {
        $activity = RecentActivity::find($id);
        if (!$activity) {
            return false;
        }

        return (bool) $activity->delete();
    }

    /**
     * Record a new activity event.
     *
     * @param int|null $userId
     * @param string $action
     * @param string|null $entityType
     * @param int|null $entityId
     * @return RecentActivity
     */
    public static function log(?int $userId, string $action, ?string $entityType = null, ?int $entityId = null): RecentActivity
    {
        return RecentActivity::log($userId, $action, $entityType, $entityId);
    }
}
