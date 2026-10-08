<?php
// /src/Service/SmsService.php

declare(strict_types=1);

namespace Src\Service;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;

/**
 * Thin wrapper around Termii's SMS API (https://termii.com) — used by
 * ContractorOutreachService to text a discovered, unclaimed contractor
 * inviting them to claim their profile. A missing API key just means
 * send() no-ops with a clear failure result; ContractorOutreachService is
 * what decides what that means for the caller (same "blank key = disabled
 * until configured" pattern as PaystackService).
 */
final class SmsService
{
    private const ENDPOINT = 'https://api.ng.termii.com/api/sms/send';

    public static function isConfigured(): bool
    {
        return self::apiKey() !== null && self::senderId() !== null;
    }

    /**
     * @return array{success: bool, message: string}
     */
    public static function send(string $to, string $message): array
    {
        $apiKey = self::apiKey();
        $senderId = self::senderId();

        if (!$apiKey || !$senderId) {
            return ['success' => false, 'message' => 'SMS outreach is not configured yet.'];
        }

        try {
            $client = new Client(['timeout' => 20]);
            $response = $client->post(self::ENDPOINT, [
                'headers' => ['Content-Type' => 'application/json'],
                'json' => [
                    'to' => self::normalizeNigerianNumber($to),
                    'from' => $senderId,
                    'sms' => $message,
                    'type' => 'plain',
                    'channel' => 'generic',
                    'api_key' => $apiKey,
                ],
            ]);

            $data = json_decode((string) $response->getBody(), true);

            // Termii returns a message_id on success; anything else (or an
            // explicit error message in the body) is treated as a failure.
            if (is_array($data) && !empty($data['message_id'])) {
                return ['success' => true, 'message' => 'ok'];
            }

            return ['success' => false, 'message' => $data['message'] ?? 'SMS could not be sent.'];
        } catch (GuzzleException $e) {
            error_log('SmsService::send failed: ' . $e->getMessage());
            return ['success' => false, 'message' => 'Could not reach the SMS gateway.'];
        }
    }

    /**
     * Termii expects international format without a leading '+' (e.g.
     * 2348011111111) — most numbers in this app are stored as local
     * (0801...) or with a leading '+'.
     */
    private static function normalizeNigerianNumber(string $number): string
    {
        $digits = preg_replace('/\D/', '', $number) ?? '';

        if (str_starts_with($digits, '234')) {
            return $digits;
        }

        if (str_starts_with($digits, '0')) {
            return '234' . substr($digits, 1);
        }

        return $digits;
    }

    private static function apiKey(): ?string
    {
        $key = $_ENV['TERMII_API_KEY'] ?? (getenv('TERMII_API_KEY') ?: null);
        $key = $key !== null ? trim((string) $key) : '';
        return $key !== '' ? $key : null;
    }

    private static function senderId(): ?string
    {
        $id = $_ENV['TERMII_SENDER_ID'] ?? (getenv('TERMII_SENDER_ID') ?: null);
        $id = $id !== null ? trim((string) $id) : '';
        return $id !== '' ? $id : null;
    }
}
