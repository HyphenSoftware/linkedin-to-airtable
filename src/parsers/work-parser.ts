/**
 * Work Experience Parser
 *
 * Parses LinkedIn work position/experience data and transforms it into JSON Resume format.
 */

import { noNullOrUndef, parseAndAttachResumeDates, companyLiPageFromCompanyUrn } from '../utilities';

/**
 * LinkedIn work position entity
 */
export interface LiWorkPosition {
    $type?: `com.linkedin.${string}`;
    companyName?: string;
    title?: string;
    description?: string;
    companyUrn?: string;
    locationName?: string;
    timePeriod?: {
        startDate?: { year?: number; month?: number };
        endDate?: { year?: number; month?: number };
    };
    company?: {
        '*miniCompany'?: string;
    };
    [key: string]: any;
}

/**
 * Minimal internal database interface for work parser
 * (Subset of the full InternalDb from global.d.ts)
 */
export interface WorkParserDb {
    entitiesByUrn: Record<string, any>;
}

/**
 * JSON Resume work entry (legacy format)
 */
export interface ResumeWorkLegacy {
    company: string;
    position: string;
    website: string;
    startDate: string;
    endDate: string;
    summary: string;
    highlights: string[];
}

/**
 * JSON Resume work entry (stable format)
 */
export interface ResumeWorkStable {
    name: string;
    position: string;
    startDate: string;
    endDate: string;
    highlights: string[];
    summary: string;
    url: string;
    location: string;
}

/**
 * Parse a LinkedIn position object into JSON Resume work format
 *
 * @param positionObj - LinkedIn work position entity
 * @param db - Internal database for looking up related entities (company info)
 * @returns Parsed work entry in both legacy and stable formats
 *
 * @example
 * ```typescript
 * const position = {
 *   companyName: 'Google',
 *   title: 'Software Engineer',
 *   description: 'Worked on search algorithms',
 *   locationName: 'Mountain View, CA'
 * };
 * const parsed = parseWorkPosition(position, db);
 * ```
 */
export function parseWorkPosition(positionObj: LiWorkPosition, db: WorkParserDb): { legacy: ResumeWorkLegacy; stable: ResumeWorkStable } {
    // Parse legacy format
    const parsedWorkLegacy: ResumeWorkLegacy = {
        company: positionObj.companyName || '',
        endDate: '',
        highlights: [],
        position: positionObj.title || '',
        startDate: '',
        summary: positionObj.description || '',
        website: companyLiPageFromCompanyUrn(positionObj.companyUrn, db as any)
    };

    // Attach dates
    parseAndAttachResumeDates(parsedWorkLegacy, positionObj as any);

    // Lookup company website (future enhancement)
    // Currently company website is not in schema, would need Voyager API call
    if (positionObj.company && positionObj.company['*miniCompany']) {
        // @TODO - website is not in schema. Use voyager?
        // const companyInfo = db.entitiesByUrn[positionObj.company['*miniCompany']];
    }

    // Parse stable format
    const parsedWorkStable: ResumeWorkStable = {
        name: parsedWorkLegacy.company,
        position: parsedWorkLegacy.position,
        startDate: parsedWorkLegacy.startDate,
        endDate: parsedWorkLegacy.endDate,
        highlights: parsedWorkLegacy.highlights,
        summary: parsedWorkLegacy.summary,
        url: parsedWorkLegacy.website,
        location: positionObj.locationName || ''
    };

    return {
        legacy: parsedWorkLegacy,
        stable: parsedWorkStable
    };
}

/**
 * Parse multiple work position entries
 *
 * @param positionsArray - Array of LinkedIn work position entities
 * @param db - Internal database
 * @returns Arrays of parsed work entries (legacy and stable formats)
 */
export function parseWorkPositionList(
    positionsArray: LiWorkPosition[],
    db: WorkParserDb
): {
    legacy: ResumeWorkLegacy[];
    stable: ResumeWorkStable[];
} {
    const legacy: ResumeWorkLegacy[] = [];
    const stable: ResumeWorkStable[] = [];

    positionsArray.forEach((position) => {
        const parsed = parseWorkPosition(position, db);
        legacy.push(parsed.legacy);
        stable.push(parsed.stable);
    });

    return { legacy, stable };
}

/**
 * Extract highlights from work description
 *
 * Attempts to parse bullet points or achievements from the description text.
 * Common patterns:
 * - Lines starting with • or -
 * - Lines starting with * (markdown)
 * - Numbered achievements
 *
 * @param description - Work description text
 * @param maxHighlights - Maximum number of highlights to extract
 * @returns Array of highlight strings
 */
export function extractHighlights(description: string | undefined, maxHighlights: number = 5): string[] {
    if (!description) return [];

    const highlights: string[] = [];
    const lines = description.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();

        // Match bullet points (•, -, *, or numbered)
        const bulletMatch = trimmed.match(/^[•\-*]\s+(.+)$/);
        const numberedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/);

        if (bulletMatch && bulletMatch[1]) {
            highlights.push(bulletMatch[1].trim());
        } else if (numberedMatch && numberedMatch[1]) {
            highlights.push(numberedMatch[1].trim());
        }

        if (highlights.length >= maxHighlights) break;
    }

    return highlights;
}

/**
 * Parse work position with automatic highlight extraction
 *
 * @param positionObj - LinkedIn work position entity
 * @param db - Internal database
 * @param extractHighlightsFromDesc - Whether to auto-extract highlights from description
 * @returns Parsed work entry with highlights
 */
export function parseWorkPositionWithHighlights(positionObj: LiWorkPosition, db: WorkParserDb, extractHighlightsFromDesc: boolean = false): { legacy: ResumeWorkLegacy; stable: ResumeWorkStable } {
    const parsed = parseWorkPosition(positionObj, db);

    if (extractHighlightsFromDesc && positionObj.description) {
        const highlights = extractHighlights(positionObj.description);
        parsed.legacy.highlights = highlights;
        parsed.stable.highlights = highlights;
    }

    return parsed;
}
