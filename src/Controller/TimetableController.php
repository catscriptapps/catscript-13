<?php
// /src/Controller/TimetableController.php

declare(strict_types=1);

namespace Src\Controller;

use App\Models\TimetableActivity;
use App\Models\TimetableCategory;
use App\Traits\RecentActivityLogger;
use App\Utils\IdEncoder;
use Illuminate\Database\Capsule\Manager as Capsule;
use Src\Service\AuthService;

/**
 * Timetable — the family's weekly routine (ported from the legacy CatScript
 * Timetable, on the same legacy `timetable_activities` table, which holds
 * live production data).
 *
 * One shared timetable, as in legacy (legacy scoped by a user id it could
 * never read, so everything lived under user #1 and everyone saw it):
 *  - everyone with Timetable access can view it;
 *  - admins, and anyone granted the Timetable Editor capability, can change
 *    it (AuthService::canEditTimetable()).
 *
 * Legacy compatibility — the production legacy app keeps reading this table:
 *  - every save still writes a valid legacy `category` ENUM value (the
 *    chosen category's legacy_category), alongside the new category_id;
 *  - rows the legacy app wrote (category_id NULL) are shown in the category
 *    whose slug equals their ENUM value, and are never rewritten just by
 *    being viewed;
 *  - only status_id = 1 rows are shown, as in legacy.
 *
 * Every change is written to recent_activities (entity_type "Timetable").
 */
class TimetableController
{
    use RecentActivityLogger;

    private const MAX_NAME = 150; // activity_name is varchar(150)
    private const MAX_CATEGORY_NAME = 60;
    private const MAX_CATEGORIES = 60;
    private const MAX_PER_DAY = 60;

    // ============================================================
    // Reads
    // ============================================================

    /**
     * Everything the page needs: categories (with usage counts), every
     * activity, and whether the viewer may edit.
     */
    public static function state(): array
    {
        $categories = self::categories();
        $bySlug = [];
        foreach ($categories as $c) {
            if ($c['slug']) {
                $bySlug[$c['slug']] = $c['id'];
            }
        }
        $ids = array_column($categories, 'id');

        $activities = TimetableActivity::active()
            ->whereIn('day_of_week', TimetableActivity::DAYS)
            ->orderBy('start_time')
            ->orderBy('activity_id')
            ->get()
            ->map(fn(TimetableActivity $a) => self::present($a, $ids, $bySlug))
            ->all();

        $counts = array_count_values(array_column($activities, 'category_id'));
        foreach ($categories as &$c) {
            $c['count'] = $counts[$c['id']] ?? 0;
        }
        unset($c);

        return [
            'categories' => $categories,
            'activities' => $activities,
            'can_edit'   => AuthService::canEditTimetable(),
        ];
    }

    /**
     * @return array<int, array{id: int, slug: ?string, name: string, color: string, locked: bool}>
     */
    public static function categories(): array
    {
        return TimetableCategory::orderBy('sort_order')->orderBy('category_id')->get()
            ->map(fn(TimetableCategory $c) => [
                'id'     => (int) $c->category_id,
                'slug'   => $c->slug,
                'name'   => (string) $c->name,
                'color'  => in_array($c->color, TimetableCategory::COLORS, true) ? $c->color : 'gray',
                // The five original categories back legacy rows (via slug) — rename / recolour only
                'locked' => in_array($c->slug, TimetableActivity::LEGACY_CATEGORIES, true),
            ])->all();
    }

    /**
     * @param int[] $categoryIds    existing category ids
     * @param array<string,int> $bySlug  slug => category id
     */
    public static function present(TimetableActivity $a, array $categoryIds, array $bySlug): array
    {
        $categoryId = in_array((int) $a->category_id, $categoryIds, true)
            ? (int) $a->category_id
            : ($bySlug[(string) $a->category] ?? $bySlug['routine'] ?? ($categoryIds[0] ?? 0));

        return [
            'encoded_id'  => IdEncoder::encode((int) $a->activity_id),
            'day'         => (string) $a->day_of_week,
            'start'       => substr((string) $a->start_time, 0, 5),
            'end'         => substr((string) $a->end_time, 0, 5),
            'name'        => (string) $a->activity_name,
            'category_id' => $categoryId,
        ];
    }

    private static function presentOne(TimetableActivity $a): array
    {
        $categories = self::categories();
        $bySlug = [];
        foreach ($categories as $c) {
            if ($c['slug']) {
                $bySlug[$c['slug']] = $c['id'];
            }
        }
        return self::present($a, array_column($categories, 'id'), $bySlug);
    }

    // ============================================================
    // Activities
    // ============================================================

    /**
     * Create (on one or more days) or update an activity.
     * New: {days[], start, end, name, category_id}; edit: {encoded_id, day, …}.
     */
    public function saveActivity(array $data, int $userId): array
    {
        try {
            if (!AuthService::canEditTimetable()) {
                return self::readOnly();
            }

            $encodedId = trim((string) ($data['encoded_id'] ?? ''));
            $isNew = $encodedId === '';
            $name = trim((string) ($data['name'] ?? ''));
            $start = self::time($data['start'] ?? '');
            $end = self::time($data['end'] ?? '');
            $category = TimetableCategory::find((int) ($data['category_id'] ?? 0));
            $days = $isNew
                ? array_values(array_unique(array_filter((array) ($data['days'] ?? []), fn($d) => in_array($d, TimetableActivity::DAYS, true))))
                : (in_array($data['day'] ?? '', TimetableActivity::DAYS, true) ? [$data['day']] : []);

            $errors = [];
            if ($name === '') {
                $errors[] = 'Give the activity a name.';
            } elseif (mb_strlen($name) > self::MAX_NAME) {
                $errors[] = 'The name must be ' . self::MAX_NAME . ' characters or fewer.';
            }
            if (!$days) {
                $errors[] = $isNew ? 'Pick at least one day.' : 'Choose a day.';
            }
            if (!$start || !$end) {
                $errors[] = 'Choose a start and end time.';
            } elseif ($end <= $start) {
                $errors[] = 'The end time must be after the start time.';
            }
            if (!$category) {
                $errors[] = 'Choose a category.';
            }
            if ($errors) {
                return ['success' => false, 'messages' => $errors];
            }

            $fields = [
                'start_time'    => $start . ':00',
                'end_time'      => $end . ':00',
                'activity_name' => $name,
                'category_id'   => (int) $category->category_id,
                'category'      => self::legacyValue($category),
            ];

            if (!$isNew) {
                $activity = TimetableActivity::active()->find(IdEncoder::decode($encodedId) ?? 0);
                if (!$activity) {
                    return ['success' => false, 'messages' => ['Activity not found.']];
                }
                $activity->fill($fields + ['day_of_week' => $days[0]])->save();
                static::logActivity("Updated timetable activity: {$name} ({$days[0]} " . self::label($start) . '–' . self::label($end) . ')', 'Timetable', $activity->activity_id);

                return ['success' => true, 'messages' => ['Activity updated.'], 'activities' => [self::presentOne($activity->refresh())]];
            }

            foreach ($days as $day) {
                if (TimetableActivity::active()->where('day_of_week', $day)->count() >= self::MAX_PER_DAY) {
                    return ['success' => false, 'messages' => ["{$day} already has " . self::MAX_PER_DAY . ' activities — that\'s the limit.']];
                }
            }

            $created = Capsule::connection()->transaction(function () use ($days, $fields, $userId) {
                $rows = [];
                foreach ($days as $day) {
                    $a = new TimetableActivity($fields + ['day_of_week' => $day]);
                    $a->orig_user_id = $userId;
                    $a->status_id = TimetableActivity::STATUS_ACTIVE;
                    $a->save();
                    $rows[] = $a;
                }
                return $rows;
            });

            $when = self::label($start) . '–' . self::label($end);
            static::logActivity("Added timetable activity: {$name} (" . self::dayList($days) . ", {$when})", 'Timetable', count($created) === 1 ? $created[0]->activity_id : null);

            return [
                'success'    => true,
                'messages'   => [count($created) === 1 ? 'Activity added.' : 'Added to ' . count($created) . ' days.'],
                'activities' => array_map(fn($a) => self::presentOne($a->refresh()), $created),
            ];
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not save the activity: ' . $e->getMessage()]];
        }
    }

    public function deleteActivity(string $encodedId): array
    {
        try {
            if (!AuthService::canEditTimetable()) {
                return self::readOnly();
            }
            $activity = TimetableActivity::active()->find(IdEncoder::decode($encodedId) ?? 0);
            if (!$activity) {
                return ['success' => false, 'messages' => ['Activity not found.']];
            }
            $summary = "{$activity->activity_name} ({$activity->day_of_week} " . self::label(substr((string) $activity->start_time, 0, 5)) . ')';
            $id = (int) $activity->activity_id;
            $activity->delete();
            static::logActivity("Removed timetable activity: {$summary}", 'Timetable', $id);

            return ['success' => true, 'messages' => ['Activity removed.']];
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not remove the activity: ' . $e->getMessage()]];
        }
    }

    /**
     * Copy one day's activities onto other days — either added to what's
     * already there, or replacing it. (Legacy always wiped the target.)
     * @param string[] $targets
     */
    public function copyDay(string $source, array $targets, bool $replace, int $userId): array
    {
        try {
            if (!AuthService::canEditTimetable()) {
                return self::readOnly();
            }
            $targets = array_values(array_unique(array_filter($targets, fn($d) => in_array($d, TimetableActivity::DAYS, true) && $d !== $source)));
            if (!in_array($source, TimetableActivity::DAYS, true) || !$targets) {
                return ['success' => false, 'messages' => ['Pick the day to copy from and at least one day to copy to.']];
            }

            $activities = TimetableActivity::active()->where('day_of_week', $source)->orderBy('start_time')->get();
            if ($activities->isEmpty()) {
                return ['success' => false, 'messages' => ["{$source} has nothing to copy yet."]];
            }

            Capsule::connection()->transaction(function () use ($activities, $targets, $replace, $userId) {
                foreach ($targets as $day) {
                    if ($replace) {
                        TimetableActivity::active()->where('day_of_week', $day)->delete();
                    }
                    foreach ($activities as $a) {
                        $copy = $a->replicate(['created_at', 'updated_at']);
                        $copy->day_of_week = $day;
                        $copy->orig_user_id = $userId;
                        $copy->save();
                    }
                }
            });

            static::logActivity("Copied {$source}'s timetable to " . self::dayList($targets) . ($replace ? ' (replaced)' : ''), 'Timetable');

            return ['success' => true, 'messages' => ["Copied {$source} to " . self::dayList($targets) . '.']] + self::state();
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not copy: ' . $e->getMessage()]];
        }
    }

    /**
     * Remove every activity from one day, or from the whole week ($day = 'all').
     */
    public function clear(string $day): array
    {
        try {
            if (!AuthService::canEditTimetable()) {
                return self::readOnly();
            }
            $all = $day === 'all';
            if (!$all && !in_array($day, TimetableActivity::DAYS, true)) {
                return ['success' => false, 'messages' => ['Choose a day.']];
            }
            $query = TimetableActivity::active();
            if (!$all) {
                $query->where('day_of_week', $day);
            }
            $n = $query->delete();
            static::logActivity($all ? "Cleared the whole timetable ({$n} activities)" : "Cleared {$day} on the timetable ({$n} activities)", 'Timetable');

            return ['success' => true, 'messages' => [$n ? ($all ? 'Timetable cleared.' : "{$day} cleared.") : 'Nothing to clear.']];
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not clear: ' . $e->getMessage()]];
        }
    }

    // ============================================================
    // Categories
    // ============================================================

    /**
     * Create (no id) or rename / recolour a category.
     */
    public function saveCategory(array $data, int $userId): array
    {
        try {
            if (!AuthService::canEditTimetable()) {
                return self::readOnly();
            }
            $id = (int) ($data['id'] ?? 0);
            $name = trim((string) ($data['name'] ?? ''));
            $color = (string) ($data['color'] ?? '');

            $errors = [];
            if ($name === '') {
                $errors[] = 'Give the category a name.';
            } elseif (mb_strlen($name) > self::MAX_CATEGORY_NAME) {
                $errors[] = 'Category names must be ' . self::MAX_CATEGORY_NAME . ' characters or fewer.';
            } elseif (TimetableCategory::whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->where('category_id', '<>', $id)->exists()) {
                $errors[] = "There's already a category called “{$name}”.";
            }
            if (!in_array($color, TimetableCategory::COLORS, true)) {
                $errors[] = 'Pick a colour.';
            }
            if ($errors) {
                return ['success' => false, 'messages' => $errors];
            }

            if ($id) {
                $category = TimetableCategory::find($id);
                if (!$category) {
                    return ['success' => false, 'messages' => ['Category not found.']];
                }
                $old = (string) $category->name;
                $category->fill(['name' => $name, 'color' => $color])->save();
                static::logActivity($old !== $name ? "Renamed timetable category '{$old}' to '{$name}'" : "Updated timetable category: {$name}", 'Timetable');
            } else {
                if (TimetableCategory::count() >= self::MAX_CATEGORIES) {
                    return ['success' => false, 'messages' => ['That\'s the limit of ' . self::MAX_CATEGORIES . ' categories.']];
                }
                $category = new TimetableCategory([
                    'name'            => $name,
                    'color'           => $color,
                    'legacy_category' => 'routine', // what the legacy app shows it as
                    'sort_order'      => (int) TimetableCategory::max('sort_order') + 10,
                    'created_by'      => $userId,
                ]);
                $category->save();
                static::logActivity("Added timetable category: {$name}", 'Timetable');
            }

            return ['success' => true, 'messages' => [$id ? 'Category saved.' : 'Category added.']] + self::state();
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not save the category: ' . $e->getMessage()]];
        }
    }

    /**
     * Delete a category. If activities use it, they move to $moveTo first.
     * The five original categories can't be deleted (legacy rows map to them).
     */
    public function deleteCategory(int $id, int $moveTo): array
    {
        try {
            if (!AuthService::canEditTimetable()) {
                return self::readOnly();
            }
            $category = TimetableCategory::find($id);
            if (!$category) {
                return ['success' => false, 'messages' => ['Category not found.']];
            }
            if (in_array($category->slug, TimetableActivity::LEGACY_CATEGORIES, true)) {
                return ['success' => false, 'messages' => ["“{$category->name}” is one of the original categories and can't be deleted — you can rename it or change its colour."]];
            }

            $used = TimetableActivity::where('category_id', $id)->count();
            $target = $used ? TimetableCategory::find($moveTo) : null;
            if ($used && (!$target || (int) $target->category_id === $id)) {
                return ['success' => false, 'messages' => ["{$used} " . ($used === 1 ? 'activity uses' : 'activities use') . ' this category — choose where to move ' . ($used === 1 ? 'it' : 'them') . '.']];
            }

            $name = (string) $category->name;
            Capsule::connection()->transaction(function () use ($category, $target, $id) {
                if ($target) {
                    TimetableActivity::where('category_id', $id)->update([
                        'category_id' => $target->category_id,
                        'category'    => self::legacyValue($target),
                    ]);
                }
                $category->delete();
            });
            static::logActivity("Deleted timetable category: {$name}" . ($target ? " (moved {$used} to {$target->name})" : ''), 'Timetable');

            return ['success' => true, 'messages' => ["“{$name}” deleted."]] + self::state();
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not delete the category: ' . $e->getMessage()]];
        }
    }

    // ============================================================
    // Helpers
    // ============================================================

    private static function readOnly(): array
    {
        return ['success' => false, 'messages' => ["You can view the timetable, but you can't change it."]];
    }

    /** The legacy ENUM value to store for a category (always valid). */
    private static function legacyValue(TimetableCategory $c): string
    {
        return in_array($c->legacy_category, TimetableActivity::LEGACY_CATEGORIES, true) ? $c->legacy_category : 'routine';
    }

    /** "HH:MM" from "H:MM", "HH:MM" or "HH:MM:SS", or null. */
    private static function time(mixed $value): ?string
    {
        return preg_match('/^([01]?\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/', trim((string) $value), $m)
            ? str_pad($m[1], 2, '0', STR_PAD_LEFT) . ':' . $m[2]
            : null;
    }

    private static function label(string $hhmm): string
    {
        return date('g:i A', strtotime($hhmm));
    }

    /** "Monday", "Monday & Tuesday", "Monday–Friday" (consecutive runs), … */
    private static function dayList(array $days): string
    {
        $idx = array_map(fn($d) => array_search($d, TimetableActivity::DAYS, true), $days);
        sort($idx);
        $runs = [];
        foreach ($idx as $i) {
            if ($runs && end($runs)[1] === $i - 1) {
                $runs[array_key_last($runs)][1] = $i;
            } else {
                $runs[] = [$i, $i];
            }
        }
        $parts = array_map(function ($r) {
            [$a, $b] = $r;
            $A = TimetableActivity::DAYS[$a];
            $B = TimetableActivity::DAYS[$b];
            return $a === $b ? $A : ($b - $a === 1 ? "{$A} & {$B}" : "{$A}–{$B}");
        }, $runs);
        return implode(', ', $parts);
    }
}
