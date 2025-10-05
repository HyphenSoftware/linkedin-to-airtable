import { VoyagerClient, VoyagerAPIError, RateLimitError } from '../../src/api/voyager-client';
import * as utilities from '../../src/utilities';

// Mock the utilities module
jest.mock('../../src/utilities', () => ({
    getCookie: jest.fn()
}));

describe('VoyagerClient', () => {
    let client: VoyagerClient;
    let mockFetch: jest.Mock;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Mock getCookie to return a test token
        (utilities.getCookie as jest.Mock).mockReturnValue('"test-csrf-token"');

        // Mock global fetch
        mockFetch = jest.fn();
        global.fetch = mockFetch;

        // Create client instance
        client = new VoyagerClient({ debug: false });
    });

    describe('Constructor', () => {
        it('should create instance with default options', () => {
            const c = new VoyagerClient();
            expect(c).toBeInstanceOf(VoyagerClient);
        });

        it('should accept debug option', () => {
            const c = new VoyagerClient({ debug: true });
            expect(c).toBeInstanceOf(VoyagerClient);
        });

        it('should accept maxRetries option', () => {
            const c = new VoyagerClient({ maxRetries: 5 });
            expect(c).toBeInstanceOf(VoyagerClient);
        });

        it('should extract CSRF token on creation', () => {
            expect(utilities.getCookie).toHaveBeenCalledWith('JSESSIONID');
        });
    });

    describe('fetchProfile', () => {
        it('should fetch profile successfully', async () => {
            const mockResponse = {
                data: { profile: 'test' },
                included: []
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockResponse,
                headers: new Headers()
            });

            const result = await client.fetchProfile('john-doe');

            expect(result).toEqual(mockResponse);
            expect(mockFetch).toHaveBeenCalledTimes(1);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('memberIdentity=john-doe'),
                expect.objectContaining({
                    method: 'GET',
                    credentials: 'include'
                })
            );
        });

        it('should include CSRF token in headers', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({}),
                headers: new Headers()
            });

            await client.fetchProfile('john-doe');

            const fetchCall = mockFetch.mock.calls[0];
            const { headers } = fetchCall[1];
            expect(headers['csrf-token']).toBe('test-csrf-token');
        });

        it('should throw VoyagerAPIError on HTTP error', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                text: async () => 'Profile not found',
                headers: new Headers()
            });

            await expect(client.fetchProfile('nonexistent')).rejects.toThrow(VoyagerAPIError);
        });

        it('should throw RateLimitError on 429 status', async () => {
            const headers = new Headers();
            headers.set('Retry-After', '120');

            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests',
                headers
            });

            await expect(client.fetchProfile('john-doe')).rejects.toThrow(RateLimitError);
        });
    });

    describe('Retry Logic', () => {
        it('should retry on network errors', async () => {
            const client = new VoyagerClient({ maxRetries: 2, retryDelayMs: 10 });

            // Fail twice, then succeed
            mockFetch
                .mockRejectedValueOnce(new Error('Network error'))
                .mockRejectedValueOnce(new Error('Network error'))
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async () => ({ data: 'success' }),
                    headers: new Headers()
                });

            const result = await client.fetchProfile('john-doe');

            expect(result).toEqual({ data: 'success' });
            expect(mockFetch).toHaveBeenCalledTimes(3);
        });

        it('should not retry on 4xx errors', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                text: async () => 'Not found',
                headers: new Headers()
            });

            await expect(client.fetchProfile('john-doe')).rejects.toThrow();
            expect(mockFetch).toHaveBeenCalledTimes(1);
        });

        it('should retry on 5xx errors', async () => {
            const client = new VoyagerClient({ maxRetries: 1, retryDelayMs: 10 });

            mockFetch
                .mockResolvedValueOnce({
                    ok: false,
                    status: 500,
                    statusText: 'Internal Server Error',
                    text: async () => 'Server error',
                    headers: new Headers()
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async () => ({ data: 'success' }),
                    headers: new Headers()
                });

            const result = await client.fetchProfile('john-doe');
            expect(result).toEqual({ data: 'success' });
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });

        it('should throw after max retries exceeded', async () => {
            const client = new VoyagerClient({ maxRetries: 2, retryDelayMs: 1 });

            mockFetch.mockRejectedValue(new Error('Network error'));

            await expect(client.fetchProfile('john-doe')).rejects.toThrow('Network error');
            expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
        });
    });

    describe('fetchContactInfo', () => {
        it('should fetch contact info successfully', async () => {
            const mockResponse = { email: 'test@example.com' };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockResponse,
                headers: new Headers()
            });

            const result = await client.fetchContactInfo('john-doe');

            expect(result).toEqual(mockResponse);
            expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/profileContactInfo'), expect.any(Object));
        });
    });

    describe('fetchSkills', () => {
        it('should fetch skills successfully', async () => {
            const mockResponse = { skills: ['JavaScript', 'TypeScript'] };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockResponse,
                headers: new Headers()
            });

            const result = await client.fetchSkills('john-doe');

            expect(result).toEqual(mockResponse);
            expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/skillCategory'), expect.any(Object));
        });
    });

    describe('fetchPositionGroups', () => {
        it('should fetch position groups successfully', async () => {
            const mockResponse = { positions: [] };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockResponse,
                headers: new Headers()
            });

            const result = await client.fetchPositionGroups('ABC123');

            expect(result).toEqual(mockResponse);
            expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('profilePositionGroups'), expect.any(Object));
        });
    });

    describe('fetchVolunteerExperiences', () => {
        it('should fetch volunteer experiences successfully', async () => {
            const mockResponse = { volunteering: [] };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockResponse,
                headers: new Headers()
            });

            const result = await client.fetchVolunteerExperiences('ABC123');

            expect(result).toEqual(mockResponse);
            expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('profileVolunteerExperiences'), expect.any(Object));
        });
    });

    describe('Generic fetch', () => {
        it('should fetch any endpoint', async () => {
            const mockResponse = { data: 'test' };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => mockResponse,
                headers: new Headers()
            });

            const result = await client.fetch('/test/endpoint');

            expect(result).toEqual(mockResponse);
            expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/test/endpoint'), expect.any(Object));
        });

        it('should replace placeholders in endpoint', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({}),
                headers: new Headers()
            });

            await client.fetch('/test/{id}/data', { id: '123' });

            expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/test/123/data'), expect.any(Object));
        });
    });

    describe('profileExists', () => {
        it('should return true if profile exists', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ data: {} }),
                headers: new Headers()
            });

            const exists = await client.profileExists('john-doe');
            expect(exists).toBe(true);
        });

        it('should return false if profile returns 404', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                text: async () => 'Not found',
                headers: new Headers()
            });

            const exists = await client.profileExists('nonexistent');
            expect(exists).toBe(false);
        });

        it('should throw on other errors', async () => {
            // Use a client with 0 retries for this test to avoid timeout
            const clientNoRetry = new VoyagerClient({ maxRetries: 0, retryDelayMs: 1 });

            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
                text: async () => 'Server error',
                headers: new Headers()
            });

            await expect(clientNoRetry.profileExists('john-doe')).rejects.toThrow();
        });
    });

    describe('Error Handling', () => {
        it('should create VoyagerAPIError with correct properties', () => {
            const error = new VoyagerAPIError('Test error', 404, '/test/endpoint', 'response data');

            expect(error.message).toBe('Test error');
            expect(error.statusCode).toBe(404);
            expect(error.endpoint).toBe('/test/endpoint');
            expect(error.response).toBe('response data');
            expect(error.name).toBe('VoyagerAPIError');
        });

        it('should create RateLimitError with retry info', () => {
            const error = new RateLimitError('/test/endpoint', 120);

            expect(error.statusCode).toBe(429);
            expect(error.endpoint).toBe('/test/endpoint');
            expect(error.retryAfter).toBe(120);
            expect(error.name).toBe('RateLimitError');
        });
    });

    describe('CSRF Token Handling', () => {
        it('should handle missing CSRF token', () => {
            (utilities.getCookie as jest.Mock).mockReturnValue(null);

            const client = new VoyagerClient();
            expect(client).toBeInstanceOf(VoyagerClient);
        });

        it('should remove quotes from CSRF token', () => {
            (utilities.getCookie as jest.Mock).mockReturnValue('"token-with-quotes"');

            mockFetch.mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({}),
                headers: new Headers()
            });

            const client = new VoyagerClient();
            client.fetchProfile('test');

            // Check that quotes were removed
            const { headers } = mockFetch.mock.calls[0][1];
            expect(headers['csrf-token']).toBe('token-with-quotes');
        });
    });
});
