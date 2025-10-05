import { VOYAGER_BASE_URL, VOYAGER_ENDPOINTS, replaceEndpointPlaceholders, buildVoyagerUrl } from '../../src/api/endpoints';

describe('API Endpoints', () => {
    describe('Constants', () => {
        it('should have correct base URL', () => {
            expect(VOYAGER_BASE_URL).toBe('https://www.linkedin.com/voyager/api');
        });

        it('should have all required endpoint definitions', () => {
            expect(VOYAGER_ENDPOINTS).toHaveProperty('following');
            expect(VOYAGER_ENDPOINTS).toHaveProperty('contactInfo');
            expect(VOYAGER_ENDPOINTS).toHaveProperty('dash.fullProfile');
            expect(VOYAGER_ENDPOINTS).toHaveProperty('dash.profilePositionGroups');
        });

        it('should have Dash endpoints with required properties', () => {
            expect(VOYAGER_ENDPOINTS.dash.fullProfile).toHaveProperty('path');
            expect(VOYAGER_ENDPOINTS.dash.fullProfile).toHaveProperty('template');
            expect(VOYAGER_ENDPOINTS.dash.fullProfile).toHaveProperty('recipe');
        });
    });

    describe('replaceEndpointPlaceholders', () => {
        it('should replace single placeholder', () => {
            const endpoint = '/identity/profiles/{profileId}/profileView';
            const result = replaceEndpointPlaceholders(endpoint, { profileId: 'johndoe' });
            expect(result).toBe('/identity/profiles/johndoe/profileView');
        });

        it('should replace multiple placeholders', () => {
            const endpoint = '/identity/profiles/{profileId}/items/{itemId}';
            const result = replaceEndpointPlaceholders(endpoint, {
                profileId: 'johndoe',
                itemId: '123'
            });
            expect(result).toBe('/identity/profiles/johndoe/items/123');
        });

        it('should replace multiple occurrences of same placeholder', () => {
            const endpoint = '/path/{id}/sub/{id}/end';
            const result = replaceEndpointPlaceholders(endpoint, { id: 'test' });
            expect(result).toBe('/path/test/sub/test/end');
        });

        it('should return unchanged string if no placeholders', () => {
            const endpoint = '/identity/profiles/profileView';
            const result = replaceEndpointPlaceholders(endpoint, { profileId: 'johndoe' });
            expect(result).toBe('/identity/profiles/profileView');
        });

        it('should handle empty params object', () => {
            const endpoint = '/identity/profiles/{profileId}/profileView';
            const result = replaceEndpointPlaceholders(endpoint, {});
            expect(result).toBe('/identity/profiles/{profileId}/profileView');
        });
    });

    describe('buildVoyagerUrl', () => {
        it('should build complete URL without params', () => {
            const endpoint = '/identity/profiles/me';
            const result = buildVoyagerUrl(endpoint);
            expect(result).toBe('https://www.linkedin.com/voyager/api/identity/profiles/me');
        });

        it('should build complete URL with params', () => {
            const endpoint = '/identity/profiles/{profileId}/profileView';
            const result = buildVoyagerUrl(endpoint, { profileId: 'johndoe' });
            expect(result).toBe('https://www.linkedin.com/voyager/api/identity/profiles/johndoe/profileView');
        });

        it('should handle complex Dash endpoints', () => {
            const endpoint = VOYAGER_ENDPOINTS.dash.fullProfile.path;
            const result = buildVoyagerUrl(endpoint, { profileId: 'test-user' });
            expect(result).toContain('https://www.linkedin.com/voyager/api');
            expect(result).toContain('memberIdentity=test-user');
        });

        it('should handle profileUrnId replacement', () => {
            const endpoint = '/identity/dash/profilePositionGroups?profileUrn=urn:li:fsd_profile:{profileUrnId}';
            const result = buildVoyagerUrl(endpoint, { profileUrnId: 'ABC123' });
            expect(result).toContain('profileUrn=urn:li:fsd_profile:ABC123');
        });
    });

    describe('Endpoint Structure', () => {
        it('should have consistent Dash endpoint structure', () => {
            const dashEndpoints = [VOYAGER_ENDPOINTS.dash.fullProfile, VOYAGER_ENDPOINTS.dash.profilePositionGroups];

            dashEndpoints.forEach((endpoint) => {
                expect(endpoint).toHaveProperty('path');
                expect(endpoint).toHaveProperty('template');
                expect(endpoint).toHaveProperty('recipe');
                expect(typeof endpoint.path).toBe('string');
                expect(typeof endpoint.template).toBe('string');
                expect(typeof endpoint.recipe).toBe('string');
            });
        });

        it('should have valid recipe names', () => {
            expect(VOYAGER_ENDPOINTS.dash.fullProfile.recipe).toContain('com.linkedin.voyager.dash');
            expect(VOYAGER_ENDPOINTS.dash.profilePositionGroups.recipe).toContain('com.linkedin.voyager.dash');
        });
    });
});
