/**
 * Skills Parser
 *
 * Parses LinkedIn skills data and transforms it into JSON Resume format.
 */

/**
 * LinkedIn skill entity
 */
export interface LiSkill {
    name?: string;
    skill?: {
        name?: string;
    };
    [key: string]: any;
}

/**
 * JSON Resume skill entry
 */
export interface ResumeSkill {
    name: string;
    level: string;
    keywords: string[];
}

/**
 * Parse a LinkedIn skill object into JSON Resume format
 *
 * @param skillObj - LinkedIn skill entity
 * @returns Parsed skill in JSON Resume format
 *
 * @example
 * ```typescript
 * const skill = { name: 'JavaScript' };
 * const parsed = parseSkill(skill);
 * // Returns: { name: 'JavaScript', level: '', keywords: [] }
 * ```
 */
export function parseSkill(skillObj: LiSkill): ResumeSkill {
    // LinkedIn skill objects can have the name in two different places
    const skillName = skillObj.name || skillObj.skill?.name || '';

    return {
        name: skillName,
        level: '',
        keywords: []
    };
}

/**
 * Parse multiple skill entries
 *
 * @param skillsArray - Array of LinkedIn skill entities
 * @returns Array of parsed skills
 */
export function parseSkillsList(skillsArray: LiSkill[]): ResumeSkill[] {
    return skillsArray.map((skill) => parseSkill(skill));
}

/**
 * Push a skill to a skills array, preventing duplicates
 *
 * @param skillsArray - Existing skills array
 * @param skillName - Skill name to add
 * @returns Updated skills array
 *
 * @example
 * ```typescript
 * const skills = [{ name: 'JavaScript', level: '', keywords: [] }];
 * pushSkill(skills, 'TypeScript');
 * // skills now has JavaScript and TypeScript
 * pushSkill(skills, 'JavaScript'); // No duplicate added
 * ```
 */
export function pushSkill(skillsArray: ResumeSkill[], skillName: string): ResumeSkill[] {
    // Check if skill already exists (case-insensitive)
    const skillNames = skillsArray.map((skill) => skill.name.toLowerCase());

    if (skillName && skillNames.indexOf(skillName.toLowerCase()) === -1) {
        skillsArray.push({
            name: skillName,
            level: '',
            keywords: []
        });
    }

    return skillsArray;
}

/**
 * Parse and deduplicate skills from multiple sources
 *
 * Useful when combining skills from different API endpoints
 * or extracting skills from multiple sections
 *
 * @param skillsSources - Array of skill arrays from different sources
 * @returns Deduplicated array of skills
 *
 * @example
 * ```typescript
 * const apiSkills = [{ name: 'JavaScript' }];
 * const profileSkills = [{ name: 'TypeScript' }, { name: 'JavaScript' }];
 * const merged = mergeSkills([apiSkills, profileSkills]);
 * // Returns unique skills: ['JavaScript', 'TypeScript']
 * ```
 */
export function mergeSkills(...skillsSources: LiSkill[][]): ResumeSkill[] {
    const result: ResumeSkill[] = [];

    skillsSources.forEach((source) => {
        source.forEach((skill) => {
            const skillName = skill.name || skill.skill?.name;
            if (skillName) {
                pushSkill(result, skillName);
            }
        });
    });

    return result;
}

/**
 * Extract skill names from a text (e.g., job description)
 *
 * Simple keyword extraction that looks for common skill patterns
 *
 * @param text - Text to extract skills from
 * @param knownSkills - List of known skill names to look for
 * @returns Array of found skill names
 */
export function extractSkillsFromText(text: string, knownSkills: string[]): string[] {
    if (!text) return [];

    const lowerText = text.toLowerCase();
    const found: string[] = [];

    knownSkills.forEach((skill) => {
        // Look for whole word matches
        const regex = new RegExp(`\\b${skill.toLowerCase()}\\b`, 'i');
        if (regex.test(lowerText) && !found.includes(skill)) {
            found.push(skill);
        }
    });

    return found;
}

/**
 * Group skills by category
 *
 * @param skills - Array of skills
 * @param categories - Category mapping { categoryName: [skillNames] }
 * @returns Object with skills grouped by category
 *
 * @example
 * ```typescript
 * const skills = [
 *   { name: 'JavaScript', level: '', keywords: [] },
 *   { name: 'React', level: '', keywords: [] }
 * ];
 * const categories = {
 *   'Frontend': ['JavaScript', 'React'],
 *   'Backend': ['Node.js']
 * };
 * const grouped = groupSkillsByCategory(skills, categories);
 * ```
 */
export function groupSkillsByCategory(skills: ResumeSkill[], categories: Record<string, string[]>): Record<string, ResumeSkill[]> {
    const grouped: Record<string, ResumeSkill[]> = {};
    const uncategorized: ResumeSkill[] = [];

    // Initialize categories
    Object.keys(categories).forEach((category) => {
        grouped[category] = [];
    });

    // Categorize skills
    skills.forEach((skill) => {
        let categorized = false;

        for (const [category, categorySkills] of Object.entries(categories)) {
            if (categorySkills.some((s) => s.toLowerCase() === skill.name.toLowerCase())) {
                grouped[category].push(skill);
                categorized = true;
                break;
            }
        }

        if (!categorized) {
            uncategorized.push(skill);
        }
    });

    // Add uncategorized if any exist
    if (uncategorized.length > 0) {
        grouped['Other'] = uncategorized;
    }

    return grouped;
}
