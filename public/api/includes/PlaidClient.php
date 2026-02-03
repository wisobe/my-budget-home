<?php
/**
 * Plaid API Client
 * Handles all communication with Plaid API
 */

class PlaidClient {
    private string $clientId;
    private string $secret;
    private string $environment;
    private array $countryCode;
    private array $products;
    
    private const ENVIRONMENTS = [
        'sandbox'     => 'https://sandbox.plaid.com',
        'development' => 'https://development.plaid.com',
        'production'  => 'https://production.plaid.com',
    ];

    public function __construct(array $config) {
        $this->clientId = $config['client_id'];
        $this->secret = $config['secret'];
        $this->environment = $config['environment'] ?? 'sandbox';
        $this->countryCode = $config['country_codes'] ?? ['CA'];
        $this->products = $config['products'] ?? ['transactions'];
    }

    private function getBaseUrl(): string {
        return self::ENVIRONMENTS[$this->environment] ?? self::ENVIRONMENTS['sandbox'];
    }

    private function request(string $endpoint, array $data): array {
        $url = $this->getBaseUrl() . $endpoint;
        
        $payload = array_merge($data, [
            'client_id' => $this->clientId,
            'secret' => $this->secret,
        ]);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
            ],
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_TIMEOUT => 30,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new Exception('Plaid API request failed: ' . $error);
        }

        $result = json_decode($response, true);

        if ($httpCode >= 400) {
            $errorMessage = $result['error_message'] ?? 'Unknown error';
            $errorCode = $result['error_code'] ?? 'UNKNOWN';
            throw new Exception("Plaid API error [{$errorCode}]: {$errorMessage}");
        }

        return $result;
    }

    /**
     * Create a Link token for Plaid Link initialization
     */
    public function createLinkToken(string $userId): array {
        return $this->request('/link/token/create', [
            'user' => ['client_user_id' => $userId],
            'client_name' => 'BudgetWise',
            'products' => $this->products,
            'country_codes' => $this->countryCode,
            'language' => 'en',
        ]);
    }

    /**
     * Exchange a public token for an access token
     */
    public function exchangePublicToken(string $publicToken): array {
        return $this->request('/item/public_token/exchange', [
            'public_token' => $publicToken,
        ]);
    }

    /**
     * Get account information
     */
    public function getAccounts(string $accessToken): array {
        return $this->request('/accounts/get', [
            'access_token' => $accessToken,
        ]);
    }

    /**
     * Sync transactions using the new sync endpoint
     */
    public function syncTransactions(string $accessToken, ?string $cursor = null): array {
        $data = ['access_token' => $accessToken];
        if ($cursor) {
            $data['cursor'] = $cursor;
        }
        return $this->request('/transactions/sync', $data);
    }

    /**
     * Get institution details
     */
    public function getInstitution(string $institutionId): array {
        return $this->request('/institutions/get_by_id', [
            'institution_id' => $institutionId,
            'country_codes' => $this->countryCode,
        ]);
    }

    /**
     * Remove an Item (disconnect a bank)
     */
    public function removeItem(string $accessToken): array {
        return $this->request('/item/remove', [
            'access_token' => $accessToken,
        ]);
    }

    /**
     * Get Item status
     */
    public function getItem(string $accessToken): array {
        return $this->request('/item/get', [
            'access_token' => $accessToken,
        ]);
    }
}
