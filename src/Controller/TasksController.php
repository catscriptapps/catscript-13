<?php
// /src/Controller/TasksController.php

declare(strict_types=1);

namespace Src\Controller;

use App\Models\Task;
use App\Traits\RecentActivityLogger;
use App\Utils\IdEncoder;
use Carbon\Carbon;
use Illuminate\Support\Collection;

/**
 * Tasks — a shared, dated to-do/reminder list (ported from the legacy
 * CatScript Tasks app, on the same legacy `tasks` table). Everyone with
 * Tasks access sees and manages the whole list; orig_user_id records who
 * created each task and is never overwritten on edit.
 *
 * Views:
 *  - current (default): the last 10 days plus everything upcoming (legacy)
 *  - today, week (today + next 6 days), past (before today, newest first)
 *  - search (?q=): title/details across every task, newest first
 *
 * Every create / update / delete is written to recent_activities
 * (entity_type "Tasks", entity_id = task_id).
 */
class TasksController
{
    use RecentActivityLogger;

    public const VIEWS = ['current', 'today', 'week', 'past'];
    private const RECENT_DAYS = 10;
    private const PAST_LIMIT = 150;
    private const SEARCH_LIMIT = 200;
    private const HERO_DAYS = 30;
    private const HERO_LIMIT = 150;

    /** Default time for new tasks: 12:00 AM, when most bills are due. */
    public const DEFAULT_TIME = '00:00';

    // ============================================================
    // Reads
    // ============================================================

    /**
     * @return array{tasks: Collection, grouping: string, capped: bool}
     */
    public static function listing(string $view, string $query = ''): array
    {
        $today = Carbon::today();
        $builder = Task::with('user');

        if ($query !== '') {
            $builder->where(function ($q) use ($query) {
                $q->where('task_title', 'LIKE', "%{$query}%")
                    ->orWhere('task_detail', 'LIKE', "%{$query}%");
            });
            $tasks = $builder->orderByDesc('due_date')->orderByDesc('task_time')->limit(self::SEARCH_LIMIT + 1)->get();
            return self::capped($tasks, self::SEARCH_LIMIT, 'month');
        }

        switch ($view) {
            case 'today':
                $builder->whereDate('due_date', $today);
                break;
            case 'week':
                $builder->whereBetween('due_date', [$today->toDateString(), $today->copy()->addDays(6)->toDateString()]);
                break;
            case 'past':
                $tasks = $builder->whereDate('due_date', '<', $today)
                    ->orderByDesc('due_date')->orderByDesc('task_time')
                    ->limit(self::PAST_LIMIT + 1)->get();
                return self::capped($tasks, self::PAST_LIMIT, 'month');
            default:
                $builder->whereDate('due_date', '>=', $today->copy()->subDays(self::RECENT_DAYS));
        }

        $tasks = $builder->orderBy('due_date')->orderBy('task_time')->get();
        return ['tasks' => $tasks, 'grouping' => 'timeline', 'capped' => false];
    }

    /**
     * Counts for the view tabs.
     * @return array<string, int>
     */
    public static function counts(): array
    {
        $today = Carbon::today();
        return [
            'current' => Task::whereDate('due_date', '>=', $today->copy()->subDays(self::RECENT_DAYS))->count(),
            'today'   => Task::whereDate('due_date', $today)->count(),
            'week'    => Task::whereBetween('due_date', [$today->toDateString(), $today->copy()->addDays(6)->toDateString()])->count(),
            'past'    => Task::whereDate('due_date', '<', $today)->count(),
        ];
    }

    /**
     * Today and the next HERO_DAYS days (soonest first), for the live hero:
     * what's due now, what's next, and what's coming up.
     * @return array<int, array> present()ed tasks
     */
    public static function upcoming(): array
    {
        $today = Carbon::today();
        return Task::with('user')
            ->whereBetween('due_date', [$today->toDateString(), $today->copy()->addDays(self::HERO_DAYS)->toDateString()])
            ->orderBy('due_date')->orderBy('task_time')
            ->limit(self::HERO_LIMIT)->get()
            ->map(fn(Task $t) => self::present($t))->values()->all();
    }

    /**
     * Distinct past titles for the add/edit form's autocomplete.
     * @return string[]
     */
    public static function suggestTitles(string $query): array
    {
        if (mb_strlen($query) < 2) {
            return [];
        }

        return Task::where('task_title', 'LIKE', "%{$query}%")
            ->select('task_title')
            ->groupBy('task_title')
            ->orderByRaw('MAX(due_date) DESC')
            ->limit(8)
            ->pluck('task_title')
            ->all();
    }

    /**
     * Groups tasks into labelled sections for the list view.
     * @return array<int, array{label: string, tone: string, tasks: Task[]}>
     */
    public static function groups(Collection $tasks, string $grouping): array
    {
        $groups = [];
        $today = Carbon::today();

        foreach ($tasks as $task) {
            $due = $task->due_date ? $task->due_date->copy()->startOfDay() : $today;

            if ($grouping === 'month') {
                $key = $due->format('Y-m');
                $groups[$key] ??= ['label' => $due->format('F Y'), 'tone' => 'neutral', 'tasks' => []];
            } else {
                $days = (int) $today->diffInDays($due, false);
                [$key, $label, $tone] = match (true) {
                    $days < 0   => ['past', 'Past ' . self::RECENT_DAYS . ' days', 'past'],
                    $days === 0 => ['today', 'Today', 'today'],
                    $days === 1 => ['tomorrow', 'Tomorrow', 'soon'],
                    $days <= 6  => ['week', 'This week', 'soon'],
                    default     => ['later', 'Later', 'neutral'],
                };
                $groups[$key] ??= ['label' => $label, 'tone' => $tone, 'tasks' => []];
            }

            $groups[$key]['tasks'][] = $task;
        }

        return array_values($groups);
    }

    /**
     * Server-rendered list HTML (groups + items, or an empty state).
     */
    public static function renderList(string $view, string $query = ''): array
    {
        $result = self::listing($view, $query);
        $groups = self::groups($result['tasks'], $result['grouping']);
        $capped = $result['capped'];
        $isSearch = $query !== '';

        ob_start();
        include __DIR__ . '/../../resources/views/components/tasks/list.php';
        $html = ob_get_clean() ?: '';

        return ['html' => $html, 'total' => $result['tasks']->count()];
    }

    /**
     * Display data for one task (used by the item view and the JS modals).
     */
    public static function present(Task $task): array
    {
        $today = Carbon::today();
        $due = $task->due_date ? $task->due_date->copy()->startOfDay() : null;
        $days = $due ? (int) $today->diffInDays($due, false) : null;

        $status = match (true) {
            $days === null => ['label' => '', 'tone' => 'neutral'],
            $days < 0      => ['label' => abs($days) === 1 ? 'Yesterday' : abs($days) . ' days ago', 'tone' => 'past'],
            $days === 0    => ['label' => 'Today', 'tone' => 'today'],
            $days === 1    => ['label' => 'Tomorrow', 'tone' => 'soon'],
            $days <= 6     => ['label' => 'In ' . $days . ' days', 'tone' => 'soon'],
            default        => ['label' => '', 'tone' => 'neutral'],
        };

        return [
            'encoded_id'     => IdEncoder::encode((int) $task->task_id),
            'title'          => (string) $task->task_title,
            'detail'         => (string) ($task->task_detail ?? ''),
            'due_date'       => $due?->format('Y-m-d') ?? '',
            'due_long'       => $due?->format('l, F j, Y') ?? 'No date',
            'month'          => $due?->format('M') ?? '',
            'day'            => $due?->format('j') ?? '',
            'time'           => $task->hasTime() ? substr((string) $task->task_time, 0, 5) : '',
            'time_label'     => $task->hasTime() ? Carbon::parse($task->task_time)->format('g:i A') : 'Any time',
            'status'         => $status,
            'author'         => $task->user->full_name ?? 'Unknown',
            'author_initial' => strtoupper(substr($task->user->full_name ?? '?', 0, 1)),
            'author_avatar'  => $task->user->avatar_url ?? null,
        ];
    }

    // ============================================================
    // Writes
    // ============================================================

    /**
     * Create or update from the add/edit form.
     */
    public function save(array $data, int $userId): array
    {
        try {
            $encodedId = trim((string) ($data['encoded_id'] ?? ''));
            $isNew = $encodedId === '';

            $task = $isNew ? new Task() : Task::find(IdEncoder::decode($encodedId));
            if (!$task) {
                return ['success' => false, 'messages' => ['Task not found.']];
            }

            $title = trim((string) ($data['task_title'] ?? ''));
            $detail = trim((string) ($data['task_detail'] ?? ''));
            $dueDate = trim((string) ($data['due_date'] ?? ''));
            $time = trim((string) ($data['task_time'] ?? ''));

            $errors = [];
            if ($title === '') {
                $errors[] = 'Give the task a title.';
            } elseif (mb_strlen($title) > 255) {
                $errors[] = 'The title must be 255 characters or fewer.';
            }
            $date = \DateTime::createFromFormat('!Y-m-d', $dueDate);
            if (!$date || $date->format('Y-m-d') !== $dueDate) {
                $errors[] = 'Choose a valid due date.';
            }
            if ($time !== '' && !preg_match('/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/', $time)) {
                $errors[] = 'Choose a valid time, or leave it blank.';
            }
            if (mb_strlen($detail) > 5000) {
                $errors[] = 'Details must be 5,000 characters or fewer.';
            }
            if ($errors) {
                return ['success' => false, 'messages' => $errors];
            }

            if ($isNew) {
                $task->orig_user_id = $userId; // creator; kept on later edits
            }
            $task->task_title = $title;
            $task->task_detail = $detail !== '' ? $detail : null;
            $task->due_date = $dueDate;
            // Blank = no particular time (NULL, shown as "Any time"); 00:00 is a
            // real time (12:00 AM).
            $task->task_time = $time !== '' ? (strlen($time) === 5 ? $time . ':00' : $time) : null;
            $task->save();
            $task->load('user');

            $dueLabel = $task->due_date->format('M j, Y');
            static::logActivity(($isNew ? 'Created task' : 'Updated task') . ": {$task->task_title} (Due: {$dueLabel})", 'Tasks', $task->task_id);

            return [
                'success'  => true,
                'messages' => [$isNew ? 'Task added.' : 'Task updated.'],
                'task'     => self::present($task),
            ];
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not save the task: ' . $e->getMessage()]];
        }
    }

    public function delete(string $encodedId): array
    {
        try {
            $task = Task::find(IdEncoder::decode($encodedId) ?? 0);
            if (!$task) {
                return ['success' => false, 'messages' => ['Task not found.']];
            }

            $title = $task->task_title;
            $id = $task->task_id;
            $dueLabel = $task->due_date ? $task->due_date->format('M j, Y') : 'No date';

            $task->delete();
            static::logActivity("Deleted task: {$title} (Due: {$dueLabel})", 'Tasks', $id);

            return ['success' => true, 'messages' => ['Task deleted.']];
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not delete the task: ' . $e->getMessage()]];
        }
    }

    // ============================================================

    private static function capped(Collection $tasks, int $limit, string $grouping): array
    {
        $capped = $tasks->count() > $limit;
        return ['tasks' => $capped ? $tasks->take($limit) : $tasks, 'grouping' => $grouping, 'capped' => $capped];
    }
}
