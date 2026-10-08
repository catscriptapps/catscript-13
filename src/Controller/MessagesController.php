<?php
// /src/Controller/MessagesController.php

declare(strict_types=1);

namespace Src\Controller;

use App\Models\Message;
use App\Models\User;
use App\Traits\RecentActivityLogger;
use Src\Service\AuthService;
use Src\Service\MailService;

/**
 * Messages — the site's contact-form inbox (admins only), on the
 * `messages` table.
 *
 * A visitor's contact-form message starts a thread (conversation_id); an
 * admin's reply is saved in the same thread and emailed to the visitor.
 * Rows without a conversation_id are a thread of their own, keyed "m{id}"
 * until someone replies (then they get a conversation_id).
 *
 * The public endpoint only accepts the four form fields (never is_sent /
 * parent_id, so nobody can make the server email arbitrary text), input is
 * validated, there's a honeypot and rate limits, and reading, archiving and
 * deleting work on whole threads.
 */
class MessagesController
{
    use RecentActivityLogger;

    private const MAX_NAME = 120;
    private const MAX_SUBJECT = 200;
    private const MAX_BODY = 5000;
    /** Contact form: at most this many sends per browser session / per email address, per window */
    private const RATE_SESSION = 5;
    private const RATE_EMAIL = 3;
    private const RATE_WINDOW = 600; // seconds

    // ============================================================
    // Public: the contact form
    // ============================================================

    /** A visitor's message from the contact form. Only these fields are read. */
    public static function submitContact(array $in): array
    {
        try {
            // Honeypot: real people never see or fill the "website" field
            if (trim((string) ($in['website'] ?? '')) !== '') {
                return ['success' => true, 'messages' => ['Thanks — your message is on its way.']];
            }

            $name = trim(preg_replace('/\s+/', ' ', (string) ($in['full_name'] ?? '')));
            $email = strtolower(trim((string) ($in['email'] ?? '')));
            $subject = trim(preg_replace('/\s+/', ' ', (string) ($in['subject'] ?? '')));
            $body = trim(str_replace("\r\n", "\n", (string) ($in['message'] ?? '')));

            $errors = [];
            if ($name === '') {
                $errors[] = 'Please tell us your name.';
            } elseif (mb_strlen($name) > self::MAX_NAME) {
                $errors[] = 'Your name is a little long — ' . self::MAX_NAME . ' characters at most.';
            }
            if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 255) {
                $errors[] = 'Please enter a valid email address, so we can reply.';
            }
            if (mb_strlen($subject) > self::MAX_SUBJECT) {
                $errors[] = 'Please keep the subject under ' . self::MAX_SUBJECT . ' characters.';
            }
            if ($body === '') {
                $errors[] = 'Please write your message.';
            } elseif (mb_strlen($body) > self::MAX_BODY) {
                $errors[] = 'Please keep your message under ' . number_format(self::MAX_BODY) . ' characters.';
            }
            if ($errors) {
                return ['success' => false, 'messages' => $errors];
            }

            // Rate limits: per browser session, and per email address
            // Same session setup as everywhere else (our folder, 2-week cookie)
            \Src\Service\AuthService::ensureSession();
            $now = time();
            $recent = array_values(array_filter((array) ($_SESSION['contact_sent_at'] ?? []), fn($t) => $t > $now - self::RATE_WINDOW));
            $byEmail = Message::where('email', $email)->where('is_sent', false)
                ->where('created_at', '>', date('Y-m-d H:i:s', $now - self::RATE_WINDOW))->count();
            if (count($recent) >= self::RATE_SESSION || $byEmail >= self::RATE_EMAIL) {
                return ['success' => false, 'messages' => ['You’ve sent a few messages in a short time — please wait a few minutes and try again.']];
            }

            $message = self::insert([
                'conversation_id' => bin2hex(random_bytes(8)),
                'full_name'       => $name,
                'email'           => $email,
                'subject'         => $subject !== '' ? $subject : 'No subject',
                'message'         => $body,
                'is_read'         => false,
                'is_sent'         => false,
            ]);

            $recent[] = $now;
            $_SESSION['contact_sent_at'] = $recent;
            static::logActivity("New contact message from {$name}", 'Message', $message->id);
            self::notifyAdmins($message);

            $first = explode(' ', $name)[0];
            return ['success' => true, 'messages' => ["Thanks, {$first} — your message is in. We’ll reply to {$email}."]];
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Sorry — your message couldn’t be sent. Please try again in a moment.']];
        }
    }

    /** Best effort: email every admin that a new message arrived. */
    private static function notifyAdmins(Message $m): void
    {
        if (!MailService::isConfigured()) {
            return;
        }
        try {
            $link = rtrim((string) ($_ENV['APP_URL'] ?? ''), '/') . '/messages?open=' . rawurlencode((string) $m->conversation_id);
            $e = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
            $body = '<p><strong>' . $e($m->full_name) . '</strong> (' . $e($m->email) . ') sent a message through the contact form:</p>'
                . '<p style="font-size:15px"><strong>' . $e($m->subject) . '</strong></p>'
                . '<div style="background:#f3f4f6;border-left:4px solid #ea580c;padding:14px 18px;border-radius:8px;white-space:pre-line">' . $e(mb_strimwidth($m->message, 0, 1200, '…')) . '</div>'
                . '<p><a href="' . $e($link) . '" style="color:#ea580c;font-weight:bold">Open it in Messages</a></p>';
            foreach (self::adminEmails() as $to) {
                MailService::send($to, "New message: {$m->subject}", $body, [], $m->email);
            }
        } catch (\Throwable $e) {
            // The message is saved — a failed notification mustn't fail the form
        }
    }

    /** @return string[] */
    private static function adminEmails(): array
    {
        return User::whereNotNull('user_type_ids')->get()
            ->filter(fn(User $u) => is_array($u->user_type_ids) && in_array(1, $u->user_type_ids) && filter_var($u->email, FILTER_VALIDATE_EMAIL))
            ->pluck('email')->unique()->values()->all();
    }

    // ============================================================
    // Admin: reads
    // ============================================================

    /** Every thread (newest activity first), with the inbox counts. */
    public static function state(): array
    {
        $threads = [];
        foreach (Message::orderBy('created_at')->orderBy('id')->get()->groupBy(fn(Message $m) => self::keyOf($m)) as $key => $rows) {
            $threads[] = self::summary((string) $key, $rows);
        }
        usort($threads, fn($a, $b) => strcmp($b['last_at'], $a['last_at']));

        $open = array_filter($threads, fn($t) => !$t['archived']);
        $weekAgo = date('c', strtotime('-7 days'));
        return [
            'threads' => $threads,
            'counts'  => [
                'unread'   => count(array_filter($open, fn($t) => $t['unread'] > 0)),
                'awaiting' => count(array_filter($open, fn($t) => $t['awaiting'])),
                'week'     => count(array_filter($threads, fn($t) => $t['first_at'] >= $weekAgo)),
                'archived' => count($threads) - count($open),
                'total'    => count($threads),
            ],
            'can_email' => MailService::isConfigured(),
            'me'        => (string) (AuthService::currentUser()->full_name ?? 'Admin'),
        ];
    }

    /** Threads with unread messages (the header / sidebar badge). */
    public static function unreadCount(): int
    {
        if (!AuthService::isAdmin()) {
            return 0;
        }
        return (int) Message::where('is_sent', false)->where('is_read', false)->where('is_archived', false)
            ->selectRaw("COUNT(DISTINCT COALESCE(conversation_id, CONCAT('m', id))) AS n")->value('n');
    }

    /** One thread's messages (oldest first); marks the visitor's messages read. */
    public static function thread(string $key, bool $markRead = true): ?array
    {
        $rows = self::rows($key)->orderBy('created_at')->orderBy('id')->get();
        if ($rows->isEmpty()) {
            return null;
        }
        if ($markRead && $rows->contains(fn(Message $m) => !$m->is_sent && !$m->is_read)) {
            self::rows($key)->where('is_sent', false)->update(['is_read' => true]);
            $rows->each(fn(Message $m) => $m->is_sent || ($m->is_read = true));
        }

        return self::summary($key, $rows) + [
            'messages' => $rows->map(fn(Message $m) => [
                'id'    => (int) $m->id,
                'from'  => $m->is_sent ? 'you' : 'them',
                'name'  => (string) $m->full_name,
                'email' => (string) $m->email,
                'body'  => (string) $m->message,
                'at'    => $m->created_at ? $m->created_at->format('c') : null,
            ])->values()->all(),
        ];
    }

    private static function keyOf(Message $m): string
    {
        return $m->conversation_id ?: 'm' . $m->id;
    }

    /** The rows of thread $key. */
    private static function rows(string $key)
    {
        if (preg_match('/^m(\d+)$/', $key, $mm)) {
            return Message::where('id', (int) $mm[1])->whereNull('conversation_id');
        }
        return Message::where('conversation_id', preg_match('/^[A-Za-z0-9_-]{1,64}$/', $key) ? $key : '-');
    }

    /** @param \Illuminate\Support\Collection<Message> $rows oldest first */
    private static function summary(string $key, $rows): array
    {
        $first = $rows->first();
        $last = $rows->last();
        // Who wrote in: the first incoming message (fall back to the first row)
        $visitor = $rows->first(fn(Message $m) => !$m->is_sent) ?? $first;

        return [
            'key'      => $key,
            'subject'  => (string) ($first->subject ?: 'No subject'),
            'name'     => (string) ($visitor->full_name ?: 'Unknown'),
            'email'    => (string) $visitor->email,
            'preview'  => mb_strimwidth(trim(preg_replace('/\s+/', ' ', (string) $last->message)), 0, 160, '…'),
            'last_from' => $last->is_sent ? 'you' : 'them',
            'first_at' => $first->created_at ? $first->created_at->format('c') : '',
            'last_at'  => $last->created_at ? $last->created_at->format('c') : '',
            'count'    => $rows->count(),
            'unread'   => $rows->filter(fn(Message $m) => !$m->is_sent && !$m->is_read)->count(),
            'awaiting' => !$last->is_sent,
            'archived' => (bool) $first->is_archived,
        ];
    }

    // ============================================================
    // Admin: writes
    // ============================================================

    /** Reply to the visitor: emailed to them, then saved in the thread. */
    public function reply(string $key, string $body, int $userId): array
    {
        try {
            $body = trim(str_replace("\r\n", "\n", $body));
            $t = self::thread($key, false);
            if (!$t) {
                return ['success' => false, 'messages' => ['That conversation no longer exists.']];
            }
            if ($body === '') {
                return ['success' => false, 'messages' => ['Write your reply first.']];
            }
            if (mb_strlen($body) > self::MAX_BODY) {
                return ['success' => false, 'messages' => ['Please keep replies under ' . number_format(self::MAX_BODY) . ' characters.']];
            }
            if (!filter_var($t['email'], FILTER_VALIDATE_EMAIL)) {
                return ['success' => false, 'messages' => ['This conversation has no valid email address to reply to.']];
            }
            if (!MailService::isConfigured()) {
                return ['success' => false, 'messages' => ['Email isn’t set up on this server yet, so replies can’t be sent from here — use “Reply in your email app” instead.']];
            }

            $me = User::find($userId);
            $myName = (string) ($me->full_name ?? ($_ENV['APP_NAME'] ?? 'The team'));
            $subject = preg_match('/^re:/i', $t['subject']) ? $t['subject'] : 'Re: ' . $t['subject'];

            $sent = MailService::send($t['email'], $subject, self::replyEmail($t, $body, $myName), [], $me->email ?? null);
            if (!$sent) {
                return ['success' => false, 'messages' => ['The email could not be sent — nothing was saved. Please try again.']];
            }

            // A single-message thread gets a conversation id now
            $conversation = $key;
            if (str_starts_with($key, 'm')) {
                $conversation = bin2hex(random_bytes(8));
                self::rows($key)->update(['conversation_id' => $conversation]);
            }
            $lastId = (int) collect($t['messages'])->last()['id'];
            self::insert([
                'conversation_id' => $conversation,
                'parent_id'       => $lastId,
                'full_name'       => $myName,
                'email'           => (string) ($me->email ?? ''),
                'subject'         => $subject,
                'message'         => $body,
                'is_read'         => true,
                'is_sent'         => true,
                'is_archived'     => $t['archived'],
            ]);
            static::logActivity("Replied to {$t['name']} — {$t['subject']}", 'Message', $lastId);

            return ['success' => true, 'messages' => ["Reply emailed to {$t['email']}."], 'key' => $conversation] + self::state();
        } catch (\Throwable $e) {
            return ['success' => false, 'messages' => ['Could not send the reply: ' . $e->getMessage()]];
        }
    }

    private static function replyEmail(array $t, string $body, string $from): string
    {
        $e = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
        $original = collect($t['messages'])->last(fn($m) => $m['from'] === 'them');
        return '<div style="font-family:Quicksand,Arial,sans-serif;color:#111827;line-height:1.6">'
            . '<p>Hello ' . $e(explode(' ', $t['name'])[0]) . ',</p>'
            . '<div style="white-space:pre-line">' . $e($body) . '</div>'
            . '<p>— ' . $e($from) . ', ' . $e($_ENV['APP_NAME'] ?? '') . '</p>'
            . ($original ? '<div style="margin-top:24px;border-left:3px solid #e5e7eb;padding-left:12px;color:#6b7280;font-size:13px">'
                . '<p style="margin:0 0 4px">You wrote' . ($original['at'] ? ' on ' . $e(date('M j, Y', strtotime($original['at']))) : '') . ':</p>'
                . '<div style="white-space:pre-line">' . $e(mb_strimwidth($original['body'], 0, 1500, '…')) . '</div></div>' : '')
            . '</div>';
    }

    public function setArchived(string $key, bool $archived): array
    {
        $n = self::rows($key)->update(['is_archived' => $archived]);
        if (!$n) {
            return ['success' => false, 'messages' => ['That conversation no longer exists.']];
        }
        static::logActivity(($archived ? 'Archived' : 'Restored') . ' a message thread', 'Message');
        return ['success' => true, 'messages' => [$archived ? 'Archived.' : 'Moved back to the inbox.']] + self::state();
    }

    /** Mark the visitor's latest message unread again. */
    public function markUnread(string $key): array
    {
        $last = self::rows($key)->where('is_sent', false)->orderByDesc('created_at')->orderByDesc('id')->first();
        if (!$last) {
            return ['success' => false, 'messages' => ['Nothing to mark unread here.']];
        }
        $last->is_read = false;
        $last->save();
        return ['success' => true, 'messages' => ['Marked as unread.']] + self::state();
    }

    public function deleteThread(string $key): array
    {
        $t = self::thread($key, false);
        if (!$t) {
            return ['success' => false, 'messages' => ['That conversation no longer exists.']];
        }
        self::rows($key)->delete();
        static::logActivity("Deleted the conversation with {$t['name']} — {$t['subject']}", 'Message');
        return ['success' => true, 'messages' => ['Conversation deleted.']] + self::state();
    }

    // ============================================================

    private static function insert(array $fields): Message
    {
        $m = new Message($fields);
        $m->save();
        return $m;
    }
}
