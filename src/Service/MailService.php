<?php
// /src/Service/MailService.php

declare(strict_types=1);

namespace Src\Service;

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

/**
 * MailService
 * Handles sending system emails using PHPMailer via Composer Autoload.
 */
class MailService
{
    /**
     * True once real SMTP credentials have been supplied (MAIL_HOST set in
     * .env) — i.e. once a verification link could actually be delivered.
     */
    public static function isConfigured(): bool
    {
        return trim((string) ($_ENV['MAIL_HOST'] ?? '')) !== '';
    }

    /**
     * Sends an email.
     *
     * Reads SMTP credentials from .env (MAIL_HOST / MAIL_PORT /
     * MAIL_USERNAME / MAIL_PASSWORD / MAIL_ENCRYPTION / MAIL_FROM_ADDRESS /
     * MAIL_FROM_NAME) — previously all of this was hard-coded to
     * `localhost:25` with no auth (a "GoDaddy internal relay" that doesn't
     * exist on this deploy) and a leftover `noreply@pmbtracker.com` /
     * "Property Management Brokers" sender from the old PMB template.
     * Falls back to that same localhost:25/no-auth shape when MAIL_HOST is
     * unset, so local dev (which has never had a real mail server anyway)
     * keeps working exactly as before — a real deploy just needs the
     * MAIL_* vars filled in, same "leave blank to disable" convention as
     * PAYSTACK_SECRET_KEY / TERMII_API_KEY.
     *
     * @param string $to Recipient email
     * @param string $subject Email subject
     * @param string $body HTML content
     * @param array<int, array{content: string, name: string, type?: string}> $attachments
     *        in-memory files (e.g. an invoice PDF)
     * @param string|null $replyTo
     * @return bool
     * @throws Exception
     */
    public static function send(string $to, string $subject, string $body, array $attachments = [], ?string $replyTo = null): bool
    {
        $mail = new PHPMailer(true);

        try {
            $host = $_ENV['MAIL_HOST'] ?? 'localhost';
            $port = (int) ($_ENV['MAIL_PORT'] ?? 25);
            $username = $_ENV['MAIL_USERNAME'] ?? '';
            $password = $_ENV['MAIL_PASSWORD'] ?? '';
            $encryption = $_ENV['MAIL_ENCRYPTION'] ?? ''; // 'tls' | 'ssl' | ''
            $fromAddress = $_ENV['MAIL_FROM_ADDRESS'] ?? 'noreply@catscriptapps.com';
            $fromName = $_ENV['MAIL_FROM_NAME'] ?? ($_ENV['APP_NAME'] ?? 'CatScript-13');

            $mail->isSMTP();
            $mail->Host = $host;
            $mail->Port = $port;
            $mail->SMTPAuth = $username !== '';

            if ($mail->SMTPAuth) {
                $mail->Username = $username;
                $mail->Password = $password;
            }

            if ($encryption === 'tls' || $encryption === 'ssl') {
                $mail->SMTPSecure = $encryption;
                $mail->SMTPAutoTLS = true;
            } else {
                $mail->SMTPSecure = '';
                $mail->SMTPAutoTLS = false;
            }

            $mail->setFrom($fromAddress, $fromName);
            $mail->addAddress($to);
            if ($replyTo) {
                $mail->addReplyTo($replyTo);
            }
            foreach ($attachments as $a) {
                $mail->addStringAttachment($a['content'], $a['name'], PHPMailer::ENCODING_BASE64, $a['type'] ?? 'application/octet-stream');
            }

            // Content
            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body    = $body;
            $mail->AltBody = strip_tags($body);

            return $mail->send();
        } catch (Exception $e) {
            // Log the detailed error, but throw a clean one for the controller
            error_log("Mailer Error: {$mail->ErrorInfo}");
            throw new \Exception("The mail system is currently unavailable.");
        }
    }
}
