/**
 * VoyagerClient - LinkedIn Voyager API Client
 *
 * Handles all HTTP requests to LinkedIn's Voyager API with proper error handling,
 * authentication, and retry logic.
 */

import { VOYAGER_BASE_URL, VOYAGER_ENDPOINTS, buildVoyagerUrl, replaceEndpointPlaceholders } from './endpoints';
import { getCookie } from '../utilities';

export interface VoyagerClientOptions {
    debug?: boolean;
    maxRetries?: number;
    retryDelayMs?: number;
}

export interface FetchOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
}

/**
 * Error thrown when a Voyager API request fails
 */
export class VoyagerAPIError extends Error {
    constructor(
        message: string,
        public statusCode: number,
        public endpoint: string,
        public response?: any
    ) {
        super(message);
        this.name = 'VoyagerAPIError';
    }
}

/**
 * Error thrown when rate limited by LinkedIn
 */
export class RateLimitError extends VoyagerAPIError {
    constructor(
        endpoint: string,
        public retryAfter?: number
    ) {
        super(`Rate limited on ${endpoint}`, 429, endpoint);
        this.name = 'RateLimitError';
    }
}

/**
 * Client for interacting with LinkedIn's Voyager API
 *
 * Handles authentication, request formatting, error handling, and retries.
 *
 * @example
 * ```typescript
 * const client = new VoyagerClient({ debug: true });
 * const profile = await client.fetchProfile('john-doe');
 * ```
 */
export class VoyagerClient {
    private debug: boolean;

    private maxRetries: number;

    private retryDelayMs: number;

    private csrfToken: string | null = null;

    constructor(options: VoyagerClientOptions = {}) {
        this.debug = options.debug ?? false;
        this.maxRetries = options.maxRetries ?? 3;
        this.retryDelayMs = options.retryDelayMs ?? 1000;
        this.csrfToken = this.extractCSRFToken();
    }

    /**
     * Extract CSRF token from cookies
     * Required for authenticated requests to LinkedIn
     */
    private extractCSRFToken(): string | null {
        const jsessionid = getCookie('JSESSIONID');
        if (!jsessionid) {
            this.log('warn', 'No JSESSIONID cookie found');
            return null;
        }
        // Remove quotes if present
        return jsessionid.replace(/"/g, '');
    }

    /**
     * Log messages if debug mode is enabled
     */
    private log(level: 'log' | 'warn' | 'error', ...args: any[]): void {
        if (this.debug) {
            console[level]('[VoyagerClient]', ...args);
        }
    }

    /**
     * Sleep for specified milliseconds (for retry delays)
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Build request headers for Voyager API
     */
    private buildHeaders(customHeaders?: Record<string, string>): Record<string, string> {
        const headers: Record<string, string> = {
            accept: 'application/vnd.linkedin.normalized+json+2.1',
            'x-restli-protocol-version': '2.0.0',
            ...customHeaders
        };

        if (this.csrfToken) {
            headers['csrf-token'] = this.csrfToken;
        }

        return headers;
    }

    /**
     * Make a request to the Voyager API with retry logic
     */
    private async fetchWithRetry(url: string, options: FetchOptions = {}, attempt: number = 0): Promise<any> {
        try {
            const response = await fetch(url, {
                method: options.method || 'GET',
                headers: this.buildHeaders(options.headers),
                body: options.body,
                credentials: 'include',
                mode: 'cors'
            });

            this.log('log', `${options.method || 'GET'} ${url} - Status: ${response.status}`);

            // Handle rate limiting
            if (response.status === 429) {
                const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
                throw new RateLimitError(url, retryAfter);
            }

            // Handle other HTTP errors
            if (!response.ok) {
                const errorText = await response.text();
                throw new VoyagerAPIError(`HTTP ${response.status}: ${response.statusText}`, response.status, url, errorText);
            }

            return await response.json();
        } catch (error) {
            // If it's a rate limit or non-retryable error, throw immediately
            if (error instanceof RateLimitError || (error instanceof VoyagerAPIError && error.statusCode < 500)) {
                throw error;
            }

            // Retry on network errors or 5xx server errors
            if (attempt < this.maxRetries) {
                const delay = this.retryDelayMs * 2 ** attempt; // Exponential backoff
                this.log('warn', `Request failed, retrying in ${delay}ms... (attempt ${attempt + 1}/${this.maxRetries})`);
                await this.sleep(delay);
                return this.fetchWithRetry(url, options, attempt + 1);
            }

            // Max retries exceeded
            throw error;
        }
    }

    /**
     * Fetch a profile using the Dash endpoint (primary method)
     *
     * @param profileId - LinkedIn profile ID (e.g., "john-doe")
     * @returns Profile data from LinkedIn API
     */
    async fetchProfile(profileId: string): Promise<any> {
        const endpoint = replaceEndpointPlaceholders(VOYAGER_ENDPOINTS.dash.fullProfile.path, { profileId });
        const url = `${VOYAGER_BASE_URL}${endpoint}`;

        this.log('log', 'Fetching profile:', profileId);
        return this.fetchWithRetry(url);
    }

    /**
     * Fetch profile using legacy profileView endpoint (deprecated, returns 410)
     * Kept for backward compatibility testing
     */
    async fetchProfileLegacy(profileId: string): Promise<any> {
        const endpoint = replaceEndpointPlaceholders(VOYAGER_ENDPOINTS.fullProfileView, { profileId });
        const url = `${VOYAGER_BASE_URL}${endpoint}`;

        this.log('warn', 'Using deprecated profileView endpoint');
        return this.fetchWithRetry(url);
    }

    /**
     * Fetch contact information for a profile
     */
    async fetchContactInfo(profileId: string): Promise<any> {
        const endpoint = replaceEndpointPlaceholders(VOYAGER_ENDPOINTS.contactInfo, { profileId });
        const url = `${VOYAGER_BASE_URL}${endpoint}`;

        this.log('log', 'Fetching contact info:', profileId);
        return this.fetchWithRetry(url);
    }

    /**
     * Fetch skills for a profile
     */
    async fetchSkills(profileId: string): Promise<any> {
        const endpoint = replaceEndpointPlaceholders(VOYAGER_ENDPOINTS.fullSkills, { profileId });
        const url = `${VOYAGER_BASE_URL}${endpoint}`;

        this.log('log', 'Fetching skills:', profileId);
        return this.fetchWithRetry(url);
    }

    /**
     * Fetch position groups (work experience) using Dash endpoint
     */
    async fetchPositionGroups(profileUrnId: string): Promise<any> {
        const endpoint = replaceEndpointPlaceholders(VOYAGER_ENDPOINTS.dash.profilePositionGroups.path, { profileUrnId });
        const url = `${VOYAGER_BASE_URL}${endpoint}`;

        this.log('log', 'Fetching position groups:', profileUrnId);
        return this.fetchWithRetry(url);
    }

    /**
     * Fetch volunteer experiences using Dash endpoint
     */
    async fetchVolunteerExperiences(profileUrnId: string): Promise<any> {
        const endpoint = replaceEndpointPlaceholders(VOYAGER_ENDPOINTS.dash.profileVolunteerExperiences, { profileUrnId });
        const url = `${VOYAGER_BASE_URL}${endpoint}`;

        this.log('log', 'Fetching volunteer experiences:', profileUrnId);
        return this.fetchWithRetry(url);
    }

    /**
     * Generic fetch method for any Voyager endpoint
     *
     * @param endpoint - Full endpoint path (can include placeholders)
     * @param params - Parameters for placeholder replacement
     * @param options - Additional fetch options
     */
    async fetch(endpoint: string, params?: Record<string, string>, options?: FetchOptions): Promise<any> {
        const processedEndpoint = params ? replaceEndpointPlaceholders(endpoint, params) : endpoint;

        const url = `${VOYAGER_BASE_URL}${processedEndpoint}`;

        this.log('log', 'Fetching:', processedEndpoint);
        return this.fetchWithRetry(url, options);
    }

    /**
     * Check if a profile exists by attempting to fetch it
     * Returns true if profile exists, false otherwise
     */
    async profileExists(profileId: string): Promise<boolean> {
        try {
            await this.fetchProfile(profileId);
            return true;
        } catch (error) {
            if (error instanceof VoyagerAPIError && error.statusCode === 404) {
                return false;
            }
            // For other errors, we can't determine existence
            throw error;
        }
    }
}
