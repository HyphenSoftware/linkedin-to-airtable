/**
 * LinkedIn Voyager API Endpoint Configuration
 *
 * This module contains all endpoint definitions for the LinkedIn Voyager API.
 * Endpoints are organized by type and include templates for dynamic URL generation.
 */

export const VOYAGER_BASE_URL = 'https://www.linkedin.com/voyager/api';

export interface DashEndpoint {
    path: string;
    template: string;
    recipe: string;
}

export interface VoyagerEndpoints {
    following: string;
    followingCompanies: string;
    contactInfo: string;
    basicAboutMe: string;
    advancedAboutMe: string;
    fullProfileView: string;
    fullSkills: string;
    recommendations: string;
    dash: {
        profilePositionGroups: DashEndpoint;
        fullProfile: DashEndpoint;
        profileVolunteerExperiences: string;
    };
}

/**
 * LinkedIn Voyager API endpoints
 *
 * Note: Some endpoints are deprecated (e.g., fullProfileView returns 410 Gone as of Oct 2024)
 * The dash endpoints are the primary data source.
 */
export const VOYAGER_ENDPOINTS: VoyagerEndpoints = {
    // Legacy endpoints (some deprecated)
    following: '/identity/profiles/{profileId}/following',
    followingCompanies: '/identity/profiles/{profileId}/following?count=10&entityType=COMPANY&q=followedEntities',
    contactInfo: '/identity/profiles/{profileId}/profileContactInfo',
    basicAboutMe: '/me',
    advancedAboutMe: '/identity/profiles/{profileId}',

    // Deprecated as of October 2024 - returns 410 Gone
    fullProfileView: '/identity/profiles/{profileId}/profileView',

    fullSkills: '/identity/profiles/{profileId}/skillCategory',
    recommendations: '/identity/profiles/{profileId}/recommendations',

    // Dash endpoints (primary data source)
    dash: {
        profilePositionGroups: {
            path: '/identity/dash/profilePositionGroups?q=viewee&profileUrn=urn:li:fsd_profile:{profileUrnId}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfilePositionGroup-50',
            template: '/identity/dash/profilePositionGroups?q=viewee&profileUrn=urn:li:fsd_profile:{profileUrnId}&decorationId={decorationId}',
            recipe: 'com.linkedin.voyager.dash.deco.identity.profile.FullProfilePositionGroup'
        },
        fullProfile: {
            path: '/identity/dash/profiles?q=memberIdentity&memberIdentity={profileId}&decorationId=com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities-93',
            template: '/identity/dash/profiles?q=memberIdentity&memberIdentity={profileId}&decorationId={decorationId}',
            recipe: 'com.linkedin.voyager.dash.deco.identity.profile.FullProfileWithEntities'
        },
        profileVolunteerExperiences: '/identity/dash/profileVolunteerExperiences?q=viewee&profileUrn=urn:li:fsd_profile:{profileUrnId}'
    }
};

/**
 * Replaces placeholders in endpoint URLs with actual values
 *
 * @param endpoint - The endpoint URL template with placeholders like {profileId}
 * @param params - Object containing replacement values
 * @returns The endpoint URL with placeholders replaced
 *
 * @example
 * ```typescript
 * const url = replaceEndpointPlaceholders(
 *   '/identity/profiles/{profileId}/profileView',
 *   { profileId: 'johndoe' }
 * );
 * // Returns: '/identity/profiles/johndoe/profileView'
 * ```
 */
export function replaceEndpointPlaceholders(endpoint: string, params: Record<string, string>): string {
    let result = endpoint;

    Object.keys(params).forEach((key) => {
        const placeholder = `{${key}}`;
        result = result.replace(new RegExp(placeholder, 'g'), params[key]);
    });

    return result;
}

/**
 * Builds a full Voyager API URL
 *
 * @param endpoint - The endpoint path (can contain placeholders)
 * @param params - Optional parameters for placeholder replacement
 * @returns The complete URL
 */
export function buildVoyagerUrl(endpoint: string, params?: Record<string, string>): string {
    const processedEndpoint = params ? replaceEndpointPlaceholders(endpoint, params) : endpoint;

    return `${VOYAGER_BASE_URL}${processedEndpoint}`;
}
