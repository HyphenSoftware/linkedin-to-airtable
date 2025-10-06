/**
 * Profile/Basics Parser
 *
 * Parses LinkedIn profile basics (name, headline, location, summary, etc.)
 * and transforms them into JSON Resume format.
 */

import { noNullOrUndef } from '../utilities';

/**
 * LinkedIn profile entity
 */
export interface LiProfile {
    $type?: `com.linkedin.${string}`;
    firstName?: string;
    lastName?: string;
    headline?: string;
    summary?: string;
    address?: string;
    locationName?: string;
    publicIdentifier?: string;
    picture?: string;
    defaultLocale?: {
        country?: string;
        language?: string;
    };
    primaryLocale?: {
        country?: string;
        language?: string;
    };
    [key: string]: any;
}

/**
 * LinkedIn locale information
 */
export interface LiLocale {
    country?: string;
    language?: string;
}

/**
 * JSON Resume basics section (legacy format)
 */
export interface ResumeBasicsLegacy {
    name: string;
    label: string;
    image?: string;
    email?: string;
    phone?: string;
    url?: string;
    summary: string;
    location: {
        address?: string;
        postalCode?: string;
        city?: string;
        countryCode: string;
        region?: string;
    };
    profiles: Array<{
        network: string;
        username: string;
        url: string;
    }>;
}

/**
 * JSON Resume basics section (stable format)
 */
export interface ResumeBasicsStable {
    name: string;
    label: string;
    image?: string;
    email?: string;
    phone?: string;
    url?: string;
    summary: string;
    location: {
        address?: string;
        postalCode?: string;
        city?: string;
        countryCode: string;
        region?: string;
    };
    profiles: Array<{
        network: string;
        username: string;
        url: string;
    }>;
}

/**
 * JSON Resume language entry
 */
export interface ResumeLanguage {
    language: string;
    fluency: string;
}

/**
 * Parse LinkedIn profile basics into JSON Resume format
 *
 * @param profileObj - LinkedIn profile entity
 * @param useDashFormat - Whether using Dash endpoint (affects locale field name)
 * @returns Parsed basics in both legacy and stable formats
 *
 * @example
 * ```typescript
 * const profile = {
 *   firstName: 'John',
 *   lastName: 'Doe',
 *   headline: 'Software Engineer',
 *   summary: 'Experienced developer...'
 * };
 * const parsed = parseProfileBasics(profile);
 * ```
 */
export function parseProfileBasics(
    profileObj: LiProfile,
    useDashFormat: boolean = false
): {
    legacy: ResumeBasicsLegacy;
    stable: ResumeBasicsStable;
    locale: string;
} {
    // LinkedIn inconsistently names locale fields between endpoints
    const localeObject: LiLocale = useDashFormat ? profileObj.primaryLocale || {} : profileObj.defaultLocale || {};

    const formattedBasics = {
        name: `${profileObj.firstName || ''} ${profileObj.lastName || ''}`.trim(),
        label: noNullOrUndef(profileObj.headline),
        summary: noNullOrUndef(profileObj.summary),
        location: {
            countryCode: localeObject.country || '',
            address: undefined as string | undefined
        }
    };

    // Add address if available
    if (profileObj.address) {
        formattedBasics.location.address = noNullOrUndef(profileObj.address);
    } else if (profileObj.locationName) {
        formattedBasics.location.address = noNullOrUndef(profileObj.locationName);
    }

    // Create base structure for both formats
    const basicsLegacy: ResumeBasicsLegacy = {
        ...formattedBasics,
        location: formattedBasics.location,
        profiles: []
    };

    const basicsStable: ResumeBasicsStable = {
        ...formattedBasics,
        location: formattedBasics.location,
        profiles: []
    };

    // Construct locale string
    const localeStr = `${localeObject.language || 'en'}_${localeObject.country || 'US'}`;

    return {
        legacy: basicsLegacy,
        stable: basicsStable,
        locale: localeStr
    };
}

/**
 * Parse primary language from profile locale
 *
 * @param profileObj - LinkedIn profile entity
 * @param useDashFormat - Whether using Dash endpoint
 * @returns Language entry for JSON Resume
 */
export function parseProfileLanguage(profileObj: LiProfile, useDashFormat: boolean = false): ResumeLanguage {
    const localeObject: LiLocale = useDashFormat ? profileObj.primaryLocale || {} : profileObj.defaultLocale || {};

    const languageCode = localeObject.language?.toLowerCase() || 'en';
    const languageName = languageCode === 'en' ? 'English' : localeObject.language || 'English';

    return {
        language: languageName,
        fluency: 'Native Speaker'
    };
}

/**
 * Extract LinkedIn profile URL from public identifier
 *
 * @param publicIdentifier - LinkedIn public identifier (e.g., "john-doe")
 * @returns Full LinkedIn profile URL
 */
export function buildLinkedInProfileUrl(publicIdentifier?: string): string {
    if (!publicIdentifier) return '';
    return `https://www.linkedin.com/in/${publicIdentifier}`;
}

/**
 * Add social profile to basics
 *
 * @param basics - Basics object to modify
 * @param network - Social network name (e.g., "LinkedIn", "GitHub")
 * @param username - Username on the network
 * @param url - Full URL to profile
 */
export function addSocialProfile(basics: ResumeBasicsLegacy | ResumeBasicsStable, network: string, username: string, url: string): void {
    // Check if profile already exists (prevent duplicates)
    const exists = basics.profiles.some((p) => p.network.toLowerCase() === network.toLowerCase());

    if (!exists && username && url) {
        basics.profiles.push({
            network,
            username,
            url
        });
    }
}

/**
 * Parse full name into first and last name
 *
 * Useful for reverse parsing or validation
 *
 * @param fullName - Full name string
 * @returns Object with firstName and lastName
 */
export function parseFullName(fullName: string): { firstName: string; lastName: string } {
    if (!fullName) return { firstName: '', lastName: '' };

    const parts = fullName.trim().split(/\s+/);

    if (parts.length === 0) {
        return { firstName: '', lastName: '' };
    }
    if (parts.length === 1) {
        return { firstName: parts[0], lastName: '' };
    }
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');
    return { firstName, lastName };
}

/**
 * Validate basics object has required fields
 *
 * @param basics - Basics object to validate
 * @returns True if valid, false otherwise
 */
export function validateBasics(basics: ResumeBasicsLegacy | ResumeBasicsStable): boolean {
    // Name is required
    if (!basics.name || basics.name.trim().length === 0) {
        return false;
    }

    // Location with country code is required
    if (!basics.location || !basics.location.countryCode) {
        return false;
    }

    return true;
}

/**
 * Merge additional profile data into basics
 *
 * Useful for combining data from multiple sources
 *
 * @param target - Target basics object
 * @param source - Source basics object
 * @returns Merged basics object
 */
export function mergeBasics(target: ResumeBasicsLegacy | ResumeBasicsStable, source: Partial<ResumeBasicsLegacy | ResumeBasicsStable>): ResumeBasicsLegacy | ResumeBasicsStable {
    return {
        ...target,
        ...source,
        // Merge location deeply
        location: {
            ...target.location,
            ...(source.location || {})
        },
        // Merge profiles (deduplicate by network)
        profiles: [...target.profiles, ...(source.profiles || []).filter((sp) => !target.profiles.some((tp) => tp.network.toLowerCase() === sp.network.toLowerCase()))]
    };
}

/**
 * Sanitize basics data for security
 *
 * Removes potentially dangerous content
 *
 * @param basics - Basics object to sanitize
 * @returns Sanitized basics object
 */
export function sanitizeBasics(basics: ResumeBasicsLegacy | ResumeBasicsStable): ResumeBasicsLegacy | ResumeBasicsStable {
    // Remove HTML tags from text fields (including script content)
    const stripHtml = (text: string): string => {
        if (!text) return text;
        // First, remove script tags and their content
        let clean = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        // Then remove all other HTML tags
        clean = clean.replace(/<[^>]*>/g, '');
        return clean.trim();
    };

    return {
        ...basics,
        name: stripHtml(basics.name),
        label: stripHtml(basics.label || ''),
        summary: stripHtml(basics.summary || ''),
        location: {
            ...basics.location,
            address: stripHtml(basics.location.address || '')
        }
    };
}
