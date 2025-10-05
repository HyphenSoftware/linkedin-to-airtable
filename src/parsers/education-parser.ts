/**
 * Education Parser
 *
 * Parses LinkedIn education data and transforms it into JSON Resume format.
 */

import { noNullOrUndef, parseAndAttachResumeDates } from '../utilities';
import { liTypeMappings } from '../schema';

/**
 * LinkedIn education entity (simplified type)
 */
export interface LiEducation {
    $type?: `com.linkedin.${string}`;
    schoolName?: string;
    fieldOfStudy?: string;
    degreeName?: string;
    grade?: string;
    entityUrn?: string;
    courses?: string[];
    timePeriod?: {
        startDate?: { year?: number; month?: number };
        endDate?: { year?: number; month?: number };
    };
    [key: string]: any;
}

/**
 * LinkedIn course entity
 */
export interface LiCourse {
    number?: string;
    name?: string;
    occupationUnion?: {
        profileEducation?: string;
    };
}

/**
 * Internal database interface for looking up related entities
 */
export interface InternalDb {
    entitiesByUrn: Record<string, any>;
    getElementsByType: (types: string[]) => any[];
}

/**
 * JSON Resume education entry (legacy format)
 */
export interface ResumeEducationLegacy {
    institution: string;
    area: string;
    studyType: string;
    startDate: string;
    endDate: string;
    gpa: string;
    courses: string[];
}

/**
 * JSON Resume education entry (stable format)
 */
export interface ResumeEducationStable {
    institution: string;
    area: string;
    studyType: string;
    startDate: string;
    endDate: string;
    score: string;
    courses: string[];
}

/**
 * Parse a LinkedIn education object into JSON Resume format
 *
 * @param educationObj - LinkedIn education entity
 * @param db - Internal database for looking up related entities (courses)
 * @param debugLogger - Optional debug logger
 * @returns Parsed education in both legacy and stable formats
 *
 * @example
 * ```typescript
 * const edu = {
 *   schoolName: 'MIT',
 *   fieldOfStudy: 'Computer Science',
 *   degreeName: 'Bachelor of Science',
 *   grade: '3.8'
 * };
 * const parsed = parseEducation(edu, db);
 * ```
 */
export function parseEducation(educationObj: LiEducation, db: InternalDb, debugLogger?: { warn: (...args: any[]) => void }): { legacy: ResumeEducationLegacy; stable: ResumeEducationStable } {
    const edu = educationObj;

    // Parse legacy format
    const parsedEduLegacy: ResumeEducationLegacy = {
        institution: noNullOrUndef(edu.schoolName),
        area: noNullOrUndef(edu.fieldOfStudy),
        studyType: noNullOrUndef(edu.degreeName),
        startDate: '',
        endDate: '',
        gpa: noNullOrUndef(edu.grade),
        courses: []
    };

    // Attach dates
    parseAndAttachResumeDates(parsedEduLegacy, edu as any);

    // Parse courses
    parsedEduLegacy.courses = parseCourses(edu, db, debugLogger);

    // Parse stable format (mostly same as legacy)
    const parsedEduStable: ResumeEducationStable = {
        institution: noNullOrUndef(edu.schoolName),
        area: noNullOrUndef(edu.fieldOfStudy),
        studyType: noNullOrUndef(edu.degreeName),
        startDate: parsedEduLegacy.startDate,
        endDate: parsedEduLegacy.endDate,
        score: noNullOrUndef(edu.grade),
        courses: parsedEduLegacy.courses
    };

    return {
        legacy: parsedEduLegacy,
        stable: parsedEduStable
    };
}

/**
 * Parse courses associated with an education entry
 *
 * Handles both old format (direct course array) and new format (Dash endpoint union field)
 *
 * @param educationObj - LinkedIn education entity
 * @param db - Internal database for looking up courses
 * @param debugLogger - Optional debug logger
 * @returns Array of formatted course strings
 */
function parseCourses(educationObj: LiEducation, db: InternalDb, debugLogger?: { warn: (...args: any[]) => void }): string[] {
    const courses: string[] = [];
    const edu = educationObj;

    if (Array.isArray(edu.courses)) {
        // Old version: courses are directly linked via URNs
        edu.courses.forEach((courseKey) => {
            const courseInfo = db.entitiesByUrn[courseKey];
            if (courseInfo) {
                courses.push(`${courseInfo.number} - ${courseInfo.name}`);
            } else if (debugLogger) {
                debugLogger.warn('could not find course:', courseKey);
            }
        });
    } else {
        // New version (Dash): courses linked via union field
        // Need to iterate through all courses and check occupationUnion
        const courseElements = db.getElementsByType(liTypeMappings.courses.types);
        courseElements.forEach((course: LiCourse) => {
            if (course.occupationUnion && course.occupationUnion.profileEducation) {
                if (course.occupationUnion.profileEducation === edu.entityUrn) {
                    // Union joined!
                    courses.push(`${course.number} - ${course.name}`);
                }
            }
        });
    }

    return courses;
}

/**
 * Parse multiple education entries
 *
 * @param educationArray - Array of LinkedIn education entities
 * @param db - Internal database
 * @param debugLogger - Optional debug logger
 * @returns Arrays of parsed education entries (legacy and stable formats)
 */
export function parseEducationList(
    educationArray: LiEducation[],
    db: InternalDb,
    debugLogger?: { warn: (...args: any[]) => void }
): {
    legacy: ResumeEducationLegacy[];
    stable: ResumeEducationStable[];
} {
    const legacy: ResumeEducationLegacy[] = [];
    const stable: ResumeEducationStable[] = [];

    educationArray.forEach((edu) => {
        const parsed = parseEducation(edu, db, debugLogger);
        legacy.push(parsed.legacy);
        stable.push(parsed.stable);
    });

    return { legacy, stable };
}
