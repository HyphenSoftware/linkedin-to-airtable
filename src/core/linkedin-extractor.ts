/**
 * LinkedIn Profile Extractor - ES6 Class
 *
 * Modern ES6 class that orchestrates LinkedIn profile extraction using
 * the new modular parser architecture.
 */

import { VoyagerClient } from '../api/voyager-client';
import { buildVoyagerUrl, VOYAGER_ENDPOINTS } from '../api/endpoints';
import { parseProfileBasics, parseProfileLanguage, buildLinkedInProfileUrl } from '../parsers/profile-parser';
import { parseEducationList } from '../parsers/education-parser';
import { parseWorkPositionList } from '../parsers/work-parser';
import { parseSkillsList, groupSkillsByCategory } from '../parsers/skills-parser';
import { parseVolunteerExperienceList } from '../parsers/volunteer-parser';
import { parseCertificationList } from '../parsers/certificate-parser';
import { getCookie, noNullOrUndef, promptDownload, buildDbFromLiSchema } from '../utilities';
import { resumeJsonTemplateLegacy, resumeJsonTemplateStable } from '../templates';

/**
 * Options for the LinkedIn extractor
 */
export interface ExtractorOptions {
    debug?: boolean;
    preferApi?: boolean;
    getFullSkills?: boolean;
    maxRetries?: number;
    retryDelayMs?: number;
}

/**
 * Result of profile extraction
 */
export interface ExtractionResult {
    success: boolean;
    legacy: any;
    stable: any;
    profileId: string;
    profileUrnId?: string;
    locale: string;
    error?: string;
    summary?: {
        education: number;
        work: number;
        skills: number;
        volunteer: number;
        certificates: number;
        interests: number;
    };
}

/**
 * LinkedIn Profile Extractor Class
 *
 * Modern ES6 class that extracts LinkedIn profile data and converts it to JSON Resume format.
 * Uses the new modular parser architecture for clean separation of concerns.
 *
 * @example
 * ```typescript
 * const extractor = new LinkedInExtractor({
 *   debug: true,
 *   preferApi: true,
 *   getFullSkills: true
 * });
 *
 * const result = await extractor.extractProfile();
 * if (result.success) {
 *   console.log('Extracted profile:', result.legacy);
 * }
 * ```
 */
export class LinkedInExtractor {
    private profileId: string;

    private profileUrnId: string | null = null;

    private apiClient: VoyagerClient;

    private debug: boolean;

    private preferApi: boolean;

    private getFullSkills: boolean;

    private debugConsole: Console;

    private outputJsonLegacy: any;

    private outputJsonStable: any;

    private defaultLocale: string = 'en_US';

    private preferLocale: string | null = null;

    /**
     * Create a new LinkedIn extractor instance
     *
     * @param options - Configuration options
     */
    constructor(options: ExtractorOptions = {}) {
        this.debug = options.debug ?? false;
        this.preferApi = options.preferApi ?? true;
        this.getFullSkills = options.getFullSkills ?? true;

        // Initialize debug console first
        this.debugConsole = this.debug
            ? console
            : ({
                log: () => {},
                warn: () => {},
                error: () => {},
                assert: () => {},
                clear: () => {},
                count: () => {},
                countReset: () => {},
                debug: () => {},
                dir: () => {},
                dirxml: () => {},
                group: () => {},
                groupCollapsed: () => {},
                groupEnd: () => {},
                info: () => {},
                table: () => {},
                time: () => {},
                timeEnd: () => {},
                timeLog: () => {},
                trace: () => {},
                timeStamp: () => {},
                Console: console.Console,
                profile: () => {},
                profileEnd: () => {}
            } as Console);

        // Initialize API client
        this.apiClient = new VoyagerClient({
            debug: this.debug,
            maxRetries: options.maxRetries ?? 3,
            retryDelayMs: options.retryDelayMs ?? 1000
        });

        // Initialize output templates
        this.outputJsonLegacy = JSON.parse(JSON.stringify(resumeJsonTemplateLegacy));
        this.outputJsonStable = JSON.parse(JSON.stringify(resumeJsonTemplateStable));

        // Get profile ID from current page
        this.profileId = this.getProfileId();
        this.defaultLocale = this.getViewersLocalLang();
    }

    /**
     * Extract complete LinkedIn profile and convert to JSON Resume format
     *
     * @returns Promise<ExtractionResult> - Extraction result with success status and data
     */
    async extractProfile(): Promise<ExtractionResult> {
        try {
            // Step 0: Extract profile ID from URL if not already set
            if (!this.profileId) {
                this.profileId = this.getProfileId();
                if (!this.profileId) {
                    return {
                        success: false,
                        legacy: null,
                        stable: null,
                        profileId: '',
                        locale: 'en_US',
                        error: 'Could not extract profile ID from URL. Please ensure you are on a LinkedIn profile page.'
                    };
                }
            }

            this.debugConsole.log('Starting profile extraction for:', this.profileId);

            // Step 1: Get profile URN ID (needed for some API calls)
            this.profileUrnId = await this.getProfileUrnId();
            this.debugConsole.log('Profile URN ID:', this.profileUrnId);

            // Step 2: Extract profile basics
            const basicsResult = await this.extractProfileBasics();
            if (!basicsResult.success) {
                return {
                    success: false,
                    legacy: null,
                    stable: null,
                    profileId: this.profileId,
                    locale: 'en_US',
                    error: `Failed to extract profile basics: ${basicsResult.error}`
                };
            }

            // Step 3: Extract education
            const educationResult = await this.extractEducation();
            this.debugConsole.log('Education extracted:', educationResult.count);

            // Step 4: Extract work experience
            const workResult = await this.extractWorkExperience();
            this.debugConsole.log('Work experience extracted:', workResult.count);

            // Step 5: Extract skills
            const skillsResult = await this.extractSkills();
            this.debugConsole.log('Skills extracted:', skillsResult.count);

            // Step 6: Extract volunteer experience
            const volunteerResult = await this.extractVolunteerExperience();
            this.debugConsole.log('Volunteer experience extracted:', volunteerResult.count);

            // Step 7: Extract certificates
            const certificatesResult = await this.extractCertificates();
            this.debugConsole.log('Certificates extracted:', certificatesResult.count);

            // Step 8: Extract interests
            const interestsResult = await this.extractInterests();
            this.debugConsole.log('Interests extracted:', interestsResult.count);

            // Step 9: Finalize output
            this.finalizeOutput();

            const result: ExtractionResult = {
                success: true,
                legacy: this.outputJsonLegacy,
                stable: this.outputJsonStable,
                profileId: this.profileId,
                profileUrnId: this.profileUrnId,
                locale: basicsResult.locale,
                summary: {
                    education: educationResult.count,
                    work: workResult.count,
                    skills: skillsResult.count,
                    volunteer: volunteerResult.count,
                    certificates: certificatesResult.count,
                    interests: interestsResult.count
                }
            };

            this.debugConsole.log('Profile extraction completed successfully:', result.summary);
            return result;
        } catch (error) {
            const errorMessage = `Profile extraction failed: ${error instanceof Error ? error.message : String(error)}`;
            this.debugConsole.error(errorMessage, error);

            return {
                success: false,
                legacy: null,
                stable: null,
                profileId: this.profileId,
                locale: 'en_US',
                error: errorMessage
            };
        }
    }

    /**
     * Extract profile basics (name, headline, summary, location)
     */
    private async extractProfileBasics(): Promise<{ success: boolean; locale: string; error?: string }> {
        try {
            this.debugConsole.log('Starting profile basics extraction...');
            this.debugConsole.log('Profile ID:', this.profileId);
            this.debugConsole.log('Prefer API:', this.preferApi);

            // Try API first if preferred
            if (this.preferApi) {
                try {
                    this.debugConsole.log('Attempting API extraction...');
                    const profileData = await this.apiClient.fetchProfile(this.profileId);
                    this.debugConsole.log('Profile data received:', profileData);

                    const db = buildDbFromLiSchema(profileData);
                    this.debugConsole.log('Database built, looking for profile entities...');

                    // Try both legacy and Dash profile types
                    const profiles = db.getElementsByType(['com.linkedin.voyager.dash.identity.profile.Profile', 'com.linkedin.voyager.identity.profile.Profile']);
                    this.debugConsole.log('Found profiles:', profiles.length);

                    const profile = profiles[0];

                    if (profile) {
                        this.debugConsole.log('Profile found via API, parsing...');
                        const parsed = parseProfileBasics(profile, true); // Use Dash format
                        this.outputJsonLegacy.basics = parsed.legacy;
                        this.outputJsonStable.basics = parsed.stable;

                        // Extract and attach profile photo URL (legacy + stable schema fields)
                        const profilePhotoUrl = this.extractProfilePhotoUrl(profile, db);
                        if (profilePhotoUrl) {
                            this.outputJsonLegacy.basics.picture = profilePhotoUrl;
                            this.outputJsonStable.basics.image = profilePhotoUrl;
                        }

                        // Add language
                        const language = parseProfileLanguage(profile, true);
                        this.outputJsonLegacy.languages = [language];
                        this.outputJsonStable.languages = [language];

                        this.debugConsole.log('API extraction successful');
                        return { success: true, locale: parsed.locale };
                    }
                    this.debugConsole.warn('No profile entity found in API response');
                } catch (apiError) {
                    this.debugConsole.warn('API extraction failed, falling back to DOM:', apiError);
                }
            } else {
                this.debugConsole.log('API extraction skipped (preferApi is false)');
            }

            // Fallback to DOM extraction
            this.debugConsole.log('Attempting DOM extraction...');
            const domProfile = this.extractProfileFromDOM();
            this.debugConsole.log('DOM profile extracted:', domProfile ? 'Success' : 'Failed', domProfile);

            if (domProfile) {
                this.debugConsole.log('Parsing DOM profile...');
                const parsed = parseProfileBasics(domProfile, false);
                this.outputJsonLegacy.basics = parsed.legacy;
                this.outputJsonStable.basics = parsed.stable;

                // Extract and attach profile photo URL (legacy + stable schema fields)
                const profilePhotoUrl = this.extractProfilePhotoUrl(domProfile);
                if (profilePhotoUrl) {
                    this.outputJsonLegacy.basics.picture = profilePhotoUrl;
                    this.outputJsonStable.basics.image = profilePhotoUrl;
                }

                const language = parseProfileLanguage(domProfile, false);
                this.outputJsonLegacy.languages = [language];
                this.outputJsonStable.languages = [language];

                this.debugConsole.log('DOM extraction successful');
                return { success: true, locale: parsed.locale };
            }

            this.debugConsole.error('Both API and DOM extraction failed');
            return { success: false, locale: 'en_US', error: 'Could not extract profile basics from API or DOM' };
        } catch (error) {
            this.debugConsole.error('Exception in extractProfileBasics:', error);
            return {
                success: false,
                locale: 'en_US',
                error: `Profile basics extraction failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Extract education information
     */
    private async extractEducation(): Promise<{ count: number }> {
        try {
            if (this.preferApi) {
                try {
                    const profileData = await this.apiClient.fetchProfile(this.profileId);
                    const db = buildDbFromLiSchema(profileData);
                    const education = db.getElementsByType(['com.linkedin.voyager.dash.identity.profile.Education', 'com.linkedin.voyager.identity.profile.Education']);

                    if (education.length > 0) {
                        const parsed = parseEducationList(education, db, this.debugConsole);
                        this.outputJsonLegacy.education = parsed.legacy;
                        this.outputJsonStable.education = parsed.stable;
                        return { count: education.length };
                    }
                } catch (apiError) {
                    this.debugConsole.warn('Education API extraction failed:', apiError);
                }
            }

            // Fallback to DOM extraction
            const domEducation = this.extractEducationFromDOM();
            if (domEducation.length > 0) {
                const parsed = parseEducationList(domEducation, { entitiesByUrn: {}, getElementsByType: () => [] }, this.debugConsole);
                this.outputJsonLegacy.education = parsed.legacy;
                this.outputJsonStable.education = parsed.stable;
                return { count: domEducation.length };
            }

            return { count: 0 };
        } catch (error) {
            this.debugConsole.error('Education extraction failed:', error);
            return { count: 0 };
        }
    }

    /**
     * Extract work experience
     */
    private async extractWorkExperience(): Promise<{ count: number }> {
        try {
            if (this.preferApi) {
                try {
                    // Use the main profile data which already includes position groups
                    const profileData = await this.apiClient.fetchProfile(this.profileId);
                    const db = buildDbFromLiSchema(profileData);

                    // Look for position entities in the included data
                    const positions = db.getElementsByType(['com.linkedin.voyager.dash.identity.profile.Position', 'com.linkedin.voyager.identity.profile.Position']);

                    this.debugConsole.log('Found work positions in profile data:', positions.length);

                    if (positions.length > 0) {
                        const parsed = parseWorkPositionList(positions, db);
                        this.outputJsonLegacy.work = parsed.legacy;
                        this.outputJsonStable.work = parsed.stable;
                        return { count: positions.length };
                    }
                } catch (apiError) {
                    this.debugConsole.warn('Work experience API extraction failed:', apiError);
                }
            }

            // Fallback to DOM extraction
            this.debugConsole.log('Falling back to DOM extraction for work experience...');
            const domWork = this.extractWorkFromDOM();
            if (domWork.length > 0) {
                const parsed = parseWorkPositionList(domWork, { entitiesByUrn: {} });
                this.outputJsonLegacy.work = parsed.legacy;
                this.outputJsonStable.work = parsed.stable;
                return { count: domWork.length };
            }

            return { count: 0 };
        } catch (error) {
            this.debugConsole.error('Work experience extraction failed:', error);
            return { count: 0 };
        }
    }

    /**
     * Extract skills
     */
    private async extractSkills(): Promise<{ count: number }> {
        try {
            if (this.preferApi) {
                try {
                    const profileData = await this.apiClient.fetchProfile(this.profileId);
                    const db = buildDbFromLiSchema(profileData);
                    const skills = db.getElementsByType(['com.linkedin.voyager.dash.identity.profile.Skill', 'com.linkedin.voyager.identity.profile.Skill']);

                    if (skills.length > 0) {
                        const parsed = parseSkillsList(skills);
                        const categorized = groupSkillsByCategory(parsed, {});

                        // Convert categorized skills to flat array for JSON Resume
                        const flatSkills = Object.values(categorized).flat();
                        this.outputJsonLegacy.skills = flatSkills;
                        this.outputJsonStable.skills = flatSkills;
                        return { count: skills.length };
                    }
                } catch (apiError) {
                    this.debugConsole.warn('Skills API extraction failed:', apiError);
                }
            }

            // Fallback to DOM extraction
            const domSkills = this.extractSkillsFromDOM();
            if (domSkills.length > 0) {
                const parsed = parseSkillsList(domSkills);
                const categorized = groupSkillsByCategory(parsed, {});
                const flatSkills = Object.values(categorized).flat();
                this.outputJsonLegacy.skills = flatSkills;
                this.outputJsonStable.skills = flatSkills;
                return { count: domSkills.length };
            }

            return { count: 0 };
        } catch (error) {
            this.debugConsole.error('Skills extraction failed:', error);
            return { count: 0 };
        }
    }

    /**
     * Extract volunteer experience
     */
    private async extractVolunteerExperience(): Promise<{ count: number }> {
        try {
            if (this.preferApi) {
                try {
                    // Use the main profile data which already includes volunteer experiences
                    const profileData = await this.apiClient.fetchProfile(this.profileId);
                    const db = buildDbFromLiSchema(profileData);

                    // Look for volunteer experience entities in the included data
                    const volunteers = db.getElementsByType(['com.linkedin.voyager.dash.identity.profile.VolunteerExperience', 'com.linkedin.voyager.identity.profile.VolunteerExperience']);

                    this.debugConsole.log('Found volunteer experiences in profile data:', volunteers.length);

                    if (volunteers.length > 0) {
                        const parsed = parseVolunteerExperienceList(volunteers, db);
                        this.outputJsonLegacy.volunteer = parsed.legacy;
                        this.outputJsonStable.volunteer = parsed.stable;
                        return { count: volunteers.length };
                    }
                } catch (apiError) {
                    this.debugConsole.warn('Volunteer experience API extraction failed:', apiError);
                }
            }

            // Fallback to DOM extraction
            this.debugConsole.log('Falling back to DOM extraction for volunteer experience...');
            const domVolunteer = this.extractVolunteerFromDOM();
            if (domVolunteer.length > 0) {
                const parsed = parseVolunteerExperienceList(domVolunteer, { entitiesByUrn: {} });
                this.outputJsonLegacy.volunteer = parsed.legacy;
                this.outputJsonStable.volunteer = parsed.stable;
                return { count: domVolunteer.length };
            }

            return { count: 0 };
        } catch (error) {
            this.debugConsole.error('Volunteer experience extraction failed:', error);
            return { count: 0 };
        }
    }

    /**
     * Extract certificates
     */
    private async extractCertificates(): Promise<{ count: number }> {
        try {
            if (this.preferApi) {
                try {
                    // Use the main profile data which already includes certificates
                    const profileData = await this.apiClient.fetchProfile(this.profileId);
                    const db = buildDbFromLiSchema(profileData);

                    // Look for certificate entities in the included data
                    const certificates = db.getElementsByType(['com.linkedin.voyager.dash.identity.profile.Certification', 'com.linkedin.voyager.identity.profile.Certification']);

                    this.debugConsole.log('Found certificates in profile data:', certificates.length);

                    if (certificates.length > 0) {
                        const parsed = parseCertificationList(certificates);
                        this.outputJsonLegacy.certificates = parsed.legacy;
                        this.outputJsonStable.certificates = parsed.stable;
                        return { count: certificates.length };
                    }
                } catch (apiError) {
                    this.debugConsole.warn('Certificates API extraction failed:', apiError);
                }
            }

            return { count: 0 };
        } catch (error) {
            this.debugConsole.error('Certificates extraction failed:', error);
            return { count: 0 };
        }
    }

    /**
     * Extract interests
     */
    private async extractInterests(): Promise<{ count: number }> {
        try {
            if (this.preferApi) {
                try {
                    // Use the main profile data which includes volunteer causes (interests)
                    const profileData = await this.apiClient.fetchProfile(this.profileId);
                    const db = buildDbFromLiSchema(profileData);

                    // Get the profile entity which contains volunteerCauses
                    const profiles = db.getElementsByType(['com.linkedin.voyager.dash.identity.profile.Profile', 'com.linkedin.voyager.identity.profile.Profile']);

                    this.debugConsole.log('Looking for interests in profile...');
                    this.debugConsole.log('Found profile entities:', profiles.length);

                    if (profiles.length > 0) {
                        const profile = profiles[0];
                        this.debugConsole.log('Profile has volunteerCauses field:', 'volunteerCauses' in profile);
                        this.debugConsole.log('volunteerCauses value:', profile.volunteerCauses);

                        if (profile.volunteerCauses && Array.isArray(profile.volunteerCauses) && profile.volunteerCauses.length > 0) {
                            const causes = profile.volunteerCauses;
                            this.debugConsole.log('Found volunteer causes (interests):', causes.length, causes);

                            // Convert to JSON Resume interests format
                            const interests = causes.map((cause: string) => ({
                                name: cause,
                                keywords: []
                            }));

                            this.outputJsonLegacy.interests = interests;
                            this.outputJsonStable.interests = interests;
                            return { count: interests.length };
                        }
                        this.debugConsole.log('No volunteer causes found or field is empty/not an array');
                    } else {
                        this.debugConsole.warn('No profile entities found for interests extraction');
                    }
                } catch (apiError) {
                    this.debugConsole.warn('Interests API extraction failed:', apiError);
                }
            }

            return { count: 0 };
        } catch (error) {
            this.debugConsole.error('Interests extraction failed:', error);
            return { count: 0 };
        }
    }

    /**
     * Finalize the output JSON by cleaning up and adding metadata
     */
    private finalizeOutput(): void {
        // Add LinkedIn profile URL if we have the profile ID
        if (this.profileId) {
            const linkedInUrl = buildLinkedInProfileUrl(this.profileId);
            if (linkedInUrl) {
                this.outputJsonLegacy.basics.profiles = this.outputJsonLegacy.basics.profiles || [];
                this.outputJsonStable.basics.profiles = this.outputJsonStable.basics.profiles || [];

                // Include the stable member URN when we resolved a real one
                // (getProfileUrnId() falls back to 'unknown-urn-id', which we must not persist).
                const urnPart = this.profileUrnId && this.profileUrnId !== 'unknown-urn-id'
                    ? { id: this.profileUrnId }
                    : {};

                this.outputJsonLegacy.basics.profiles.push({
                    network: 'LinkedIn',
                    username: this.profileId,
                    url: linkedInUrl,
                    ...urnPart
                });

                this.outputJsonStable.basics.profiles.push({
                    network: 'LinkedIn',
                    username: this.profileId,
                    url: linkedInUrl,
                    ...urnPart
                });
            }
        }

        // Clean up empty arrays (keep interests and certificates even if empty for consistency)
        ['education', 'work', 'skills', 'volunteer', 'languages'].forEach((section) => {
            if (this.outputJsonLegacy[section] && this.outputJsonLegacy[section].length === 0) {
                delete this.outputJsonLegacy[section];
            }
            if (this.outputJsonStable[section] && this.outputJsonStable[section].length === 0) {
                delete this.outputJsonStable[section];
            }
        });

        // Ensure certificates and interests arrays exist even if empty
        if (!this.outputJsonLegacy.interests) {
            this.outputJsonLegacy.interests = [];
        }
        if (!this.outputJsonStable.interests) {
            this.outputJsonStable.interests = [];
        }
        if (!this.outputJsonStable.certificates) {
            this.outputJsonStable.certificates = [];
        }
    }

    /**
     * Download the extracted profile as JSON file
     */
    downloadProfile(format: 'legacy' | 'stable' = 'legacy'): void {
        const data = format === 'legacy' ? this.outputJsonLegacy : this.outputJsonStable;
        const filename = `linkedin-profile-${this.profileId}-${format}.json`;
        promptDownload(data, filename);
    }

    /**
     * Get profile ID from current URL
     */
    private getProfileId(): string {
        const url = window.location.href;
        const match = url.match(/\/in\/([^\/\?]+)/);
        return match ? match[1] : '';
    }

    /**
     * Get profile URN ID (needed for some API calls)
     */
    private async getProfileUrnId(): Promise<string> {
        if (this.profileUrnId) {
            return this.profileUrnId;
        }

        this.debugConsole.log('Attempting to extract profile URN ID...');

        // Try to extract from embedded JSON first
        const embeddedData = this.extractEmbeddedProfileData();
        if (embeddedData) {
            // Try multiple URN patterns
            const patterns = [
                /urn:li:fsd_profile:([^",\s]+)/,
                /urn:li:fs_profileView:([^",\s]+)/,
                /"entityUrn":"urn:li:fsd_profile:([^"]+)"/,
                /"publicIdentifier":"[^"]*","dashEntityUrn":"urn:li:fsd_profile:([^"]+)"/
            ];

            for (const pattern of patterns) {
                const match = embeddedData.match(pattern);
                if (match) {
                    this.profileUrnId = match[1];
                    this.debugConsole.log('Profile URN ID found in embedded data:', this.profileUrnId);
                    return this.profileUrnId;
                }
            }
        }

        // Fallback: try to get from API
        try {
            const profileData = await this.apiClient.fetchProfile(this.profileId);
            this.debugConsole.log('Profile data received for URN extraction:', profileData.data);

            const db = buildDbFromLiSchema(profileData);

            // Look for profile entity and extract its URN
            const profiles = db.getElementsByType(['com.linkedin.voyager.dash.identity.profile.Profile', 'com.linkedin.voyager.identity.profile.Profile']);

            this.debugConsole.log('Found profiles for URN extraction:', profiles.length);

            if (profiles.length > 0) {
                const profile = profiles[0];
                this.debugConsole.log('Profile entity keys:', Object.keys(profile));
                this.debugConsole.log('Profile entityUrn:', profile.entityUrn);

                if (profile.entityUrn) {
                    const urnMatch = profile.entityUrn.match(/urn:li:fsd_profile:([^:,\s]+)/);
                    if (urnMatch) {
                        this.profileUrnId = urnMatch[1];
                        this.debugConsole.log('Profile URN ID extracted from API profile entity:', this.profileUrnId);
                        return this.profileUrnId;
                    }
                    this.debugConsole.warn('Profile entityUrn did not match pattern:', profile.entityUrn);
                }
            }

            // Try searching the entire response for URN patterns
            const dataStr = JSON.stringify(profileData);
            const patterns = [/urn:li:fsd_profile:([^",\s]+)/, /urn:li:fs_profileView:([^",\s]+)/];

            for (const pattern of patterns) {
                const match = dataStr.match(pattern);
                if (match) {
                    this.profileUrnId = match[1];
                    this.debugConsole.log('Profile URN ID found via regex in API response:', this.profileUrnId);
                    return this.profileUrnId;
                }
            }
        } catch (error) {
            this.debugConsole.warn('Failed to get profile URN from API:', error);
        }

        // Last resort: generate a placeholder
        this.debugConsole.error('Could not extract profile URN ID, using placeholder');
        this.profileUrnId = 'unknown-urn-id';
        return this.profileUrnId;
    }

    /**
     * Cheaply resolve the durable member URN and the profile's full name without a full
     * extraction. Used by the profile-exists precheck, which fires before extractProfile().
     * Reads embedded page JSON (URN + first/last name), falling back to DOM for the name.
     */
    async resolveIdentity(): Promise<{ urn: string | null; name: string | null }> {
        let urn: string | null = null;
        try {
            const resolved = await this.getProfileUrnId();
            urn = resolved && resolved !== 'unknown-urn-id' ? resolved : null;
        } catch (error) {
            this.debugConsole.warn('resolveIdentity: failed to resolve URN:', error);
        }

        let name: string | null = null;
        try {
            const profile = this.extractProfileFromEmbeddedData() || this.extractProfileFromDOM();
            if (profile) {
                const candidate = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
                name = candidate || null;
            }
        } catch (error) {
            this.debugConsole.warn('resolveIdentity: failed to resolve name from page:', error);
        }

        // Fallback: pull the name from the Voyager API profile (the same source getProfileUrnId
        // uses). LinkedIn's embedded JSON / DOM selectors are frequently absent on modern profile
        // pages, which would otherwise leave the name null and break the name-based fallback.
        if (!name) {
            try {
                const profileData = await this.apiClient.fetchProfile(this.profileId);
                const db = buildDbFromLiSchema(profileData);
                const profiles = db.getElementsByType(['com.linkedin.voyager.dash.identity.profile.Profile', 'com.linkedin.voyager.identity.profile.Profile']);
                if (profiles.length > 0) {
                    const profile = profiles[0];
                    const candidate = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
                    name = candidate || null;
                }
            } catch (error) {
                this.debugConsole.warn('resolveIdentity: failed to resolve name from API:', error);
            }
        }

        this.debugConsole.log('resolveIdentity result:', { urn, name });
        return { urn, name };
    }

    /**
     * Get viewer's local language
     */
    private getViewersLocalLang(): string {
        const lang = navigator.language || 'en-US';
        return lang.replace('-', '_');
    }

    /**
     * Build profile photo URL from LinkedIn vector image metadata
     * Prefer the highest resolution artifact for better quality.
     */
    private buildProfilePhotoUrlFromPictureMeta(pictureMeta: any): string {
        if (!pictureMeta || typeof pictureMeta !== 'object') {
            return '';
        }

        // Sometimes the vector image object is nested under displayImageReference/vectorImage
        const vectorImage = pictureMeta.displayImageReference?.vectorImage || pictureMeta.vectorImage || pictureMeta;
        const rootUrl = vectorImage?.rootUrl;
        const artifacts = vectorImage?.artifacts;
        if (!rootUrl || !Array.isArray(artifacts) || artifacts.length === 0) {
            return '';
        }

        // Prefer highest quality by selecting the largest artifact
        const largestArtifact = artifacts.sort((a: any, b: any) => (b?.width || 0) - (a?.width || 0))[0];
        const pathSegment = largestArtifact?.fileIdentifyingUrlPathSegment;
        if (!pathSegment) {
            return '';
        }

        return `${rootUrl}${pathSegment}`;
    }

    /**
     * Extract profile photo URL from DOM first, then from API metadata
     */
    private extractProfilePhotoUrl(profileObj?: any, db?: any): string {
        // 1) DOM extraction first (matches old behavior and works across layouts)
        const domImage =
            (document.querySelector('img[class*="profile-picture"]') as HTMLImageElement | null) ||
            (document.querySelector('img[class*="profile-photo"]') as HTMLImageElement | null);
        if (domImage?.src) {
            return domImage.src;
        }

        if (!profileObj || typeof profileObj !== 'object') {
            return '';
        }

        // 2) Direct string picture URL (some payload variants expose this)
        if (typeof profileObj.picture === 'string' && profileObj.picture.trim().length > 0) {
            return profileObj.picture;
        }

        // 3) profileView style miniProfile.picture
        if (db && profileObj['*miniProfile']) {
            const miniProfile = db.getElementByUrn?.(profileObj['*miniProfile']);
            const miniProfileUrl = this.buildProfilePhotoUrlFromPictureMeta(miniProfile?.picture);
            if (miniProfileUrl) {
                return miniProfileUrl;
            }
        }

        // 4) Dash style profilePicture.displayImageReference.vectorImage
        const dashPictureUrl = this.buildProfilePhotoUrlFromPictureMeta(profileObj.profilePicture);
        if (dashPictureUrl) {
            return dashPictureUrl;
        }

        // 5) Other known picture-like fields on profile entities
        const directPictureUrl = this.buildProfilePhotoUrlFromPictureMeta(profileObj.picture);
        if (directPictureUrl) {
            return directPictureUrl;
        }

        return '';
    }

    /**
     * Extract embedded profile data from LinkedIn page
     */
    private extractEmbeddedProfileData(): string | null {
        // Look for embedded JSON in script tags
        const scriptTags = document.querySelectorAll('script[type="application/ld+json"], script');

        for (const script of scriptTags) {
            const content = script.textContent || script.innerHTML;
            if (content && content.includes('urn:li:fs_profileView:')) {
                return content;
            }
        }

        return null;
    }

    /**
     * Extract profile data from embedded JSON
     */
    private extractProfileFromEmbeddedData(): any {
        const embeddedData = this.extractEmbeddedProfileData();
        if (!embeddedData) {
            return null;
        }

        try {
            // Try to parse as JSON
            const jsonData = JSON.parse(embeddedData);
            if (jsonData && jsonData.included) {
                // Find profile object
                const profile = jsonData.included.find(
                    (item: any) => item.$type === 'com.linkedin.voyager.identity.profile.Profile' || item.$type === 'com.linkedin.voyager.dash.identity.profile.Profile'
                );
                return profile;
            }
        } catch (error) {
            this.debugConsole.warn('Failed to parse embedded JSON:', error);
        }

        return null;
    }

    // DOM extraction methods
    private extractProfileFromDOM(): any {
        this.debugConsole.log('Checking for embedded profile data in script tags...');

        // First try embedded data
        const embeddedProfile = this.extractProfileFromEmbeddedData();
        if (embeddedProfile) {
            this.debugConsole.log('Found profile in embedded data!');
            return embeddedProfile;
        }

        this.debugConsole.log('No embedded data found, trying DOM selectors...');

        // Fallback to DOM parsing - try multiple selectors for LinkedIn's changing UI
        const nameSelectors = ['h1.text-heading-xlarge', '.pv-text-details__left-panel h1', 'h1[class*="text-heading"]', '.ph5 h1', 'section.artdeco-card h1', '.pv-top-card h1'];

        const headlineSelector = '.text-body-medium.break-words, .pv-text-details__left-panel .text-body-medium';
        const summarySelector = '#about ~ * .pv-shared-text-with-see-more .inline-show-more-text, .pv-about-section .pv-about__summary-text';
        const locationSelector = '.text-body-small.inline.t-black--light.break-words, .pv-text-details__left-panel .text-body-small';

        let nameElement: Element | null = null;
        for (const selector of nameSelectors) {
            this.debugConsole.log('Trying name selector:', selector);
            nameElement = document.querySelector(selector);
            if (nameElement) {
                this.debugConsole.log('Name element found with selector:', selector, nameElement.textContent?.trim());
                break;
            }
        }

        if (!nameElement) {
            this.debugConsole.log('Name element not found with any selector');
        }

        this.debugConsole.log('Trying headline selector:', headlineSelector);
        const headlineElement = document.querySelector(headlineSelector);
        this.debugConsole.log('Headline element found:', !!headlineElement, headlineElement?.textContent?.trim());

        this.debugConsole.log('Trying summary selector:', summarySelector);
        const summaryElement = document.querySelector(summarySelector);
        this.debugConsole.log('Summary element found:', !!summaryElement);

        this.debugConsole.log('Trying location selector:', locationSelector);
        const locationElement = document.querySelector(locationSelector);
        this.debugConsole.log('Location element found:', !!locationElement, locationElement?.textContent?.trim());

        if (nameElement) {
            const name = nameElement.textContent?.trim() || '';
            const [firstName, ...lastNameParts] = name.split(' ');
            const lastName = lastNameParts.join(' ');

            this.debugConsole.log('Successfully extracted profile from DOM');
            return {
                firstName,
                lastName,
                headline: headlineElement?.textContent?.trim() || '',
                summary: summaryElement?.textContent?.trim() || '',
                locationName: locationElement?.textContent?.trim() || '',
                publicIdentifier: this.profileId,
                defaultLocale: {
                    country: 'US',
                    language: 'en'
                }
            };
        }

        this.debugConsole.error('DOM extraction failed: Could not find name element');
        return null;
    }

    private extractEducationFromDOM(): any[] {
        const embeddedData = this.extractEmbeddedProfileData();
        if (embeddedData) {
            try {
                const jsonData = JSON.parse(embeddedData);
                if (jsonData && jsonData.included) {
                    return jsonData.included.filter(
                        (item: any) => item.$type === 'com.linkedin.voyager.identity.profile.Education' || item.$type === 'com.linkedin.voyager.dash.identity.profile.Education'
                    );
                }
            } catch (error) {
                this.debugConsole.warn('Failed to parse embedded education data:', error);
            }
        }

        // Fallback to DOM parsing
        const educationElements = document.querySelectorAll('#education ~ * .pvs-entity, .pv-profile-section.education-section .pv-entity__summary-info');
        const educationData: any[] = [];

        educationElements.forEach((element) => {
            const schoolName = element.querySelector('h3, .pv-entity__school-name')?.textContent?.trim();
            const degree = element.querySelector('.pv-entity__degree-name, .pv-entity__secondary-title')?.textContent?.trim();
            const field = element.querySelector('.pv-entity__fos, .pv-entity__field-of-study')?.textContent?.trim();
            const dates = element.querySelector('.pv-entity__dates, .pv-entity__date-range')?.textContent?.trim();

            if (schoolName) {
                educationData.push({
                    schoolName,
                    degreeName: degree,
                    fieldOfStudy: field,
                    timePeriod: dates,
                    $type: 'com.linkedin.voyager.identity.profile.Education'
                });
            }
        });

        return educationData;
    }

    private extractWorkFromDOM(): any[] {
        const embeddedData = this.extractEmbeddedProfileData();
        if (embeddedData) {
            try {
                const jsonData = JSON.parse(embeddedData);
                if (jsonData && jsonData.included) {
                    return jsonData.included.filter(
                        (item: any) => item.$type === 'com.linkedin.voyager.identity.profile.Position' || item.$type === 'com.linkedin.voyager.dash.identity.profile.Position'
                    );
                }
            } catch (error) {
                this.debugConsole.warn('Failed to parse embedded work data:', error);
            }
        }

        // Fallback to DOM parsing
        const workElements = document.querySelectorAll('#experience ~ * .pvs-entity, .pv-profile-section.experience-section .pv-entity__summary-info');
        const workData: any[] = [];

        workElements.forEach((element) => {
            const title = element.querySelector('h3, .pv-entity__summary-info h3')?.textContent?.trim();
            const company = element.querySelector('.pv-entity__secondary-title, .pv-entity__company-name')?.textContent?.trim();
            const dates = element.querySelector('.pv-entity__dates, .pv-entity__date-range')?.textContent?.trim();
            const description = element.querySelector('.pv-entity__description, .pv-entity__extra-details')?.textContent?.trim();

            if (title && company) {
                workData.push({
                    title,
                    companyName: company,
                    timePeriod: dates,
                    description,
                    $type: 'com.linkedin.voyager.identity.profile.Position'
                });
            }
        });

        return workData;
    }

    private extractSkillsFromDOM(): any[] {
        const embeddedData = this.extractEmbeddedProfileData();
        if (embeddedData) {
            try {
                const jsonData = JSON.parse(embeddedData);
                if (jsonData && jsonData.included) {
                    return jsonData.included.filter((item: any) => item.$type === 'com.linkedin.voyager.identity.profile.Skill' || item.$type === 'com.linkedin.voyager.dash.identity.profile.Skill');
                }
            } catch (error) {
                this.debugConsole.warn('Failed to parse embedded skills data:', error);
            }
        }

        // Fallback to DOM parsing
        const skillElements = document.querySelectorAll('#skills ~ * .pvs-entity, .pv-profile-section.skills-section .pv-skill-category-entity__name');
        const skillsData: any[] = [];

        skillElements.forEach((element) => {
            const skillName = element.textContent?.trim();
            if (skillName) {
                skillsData.push({
                    name: skillName,
                    $type: 'com.linkedin.voyager.identity.profile.Skill'
                });
            }
        });

        return skillsData;
    }

    private extractVolunteerFromDOM(): any[] {
        const embeddedData = this.extractEmbeddedProfileData();
        if (embeddedData) {
            try {
                const jsonData = JSON.parse(embeddedData);
                if (jsonData && jsonData.included) {
                    return jsonData.included.filter(
                        (item: any) => item.$type === 'com.linkedin.voyager.identity.profile.VolunteerExperience' || item.$type === 'com.linkedin.voyager.dash.identity.profile.VolunteerExperience'
                    );
                }
            } catch (error) {
                this.debugConsole.warn('Failed to parse embedded volunteer data:', error);
            }
        }

        // Fallback to DOM parsing
        const volunteerElements = document.querySelectorAll('#volunteer-experience ~ * .pvs-entity, .pv-profile-section.volunteer-section .pv-entity__summary-info');
        const volunteerData: any[] = [];

        volunteerElements.forEach((element) => {
            const title = element.querySelector('h3, .pv-entity__summary-info h3')?.textContent?.trim();
            const organization = element.querySelector('.pv-entity__secondary-title, .pv-entity__company-name')?.textContent?.trim();
            const dates = element.querySelector('.pv-entity__dates, .pv-entity__date-range')?.textContent?.trim();
            const description = element.querySelector('.pv-entity__description, .pv-entity__extra-details')?.textContent?.trim();

            if (title && organization) {
                volunteerData.push({
                    title,
                    companyName: organization,
                    timePeriod: dates,
                    description,
                    $type: 'com.linkedin.voyager.identity.profile.VolunteerExperience'
                });
            }
        });

        return volunteerData;
    }
}
