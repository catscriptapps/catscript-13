<?php
// /src/Controller/ChoresController.php

declare(strict_types=1);

namespace Src\Controller;

use App\Models\ChoreChild;
use App\Models\ChoreDone;
use App\Models\ChoreLibraryItem;
use App\Models\ChorePlan;
use App\Models\TimetableActivity;
use App\Models\User;
use App\Traits\RecentActivityLogger;
use Illuminate\Database\Capsule\Manager as Capsule;
use Src\Service\AuthService;

/**
 * Chores — who does which chore, in the Timetable's chore slots.
 *
 * Replaces the legacy daily / weekly model with three simple things:
 *  - a library of every possible chore (area, minutes, best time of day);
 *  - the children who share them;
 *  - chore SLOTS, taken live from the Timetable: every activity in the
 *    Chores category (or with "chore" in its name), e.g. Mon–Fri 6:30–6:50.
 *    Each child gets chores for a slot that fit inside it — the plan shows
 *    each child's minutes against the slot's length. A slot is keyed by
 *    day + start time, so plans survive the Timetable's copy / replace.
 *
 * Everyone with Chores access can view the plan and tick chores done;
 * changing the plan, the library or the children needs the Chores Manager
 * capability (AuthService::canManageChores()). The legacy chore tables are
 * never written to. Changes are logged to recent_activities ("Chores").
 */
class ChoresController
{
    use RecentActivityLogger;

    private const MAX_TITLE = 150;
    private const MAX_MINUTES = 240;

    // ============================================================
    // Reads
    // ============================================================

    public static function state(): array
    {
        $children = ChoreChild::where('active', true)->orderBy('sort_order')->orderBy('id')->get()
            ->map(fn(ChoreChild $c) => self::presentChild($c))->values()->all();
        $library = ChoreLibraryItem::orderBy('title')->get()
            ->map(fn(ChoreLibraryItem $c) => self::presentChore($c))->values()->all();
        $plan = ChorePlan::orderBy('id')->get()
            ->map(fn(ChorePlan $p) => self::presentPlan($p))->values()->all();

        [$weekStart, $weekEnd] = self::week();
        $done = ChoreDone::whereBetween('done_on', [$weekStart, $weekEnd])->get()
            ->map(fn(ChoreDone $d) => ['plan_id' => (int) $d->plan_id, 'date' => $d->done_on->format('Y-m-d')])
            ->values()->all();

        $canManage = AuthService::canManageChores();

        return [
            'children'   => $children,
            'library'    => $library,
            'slots'      => self::slots(),
            'plan'       => $plan,
            'done'       => $done,
            'today'      => date('Y-m-d'),
            'week_start' => $weekStart,
            'areas'      => ChoreLibraryItem::AREAS,
            'can_manage' => $canManage,
            'accounts'   => $canManage
                ? User::orderBy('full_name')->get(['id', 'full_name'])->map(fn($u) => ['id' => (int) $u->id, 'name' => (string) $u->full_name])->all()
                : [],
        ];
    }

    /**
     * Chore slots from the Timetable: activities in the Chores category, or
     * with "chore" in the name. Keyed "Day|HH:MM".
     * @return array<int, array>
     */
    public static function slots(): array
    {
        $tt = TimetableController::state();
        $choreCats = array_column(array_filter($tt['categories'], fn($c) => $c['slug'] === 'chores'), 'id');

        $slots = [];
        foreach ($tt['activities'] as $a) {
            if (!in_array($a['category_id'], $choreCats, true) && !preg_match('/chore/i', $a['name'])) {
                continue;
            }
            $key = "{$a['day']}|{$a['start']}";
            if (isset($slots[$key])) {
                continue; // two Timetable rows starting together = one slot
            }
            $minutes = self::toMin($a['end']) - self::toMin($a['start']);
            $slots[$key] = [
                'key'     => $key,
                'day'     => $a['day'],
                'start'   => $a['start'],
                'end'     => $a['end'],
                'name'    => $a['name'],
                'minutes' => $minutes,
                'period'  => self::period($a['start']),
            ];
        }

        $order = array_flip(TimetableActivity::DAYS);
        uasort($slots, fn($x, $y) => [$order[$x['day']], $x['start']] <=> [$order[$y['day']], $y['start']]);
        return array_values($slots);
    }

    public static function presentChild(ChoreChild $c): array
    {
        return [
            'id'         => (int) $c->id,
            'first_name' => (string) $c->first_name,
            'last_name'  => (string) $c->last_name,
            'color'      => in_array($c->color, ChoreChild::COLORS, true) ? $c->color : 'orange',
            'user_id'    => $c->user_id ? (int) $c->user_id : null,
            // Their profile photo, when they're linked to an account that has one
            // (the page shows it instead of the coloured initial)
            'avatar'     => self::avatarOf($c->user_id ? (int) $c->user_id : null),
        ];
    }

    /** @var array<int, ?string>|null user id => avatar URL (per request) */
    private static ?array $avatars = null;

    private static function avatarOf(?int $userId): ?string
    {
        if (!$userId) {
            return null;
        }
        if (self::$avatars === null) {
            $dir = getAssetBase() . 'images/uploads/avatars/';
            self::$avatars = User::whereNotNull('avatar_url')->where('avatar_url', '<>', '')->pluck('avatar_url', 'id')
                ->map(fn($f) => $dir . rawurlencode(basename((string) $f)))->all();
        }
        return self::$avatars[$userId] ?? null;
    }

    public static function presentChore(ChoreLibraryItem $c): array
    {
        return [
            'id'        => (int) $c->id,
            'title'     => (string) $c->title,
            'area'      => isset(ChoreLibraryItem::AREAS[$c->area]) ? $c->area : 'general',
            'minutes'   => (int) $c->minutes,
            'best_time' => in_array($c->best_time, ChoreLibraryItem::TIMES, true) ? $c->best_time : 'any',
            'per_child' => (bool) $c->per_child,
            'detail'    => (string) ($c->detail ?? ''),
            'active'    => (bool) $c->active,
        ];
    }

    public static function presentPlan(ChorePlan $p): array
    {
        return [
            'id'       => (int) $p->id,
            'slot'     => "{$p->day_of_week}|{$p->slot_start}",
            'child_id' => (int) $p->child_id,
            'chore_id' => (int) $p->chore_id,
        ];
    }

    // ============================================================
    // Ticking chores off (anyone with Chores access)
    // ============================================================

    public function toggleDone(int $planId, string $date, int $userId): array
    {
        try {
            $plan = ChorePlan::find($planId);
            if (!$plan) {
                return ['success' => false, 'messages' => ['That chore is no longer planned.']];
            }
            [$weekStart] = self::week();
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || $date < $weekStart || $date > date('Y-m-d')) {
                return ['success' => false, 'messages' => ['Chores can be ticked off for this week, up to today.']];
            }
            if (date('l', strtotime($date)) !== $plan->day_of_week) {
                return ['success' => false, 'messages' => ["That chore is planned for {$plan->day_of_week}s."]];
            }

            $existing = ChoreDone::where('plan_id', $planId)->where('done_on', $date)->first();
            $chore = ChoreLibraryItem::find($plan->chore_id);
            $child = ChoreChild::find($plan->child_id);
            $label = ($child->first_name ?? 'Someone') . ': ' . ($chore->title ?? 'a chore');

            if ($existing) {
                $existing->delete();
                static::logActivity("Unticked chore — {$label}", 'Chores', $planId);
                return ['success' => true, 'done' => false];
            }
            ChoreDone::create(['plan_id' => $planId, 'done_on' => $date, 'ticked_by' => $userId]);
            static::logActivity("Chore done — {$label}", 'Chores', $planId);
            return ['success' => true, 'done' => true];
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not update the chore: ' . $e->getMessage()]];
        }
    }

    // ============================================================
    // The plan (Chores Manager)
    // ============================================================

    public function assign(string $slotKey, int $childId, int $choreId, int $userId): array
    {
        try {
            if (!AuthService::canManageChores()) {
                return self::readOnly();
            }
            $slot = self::slot($slotKey);
            $child = ChoreChild::where('active', true)->find($childId);
            $chore = ChoreLibraryItem::where('active', true)->find($choreId);
            if (!$slot || !$child || !$chore) {
                return ['success' => false, 'messages' => ['Pick a chore slot, a child and a chore.']];
            }
            if (ChorePlan::where(['day_of_week' => $slot['day'], 'slot_start' => $slot['start'], 'child_id' => $childId, 'chore_id' => $choreId])->exists()) {
                return ['success' => false, 'messages' => ["{$child->first_name} already has that chore in this slot."]];
            }

            $plan = ChorePlan::create([
                'day_of_week' => $slot['day'], 'slot_start' => $slot['start'],
                'child_id' => $childId, 'chore_id' => $choreId, 'created_by' => $userId,
            ]);
            static::logActivity("Gave {$child->first_name} a chore: {$chore->title} ({$slot['day']} " . self::label($slot['start']) . ')', 'Chores', $plan->id);

            return ['success' => true, 'messages' => ['Chore added.'], 'plan' => self::presentPlan($plan)];
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not add the chore: ' . $e->getMessage()]];
        }
    }

    /** Remove one planned chore (and its ticks). */
    public function unassign(int $planId): array
    {
        try {
            if (!AuthService::canManageChores()) {
                return self::readOnly();
            }
            $plan = ChorePlan::find($planId);
            if (!$plan) {
                return ['success' => false, 'messages' => ['That chore is no longer planned.']];
            }
            $chore = ChoreLibraryItem::find($plan->chore_id);
            $child = ChoreChild::find($plan->child_id);
            Capsule::connection()->transaction(function () use ($plan) {
                ChoreDone::where('plan_id', $plan->id)->delete();
                $plan->delete();
            });
            static::logActivity('Took a chore off ' . ($child->first_name ?? 'a child') . ': ' . ($chore->title ?? 'chore') . " ({$plan->day_of_week})", 'Chores', $planId);

            return ['success' => true, 'messages' => ['Chore removed.']];
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not remove the chore: ' . $e->getMessage()]];
        }
    }

    /**
     * Share chores out fairly across the children, slot by slot, so each
     * child's chores fit inside the slot. Personal chores (make bed, …) go to
     * every child first; then shared chores, biggest first, each to the child
     * with the least time used who still has room. The order of children
     * rotates from slot to slot, so nobody gets the same chores every day.
     * Chores that don't fit are reported back.
     *
     * @param string[] $slotKeys
     * @param int[]    $choreIds
     */
    public function shareOut(array $slotKeys, array $choreIds, bool $replace, int $userId): array
    {
        try {
            if (!AuthService::canManageChores()) {
                return self::readOnly();
            }
            $allSlots = array_column(self::slots(), null, 'key');
            $slots = array_values(array_filter(array_map(fn($k) => $allSlots[$k] ?? null, array_unique($slotKeys))));
            $chores = ChoreLibraryItem::where('active', true)->whereIn('id', array_map('intval', $choreIds))->get()
                ->sortBy([['minutes', 'desc'], ['id', 'asc']])->values();
            $children = ChoreChild::where('active', true)->orderBy('sort_order')->orderBy('id')->get()->values();

            if (!$slots || $chores->isEmpty() || $children->isEmpty()) {
                return ['success' => false, 'messages' => ['Pick at least one chore slot and one chore (and make sure there are children to share with).']];
            }

            $placed = 0;
            $unfit = [];
            Capsule::connection()->transaction(function () use ($slots, $chores, $children, $replace, $userId, &$placed, &$unfit) {
                foreach ($slots as $s => $slot) {
                    $where = ['day_of_week' => $slot['day'], 'slot_start' => $slot['start']];
                    if ($replace) {
                        $ids = ChorePlan::where($where)->pluck('id');
                        ChoreDone::whereIn('plan_id', $ids)->delete();
                        ChorePlan::whereIn('id', $ids)->delete();
                    }

                    $existing = ChorePlan::where($where)->get();
                    $loads = [];
                    foreach ($children as $c) {
                        $loads[$c->id] = 0;
                    }
                    $minutesOf = ChoreLibraryItem::whereIn('id', $existing->pluck('chore_id'))->pluck('minutes', 'id');
                    foreach ($existing as $p) {
                        if (isset($loads[$p->child_id])) {
                            $loads[$p->child_id] += (int) ($minutesOf[$p->chore_id] ?? 0);
                        }
                    }
                    $taken = $existing->pluck('chore_id')->all();
                    $has = []; // child id => chore ids they already have here
                    foreach ($existing as $p) {
                        $has[$p->child_id][] = (int) $p->chore_id;
                    }

                    // Rotate who's first in line, slot by slot
                    $n = $children->count();
                    $order = [];
                    for ($i = 0; $i < $n; $i++) {
                        $order[] = $children[($i + $s) % $n];
                    }

                    // 1. Personal chores: everyone does their own
                    foreach ($chores->where('per_child', true) as $chore) {
                        foreach ($order as $c) {
                            if (in_array((int) $chore->id, $has[$c->id] ?? [], true)) {
                                continue;
                            }
                            if ($loads[$c->id] + $chore->minutes > $slot['minutes']) {
                                $unfit[] = "{$chore->title} for {$c->first_name} ({$slot['day']})";
                                continue;
                            }
                            ChorePlan::create([
                                'day_of_week' => $slot['day'], 'slot_start' => $slot['start'],
                                'child_id' => $c->id, 'chore_id' => $chore->id, 'created_by' => $userId,
                            ]);
                            $loads[$c->id] += $chore->minutes;
                            $has[$c->id][] = (int) $chore->id;
                            $placed++;
                        }
                    }

                    // 2. Shared chores: one child each, fairly
                    foreach ($chores->where('per_child', false) as $chore) {
                        if (in_array((int) $chore->id, $taken, true)) {
                            continue; // already someone's in this slot
                        }
                        $best = null;
                        foreach ($order as $c) {
                            if ($loads[$c->id] + $chore->minutes > $slot['minutes']) {
                                continue;
                            }
                            if ($best === null || $loads[$c->id] < $loads[$best->id]) {
                                $best = $c;
                            }
                        }
                        if (!$best) {
                            $unfit[] = "{$chore->title} ({$slot['day']})";
                            continue;
                        }
                        ChorePlan::create([
                            'day_of_week' => $slot['day'], 'slot_start' => $slot['start'],
                            'child_id' => $best->id, 'chore_id' => $chore->id, 'created_by' => $userId,
                        ]);
                        $loads[$best->id] += $chore->minutes;
                        $taken[] = (int) $chore->id;
                        $placed++;
                    }
                }
            });

            $slotWord = count($slots) === 1 ? '1 slot' : count($slots) . ' slots';
            static::logActivity("Shared out {$placed} chores across {$slotWord}" . ($replace ? ' (replaced)' : ''), 'Chores');

            $msg = $placed ? "Shared out {$placed} " . ($placed === 1 ? 'chore' : 'chores') . " across {$slotWord}." : 'Nothing new to share out.';
            return ['success' => true, 'messages' => [$msg], 'unfit' => $unfit] + self::state();
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not share the chores out: ' . $e->getMessage()]];
        }
    }

    /** Empty one slot (every child's chores in it). */
    public function clearSlot(string $slotKey): array
    {
        try {
            if (!AuthService::canManageChores()) {
                return self::readOnly();
            }
            [$day, $start] = array_pad(explode('|', $slotKey, 2), 2, '');
            $ids = ChorePlan::where(['day_of_week' => $day, 'slot_start' => $start])->pluck('id');
            Capsule::connection()->transaction(function () use ($ids) {
                ChoreDone::whereIn('plan_id', $ids)->delete();
                ChorePlan::whereIn('id', $ids)->delete();
            });
            static::logActivity("Cleared the {$day} " . self::label($start) . ' chore slot (' . count($ids) . ' chores)', 'Chores');

            return ['success' => true, 'messages' => [count($ids) ? 'Slot cleared.' : 'That slot was already empty.']] + self::state();
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not clear the slot: ' . $e->getMessage()]];
        }
    }

    // ============================================================
    // Library (Chores Manager)
    // ============================================================

    public function saveChore(array $data): array
    {
        try {
            if (!AuthService::canManageChores()) {
                return self::readOnly();
            }
            $id = (int) ($data['id'] ?? 0);
            $title = trim((string) ($data['title'] ?? ''));
            $area = (string) ($data['area'] ?? 'general');
            $minutes = (int) ($data['minutes'] ?? 0);
            $best = (string) ($data['best_time'] ?? 'any');
            $perChild = filter_var($data['per_child'] ?? false, FILTER_VALIDATE_BOOLEAN);
            $detail = trim((string) ($data['detail'] ?? ''));

            $errors = [];
            if ($title === '') {
                $errors[] = 'Give the chore a name.';
            } elseif (mb_strlen($title) > self::MAX_TITLE) {
                $errors[] = 'The name must be ' . self::MAX_TITLE . ' characters or fewer.';
            } elseif (ChoreLibraryItem::whereRaw('LOWER(title) = ?', [mb_strtolower($title)])->where('id', '<>', $id)->exists()) {
                $errors[] = "“{$title}” is already in the library.";
            }
            if (!isset(ChoreLibraryItem::AREAS[$area])) {
                $errors[] = 'Choose where the chore is done.';
            }
            if ($minutes < 1 || $minutes > self::MAX_MINUTES) {
                $errors[] = 'Minutes must be between 1 and ' . self::MAX_MINUTES . '.';
            }
            if (!in_array($best, ChoreLibraryItem::TIMES, true)) {
                $errors[] = 'Choose the best time of day.';
            }
            if (mb_strlen($detail) > 1000) {
                $errors[] = 'Notes must be 1,000 characters or fewer.';
            }
            if ($errors) {
                return ['success' => false, 'messages' => $errors];
            }

            $fields = ['title' => $title, 'area' => $area, 'minutes' => $minutes, 'best_time' => $best, 'per_child' => $perChild, 'detail' => $detail !== '' ? $detail : null];
            if ($id) {
                $chore = ChoreLibraryItem::find($id);
                if (!$chore) {
                    return ['success' => false, 'messages' => ['Chore not found.']];
                }
                $chore->fill($fields)->save();
                static::logActivity("Updated chore: {$title}", 'Chores', $chore->id);
            } else {
                $chore = ChoreLibraryItem::create($fields + ['active' => true]);
                static::logActivity("Added chore to the library: {$title}", 'Chores', $chore->id);
            }

            return ['success' => true, 'messages' => [$id ? 'Chore saved.' : 'Chore added to the library.'], 'chore' => self::presentChore($chore->refresh())];
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not save the chore: ' . $e->getMessage()]];
        }
    }

    /** Delete a chore from the library — and from everyone's plan. */
    public function deleteChore(int $id): array
    {
        try {
            if (!AuthService::canManageChores()) {
                return self::readOnly();
            }
            $chore = ChoreLibraryItem::find($id);
            if (!$chore) {
                return ['success' => false, 'messages' => ['Chore not found.']];
            }
            $title = (string) $chore->title;
            Capsule::connection()->transaction(function () use ($chore) {
                $ids = ChorePlan::where('chore_id', $chore->id)->pluck('id');
                ChoreDone::whereIn('plan_id', $ids)->delete();
                ChorePlan::whereIn('id', $ids)->delete();
                $chore->delete();
            });
            static::logActivity("Deleted chore from the library: {$title}", 'Chores', $id);

            return ['success' => true, 'messages' => ["“{$title}” deleted."]] + self::state();
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not delete the chore: ' . $e->getMessage()]];
        }
    }

    // ============================================================
    // Children (Chores Manager)
    // ============================================================

    public function saveChild(array $data): array
    {
        try {
            if (!AuthService::canManageChores()) {
                return self::readOnly();
            }
            $id = (int) ($data['id'] ?? 0);
            $first = trim((string) ($data['first_name'] ?? ''));
            $last = trim((string) ($data['last_name'] ?? ''));
            $color = (string) ($data['color'] ?? 'orange');
            $userId = (int) ($data['user_id'] ?? 0) ?: null;

            $errors = [];
            if ($first === '') {
                $errors[] = 'Enter a first name.';
            }
            if (mb_strlen($first) > 100 || mb_strlen($last) > 100) {
                $errors[] = 'Names must be 100 characters or fewer.';
            }
            if (!in_array($color, ChoreChild::COLORS, true)) {
                $errors[] = 'Pick a colour.';
            }
            if ($userId && !User::find($userId)) {
                $errors[] = 'That account no longer exists.';
            }
            if ($errors) {
                return ['success' => false, 'messages' => $errors];
            }

            $fields = ['first_name' => $first, 'last_name' => $last, 'color' => $color, 'user_id' => $userId];
            if ($id) {
                $child = ChoreChild::find($id);
                if (!$child) {
                    return ['success' => false, 'messages' => ['Not found.']];
                }
                $child->fill($fields)->save();
                static::logActivity("Updated chores helper: {$first} {$last}", 'Chores', $child->id);
            } else {
                $child = ChoreChild::create($fields + ['active' => true, 'sort_order' => (int) ChoreChild::max('sort_order') + 10]);
                static::logActivity("Added {$first} {$last} to the chores", 'Chores', $child->id);
            }

            return ['success' => true, 'messages' => [$id ? 'Saved.' : "{$first} added."]] + self::state();
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not save: ' . $e->getMessage()]];
        }
    }

    /** Take a child off the chores (kept for history; their planned chores are removed). */
    public function removeChild(int $id): array
    {
        try {
            if (!AuthService::canManageChores()) {
                return self::readOnly();
            }
            $child = ChoreChild::find($id);
            if (!$child) {
                return ['success' => false, 'messages' => ['Not found.']];
            }
            Capsule::connection()->transaction(function () use ($child) {
                $ids = ChorePlan::where('child_id', $child->id)->pluck('id');
                ChoreDone::whereIn('plan_id', $ids)->delete();
                ChorePlan::whereIn('id', $ids)->delete();
                $child->active = false;
                $child->save();
            });
            static::logActivity("Took {$child->first_name} {$child->last_name} off the chores", 'Chores', $id);

            return ['success' => true, 'messages' => ["{$child->first_name} is off the chores."]] + self::state();
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not remove: ' . $e->getMessage()]];
        }
    }

    // ============================================================
    // Helpers
    // ============================================================

    private static function readOnly(): array
    {
        return ['success' => false, 'messages' => ["You can view the chores and tick them off, but you can't change the plan."]];
    }

    private static function slot(string $key): ?array
    {
        foreach (self::slots() as $s) {
            if ($s['key'] === $key) {
                return $s;
            }
        }
        return null;
    }

    /** [Monday, Sunday] of the current week, as Y-m-d. */
    private static function week(): array
    {
        $monday = strtotime('monday this week');
        return [date('Y-m-d', $monday), date('Y-m-d', strtotime('+6 days', $monday))];
    }

    private static function toMin(string $hhmm): int
    {
        [$h, $m] = array_map('intval', explode(':', $hhmm));
        return $h * 60 + $m;
    }

    private static function period(string $hhmm): string
    {
        $m = self::toMin($hhmm);
        return $m < 12 * 60 ? 'morning' : ($m < 17 * 60 ? 'afternoon' : 'evening');
    }

    private static function label(string $hhmm): string
    {
        return date('g:i A', strtotime($hhmm));
    }
}
