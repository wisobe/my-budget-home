<?php
/**
 * TOTP (Time-based One-Time Password) Helper
 * RFC 6238 compliant implementation using PHP's hash_hmac.
 * No external dependencies required.
 */

class TOTP {
    private const PERIOD = 30;       // seconds
    private const DIGITS = 6;
    private const ALGORITHM = 'sha1';
    private const SECRET_LENGTH = 20; // bytes (160 bits)

    /**
     * Generate a random Base32-encoded secret.
     */
    public static function generateSecret(): string {
        $bytes = random_bytes(self::SECRET_LENGTH);
        return self::base32Encode($bytes);
    }

    /**
     * Verify a TOTP code against a secret.
     * Allows ±1 time-step window to account for clock drift.
     */
    public static function verify(string $secret, string $code, int $window = 1): bool {
        $code = str_pad($code, self::DIGITS, '0', STR_PAD_LEFT);
        $timeStep = intdiv(time(), self::PERIOD);

        for ($i = -$window; $i <= $window; $i++) {
            if (hash_equals(self::generateCode($secret, $timeStep + $i), $code)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Generate the otpauth:// URI for QR code generation.
     */
    public static function getOtpAuthUri(string $secret, string $email, string $issuer = 'BudgetWise'): string {
        $params = http_build_query([
            'secret' => $secret,
            'issuer' => $issuer,
            'algorithm' => strtoupper(self::ALGORITHM),
            'digits' => self::DIGITS,
            'period' => self::PERIOD,
        ]);
        $label = rawurlencode($issuer) . ':' . rawurlencode($email);
        return "otpauth://totp/{$label}?{$params}";
    }

    /**
     * Generate one-time recovery codes.
     */
    public static function generateRecoveryCodes(int $count = 8): array {
        $codes = [];
        for ($i = 0; $i < $count; $i++) {
            // Format: XXXX-XXXX (8 hex chars with dash)
            $codes[] = strtoupper(bin2hex(random_bytes(2))) . '-' . strtoupper(bin2hex(random_bytes(2)));
        }
        return $codes;
    }

    // ---- Internal methods ----

    private static function generateCode(string $base32Secret, int $timeStep): string {
        $secretBytes = self::base32Decode($base32Secret);
        $timeBytes = pack('J', $timeStep); // 8-byte big-endian

        $hash = hash_hmac(self::ALGORITHM, $timeBytes, $secretBytes, true);
        $offset = ord($hash[strlen($hash) - 1]) & 0x0F;
        $binary = (
            ((ord($hash[$offset]) & 0x7F) << 24) |
            ((ord($hash[$offset + 1]) & 0xFF) << 16) |
            ((ord($hash[$offset + 2]) & 0xFF) << 8) |
            (ord($hash[$offset + 3]) & 0xFF)
        );
        $otp = $binary % (10 ** self::DIGITS);
        return str_pad((string)$otp, self::DIGITS, '0', STR_PAD_LEFT);
    }

    private static function base32Encode(string $data): string {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $binary = '';
        foreach (str_split($data) as $char) {
            $binary .= str_pad(decbin(ord($char)), 8, '0', STR_PAD_LEFT);
        }
        $result = '';
        foreach (str_split($binary, 5) as $chunk) {
            $chunk = str_pad($chunk, 5, '0', STR_PAD_RIGHT);
            $result .= $alphabet[bindec($chunk)];
        }
        return $result;
    }

    private static function base32Decode(string $data): string {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $data = strtoupper(rtrim($data, '='));
        $binary = '';
        foreach (str_split($data) as $char) {
            $pos = strpos($alphabet, $char);
            if ($pos === false) continue;
            $binary .= str_pad(decbin($pos), 5, '0', STR_PAD_LEFT);
        }
        $result = '';
        foreach (str_split($binary, 8) as $byte) {
            if (strlen($byte) < 8) break;
            $result .= chr(bindec($byte));
        }
        return $result;
    }
}
