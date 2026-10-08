<?php
// /src/Controller/ChatController.php

declare(strict_types=1);

namespace Src\Controller;

use App\Models\ChatConversation;
use App\Models\ChatMessage;
use Illuminate\Pagination\LengthAwarePaginator;
use Src\Service\AuthService;

/**
 * ChatController
 * Owns the live chat widget: one open conversation per visitor (guest or
 * logged-in) with admin. Separate from the older `messages` contact-form
 * inbox (MessagesController) — see server/api/global-unread.php, which
 * already anticipated "chats" as a distinct concept from "messages".
 *
 * Guests are identified by a token minted into $_SESSION on first use (the
 * app's existing native-PHP-session auth pattern — see AuthService) rather
 * than a client-managed cookie/localStorage value.
 */
class ChatController
{
    private const MAX_BODY_LENGTH = 4000;

    /**
     * Get-or-create the current caller's open conversation.
     */
    public static function findOrCreateConversation(?string $guestName = null, ?string $guestEmail = null): ChatConversation
    {
        $userId = AuthService::userId(); // also ensures the session is started

        if ($userId) {
            $conversation = ChatConversation::where('user_id', $userId)->open()->first();
            if ($conversation) {
                return $conversation;
            }

            return ChatConversation::create([
                'user_id' => $userId,
                'status' => 'open',
                'last_message_at' => null,
            ]);
        }

        if (empty($_SESSION['chat_guest_token'])) {
            $_SESSION['chat_guest_token'] = bin2hex(random_bytes(16));
        }
        $guestToken = $_SESSION['chat_guest_token'];

        $conversation = ChatConversation::where('guest_token', $guestToken)->open()->first();
        if ($conversation) {
            // Fill in the name/email the first time the guest supplies it.
            if ($guestName && !$conversation->guest_name) {
                $conversation->guest_name = $guestName;
            }
            if ($guestEmail && !$conversation->guest_email) {
                $conversation->guest_email = $guestEmail;
            }
            if ($conversation->isDirty()) {
                $conversation->save();
            }
            return $conversation;
        }

        return ChatConversation::create([
            'guest_token' => $guestToken,
            'guest_name' => $guestName,
            'guest_email' => $guestEmail,
            'status' => 'open',
            'last_message_at' => null,
        ]);
    }

    /**
     * Loads the caller's conversation strictly by ownership (session
     * user/guest-token match) — used by chat-send.php/chat-poll.php so a
     * conversation id in the request body can't be used to read/write
     * someone else's thread.
     */
    public static function loadOwnConversation(int $conversationId): ?ChatConversation
    {
        $userId = AuthService::userId();

        if ($userId) {
            return ChatConversation::where('id', $conversationId)->where('user_id', $userId)->first();
        }

        $guestToken = $_SESSION['chat_guest_token'] ?? null;
        if (!$guestToken) {
            return null;
        }

        return ChatConversation::where('id', $conversationId)->where('guest_token', $guestToken)->first();
    }

    /**
     * @return array{success: bool, errors: string[], message?: ChatMessage}
     */
    public static function postMessage(ChatConversation $conversation, string $role, string $body, bool $isAi = false): array
    {
        $body = trim($body);

        if ($body === '') {
            return ['success' => false, 'errors' => ['Message cannot be empty.']];
        }

        if (mb_strlen($body) > self::MAX_BODY_LENGTH) {
            return ['success' => false, 'errors' => ['Message is too long.']];
        }

        $message = ChatMessage::create([
            'conversation_id' => $conversation->id,
            'sender_role' => $role,
            'sender_user_id' => $isAi ? null : AuthService::userId(),
            'is_ai' => $isAi,
            'body' => $body,
            // The sender's own side is trivially "read"; the other side needs to see it.
            'is_read_by_admin' => $role === 'admin',
            'is_read_by_visitor' => $role === 'visitor',
        ]);

        $conversation->last_message_at = $message->created_at;
        if ($conversation->status !== 'open') {
            $conversation->status = 'open';
        }
        $conversation->save();

        return ['success' => true, 'errors' => [], 'message' => $message];
    }

    /**
     * Full thread, oldest first — used for the widget/admin thread's initial load.
     */
    public static function fullThread(ChatConversation $conversation, int $limit = 100)
    {
        return ChatMessage::where('conversation_id', $conversation->id)
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->reverse()
            ->values();
    }

    /**
     * Incremental fetch for polling — only messages newer than $afterId.
     */
    public static function threadSince(ChatConversation $conversation, int $afterId)
    {
        return ChatMessage::where('conversation_id', $conversation->id)
            ->where('id', '>', $afterId)
            ->orderBy('id')
            ->get();
    }

    public static function markReadByVisitor(ChatConversation $conversation): void
    {
        ChatMessage::where('conversation_id', $conversation->id)
            ->where('is_read_by_visitor', false)
            ->update(['is_read_by_visitor' => true]);
    }

    public static function markReadByAdmin(ChatConversation $conversation): void
    {
        ChatMessage::where('conversation_id', $conversation->id)
            ->where('is_read_by_admin', false)
            ->update(['is_read_by_admin' => true]);
    }

    public static function unreadCountForVisitor(ChatConversation $conversation): int
    {
        return ChatMessage::where('conversation_id', $conversation->id)
            ->where('is_read_by_visitor', false)
            ->count();
    }

    /**
     * Unread count across every open conversation — powers the admin badge.
     */
    public static function unreadCountForAdmin(): int
    {
        return ChatMessage::where('is_read_by_admin', false)
            ->whereHas('conversation', fn($q) => $q->where('status', 'open'))
            ->count();
    }

    /**
     * Admin inbox listing — open conversations with unread first, then most recent.
     */
    public static function openConversations(int $perPage = 20): LengthAwarePaginator
    {
        return ChatConversation::open()
            ->with(['user'])
            ->withCount(['messages as unread_count' => fn($q) => $q->where('is_read_by_admin', false)])
            ->orderByDesc('last_message_at')
            ->paginate($perPage);
    }

    /**
     * Admin inbox listing — closed conversations, most recently closed first.
     */
    public static function closedConversations(int $perPage = 20): LengthAwarePaginator
    {
        return ChatConversation::closed()
            ->with(['user'])
            ->withCount(['messages as unread_count' => fn($q) => $q->where('is_read_by_admin', false)])
            ->orderByDesc('updated_at')
            ->paginate($perPage);
    }

    public static function close(int $id): bool
    {
        $conversation = ChatConversation::find($id);
        if (!$conversation) {
            return false;
        }

        $conversation->status = 'closed';
        return $conversation->save();
    }
}
