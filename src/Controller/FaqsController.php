<?php
// /src/Controller/FaqsController.php

declare(strict_types=1);

namespace Src\Controller;

use App\Models\Faq;
use App\Traits\RecentActivityLogger;
use App\Utils\IdEncoder;
use Illuminate\Database\Capsule\Manager as Capsule;
use Src\Service\AuthService;

/**
 * FAQs — the help centre, on the legacy `faqs` table.
 *
 * Every question belongs to a topic (CATEGORIES: one per app, plus getting
 * started, account, admin…), grouped into the same sections as the sidebar.
 * Everyone can read the published questions; admins also see archived ones
 * and can add, edit, archive and delete.
 *
 * Answers are plain text with a little formatting (see format()): blank
 * lines make paragraphs, "- " starts a bullet, "1. " a numbered step,
 * **bold**, and [label](/path) links to a page in the app. So they stay easy
 * to write in a textarea and are always escaped on the way out.
 */
class FaqsController
{
    use RecentActivityLogger;

    private const MAX_QUESTION = 255;
    private const MAX_ANSWER = 20000;
    /** Topics with no published questions yet still show to admins (so they can fill them). */
    public const GENERAL = 'getting-started';

    /** key => [label, section, emoji, one-line blurb] — in display order. */
    public const CATEGORIES = [
        'getting-started' => ['Getting started', 'Start here', '🚀', 'What CatScript Apps is, finding your way around, and the basics.'],
        'account'         => ['Account & sign-in', 'Start here', '🔐', 'Signing in, passwords, your profile and photo.'],
        'privacy'         => ['Privacy & access', 'Start here', '🛡️', 'Who can see what, app access and the special permissions.'],
        'tasks'           => ['Tasks', 'Workspace', '✅', 'The shared to-do and reminder list.'],
        'cash-flow'       => ['Cash Flow', 'Workspace', '💰', 'Your private money in / money out ledger.'],
        'meals'           => ['Meals', 'Workspace', '🍽️', 'Weekly meal plans with calories and PDFs.'],
        'timetable'       => ['Timetable', 'Workspace', '🗓️', 'The family’s weekly routine, hour by hour.'],
        'chores'          => ['Chores', 'Workspace', '✨', 'Who does which chore, and ticking them off.'],
        'medicals'        => ['Medicals', 'Workspace', '🩺', 'Appointments, medications, vaccinations and health records.'],
        'pictures'        => ['Pictures', 'Workspace', '🖼️', 'Your private photo gallery.'],
        'customers'       => ['Customers', 'Business', '🤝', 'The business customer directory.'],
        'invoices'        => ['Invoices', 'Business', '🧾', 'Itemised invoices, PDFs and what’s owing.'],
        'receipts'        => ['Receipts', 'Business', '💵', 'Recording payments against invoices.'],
        'social-feed'     => ['Social Feed', 'Community', '💬', 'Posts, photos, videos, likes and follows.'],
        'live-chat'       => ['Live chat', 'Community', '🗨️', 'The chat bubble on every page.'],
        'guest-demos'     => ['Trying as a guest', 'Help', '🎮', 'The try-it demos — no account needed.'],
        'contact'         => ['Contact & support', 'Help', '✉️', 'Getting in touch and reporting problems.'],
        'admin'           => ['Admin tools', 'Admin', '👑', 'Users, app access, Messages, the chat inbox and updates.'],
    ];

    // ============================================================
    // Reads
    // ============================================================

    /** Everything the help centre needs. Archived questions only for admins. */
    public static function state(): array
    {
        $isAdmin = AuthService::isAdmin();
        $hasCategory = Capsule::schema()->hasColumn('faqs', 'category');
        $faqs = Faq::query()->when(!$isAdmin, fn($q) => $q->where('status_id', Faq::STATUS_ACTIVE))
            ->orderBy('display_order')->orderBy('id')->get()
            ->map(fn(Faq $f) => self::present($f, $hasCategory))->values()->all();

        $counts = array_count_values(array_column(array_filter($faqs, fn($f) => $f['active']), 'category'));
        $categories = [];
        foreach (self::CATEGORIES as $key => [$label, $section, $icon, $blurb]) {
            $categories[] = ['key' => $key, 'label' => $label, 'section' => $section, 'icon' => $icon, 'blurb' => $blurb, 'count' => $counts[$key] ?? 0];
        }

        return ['faqs' => $faqs, 'categories' => $categories, 'is_admin' => $isAdmin];
    }

    private static function present(Faq $f, bool $hasCategory): array
    {
        $category = $hasCategory ? (string) ($f->category ?? '') : '';
        return [
            'id'       => IdEncoder::encode((int) $f->id),
            'question' => (string) $f->question,
            'answer'   => (string) $f->answer,
            'html'     => self::format((string) $f->answer),
            'category' => isset(self::CATEGORIES[$category]) ? $category : self::GENERAL,
            'order'    => (int) $f->display_order,
            'active'   => (int) $f->status_id === Faq::STATUS_ACTIVE,
            'updated'  => $f->updated_at ? $f->updated_at->format('Y-m-d') : null,
        ];
    }

    /**
     * Plain text -> safe HTML: paragraphs (blank lines), "- " bullets, "1. "
     * numbered steps, **bold**, and [label](/path) links within the app.
     * Old answers that contain HTML are shown as plain text.
     */
    public static function format(string $text): string
    {
        $base = rtrim((string) ($_ENV['APP_BASE_PATH'] ?? ''), '/');
        $inline = function (string $line) use ($base): string {
            $s = htmlspecialchars($line, ENT_QUOTES, 'UTF-8');
            $s = preg_replace('/\*\*(.+?)\*\*/u', '<strong>$1</strong>', $s);
            return preg_replace_callback('/\[([^\]]+)\]\((\/[A-Za-z0-9\-\/?=&;#_.]*)\)/u', function ($m) use ($base) {
                return '<a href="' . $base . $m[2] . '" data-partial class="font-semibold text-primary-600 dark:text-primary-400 hover:underline">' . $m[1] . '</a>';
            }, $s);
        };

        $text = str_replace(["\r\n", "\r"], "\n", trim(strip_tags($text)));
        $html = '';
        foreach (preg_split("/\n\s*\n/", $text) as $block) {
            $lines = array_values(array_filter(array_map('rtrim', explode("\n", $block)), fn($l) => trim($l) !== ''));
            if (!$lines) {
                continue;
            }
            if (count(array_filter($lines, fn($l) => preg_match('/^\s*[-•]\s+/', $l))) === count($lines)) {
                $html .= '<ul>' . implode('', array_map(fn($l) => '<li>' . $inline(preg_replace('/^\s*[-•]\s+/', '', $l)) . '</li>', $lines)) . '</ul>';
            } elseif (count(array_filter($lines, fn($l) => preg_match('/^\s*\d+[.)]\s+/', $l))) === count($lines)) {
                $html .= '<ol>' . implode('', array_map(fn($l) => '<li>' . $inline(preg_replace('/^\s*\d+[.)]\s+/', '', $l)) . '</li>', $lines)) . '</ol>';
            } else {
                $html .= '<p>' . implode('<br>', array_map($inline, $lines)) . '</p>';
            }
        }
        return $html;
    }

    // ============================================================
    // Writes (admins only — server/api/faqs.php checks)
    // ============================================================

    public function save(array $data, int $userId): array
    {
        try {
            $encodedId = trim((string) ($data['id'] ?? ''));
            $isNew = $encodedId === '';
            $faq = $isNew ? new Faq() : Faq::find(IdEncoder::decode($encodedId) ?? 0);
            if (!$faq) {
                return ['success' => false, 'messages' => ['That question no longer exists.']];
            }

            $question = trim(preg_replace('/\s+/', ' ', (string) ($data['question'] ?? '')));
            $answer = trim(str_replace("\r\n", "\n", (string) ($data['answer'] ?? '')));
            $category = (string) ($data['category'] ?? '');
            $active = !empty($data['active']);

            $errors = [];
            if ($question === '') {
                $errors[] = 'Write the question.';
            } elseif (mb_strlen($question) > self::MAX_QUESTION) {
                $errors[] = 'Keep the question under ' . self::MAX_QUESTION . ' characters.';
            }
            if ($answer === '') {
                $errors[] = 'Write the answer.';
            } elseif (mb_strlen($answer) > self::MAX_ANSWER) {
                $errors[] = 'Keep the answer under ' . number_format(self::MAX_ANSWER) . ' characters.';
            }
            if (!isset(self::CATEGORIES[$category])) {
                $errors[] = 'Choose a topic.';
            }
            if ($question !== '' && Faq::where('question', $question)->when(!$isNew, fn($q) => $q->where('id', '<>', $faq->id))->exists()) {
                $errors[] = 'There’s already a question worded exactly like that.';
            }
            if ($errors) {
                return ['success' => false, 'messages' => $errors];
            }

            $hasCategory = Capsule::schema()->hasColumn('faqs', 'category');
            $movedTopic = $isNew || ($hasCategory && $faq->category !== $category);

            Capsule::connection()->transaction(function () use ($faq, $isNew, $question, $answer, $category, $active, $userId, $hasCategory, $movedTopic) {
                if ($isNew) {
                    $faq->id = (int) Capsule::table('faqs')->lockForUpdate()->max('id') + 1;
                    $faq->orig_user_id = $userId;
                }
                $faq->question = $question;
                $faq->answer = $answer;
                $faq->status_id = $active ? Faq::STATUS_ACTIVE : Faq::STATUS_ARCHIVED;
                if ($hasCategory) {
                    $faq->category = $category;
                }
                // New (or moved) questions go to the end of their topic
                if ($movedTopic) {
                    $faq->display_order = (int) Faq::query()->when($hasCategory, fn($q) => $q->where('category', $category))->max('display_order') + 1;
                }
                $faq->save();
            });

            static::logActivity(($isNew ? 'Added' : 'Updated') . " FAQ: {$question}", 'FAQ', $faq->id);
            return ['success' => true, 'messages' => [$isNew ? 'Question added.' : 'Question saved.'], 'saved' => IdEncoder::encode((int) $faq->id)] + self::state();
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not save the question: ' . $e->getMessage()]];
        }
    }

    /** Move a question up / down within its topic. */
    public function move(string $encodedId, int $dir): array
    {
        $faq = Faq::find(IdEncoder::decode($encodedId) ?? 0);
        if (!$faq) {
            return ['success' => false, 'messages' => ['That question no longer exists.']];
        }
        $hasCategory = Capsule::schema()->hasColumn('faqs', 'category');
        $siblings = Faq::query()->when($hasCategory, fn($q) => $q->where('category', $faq->category))
            ->orderBy('display_order')->orderBy('id')->get()->values();
        $i = $siblings->search(fn(Faq $f) => $f->id === $faq->id);
        $j = $i + ($dir < 0 ? -1 : 1);
        if ($i === false || $j < 0 || $j >= $siblings->count()) {
            return ['success' => true, 'messages' => []] + self::state();
        }
        Capsule::connection()->transaction(function () use ($siblings, $i, $j) {
            $list = $siblings->all();
            [$list[$i], $list[$j]] = [$list[$j], $list[$i]];
            foreach ($list as $n => $f) {
                if ($f->display_order !== $n + 1) {
                    $f->display_order = $n + 1;
                    $f->save();
                }
            }
        });
        return ['success' => true, 'messages' => []] + self::state();
    }

    public function delete(string $encodedId): array
    {
        $faq = Faq::find(IdEncoder::decode($encodedId) ?? 0);
        if (!$faq) {
            return ['success' => false, 'messages' => ['That question no longer exists.']];
        }
        $question = (string) $faq->question;
        $faq->delete();
        static::logActivity("Deleted FAQ: {$question}", 'FAQ');
        return ['success' => true, 'messages' => ['Question deleted.']] + self::state();
    }
}
