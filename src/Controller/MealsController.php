<?php
// /src/Controller/MealsController.php

declare(strict_types=1);

namespace Src\Controller;

use App\Models\Meal;
use App\Models\MealPlan;
use App\Traits\RecentActivityLogger;
use App\Utils\IdEncoder;
use Illuminate\Database\Capsule\Manager as Capsule;
use Src\Service\AuthService;

/**
 * Meals — weekly meal plans (ported from the legacy CatScript Meals app, on
 * the same legacy `meal_plans` / `meals` tables). Each plan is a 7-day grid
 * of breakfast / lunch / dinner / snacks. One meal per plan / day / type.
 *
 * Sharing (unlike legacy, where plans were private):
 *  - everyone with Meals access can VIEW every plan (and export its PDF);
 *  - only "meal planners" (AuthService::canPlanMeals() — admins, plus anyone
 *    granted the Meal Planner capability) can create plans or duplicate one;
 *  - a plan and its meals can only be EDITED by its owner, and only while
 *    they're still a meal planner.
 *
 * The page loads the owner's plans plus the active plan's meals once; the
 * grid, day totals and weekly calorie figures are computed in the browser,
 * and every write returns what changed so the client can patch its copy.
 *
 * Every change is written to recent_activities (entity_type "Meals").
 */
class MealsController
{
    use RecentActivityLogger;

    private const MAX_TITLE = 255;
    private const MAX_PLAN_DESCRIPTION = 1000;
    private const MAX_MEAL = 2000;
    private const MAX_CALORIES = 20000;
    private const MAX_PLANS = 100;

    // ============================================================
    // Reads
    // ============================================================

    /**
     * Every plan (they're shared), the viewer's own first, then everyone
     * else's by owner; oldest first within each (the legacy order).
     * @return array<int, array>
     */
    public static function plans(int $userId): array
    {
        return MealPlan::with('owner')
            ->withCount('meals')
            ->orderByRaw('CASE WHEN orig_user_id = ? THEN 0 ELSE 1 END', [$userId])
            ->orderBy('orig_user_id')
            ->orderBy('meal_plan_id')
            ->get()
            ->map(fn(MealPlan $p) => self::presentPlan($p, $userId))
            ->all();
    }

    /**
     * The meals in a plan.
     * @return array<int, array>
     */
    public static function meals(int $planId): array
    {
        return Meal::where('meal_plan_id', $planId)
            ->whereIn('day_of_week', Meal::DAYS)
            ->whereIn('meal_type', array_keys(Meal::TYPES))
            ->orderBy('meal_id')
            ->get()
            ->unique(fn(Meal $m) => $m->day_of_week . '|' . $m->meal_type) // legacy never enforced this
            ->map(fn(Meal $m) => self::presentMeal($m))
            ->values()
            ->all();
    }

    /**
     * Everything the page needs: all plans, the active one (the requested
     * plan, else the viewer's first, else anyone's first) and its meals, and
     * whether the viewer may create plans.
     */
    public static function state(int $userId, string $requestedPlan = ''): array
    {
        $plans = self::plans($userId);
        $active = null;
        foreach ($plans as $p) {
            if ($p['encoded_id'] === $requestedPlan) {
                $active = $p;
            }
        }
        $active ??= $plans[0] ?? null; // plans() lists the viewer's own first
        $model = $active ? self::visiblePlan($active['encoded_id']) : null;

        return [
            'plans'    => $plans,
            'plan'     => $active,
            'meals'    => $model ? self::meals((int) $model->meal_plan_id) : [],
            'can_plan' => AuthService::canPlanMeals(),
        ];
    }

    /**
     * Resolve an encoded plan id to any plan (plans are visible to everyone
     * with Meals access), or null.
     */
    public static function visiblePlan(string $encodedId): ?MealPlan
    {
        $id = IdEncoder::decode($encodedId);
        return $id ? MealPlan::find($id) : null;
    }

    /**
     * Resolve an encoded plan id to a plan the user may change: their own,
     * while they're a meal planner. Null otherwise.
     */
    public static function editablePlan(string $encodedId, int $userId): ?MealPlan
    {
        $plan = self::visiblePlan($encodedId);
        return $plan && self::canEdit($plan, $userId) ? $plan : null;
    }

    public static function canEdit(MealPlan $plan, int $userId): bool
    {
        return (int) $plan->orig_user_id === $userId && AuthService::canPlanMeals();
    }

    /** Why a plan can't be changed — for the refusal message. */
    private static function notEditable(string $encodedId): array
    {
        $plan = self::visiblePlan($encodedId);
        if (!$plan) {
            return ['success' => false, 'messages' => ['Meal plan not found.']];
        }
        return ['success' => false, 'messages' => [AuthService::canPlanMeals()
            ? 'Only the person who made this plan can change it.'
            : "You can view meal plans, but you can't change them."]];
    }

    /**
     * Dishes the owner has planned before, for the form's autocomplete —
     * newest first, with the calories last used, preferring the same meal type.
     * @return array<int, array{description: string, calories: ?int}>
     */
    public static function suggestDishes(int $userId, string $query, string $type = ''): array
    {
        if (mb_strlen($query) < 2) {
            return [];
        }

        $rows = Meal::ownedBy($userId)
            ->where('meal_description', 'LIKE', "%{$query}%")
            ->orderByDesc('updated_at')
            ->limit(200)
            ->get(['meal_description', 'calories', 'meal_type']);

        if (isset(Meal::TYPES[$type])) {
            $rows = $rows->sortBy(fn(Meal $m) => $m->meal_type === $type ? 0 : 1, SORT_REGULAR, false);
        }

        $seen = [];
        $out = [];
        foreach ($rows as $row) {
            $description = trim((string) $row->meal_description);
            $key = mb_strtolower($description);
            if ($description === '' || isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $out[] = ['description' => $description, 'calories' => $row->calories !== null ? (int) $row->calories : null];
            if (count($out) === 8) {
                break;
            }
        }
        return $out;
    }

    public static function presentPlan(MealPlan $p, int $userId): array
    {
        $owner = trim((string) ($p->owner->full_name ?? '')) ?: 'Unknown';

        return [
            'encoded_id'  => IdEncoder::encode((int) $p->meal_plan_id),
            'title'       => (string) $p->plan_title,
            'description' => (string) ($p->description ?? ''),
            'meal_count'  => (int) ($p->meals_count ?? $p->meals()->count()),
            'owner'       => $owner,
            'owner_first' => explode(' ', $owner)[0],
            'is_mine'     => (int) $p->orig_user_id === $userId,
            'can_edit'    => self::canEdit($p, $userId),
        ];
    }

    public static function presentMeal(Meal $m): array
    {
        return [
            'encoded_id'  => IdEncoder::encode((int) $m->meal_id),
            'day'         => (string) $m->day_of_week,
            'type'        => (string) $m->meal_type,
            'description' => (string) ($m->meal_description ?? ''),
            'calories'    => $m->calories !== null ? (int) $m->calories : null,
        ];
    }

    // ============================================================
    // Plans
    // ============================================================

    /**
     * Create (no encoded_id) or rename / re-describe a plan.
     */
    public function savePlan(array $data, int $userId): array
    {
        try {
            $encodedId = trim((string) ($data['encoded_id'] ?? ''));
            $title = trim((string) ($data['title'] ?? ''));
            $description = trim((string) ($data['description'] ?? ''));

            $errors = [];
            if ($title === '') {
                $errors[] = 'Give the plan a name.';
            } elseif (mb_strlen($title) > self::MAX_TITLE) {
                $errors[] = 'The name must be ' . self::MAX_TITLE . ' characters or fewer.';
            }
            if (mb_strlen($description) > self::MAX_PLAN_DESCRIPTION) {
                $errors[] = 'The description must be ' . number_format(self::MAX_PLAN_DESCRIPTION) . ' characters or fewer.';
            }
            if ($errors) {
                return ['success' => false, 'messages' => $errors];
            }

            if ($encodedId === '') {
                if (!AuthService::canPlanMeals()) {
                    return ['success' => false, 'messages' => ["You can view meal plans, but you can't create them."]];
                }
                if (MealPlan::ownedBy($userId)->count() >= self::MAX_PLANS) {
                    return ['success' => false, 'messages' => ['You have reached the limit of ' . self::MAX_PLANS . ' meal plans.']];
                }
                $plan = new MealPlan(['plan_title' => $title, 'description' => $description !== '' ? $description : null]);
                $plan->orig_user_id = $userId;
                $plan->status_id = MealPlan::STATUS_DEFAULT;
                $plan->save();
                static::logActivity("Created meal plan: {$title}", 'Meals', $plan->meal_plan_id);
                $message = 'Meal plan created.';
            } else {
                $plan = self::editablePlan($encodedId, $userId);
                if (!$plan) {
                    return self::notEditable($encodedId);
                }
                $old = (string) $plan->plan_title;
                $plan->plan_title = $title;
                $plan->description = $description !== '' ? $description : null;
                $plan->save();
                static::logActivity($old !== $title ? "Renamed meal plan '{$old}' to '{$title}'" : "Updated meal plan: {$title}", 'Meals', $plan->meal_plan_id);
                $message = 'Meal plan saved.';
            }

            return ['success' => true, 'messages' => [$message], 'plan' => self::presentPlan($plan->load('owner'), $userId)];
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not save the plan: ' . $e->getMessage()]];
        }
    }

    /**
     * Copy any plan (yours or someone else's) and all its meals into a new
     * plan of your own. Meal planners only.
     */
    public function duplicatePlan(string $encodedId, int $userId): array
    {
        try {
            $source = self::visiblePlan($encodedId);
            if (!$source) {
                return ['success' => false, 'messages' => ['Meal plan not found.']];
            }
            if (!AuthService::canPlanMeals()) {
                return ['success' => false, 'messages' => ["You can view meal plans, but you can't create them."]];
            }
            if (MealPlan::ownedBy($userId)->count() >= self::MAX_PLANS) {
                return ['success' => false, 'messages' => ['You have reached the limit of ' . self::MAX_PLANS . ' meal plans.']];
            }

            $copy = Capsule::connection()->transaction(function () use ($source, $userId) {
                $title = mb_substr($source->plan_title . ' (copy)', 0, self::MAX_TITLE);
                $plan = new MealPlan(['plan_title' => $title, 'description' => $source->description]);
                $plan->orig_user_id = $userId;
                $plan->status_id = MealPlan::STATUS_DEFAULT;
                $plan->save();

                foreach (self::meals((int) $source->meal_plan_id) as $m) {
                    $meal = new Meal([
                        'meal_plan_id'     => $plan->meal_plan_id,
                        'day_of_week'      => $m['day'],
                        'meal_type'        => $m['type'],
                        'meal_description' => $m['description'],
                        'calories'         => $m['calories'],
                    ]);
                    $meal->orig_user_id = $userId;
                    $meal->status_id = Meal::STATUS_DEFAULT;
                    $meal->save();
                }
                return $plan;
            });

            static::logActivity("Duplicated meal plan '{$source->plan_title}' as '{$copy->plan_title}'", 'Meals', $copy->meal_plan_id);

            return ['success' => true, 'messages' => ['Plan duplicated.'], 'plan' => self::presentPlan($copy->load('owner'), $userId)];
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not duplicate the plan: ' . $e->getMessage()]];
        }
    }

    /**
     * Delete a plan and its meals.
     */
    public function deletePlan(string $encodedId, int $userId): array
    {
        try {
            $plan = self::editablePlan($encodedId, $userId);
            if (!$plan) {
                return self::notEditable($encodedId);
            }

            $title = (string) $plan->plan_title;
            $id = (int) $plan->meal_plan_id;
            Capsule::connection()->transaction(function () use ($plan, $id) {
                Meal::where('meal_plan_id', $id)->delete();
                $plan->delete();
            });
            static::logActivity("Deleted meal plan: {$title}", 'Meals', $id);

            return ['success' => true, 'messages' => ["“{$title}” deleted."]];
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not delete the plan: ' . $e->getMessage()]];
        }
    }

    /**
     * Remove every meal from a plan (the plan itself stays).
     */
    public function clearWeek(string $encodedId, int $userId): array
    {
        try {
            $plan = self::editablePlan($encodedId, $userId);
            if (!$plan) {
                return self::notEditable($encodedId);
            }
            $n = Meal::where('meal_plan_id', $plan->meal_plan_id)->delete();
            static::logActivity("Cleared the week in meal plan: {$plan->plan_title}", 'Meals', $plan->meal_plan_id);

            return ['success' => true, 'messages' => [$n ? 'Week cleared.' : 'The week was already empty.']];
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not clear the week: ' . $e->getMessage()]];
        }
    }

    // ============================================================
    // Meals
    // ============================================================

    /**
     * Create or update a meal. Saving into a slot that already has a meal
     * (without an encoded_id) updates that meal, so a slot never holds two.
     * Moving a meal onto an occupied slot is refused.
     */
    public function saveMeal(array $data, int $userId): array
    {
        try {
            $planId = (string) ($data['plan_id'] ?? '');
            $plan = self::editablePlan($planId, $userId);
            if (!$plan) {
                return self::notEditable($planId);
            }

            $encodedId = trim((string) ($data['encoded_id'] ?? ''));
            $day = (string) ($data['day'] ?? '');
            $type = (string) ($data['type'] ?? '');
            $description = trim((string) ($data['description'] ?? ''));
            $caloriesRaw = trim(str_replace([',', ' '], '', (string) ($data['calories'] ?? '')));

            $errors = [];
            if (!in_array($day, Meal::DAYS, true)) {
                $errors[] = 'Choose a day.';
            }
            if (!isset(Meal::TYPES[$type])) {
                $errors[] = 'Choose breakfast, lunch, dinner or snacks.';
            }
            if ($description === '') {
                $errors[] = 'Describe the meal.';
            } elseif (mb_strlen($description) > self::MAX_MEAL) {
                $errors[] = 'The description must be ' . number_format(self::MAX_MEAL) . ' characters or fewer.';
            }
            if ($caloriesRaw !== '' && (!ctype_digit($caloriesRaw) || (int) $caloriesRaw > self::MAX_CALORIES)) {
                $errors[] = 'Calories must be a whole number up to ' . number_format(self::MAX_CALORIES) . ', or left blank.';
            }
            if ($errors) {
                return ['success' => false, 'messages' => $errors];
            }

            $occupant = Meal::where('meal_plan_id', $plan->meal_plan_id)
                ->where('day_of_week', $day)->where('meal_type', $type)->orderBy('meal_id')->first();

            if ($encodedId !== '') {
                $meal = Meal::where('meal_plan_id', $plan->meal_plan_id)->find(IdEncoder::decode($encodedId) ?? 0);
                if (!$meal) {
                    return ['success' => false, 'messages' => ['Meal not found.']];
                }
                if ($occupant && (int) $occupant->meal_id !== (int) $meal->meal_id) {
                    return ['success' => false, 'messages' => ["{$day} " . strtolower(Meal::TYPES[$type]) . ' already has a meal. Remove it first, or edit that one.']];
                }
            } else {
                $meal = $occupant ?? new Meal();
            }

            $isNew = !$meal->exists;
            $meal->fill([
                'meal_plan_id'     => $plan->meal_plan_id,
                'day_of_week'      => $day,
                'meal_type'        => $type,
                'meal_description' => $description,
                'calories'         => $caloriesRaw !== '' ? (int) $caloriesRaw : null,
            ]);
            if ($isNew) {
                $meal->orig_user_id = $userId;
                $meal->status_id = Meal::STATUS_DEFAULT;
            }
            $meal->save();

            $slot = "{$day} " . strtolower(Meal::TYPES[$type]);
            static::logActivity(($isNew ? 'Planned' : 'Updated') . " {$slot}: {$description}", 'Meals', $meal->meal_id);

            return ['success' => true, 'messages' => [$isNew ? 'Meal added.' : 'Meal updated.'], 'meal' => self::presentMeal($meal)];
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not save the meal: ' . $e->getMessage()]];
        }
    }

    public function deleteMeal(string $encodedId, int $userId): array
    {
        try {
            $meal = Meal::with('plan')->find(IdEncoder::decode($encodedId) ?? 0);
            if (!$meal || !$meal->plan) {
                return ['success' => false, 'messages' => ['Meal not found.']];
            }
            if (!self::canEdit($meal->plan, $userId)) {
                return self::notEditable(IdEncoder::encode((int) $meal->meal_plan_id));
            }
            $summary = "{$meal->day_of_week} " . strtolower(Meal::TYPES[$meal->meal_type] ?? (string) $meal->meal_type) . ": {$meal->meal_description}";
            $id = (int) $meal->meal_id;
            $meal->delete();
            static::logActivity("Removed {$summary}", 'Meals', $id);

            return ['success' => true, 'messages' => ['Meal removed.']];
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not remove the meal: ' . $e->getMessage()]];
        }
    }

    // ============================================================
    // Export
    // ============================================================

    /**
     * Grid for the printable / PDF view: [day][type] => meal|null, plus
     * per-day calorie totals.
     * @return array{grid: array, dayTotals: array<string, int>, weekTotal: int}
     */
    public static function grid(int $planId): array
    {
        $grid = array_fill_keys(Meal::DAYS, array_fill_keys(array_keys(Meal::TYPES), null));
        $dayTotals = array_fill_keys(Meal::DAYS, 0);
        foreach (self::meals($planId) as $m) {
            $grid[$m['day']][$m['type']] = $m;
            $dayTotals[$m['day']] += (int) ($m['calories'] ?? 0);
        }
        return ['grid' => $grid, 'dayTotals' => $dayTotals, 'weekTotal' => array_sum($dayTotals)];
    }
}
