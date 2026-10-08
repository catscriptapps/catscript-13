<?php
// /src/Service/AuthService.php

declare(strict_types=1);

namespace Src\Service;

use App\Models\User;

/**
 * Class AuthService
 * Centralized authentication service for the legacy catscript_db users table.
 */
class AuthService
{
    /**
     * Retrieves the currently logged-in user from the database.
     * Uses the standard 'id' primary key.
     */
    public static function currentUser(): ?User
    {
        self::ensureSession();

        return isset($_SESSION['user_id'])
            ? User::find((int)$_SESSION['user_id'])
            : null;
    }

    /**
     * Retrieves the currently logged-in landlord from the database.
     * Uses the 'landlord_id' from the session.
     */
    public static function currentLandlord(): ?\App\Models\Landlord
    {
        // No Landlord account model in this app (removed in the PMB-template
        // cleanup) — always null. Kept as a stub so existing callers'
        // falsy checks keep working without touching every call site.
        return null;
    }

    /**
     * Retrieves the currently logged-in tenant from the database.
     * Uses the 'tenant_id' from the session.
     */
    public static function currentTenant(): ?\App\Models\Tenant
    {
        // No Tenant account model in this app — see currentLandlord() above.
        return null;
    }

    /**
     * The rebuilt legacy CatScript apps. Access to these follows each user's
     * legacy users.permitted_apps list (the same list the legacy app reads,
     * so production permissions carry over unchanged) — e.g. Tasks is only
     * open to the family members it was granted to.
     */
    public const PERMISSIONED_APPS = [
        'Tasks', 'Chores', 'Cash Flow', 'Pictures', 'Meals',
        'Timetable', 'Customers', 'Invoices', 'Receipts', 'Social Feed', 'Slideshow', 'Medicals',
        self::MEAL_PLANNER, self::TIMETABLE_EDITOR, self::CHORES_MANAGER,
    ];

    /**
     * Who may change the chores plan, the chore library and the children.
     * Everyone with Chores access can view the plan and tick chores done.
     */
    public const CHORES_MANAGER = 'Chores Manager';

    public static function canManageChores(): bool
    {
        return self::hasAccess('Chores') && self::hasAccess(self::CHORES_MANAGER);
    }

    /**
     * Admin-only areas — never assignable. (Messages is the site's contact-
     * form inbox, not member-to-member messaging.)
     */
    public const ADMIN_ONLY_APPS = ['users', 'messages'];

    /**
     * Capabilities that ride along with an app (app => capability) — shown
     * right after that app in the admin's "App access" boxes.
     */
    public const CAPABILITIES = [
        'Meals'     => self::MEAL_PLANNER,
        'Timetable' => self::TIMETABLE_EDITOR,
        'Chores'    => self::CHORES_MANAGER,
    ];

    /**
     * Who may change the (shared) family timetable. Everyone with Timetable
     * access can view it.
     */
    public const TIMETABLE_EDITOR = 'Timetable Editor';

    public static function canEditTimetable(): bool
    {
        return self::hasAccess('Timetable') && self::hasAccess(self::TIMETABLE_EDITOR);
    }

    /**
     * Not an app but a capability, stored in permitted_apps like one: who may
     * create (and then edit their own) meal plans. Everyone with Meals can
     * view every plan. Granted per user in the admin's "App access" boxes.
     */
    public const MEAL_PLANNER = 'Meal Planner';

    /** May the current user create meal plans (and edit the ones they own)? */
    public static function canPlanMeals(): bool
    {
        return self::hasAccess('Meals') && self::hasAccess(self::MEAL_PLANNER);
    }

    /**
     * Check if the user has access to a specific app.
     * - Admins: everything.
     * - ADMIN_ONLY_APPS (Users, Messages): admins only.
     * - PERMISSIONED_APPS: only if the admin assigned it (users.permitted_apps,
     *   edited in Users → App Access).
     * - Everything else (Dashboard, Profile): any signed-in user.
     */
    public static function hasAccess(string $appName): bool
    {
        if (self::isAdmin()) {
            return true;
        }

        if (in_array(strtolower($appName), self::ADMIN_ONLY_APPS, true)) {
            return false;
        }

        $user = self::currentUser();
        if ($user === null) {
            return false;
        }

        if (in_array($appName, self::PERMISSIONED_APPS, true)) {
            return in_array($appName, (array) ($user->permitted_apps ?? []), true);
        }

        return true;
    }

    /**
     * Ensures that a PHP session is started with a 2-week persistence:
     * session files in our own folder (server/storage/sessions) with a
     * 2-week garbage-collection lifetime, and a 2-week cookie that slides
     * forward while the person keeps using the site — so you stay signed in
     * unless you're away for two weeks or sign out.
     *
     * Previously this only started the default session-only cookie (expires
     * on browser close, server-side data garbage-collected after ~24
     * minutes of inactivity per PHP's default gc_maxlifetime) despite this
     * docblock's claim — nothing actually configured the lifetime. That
     * mismatch is what let a guest's chat_guest_token (see ChatController)
     * silently expire while the widget's localStorage-cached conversation
     * id lived on indefinitely, producing a "couldn't find that
     * conversation" error the next time they sent a message.
     */
    public static function ensureSession(): void
    {
        if (session_status() !== PHP_SESSION_NONE) {
            return;
        }

        // Session files live in our own folder (outside public/). In the
        // server's shared default folder, other software's clean-up (e.g. a
        // system cron using PHP's 24-minute default) deletes them long before
        // our 2 weeks — the usual reason people get signed out early.
        $dir = self::SESSION_DIR;
        if (!is_dir($dir) && @mkdir($dir, 0700, true)) {
            // Never web-readable, even if the web root sits above public/
            @file_put_contents($dir . '/.htaccess', "Require all denied\n");
        }
        if (is_dir($dir) && is_writable($dir)) {
            session_save_path($dir);
            // PHP's own garbage collection for this folder, with our lifetime
            ini_set('session.gc_probability', '1');
            ini_set('session.gc_divisor', '100');
        }

        ini_set('session.gc_maxlifetime', (string) self::SESSION_LIFETIME);
        ini_set('session.use_strict_mode', '1'); // never adopt an unknown session id
        session_set_cookie_params(self::sessionCookieParams());
        session_start();

        // Sliding expiry: PHP only sends the cookie when a session is created,
        // so on its own it would end 2 weeks after sign-in however often the
        // site is used. While signed in, push it out again (at most hourly).
        if (!empty($_SESSION['user_id']) && !headers_sent()
            && (int) ($_SESSION['_cookie_renewed'] ?? 0) < time() - 3600) {
            $params = self::sessionCookieParams();
            unset($params['lifetime']);
            setcookie(session_name(), session_id(), ['expires' => time() + self::SESSION_LIFETIME] + $params);
            $_SESSION['_cookie_renewed'] = time();
        }
    }

    /** How long a signed-in session lasts without a visit. */
    public const SESSION_LIFETIME = 60 * 60 * 24 * 14; // 2 weeks

    /** Our own session folder (outside public/), see ensureSession(). */
    private const SESSION_DIR = __DIR__ . '/../../server/storage/sessions';

    /**
     * Signs a user out everywhere — e.g. after an admin resets their
     * password, so a session on a lost phone stops working. Deletes their
     * session files (never the caller's own). Returns how many were ended.
     */
    public static function endSessionsFor(int $userId): int
    {
        $ended = 0;
        $mine = session_status() === PHP_SESSION_ACTIVE ? session_id() : '';
        foreach (glob(self::SESSION_DIR . '/sess_*') ?: [] as $file) {
            if (basename($file) === "sess_{$mine}") {
                continue;
            }
            $raw = @file_get_contents($file);
            // PHP's session format: "user_id|i:5;…" (at the start, or after a ";")
            if ($raw !== false && preg_match('/(^|;)user_id\|i:' . $userId . ';/', $raw) && @unlink($file)) {
                $ended++;
            }
        }
        return $ended;
    }

    /** @return array{lifetime: int, path: string, domain: string, secure: bool, httponly: bool, samesite: string} */
    private static function sessionCookieParams(): array
    {
        return [
            'lifetime' => self::SESSION_LIFETIME,
            'path' => '/',
            'domain' => '',
            'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
            'httponly' => true,
            'samesite' => 'Lax',
        ];
    }

    /**
     * Determine if the current user is an admin.
     * Admin is defined as having user_type_id 1 in their collection.
     */
    public static function isAdmin(): bool
    {
        self::ensureSession();
        $uid = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;

        if ($uid === 0) {
            return false;
        }

        // Fetch the user to check their modernized type collection
        $user = \App\Models\User::find($uid);

        if (!$user || !is_array($user->user_type_ids)) {
            return false;
        }

        // Check if 1 (Admin) exists in their array of types
        return in_array(1, $user->user_type_ids);
    }

    /**
     * Determine if the current user is Cat (ID 1).
     */
    public static function isCat(): bool
    {
        self::ensureSession();
        return isset($_SESSION['user_id']) && (int)$_SESSION['user_id'] === 1;
    }

    /**
     * Checks if a user is currently logged in.
     */
    public static function isLoggedIn(): bool
    {
        self::ensureSession();
        // A user is considered logged in if either a user_id for a backend user
        // OR a landlord_id for a landlord is present in the session.
        $isUserLoggedIn = isset($_SESSION['user_id']) && (int)$_SESSION['user_id'] > 0;
        $isLandlordLoggedIn = isset($_SESSION['landlord_id']) && (int)$_SESSION['landlord_id'] > 0;
        $isTenantLoggedIn = isset($_SESSION['tenant_id']) && (int)$_SESSION['tenant_id'] > 0;
        return $isUserLoggedIn || $isLandlordLoggedIn || $isTenantLoggedIn;
    }

    /**
     * Attempt to authenticate a user against the legacy users table.
     * Only current accounts (status_id = User::STATUS_CURRENT) may sign in.
     */
    public static function login(string $email, string $password): array
    {
        self::ensureSession();

        $user = User::where('email', $email)->first();
        if (!$user || !password_verify($password, (string) $user->password)) {
            return ['success' => false, 'messages' => ['Invalid email or password.']];
        }

        if ((int)$user->status_id !== User::STATUS_CURRENT) {
            return ['success' => false, 'messages' => ['This account is not active. Please contact an administrator.']];
        }

        return self::loginAsUser($user);
    }

    /**
     * Establishes a cookie-backed login session (the 2-week cookie from
     * ensureSession()) for an already-authenticated User. No password check
     * here — the caller is responsible for that.
     */
    public static function loginAsUser(User $user): array
    {
        self::ensureSession();
        session_regenerate_id(true);

        $_SESSION['user_id'] = $user->id;
        $_SESSION['user_email'] = $user->email;
        $_SESSION['user_full_name'] = $user->full_name;
        $_SESSION['account_type'] = 'user';

        return [
            'success' => true,
            'messages' => ['Login successful!'],
            'redirect_url' => '/dashboard',
        ];
    }

    /**
     * Logs out the current user.
     */
    public static function logout(): void
    {
        self::ensureSession();

        session_unset();
        session_destroy();

        // Drop the cookie too, so the browser doesn't keep a dead session id
        if (!headers_sent()) {
            $params = self::sessionCookieParams();
            unset($params['lifetime']);
            setcookie(session_name(), '', ['expires' => time() - 3600] + $params);
        }
    }

    /**
     * Get the current user ID.
     */
    public static function userId(): ?int
    {
        self::ensureSession();
        return isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : null;
    }
}
