<?php
// /src/Service/ChatAutoResponder.php

declare(strict_types=1);

namespace Src\Service;

use App\Models\ChatAiSetting;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use GuzzleHttp\Client;
use Illuminate\Support\Collection;

/**
 * Optional AI autoresponder for the live chat widget. When the admin turns
 * "Autorespond" on (see ChatAiSetting / server/api/chat-ai-settings.php),
 * every new visitor message gets an immediate reply generated from the
 * admin-authored instructions plus the conversation so far — until a real
 * admin sends a message in that conversation, at which point the AI stops
 * replying there for good (human takeover, detected via a ChatMessage row
 * with sender_role = 'admin' and is_ai = false).
 *
 * Never throws out of maybeRespond(): a missing/invalid API key, a network
 * failure, or any Anthropic API error just means no auto-reply is
 * generated — the visitor's own message is already saved by that point, so
 * the chat keeps working normally either way.
 */
final class ChatAutoResponder
{
    private const API_URL = 'https://api.anthropic.com/v1/messages';
    private const MODEL = 'claude-opus-4-8';
    private const MAX_TOKENS = 400;
    private const HISTORY_LIMIT = 20;
    private const MAX_INSTRUCTIONS_LENGTH = 4000;

    private const BASE_SYSTEM_PROMPT = <<<'PROMPT'
You are answering live chat messages on behalf of a real business, standing in for their support team while no human admin has joined the conversation yet. Reply the way a helpful, concise member of that team would: warm but brief (usually 1-3 sentences), plain text with no markdown formatting, and never claim to be able to do things you can't — you cannot look up account details, place orders, check records, or access any system. You can only talk.

If the visitor asks for something you can't help with directly, raises a complaint, or the conversation calls for a real person, say plainly that a team member will follow up soon rather than guessing or making something up.
PROMPT;

    public static function isEnabled(): bool
    {
        return self::settings()->enabled;
    }

    public static function instructions(): string
    {
        return self::settings()->instructions ?? '';
    }

    public static function isConfigured(): bool
    {
        return self::apiKey() !== null;
    }

    public static function maxInstructionsLength(): int
    {
        return self::MAX_INSTRUCTIONS_LENGTH;
    }

    public static function updateSettings(bool $enabled, string $instructions): void
    {
        $settings = self::settings();
        $settings->enabled = $enabled;
        $settings->instructions = trim($instructions);
        $settings->save();
    }

    /**
     * True once a real admin (not the AI) has replied in this conversation —
     * once true, the AI must never reply here again.
     */
    public static function hasHumanTakenOver(ChatConversation $conversation): bool
    {
        return ChatMessage::where('conversation_id', $conversation->id)
            ->where('sender_role', 'admin')
            ->where('is_ai', false)
            ->exists();
    }

    /**
     * Generates and saves an AI reply for $conversation if autorespond is
     * on, no human admin has taken over, and an API key is configured.
     * Returns the saved message, or null if no reply was generated.
     */
    public static function maybeRespond(ChatConversation $conversation): ?ChatMessage
    {
        if (!self::isEnabled() || !self::isConfigured()) {
            return null;
        }

        if (self::hasHumanTakenOver($conversation)) {
            return null;
        }

        $history = ChatMessage::where('conversation_id', $conversation->id)
            ->orderByDesc('created_at')
            ->limit(self::HISTORY_LIMIT)
            ->get()
            ->reverse()
            ->values();

        // Only reply when the thread's last word is the visitor's — guards
        // against double-replying if this is ever called out of order.
        if ($history->isEmpty() || $history->last()->sender_role !== 'visitor') {
            return null;
        }

        $reply = self::generateReply($history);
        if ($reply === null || trim($reply) === '') {
            return null;
        }

        $message = ChatMessage::create([
            'conversation_id' => $conversation->id,
            'sender_role' => 'admin',
            'sender_user_id' => null,
            'is_ai' => true,
            'body' => trim($reply),
            // Visitor hasn't seen it yet (obviously); admin hasn't reviewed
            // it yet either — the admin badge should reflect AI activity.
            'is_read_by_admin' => false,
            'is_read_by_visitor' => false,
        ]);

        $conversation->last_message_at = $message->created_at;
        $conversation->save();

        return $message;
    }

    /**
     * @param Collection<int, ChatMessage> $history
     */
    private static function generateReply(Collection $history): ?string
    {
        $apiKey = self::apiKey();
        if (!$apiKey) {
            return null;
        }

        $messages = $history->map(fn(ChatMessage $m) => [
            'role' => $m->sender_role === 'admin' ? 'assistant' : 'user',
            'content' => $m->body,
        ])->values()->all();

        $system = self::BASE_SYSTEM_PROMPT;
        $custom = trim(self::instructions());
        if ($custom !== '') {
            $system .= "\n\nBusiness-specific guidance from the admin:\n" . $custom;
        }

        try {
            $client = new Client(['timeout' => 20]);
            $response = $client->post(self::API_URL, [
                'headers' => [
                    'x-api-key' => $apiKey,
                    'anthropic-version' => '2023-06-01',
                    'content-type' => 'application/json',
                ],
                'json' => [
                    'model' => self::MODEL,
                    'max_tokens' => self::MAX_TOKENS,
                    'system' => $system,
                    // No thinking param -> Opus 4.8 runs without extended
                    // thinking, which keeps a short chat reply fast; effort
                    // "low" trims deliberation further for this kind of task.
                    'output_config' => ['effort' => 'low'],
                    'messages' => $messages,
                ],
            ]);

            $data = json_decode((string) $response->getBody(), true);
            if (!is_array($data)) {
                return null;
            }

            if (($data['stop_reason'] ?? null) === 'refusal') {
                return null;
            }

            $text = '';
            foreach ($data['content'] ?? [] as $block) {
                if (($block['type'] ?? null) === 'text') {
                    $text .= (string) ($block['text'] ?? '');
                }
            }

            return $text !== '' ? $text : null;
        } catch (\Throwable $e) {
            error_log('ChatAutoResponder: Anthropic API call failed: ' . $e->getMessage());
            return null;
        }
    }

    private static function apiKey(): ?string
    {
        $key = $_ENV['ANTHROPIC_API_KEY'] ?? (getenv('ANTHROPIC_API_KEY') ?: null);
        $key = $key !== null ? trim((string) $key) : '';
        return $key !== '' ? $key : null;
    }

    private static function settings(): ChatAiSetting
    {
        $settings = ChatAiSetting::first();
        if (!$settings) {
            $settings = ChatAiSetting::create(['enabled' => false, 'instructions' => '']);
        }
        return $settings;
    }
}
