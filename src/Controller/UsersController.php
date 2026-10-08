<?php
// /src/Controller/UsersController.php

declare(strict_types=1);

namespace Src\Controller;

use App\Models\User;
use App\Utils\IdEncoder;
use Src\Service\AuthService;
use App\Traits\RecentActivityLogger;

class UsersController
{
    use RecentActivityLogger;

    /**
     * Core accounts that must always survive a delete request — id 1, the
     * first admin the DB reset creates. Enforced here (not just in the UI) since this is the
     * actual authority the API checks.
     */
    public const PROTECTED_USER_IDS = [1];

    /**
     * Handle Delete
     * @param string|null $id
     * @return array
     */
    public function delete(?string $id): array
    {
        try {
            $rawId = (is_string($id) && !is_numeric($id)) ? IdEncoder::decode($id) : (int)$id;

            if (in_array((int) $rawId, self::PROTECTED_USER_IDS, true)) {
                return ['success' => false, 'messages' => ['This is a core account and cannot be deleted.']];
            }

            $user = User::find($rawId);

            if ($user) {
                $userName = $user->full_name;
                $userEmail = $user->email;

                if ($user->delete()) {
                    static::logActivity("Deleted user account: {$userName} ({$userEmail})", 'Users');
                    return ['success' => true, 'messages' => ['User deleted successfully.']];
                }
            }
            return ['success' => false, 'messages' => ['Failed to delete user.']];
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => [$e->getMessage()]];
        }
    }

    // ============================================================
    // Password reset (admins — see server/api/users.php)
    // ============================================================

    private const MIN_PASSWORD = 8;

    /** Cat's own account (id 1) can only be reset by Cat. */
    private static function resettable(string $encodedId): User|string
    {
        $user = User::find(IdEncoder::decode($encodedId) ?? 0);
        if (!$user) {
            return 'User not found.';
        }
        if ((int) $user->id === 1 && (int) AuthService::userId() !== 1) {
            return 'Only Cat can reset this account’s password.';
        }
        return $user;
    }

    /**
     * Set a new password for someone (the admin passes it on to them), and
     * optionally sign them out everywhere so old sessions stop working.
     */
    public function resetPassword(string $encodedId, string $password, bool $signOut): array
    {
        try {
            $user = self::resettable($encodedId);
            if (is_string($user)) {
                return ['success' => false, 'messages' => [$user]];
            }
            if (mb_strlen($password) < self::MIN_PASSWORD) {
                return ['success' => false, 'messages' => ['The password must be at least ' . self::MIN_PASSWORD . ' characters.']];
            }
            if (mb_strlen($password) > 255) {
                return ['success' => false, 'messages' => ['That password is too long.']];
            }

            $user->password = password_hash($password, PASSWORD_BCRYPT);
            $user->save();
            $ended = $signOut ? AuthService::endSessionsFor((int) $user->id) : 0;
            static::logActivity("Reset the password for {$user->full_name}" . ($signOut ? ' (signed out everywhere)' : ''), 'Users', $user->id);

            return [
                'success'  => true,
                'messages' => ["{$user->full_name}’s password has been reset."],
                'signed_out' => $ended,
            ];
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not reset the password: ' . $e->getMessage()]];
        }
    }

    /** Email someone the usual "reset your password" link (when email is set up). */
    public function sendResetLink(string $encodedId): array
    {
        $user = self::resettable($encodedId);
        if (is_string($user)) {
            return ['success' => false, 'messages' => [$user]];
        }
        if (!\Src\Service\MailService::isConfigured()) {
            return ['success' => false, 'messages' => ['Email isn’t set up on this server yet — set a new password instead.']];
        }
        $result = AuthController::forgotPassword(['email' => (string) $user->email]);
        if (empty($result['success'])) {
            return ['success' => false, 'messages' => $result['messages'] ?? ['Could not send the link.']];
        }
        static::logActivity("Sent a password reset link to {$user->full_name}", 'Users', $user->id);
        return ['success' => true, 'messages' => ["A reset link has been emailed to {$user->email}. It works for 60 minutes."]];
    }

    /**
     * Everything the Users page (resources/js/pages/users-page.js) needs:
     * every account with its roles, app access, location and last activity,
     * plus the apps an admin can grant. Admin-only (the page and the API check).
     */
    public static function state(): array
    {
        $types = [];
        foreach (UserTypesController::list() as $t) {
            $types[(int) $t->user_type_id] = (string) $t->user_type;
        }
        $lastSeen = \Illuminate\Database\Capsule\Manager::table('recent_activities')->whereNotNull('user_id')
            ->groupBy('user_id')->selectRaw('user_id, MAX(created_at) AS at')->pluck('at', 'user_id');
        $avatarDir = getAssetBase() . 'images/uploads/avatars/';
        $grantable = \Src\Config\NavigationConfig::grantableApps();

        $users = User::with(['country', 'region'])->orderBy('full_name')->get()->map(function (User $u) use ($types, $lastSeen, $avatarDir, $grantable) {
            $roles = array_values(array_map('intval', (array) ($u->user_type_ids ?? [])));
            $isAdmin = in_array(1, $roles, true);
            return [
                'id'         => IdEncoder::encode((int) $u->id),
                'name'       => (string) $u->full_name,
                'first_name' => (string) $u->first_name,
                'last_name'  => (string) $u->last_name,
                'email'      => (string) $u->email,
                'city'       => (string) ($u->city ?? ''),
                'region'     => (string) ($u->region->region ?? ''),
                'country'    => (string) ($u->country->country ?? ''),
                'country_id' => (int) ($u->country_id ?? 0),
                'region_id'  => (int) ($u->region_id ?? 0),
                'avatar'     => $u->avatar_url ? $avatarDir . rawurlencode((string) $u->avatar_url) : null,
                'active'     => (int) $u->status_id === User::STATUS_CURRENT,
                'role_ids'   => $roles,
                'roles'      => array_map(fn($r) => $types[$r] ?? 'User', $roles),
                'is_admin'   => $isAdmin,
                // Admins open every app; for everyone else, only what's granted here
                'apps'       => array_values(array_intersect((array) ($u->permitted_apps ?? []), $grantable)),
                'permitted'  => array_values((array) ($u->permitted_apps ?? [])),
                'protected'  => in_array((int) $u->id, self::PROTECTED_USER_IDS, true),
                'admin_locked' => (int) $u->id === 1,
                'is_me'      => (int) $u->id === (int) AuthService::userId(),
                'joined'     => $u->created_at ? $u->created_at->format('Y-m-d') : null,
                'last_seen'  => isset($lastSeen[$u->id]) ? substr((string) $lastSeen[$u->id], 0, 10) : null,
            ];
        })->values()->all();

        return ['users' => $users, 'grantable' => $grantable, 'today' => date('Y-m-d'), 'can_email' => \Src\Service\MailService::isConfigured()];
    }

    /**
     * Prepare data for the Users List Page
     * Optimized: Supports infinite scroll and search
     * @return void
     */
    public function index(): void
    {
        $query = $_GET['q'] ?? '';
        $page = (int)($_GET['page'] ?? 1);
        $perPage = 100;
        $offset = ($page - 1) * $perPage;

        $mode = $_GET['mode'] ?? 'table';

        // Per-column header filters (all AND'd together, and with $query above)
        $filterName     = trim((string) ($_GET['filter_name'] ?? ''));
        $filterLocation = trim((string) ($_GET['filter_location'] ?? ''));
        $filterRoles    = trim((string) ($_GET['filter_roles'] ?? ''));
        $filterStatus   = trim((string) ($_GET['filter_status'] ?? ''));

        // Column sort: name | location | joined | status. Anything else falls
        // back to the original default (most recently created first).
        $sortKey = (string) ($_GET['sort'] ?? '');
        $sortDir = strtolower((string) ($_GET['dir'] ?? '')) === 'desc' ? 'desc' : 'asc';

        $builder = User::with(['country', 'region'])
            ->leftJoin('countries', 'users.country_id', '=', 'countries.country_id')
            ->leftJoin('regions', 'users.region_id', '=', 'regions.region_id')
            ->select('users.*');

        if (!empty($query)) {
            $builder->where(function ($q) use ($query) {
                $q->where('users.full_name', 'LIKE', "%{$query}%")
                    ->orWhere('users.email', 'LIKE', "%{$query}%")
                    ->orWhere('users.city', 'LIKE', "%{$query}%")
                    ->orWhere('countries.country', 'LIKE', "%{$query}%")
                    ->orWhere('regions.region', 'LIKE', "%{$query}%");
            });
        }

        if ($filterName !== '') {
            $builder->where(function ($q) use ($filterName) {
                $q->where('users.full_name', 'LIKE', "%{$filterName}%")
                    ->orWhere('users.email', 'LIKE', "%{$filterName}%");
            });
        }

        if ($filterLocation !== '') {
            $builder->where(function ($q) use ($filterLocation) {
                $q->where('users.city', 'LIKE', "%{$filterLocation}%")
                    ->orWhere('regions.region', 'LIKE', "%{$filterLocation}%")
                    ->orWhere('countries.country', 'LIKE', "%{$filterLocation}%");
            });
        }

        if ($filterStatus !== '') {
            // Only two labels ever render ("Current" / "Archived" — see
            // data-row.php's $statusBadge) so match the typed text against
            // those labels rather than the raw status_id.
            $needle = mb_strtolower($filterStatus);
            if (str_contains('current', $needle)) {
                $builder->where('users.status_id', 1);
            } elseif (str_contains('archived', $needle)) {
                $builder->where('users.status_id', '!=', 1);
            } else {
                $builder->whereRaw('1 = 0');
            }
        }

        if ($filterRoles !== '') {
            $matchingTypeIds = [];
            foreach (\Src\Controller\UserTypesController::list() as $type) {
                if (stripos((string) $type->user_type, $filterRoles) !== false) {
                    $matchingTypeIds[] = (int) $type->user_type_id;
                }
            }

            if (!empty($matchingTypeIds)) {
                $builder->where(function ($q) use ($matchingTypeIds) {
                    foreach ($matchingTypeIds as $typeId) {
                        $q->orWhereRaw('JSON_CONTAINS(users.user_type_ids, ?)', [json_encode($typeId)]);
                    }
                });
            } else {
                $builder->whereRaw('1 = 0');
            }
        }

        $totalFiltered = $builder->count();

        switch ($sortKey) {
            case 'name':
                $builder->orderBy('users.full_name', $sortDir);
                break;
            case 'location':
                $builder->orderBy('users.city', $sortDir);
                break;
            case 'joined':
                $builder->orderBy('users.created_at', $sortDir);
                break;
            case 'status':
                $builder->orderBy('users.status_id', $sortDir);
                break;
            default:
                $builder->orderBy('users.created_at', 'desc');
                break;
        }

        $users = $builder->offset($offset)
            ->limit($perPage)
            ->get();

        // AJAX response
        if (isset($_GET['q']) || isset($_GET['page'])) {
            header('Content-Type: application/json');

            // Standard Table Response
            echo json_encode([
                'success' => true,
                'data' => array_map(fn($u) => ['rowHtml' => self::renderRow($u)], $users->all()),
                'meta' => [
                    'total' => $totalFiltered,
                    'loaded' => $users->count(),
                    'hasMore' => ($offset + $users->count()) < $totalFiltered
                ]
            ]);
            exit;
        }

        // Standard Page Load logic remains the same...
        $html = '';
        foreach ($users as $user) {
            $html .= self::renderRow($user);
        }

        $GLOBALS['userRows'] = $html;
        $GLOBALS['title'] = "Users";
        $GLOBALS['totalUsersCount'] = $totalFiltered;
    }

    /**
     * Render individual table row HTML
     * @param User $user
     * @return string
     */
    public static function renderRow(\App\Models\User $user): string
    {
        $rowItem = $user->toArray();

        // Legacy stores one full_name; the edit form wants the parts.
        $rowItem['first_name'] = $user->first_name;
        $rowItem['last_name']  = $user->last_name;

        $GLOBALS['assetBase'] = getAssetBase();

        // Location Mapping
        $rowItem['country_name'] = $user->country->country ?? 'N/A';
        $rowItem['region_name']  = $user->region->region ?? 'N/A';

        // Encoding ID for security
        $rowItem['encoded_id'] = IdEncoder::encode((int)$user->id);
        $rowItem['created_at_formatted'] = $user->created_at ? $user->created_at->format('M j, Y') : 'N/A';

        $path = __DIR__ . '/../../resources/views/components/users/data-row.php';

        ob_start();
        try {
            // Passing variables explicitly to prevent Scope issues
            $assetBase = getAssetBase();
            include $path;
        } catch (\Throwable $e) {
            ob_end_clean();
            return "<tr><td colspan='6'>Render Error: " . $e->getMessage() . "</td></tr>";
        }
        return ob_get_clean();
    }

    /**
     * Handle Create or Update for Users
     * @param array $data
     * @return array
     */
    public function save(array $data): array
    {
        try {
            $encodedId = $data['encoded_id'] ?? null;
            $email = trim($data['email'] ?? '');
            $isNew = empty($encodedId);

            if (empty($email)) throw new \Exception("Email address is required.");

            $userId = !$isNew ? IdEncoder::decode($encodedId) : null;
            $user = $userId ? User::find($userId) : new User();

            if (!$user) throw new \Exception("User not found.");

            // Email uniqueness check
            $existingQuery = User::where('email', $email);
            if ($user->exists) {
                $existingQuery->where('id', '!=', $user->id);
            }
            if ($existingQuery->exists()) {
                throw new \Exception("The email address '{$email}' is already in use.");
            }

            // The form keeps separate first/last inputs; legacy stores one full_name.
            $fullName = trim(trim((string) ($data['first_name'] ?? '')) . ' ' . trim((string) ($data['last_name'] ?? '')));
            if ($fullName === '') throw new \Exception("Name is required.");
            $user->full_name  = $fullName;
            $user->email      = $email;
            $user->city       = $data['city'] ?? null;
            $user->country_id = (int)($data['country_id'] ?? 1);
            $tableRegionId    = (int)($data['region_id'] ?? 0);
            $user->region_id  = $tableRegionId > 0 ? $tableRegionId : null;

            if (!empty($data['password'])) {
                $user->password = password_hash($data['password'], PASSWORD_BCRYPT);
            }

            // Role Compilation — a user editing their own profile may freely
            // pick their own
            // non-admin role(s), but only an authenticated admin caller may grant or
            // keep the Admin role (user_type_id 1). The Admin checkbox is
            // already hidden from non-admin viewers client-side (see
            // users-modal.js's visibleRoles()) — this is the actual
            // enforcement, since the UI hiding it is not itself a
            // safeguard against a hand-crafted request.
            if (isset($data['user_type_ids']) && is_array($data['user_type_ids'])) {
                $submittedRoles = array_map('intval', $data['user_type_ids']);
                if (!AuthService::isAdmin()) {
                    $submittedRoles = array_values(array_diff($submittedRoles, [1]));
                }

                // Never leave a user with zero roles — falls back to the
                // default rather than wiping an existing account's roles
                // (only reachable via a hand-crafted request; the UI always
                // keeps at least one checkbox checked).
                $user->user_type_ids = $submittedRoles ?: ($isNew ? [2] : $user->user_type_ids);
            } elseif ($isNew) {
                $user->user_type_ids = [2];
            }

            // App access (users.permitted_apps). Admin-only, and only the apps
            // this app grants are touched: any other entry (e.g. an app you've
            // since retired) is preserved as it was.
            if (!empty($data['permitted_apps_present']) && AuthService::isAdmin()) {
                $grantable = \Src\Config\NavigationConfig::grantableApps();
                $submitted = array_intersect(array_map('strval', (array) ($data['permitted_apps'] ?? [])), $grantable);
                $kept = array_diff((array) ($user->permitted_apps ?? []), $grantable);
                $user->permitted_apps = array_values(array_unique(array_merge($kept, $submitted)));
            }

            // Core Account Admin Guard: user #1 (the first admin) always keeps
            // Admin (1).
            if (!$isNew && (int) $user->id === 1) {
                $currentRoles = $user->user_type_ids; // Pull array out of the overloaded property
                if (!in_array(1, $currentRoles)) {
                    $currentRoles[] = 1;
                    $user->user_type_ids = array_values(array_unique($currentRoles)); // Re-assign the whole array
                }
            }

            // Accounts are created by an admin (no self-registration or email
            // verification, same as the legacy app), so a new account is
            // current straight away.
            if ($isNew) {
                $user->status_id = User::STATUS_CURRENT;
            } elseif (array_key_exists('status_id', $data)) {
                $user->status_id = (int) $data['status_id'] === User::STATUS_CURRENT ? User::STATUS_CURRENT : User::STATUS_ARCHIVED;
            }

            $user->save();

            $user->load(['country', 'region']);

            $actionLabel = $isNew ? "Created user profile" : "Updated user profile";
            static::logActivity("{$actionLabel}: {$user->full_name} ({$user->email})", 'Users');

            return [
                'success'  => true,
                'user_id'  => $user->id,
                'data'     => $user->toArray(),
                'rowHtml'  => self::renderRow($user),
                'messages' => ['User saved successfully.']
            ];
        } catch (\Throwable $e) {
            static::logActivity("User save error: " . $e->getMessage(), 'Users');
            return ['success' => false, 'messages' => [$e->getMessage()]];
        }
    }

    /**
     * Update only User Types
     * @param array $data
     * @return array
     */
    public function updateTypes(array $data): array
    {
        try {
            $encodedId = $data['encoded_id'] ?? null;
            if (!$encodedId) throw new \Exception("User ID is required.");

            $userId = IdEncoder::decode($encodedId);
            $user = User::find($userId);

            if (!$user) throw new \Exception("User not found.");

            $user->user_type_ids = isset($data['user_type_ids']) ? array_map('intval', $data['user_type_ids']) : [];
            $user->save();

            static::logActivity("Updated professional roles for: {$user->full_name}", 'Users');
            $user->load(['country', 'region']);

            return [
                'success' => true,
                'messages' => ['Roles updated successfully.'],
                'rowHtml' => self::renderRow($user)
            ];
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => [$e->getMessage()]];
        }
    }
}
