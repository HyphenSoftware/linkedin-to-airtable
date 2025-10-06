/**
 * Volunteer Experience Parser
 *
 * Parses LinkedIn volunteer experience data and transforms it into JSON Resume format.
 */

import { noNullOrUndef, parseAndAttachResumeDates, companyLiPageFromCompanyUrn } from '../utilities';

/**
 * LinkedIn volunteer experience entity
 */
export interface LiVolunteerExperience {
    $type?: `com.linkedin.${string}`;
    companyName?: string;
    role?: string;
    description?: string;
    companyUrn?: string;
    cause?: string;
    timePeriod?: {
        startDate?: { year?: number; month?: number };
        endDate?: { year?: number; month?: number };
    };
    [key: string]: any;
}

/**
 * Minimal internal database interface for volunteer parser
 */
export interface VolunteerParserDb {
    entitiesByUrn: Record<string, any>;
}

/**
 * JSON Resume volunteer entry (legacy format)
 */
export interface ResumeVolunteerLegacy {
    organization: string;
    position: string;
    website: string;
    startDate: string;
    endDate: string;
    summary: string;
    highlights: string[];
}

/**
 * JSON Resume volunteer entry (stable format)
 */
export interface ResumeVolunteerStable {
    organization: string;
    position: string;
    url: string;
    startDate: string;
    endDate: string;
    summary: string;
    highlights: string[];
}

/**
 * Parse a LinkedIn volunteer experience object into JSON Resume format
 *
 * @param volunteerObj - LinkedIn volunteer experience entity
 * @param db - Internal database for looking up related entities
 * @returns Parsed volunteer entry in both legacy and stable formats
 *
 * @example
 * ```typescript
 * const volunteer = {
 *   companyName: 'Red Cross',
 *   role: 'Volunteer Coordinator',
 *   description: 'Organized community events',
 *   cause: 'Health'
 * };
 * const parsed = parseVolunteerExperience(volunteer, db);
 * ```
 */
export function parseVolunteerExperience(volunteerObj: LiVolunteerExperience, db: VolunteerParserDb): { legacy: ResumeVolunteerLegacy; stable: ResumeVolunteerStable } {
    // Parse legacy format
    const parsedVolunteerLegacy: ResumeVolunteerLegacy = {
        organization: volunteerObj.companyName || '',
        position: volunteerObj.role || '',
        website: companyLiPageFromCompanyUrn(volunteerObj.companyUrn, db as any),
        startDate: '',
        endDate: '',
        summary: volunteerObj.description || '',
        highlights: []
    };

    // Attach dates
    parseAndAttachResumeDates(parsedVolunteerLegacy, volunteerObj as any);

    // Parse stable format (uses 'url' instead of 'website')
    const parsedVolunteerStable: ResumeVolunteerStable = {
        organization: parsedVolunteerLegacy.organization,
        position: parsedVolunteerLegacy.position,
        url: parsedVolunteerLegacy.website,
        startDate: parsedVolunteerLegacy.startDate,
        endDate: parsedVolunteerLegacy.endDate,
        summary: parsedVolunteerLegacy.summary,
        highlights: parsedVolunteerLegacy.highlights
    };

    return {
        legacy: parsedVolunteerLegacy,
        stable: parsedVolunteerStable
    };
}

/**
 * Parse multiple volunteer experience entries
 *
 * @param volunteerArray - Array of LinkedIn volunteer experience entities
 * @param db - Internal database
 * @returns Arrays of parsed volunteer entries (legacy and stable formats)
 */
export function parseVolunteerExperienceList(
    volunteerArray: LiVolunteerExperience[],
    db: VolunteerParserDb
): {
    legacy: ResumeVolunteerLegacy[];
    stable: ResumeVolunteerStable[];
} {
    const legacy: ResumeVolunteerLegacy[] = [];
    const stable: ResumeVolunteerStable[] = [];

    volunteerArray.forEach((volunteer) => {
        const parsed = parseVolunteerExperience(volunteer, db);
        legacy.push(parsed.legacy);
        stable.push(parsed.stable);
    });

    return { legacy, stable };
}

/**
 * Extract causes/categories from volunteer experiences
 *
 * Useful for grouping volunteer work by cause or creating a summary
 *
 * @param volunteerArray - Array of volunteer experiences
 * @returns Array of unique causes
 *
 * @example
 * ```typescript
 * const volunteers = [
 *   { companyName: 'Red Cross', role: 'Helper', cause: 'Health' },
 *   { companyName: 'Food Bank', role: 'Volunteer', cause: 'Poverty' }
 * ];
 * const causes = extractCauses(volunteers);
 * // Returns: ['Health', 'Poverty']
 * ```
 */
export function extractCauses(volunteerArray: LiVolunteerExperience[]): string[] {
    const causes = new Set<string>();

    volunteerArray.forEach((volunteer) => {
        if (volunteer.cause && typeof volunteer.cause === 'string') {
            causes.add(volunteer.cause);
        }
    });

    return Array.from(causes);
}

/**
 * Group volunteer experiences by organization
 *
 * Useful when someone has multiple roles at the same organization
 *
 * @param volunteerArray - Array of volunteer experiences
 * @returns Object with organizations as keys and experiences as values
 */
export function groupByOrganization(volunteerArray: LiVolunteerExperience[]): Record<string, LiVolunteerExperience[]> {
    const grouped: Record<string, LiVolunteerExperience[]> = {};

    volunteerArray.forEach((volunteer) => {
        const org = volunteer.companyName || 'Unknown';

        if (!grouped[org]) {
            grouped[org] = [];
        }

        grouped[org].push(volunteer);
    });

    return grouped;
}

/**
 * Calculate total volunteer hours/duration
 *
 * Estimates total time spent volunteering based on date ranges
 *
 * @param volunteerArray - Array of volunteer experiences
 * @returns Total months of volunteer work
 */
export function calculateTotalDuration(volunteerArray: LiVolunteerExperience[]): number {
    let totalMonths = 0;

    volunteerArray.forEach((volunteer) => {
        if (volunteer.timePeriod) {
            const start = volunteer.timePeriod.startDate;
            const end = volunteer.timePeriod.endDate;

            if (start && start.year) {
                const startYear = start.year;
                const startMonth = start.month || 1;

                // If no end date, assume still volunteering (use current date)
                const endYear = end?.year || new Date().getFullYear();
                const endMonth = end?.month || new Date().getMonth() + 1;

                const months = (endYear - startYear) * 12 + (endMonth - startMonth);
                totalMonths += Math.max(0, months);
            }
        }
    });

    return totalMonths;
}

/**
 * Format volunteer duration as human-readable string
 *
 * @param months - Number of months
 * @returns Formatted string (e.g., "2 years 3 months")
 */
export function formatDuration(months: number): string {
    if (months < 1) return 'Less than a month';
    if (months < 12) return `${months} month${months !== 1 ? 's' : ''}`;

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    let result = `${years} year${years !== 1 ? 's' : ''}`;

    if (remainingMonths > 0) {
        result += ` ${remainingMonths} month${remainingMonths !== 1 ? 's' : ''}`;
    }

    return result;
}
