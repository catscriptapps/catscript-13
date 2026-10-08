<?php
// /src/Controller/AuthController.php
declare(strict_types=1);

namespace Src\Controller;

use Src\Service\AuthService;
use App\Traits\RecentActivityLogger;
use App\Models\User;
use App\Models\PasswordReset;

/**
 * Class AuthController
 *
 * Acts as a thin controller layer between HTTP requests (API routes)
 * and the business logic handled by AuthService.
 *
 * Responsibilities:
 * - Parse and validate input from JSON or POST data.
 * - Delegate authentication logic to AuthService.
 * - Return consistent structured responses (JSON-serializable arrays).
 *
 * This controller does NOT handle direct output (echo) or HTTP headers.
 * That responsibility remains in the API endpoint scripts, which call
 * these controller methods and return the response as JSON.
 */
class AuthController
{
    use RecentActivityLogger; // ✅ Add logging trait

    /**
     * Returns the currently logged-in user’s information.
     * @return array
     */
    public static function currentUser(): array
    {
        try {
            $user = AuthService::currentUser();

            if (!$user) {
                return [
                    'success'  => false,
                    'messages' => ['No user is currently logged in.']
                ];
            }

            return [
                'success' => true,
                'user' => [
                    'id'        => $user->id,
                    'email'     => $user->email,
                    'full_name' => $user->full_name,
                ]
            ];
        } catch (\Throwable $e) {
            return [
                'success'  => false,
                'messages' => ['Error fetching current user: ' . $e->getMessage()]
            ];
        }
    }

    /**
     * Handles the password reset request
     */
    public static function forgotPassword(array $input): array
    {
        $email = $input['email'] ?? '';

        if (empty($email) || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return [
                'success' => false,
                'messages' => ['Please provide a valid email address.']
            ];
        }

        // 1. Check if user exists
        $user = User::where('email', $email)->first();

        // Security Tip: Even if user doesn't exist, we often return "success" 
        // to prevent email enumeration, but for internal SaaS, showing an error is often fine.
        if (!$user) {
            return [
                'success' => false,
                'messages' => ['No account found with that email address.']
            ];
        }

        try {
            // 2. Generate a secure random token
            $token = bin2hex(random_bytes(32));

            // 3. Store token in database (using a dedicated table)
            // Typically: email, token, created_at
            PasswordReset::updateOrCreate(
                ['email' => $email],
                [
                    'token' => password_hash($token, PASSWORD_DEFAULT),
                    'created_at' => date('Y-m-d H:i:s')
                ]
            );

            // 4. Send the Email (Logic for your mailer here)

            // --- FIXED RECOVERY LINK LOGIC ---
            // We pull from ENV to respect the subfolder (e.g., /cas-sports/)
            $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? "https://" : "http://";
            $host     = $_SERVER['HTTP_HOST'];
            $envBase  = trim($_ENV['APP_BASE_PATH'] ?? '', '/');

            // Construct the full base (Host + Subfolder if exists)
            $fullBaseUrl = $protocol . $host . ($envBase ? '/' . $envBase : '');

            // Ensure single trailing slash before appending the route
            $resetLink = rtrim($fullBaseUrl, '/') . "/reset-password?token={$token}&email=" . urlencode($email);
            // ---------------------------------

            $subject = "Password Reset Request";
            $body = "
                <div style='font-family: \"Quicksand\", sans-serif; color: #431405;'>
                    <h2 style='color: #ea580c;'>Password Reset</h2>
                    <p>You are receiving this email because we received a password reset request for your account.</p>
                    <div style='margin: 32px 0;'>
                        <a href='{$resetLink}' style='background-color: #f97316; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;'>Reset Password</a>
                    </div>
                    <p style='font-size: 0.875rem; color: #818181;'>This password reset link will expire in 60 minutes.</p>
                    <p style='font-size: 0.875rem; color: #818181;'>If you did not request a password reset, no further action is required.</p>
                </div>
            ";

            \Src\Service\MailService::send($email, $subject, $body);

            // Log the successful request
            static::logActivity("Password reset email sent", 'Auth', $user->id);

            return [
                'success' => true,
                'message' => 'A password reset link has been sent to your email.'
            ];
        } catch (\Exception $e) {
            // Log the actual error for debugging
            static::logActivity("Forgot Password Error: " . $e->getMessage(), 'Auth');

            return [
                'success' => false,
                'messages' => ['An error occurred while processing your request.']
            ];
        }
    }

    /**
     * Handles the login process.
     * Now processes the rich array returned by AuthService.
     */
    public static function login(array $input): array
    {
        // --- Step 1: Basic input extraction & validation ---
        $email = trim($input['email'] ?? '');
        $password = trim($input['password'] ?? '');

        if ($email === '' || $password === '') {
            static::logActivity('Failed login attempt - missing credentials', 'Auth');

            return [
                'success'  => false,
                'messages' => ['Email and password are required.']
            ];
        }

        // --- Step 2: Delegate authentication to AuthService ---
        try {
            // $result is an array: ['success' => bool, 'messages' => [...]]
            $result = AuthService::login($email, $password);
        } catch (\Throwable $e) {
            static::logActivity("Login error for email: {$email} - " . $e->getMessage(), 'Auth');

            return [
                'success'  => false,
                'messages' => ['Unexpected error during login: ' . $e->getMessage()]
            ];
        }

        // --- Step 3: Handle authentication outcome ---
        if ($result['success']) {
            // Log successful login
            $userId = $_SESSION['user_id'] ?? null;
            static::logActivity('Successful login', 'Auth', $userId);

            $response = [
                'success'  => true,
                'messages' => ['Login successful. Redirecting...'],
                'redirect_url' => $result['redirect_url'] ?? '/dashboard'
            ];

            return $response;
        }

        // Log specific failure (Unverified vs Invalid)
        $isUnverified = $result['unverified'] ?? false;
        $logMessage = $isUnverified
            ? "Failed login attempt (Unverified) for email: {$email}"
            : "Failed login attempt (Invalid credentials) for email: {$email}";

        static::logActivity($logMessage, 'Auth');

        // We return the $result exactly as the Service provided it
        // This ensures the 'unverified' flag reaches our JS LoginModal.
        return $result;
    }

    /**
     * Handles logout requests.
     * @return array
     */
    public static function logout(): array
    {
        try {
            $userId = $_SESSION['user_id'] ?? null;
            AuthService::logout();

            // Log the logout event
            static::logActivity('User logged out', 'Auth', $userId);

            return [
                'success'  => true,
                'messages' => ['You have been successfully logged out.']
            ];
        } catch (\Throwable $e) {
            // Log unexpected error during logout
            static::logActivity('Logout error: ' . $e->getMessage(), 'Auth');

            return [
                'success'  => false,
                'messages' => ['Error while logging out: ' . $e->getMessage()]
            ];
        }
    }

    /**
     * Finalizes the password reset process
     */
    public static function resetPassword(array $input): array
    {
        $email = $input['email'] ?? '';
        $token = $input['token'] ?? '';
        $password = $input['password'] ?? '';
        $passwordConfirmation = $input['password_confirmation'] ?? '';

        // 1. Basic Validation
        if (empty($email) || empty($token) || empty($password)) {
            return [
                'success' => false,
                'messages' => ['Missing required information.']
            ];
        }

        if ($password !== $passwordConfirmation) {
            return [
                'success' => false,
                'messages' => ['Passwords do not match.']
            ];
        }

        if (strlen($password) < 8) {
            return [
                'success' => false,
                'messages' => ['Password must be at least 8 characters long.']
            ];
        }

        try {
            // 2. Find the reset record
            $resetRecord = PasswordReset::where('email', $email)->first();

            if (!$resetRecord) {
                return [
                    'success' => false,
                    'messages' => ['Invalid or expired reset request.']
                ];
            }

            // 3. Verify Token and Expiry
            if (!password_verify($token, $resetRecord->token)) {
                return [
                    'success' => false,
                    'messages' => ['Invalid token.']
                ];
            }

            if ($resetRecord->isExpired(60)) {
                $resetRecord->delete(); // Cleanup expired token
                return [
                    'success' => false,
                    'messages' => ['Reset link has expired. Please request a new one.']
                ];
            }

            // 4. Update the User
            $user = User::where('email', $email)->first();
            if (!$user) {
                return [
                    'success' => false,
                    'messages' => ['User account not found.']
                ];
            }

            $user->password = password_hash($password, PASSWORD_DEFAULT);
            $user->save();

            // 5. Cleanup: Remove the reset token so it can't be used again
            $resetRecord->delete();

            static::logActivity("Password updated via reset link", 'Auth', $user->id);

            return [
                'success' => true,
                'message' => 'Your password has been reset successfully.'
            ];
        } catch (\Exception $e) {
            static::logActivity("Reset Password Error: " . $e->getMessage(), 'Auth');
            return [
                'success' => false,
                'messages' => ['An unexpected error occurred. Please try again later.']
            ];
        }
    }
}
