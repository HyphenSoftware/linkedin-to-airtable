/**
 * @preserve
 * @author Joshua Tzucker
 * @license MIT
 * WARNING: This tool is not affiliated with LinkedIn in any manner. Intended use is to export your own profile data, and you, as the user, are responsible for using it within the terms and services set out by LinkedIn. I am not responsible for any misuse, or repercussions of said misuse.
 */

// Import the compatibility wrapper
import { LinkedinToResumeJsonCompat } from './core/legacy-compat-wrapper';
import { LinkedInExtractor } from './core/linkedin-extractor';

// Export the new modern implementation
export { LinkedInExtractor } from './core/linkedin-extractor';
export type { ExtractorOptions, ExtractionResult } from './core/linkedin-extractor';

// Export the legacy compatibility wrapper for backward compatibility
export { LinkedinToResumeJsonCompat as LinkedinToResumeJson } from './core/legacy-compat-wrapper';

// Also export templates and utilities for direct access if needed
export { resumeJsonTemplateLegacy, resumeJsonTemplateStable } from './templates';
export { liSchemaKeys, liTypeMappings } from './schema';

// ==Bookmarklet==
// @name linkedin-to-jsonresume-bookmarklet
// @author Joshua Tzucker
// ==/Bookmarklet==

// For browser/bookmarklet compatibility, expose on window object
if (typeof window !== 'undefined') {
    // Expose the compatibility wrapper as LinkedinToResumeJson for backward compatibility
    (window as any).LinkedinToResumeJson = LinkedinToResumeJsonCompat;

    // Also expose the new LinkedInExtractor for those who want to use it directly
    (window as any).LinkedInExtractor = LinkedInExtractor;
}
