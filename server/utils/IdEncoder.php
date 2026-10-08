<?php
// /server/utils/IdEncoder.php

/**
 * IdEncoder Utility Class
 *
 * This class provides methods to securely encode and decode integer IDs for use in URLs, HTML attributes, and client-side logic.
 * Encoding helps prevent direct exposure of raw database IDs, reducing the risk of enumeration or tampering.
 * 
 * Encoding Strategy: Base64 URL-safe encoding (non-reversible obfuscation can be added later if needed).
 * 
 * Usage:
 *   $encoded = IdEncoder::encode(123);         // returns "MTIz"
 *   $decoded = IdEncoder::decode("MTIz");      // returns 123
 */

namespace App\Utils;

class IdEncoder
{
    /**
     * Encode an integer ID into a URL-safe base64 string.
     *
     * @param int $id The raw numeric ID to encode (e.g., from database).
     * @return string Encoded string safe for use in URLs and HTML attributes.
     */
    public static function encode(int $id): string
    {
        // Convert the integer to a string and base64-encode it.
        // Then replace '+' and '/' with '-' and '_' to make it URL-safe.
        // Finally, trim any trailing '=' padding characters.
        return rtrim(strtr(base64_encode((string) $id), '+/', '-_'), '=');
    }

    /**
     * Decode a previously encoded ID string back to its original integer value.
     *
     * @param string $encoded The encoded ID string (e.g., from URL or data-* attribute).
     * @return int|null Returns the decoded integer if valid, or null if decoding fails or result is not numeric.
     */
    public static function decode(string $encoded): ?int
    {
        // Replace URL-safe characters
        $b64 = strtr($encoded, '-_', '+/');

        // Add padding if necessary
        $padding = strlen($b64) % 4;
        if ($padding > 0) {
            $b64 .= str_repeat('=', 4 - $padding);
        }

        $decoded = base64_decode($b64, true);
        return ($decoded !== false && is_numeric($decoded)) ? (int)$decoded : null;
    }
}
