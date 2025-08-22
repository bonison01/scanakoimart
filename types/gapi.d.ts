// src/types/gapi.d.ts

// Original declare global block
declare global {
    const gapi: any;
    namespace google {
        namespace accounts {
            namespace oauth2 {
                interface TokenResponse {
                    access_token: string;
                    expires_in: number;
                    scope: string;
                    token_type: string;
                    error?: string;
                    error_description?: string;
                    error_uri?: string;
                }
                interface TokenClientConfig {
                    client_id: string;
                    scope: string;
                    callback: (tokenResponse: TokenResponse) => void;
                }
                interface OverridableTokenClientConfig {
                    prompt: string;
                }
                interface TokenClient {
                    requestAccessToken: (overrideConfig?: OverridableTokenClientConfig) => void;
                }
                function initTokenClient(config: TokenClientConfig): TokenClient;
            }
        }
    }
}

// Extend the global Window interface
declare global {
    interface Window {
        gapi: any; // Use 'any' or a more specific type if available
        google: typeof google;
    }
}

export {};