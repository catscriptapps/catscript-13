<?php
// /src/Controller/AccountSecurityController.php

declare(strict_types=1);

namespace Src\Controller;

use App\Models\RecentActivity;
use App\Traits\RecentActivityLogger;
use Src\Service\AuthService;

/**
 * Settings → Security for the signed-in user: how many other devices are
 * signed in, their recent sign-ins (from the activity log), and signing out
 * everywhere else.
 */
class AccountSecurityController
{
    use RecentActivityLogger;

    private const SIGNIN_LIMIT = 6;

    public static function state(): array
    {
        $userId = (int) AuthService::userId();

        $signins = RecentActivity::query()
            ->where('entity_type', 'Auth')
            ->where('action', 'Successful login')
            ->where(fn($q) => $q->where('user_id', $userId)->orWhere('entity_id', $userId))
            ->orderByDesc('created_at')->orderByDesc('id')
            ->limit(self::SIGNIN_LIMIT)->get()
            ->map(fn(RecentActivity $a) => [
                'at'     => $a->created_at?->toIso8601String(),
                'ago'    => $a->created_at ? $a->created_at->diffForHumans() : '',
                'ip'     => (string) ($a->ip_address ?? ''),
                'device' => self::describeAgent((string) ($a->user_agent ?? '')),
            ])->values()->all();

        return [
            'other_sessions' => AuthService::otherSessionCount($userId),
            'signins'        => $signins,
            'this_device'    => self::describeAgent((string) ($_SERVER['HTTP_USER_AGENT'] ?? '')),
        ];
    }

    public static function signOutOthers(): array
    {
        $userId = (int) AuthService::userId();
        $ended = AuthService::endSessionsFor($userId);
        static::logActivity($ended ? "Signed out {$ended} other device(s)" : 'Signed out other devices (none were signed in)', 'Auth', $userId);

        return [
            'success'  => true,
            'messages' => [$ended ? ($ended === 1 ? 'Signed out 1 other device.' : "Signed out {$ended} other devices.") : 'No other devices were signed in.'],
        ] + self::state();
    }

    /** "Chrome on Windows" from a user-agent string (best effort). */
    private static function describeAgent(string $ua): string
    {
        if ($ua === '') {
            return 'Unknown device';
        }
        $browser = match (true) {
            str_contains($ua, 'Edg/')                                   => 'Edge',
            str_contains($ua, 'OPR/') || str_contains($ua, 'Opera')     => 'Opera',
            str_contains($ua, 'Firefox/')                               => 'Firefox',
            str_contains($ua, 'Chrome/') || str_contains($ua, 'CriOS/') => 'Chrome',
            str_contains($ua, 'Safari/')                                => 'Safari',
            default                                                     => 'Browser',
        };
        $os = match (true) {
            str_contains($ua, 'iPhone')                                 => 'iPhone',
            str_contains($ua, 'iPad')                                   => 'iPad',
            str_contains($ua, 'Android')                                => 'Android',
            str_contains($ua, 'Windows')                                => 'Windows',
            str_contains($ua, 'Mac OS X') || str_contains($ua, 'Macintosh') => 'Mac',
            str_contains($ua, 'CrOS')                                   => 'ChromeOS',
            str_contains($ua, 'Linux')                                  => 'Linux',
            default                                                     => 'an unknown system',
        };
        return "{$browser} on {$os}";
    }
}
