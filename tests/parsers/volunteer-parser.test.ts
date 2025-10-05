import {
    parseVolunteerExperience,
    parseVolunteerExperienceList,
    extractCauses,
    groupByOrganization,
    calculateTotalDuration,
    formatDuration,
    LiVolunteerExperience,
    VolunteerParserDb
} from '../../src/parsers/volunteer-parser';

describe('Volunteer Experience Parser', () => {
    let mockDb: VolunteerParserDb;

    beforeEach(() => {
        mockDb = {
            entitiesByUrn: {}
        };
    });

    describe('parseVolunteerExperience', () => {
        it('should parse basic volunteer info', () => {
            const volunteer: LiVolunteerExperience = {
                companyName: 'Red Cross',
                role: 'Volunteer Coordinator',
                description: 'Organized blood drives',
                cause: 'Health'
            };

            const result = parseVolunteerExperience(volunteer, mockDb);

            expect(result.legacy.organization).toBe('Red Cross');
            expect(result.legacy.position).toBe('Volunteer Coordinator');
            expect(result.legacy.summary).toBe('Organized blood drives');
        });

        it('should parse stable format correctly', () => {
            const volunteer: LiVolunteerExperience = {
                companyName: 'Habitat for Humanity',
                role: 'Construction Helper',
                description: 'Built homes for families'
            };

            const result = parseVolunteerExperience(volunteer, mockDb);

            expect(result.stable.organization).toBe('Habitat for Humanity');
            expect(result.stable.position).toBe('Construction Helper');
            expect(result.stable.summary).toBe('Built homes for families');
        });

        it('should handle undefined fields gracefully', () => {
            const volunteer: LiVolunteerExperience = {
                companyName: 'Local Charity'
                // Missing other fields
            };

            const result = parseVolunteerExperience(volunteer, mockDb);

            expect(result.legacy.organization).toBe('Local Charity');
            expect(result.legacy.position).toBe('');
            expect(result.legacy.summary).toBe('');
            expect(result.legacy.website).toBe('');
        });

        it('should parse dates when provided', () => {
            const volunteer: LiVolunteerExperience = {
                companyName: 'Food Bank',
                role: 'Organizer',
                timePeriod: {
                    startDate: { year: 2020, month: 1 },
                    endDate: { year: 2022, month: 12 }
                }
            };

            const result = parseVolunteerExperience(volunteer, mockDb);

            expect(result.legacy.startDate).toBe('2020-01-01');
            expect(result.legacy.endDate).toBe('2022-12-31');
            expect(result.stable.startDate).toBe('2020-01-01');
            expect(result.stable.endDate).toBe('2022-12-31');
        });

        it('should handle current volunteer work (no end date)', () => {
            const volunteer: LiVolunteerExperience = {
                companyName: 'Animal Shelter',
                role: 'Volunteer',
                timePeriod: {
                    startDate: { year: 2023, month: 6 }
                    // No end date - still volunteering
                }
            };

            const result = parseVolunteerExperience(volunteer, mockDb);

            expect(result.legacy.startDate).toBe('2023-06-01');
            expect(result.legacy.endDate).toBe('');
        });

        it('should use url in stable format instead of website', () => {
            const volunteer: LiVolunteerExperience = {
                companyName: 'Test Org',
                role: 'Helper'
            };

            const result = parseVolunteerExperience(volunteer, mockDb);

            expect(result.legacy).toHaveProperty('website');
            expect(result.stable).toHaveProperty('url');
            expect(result.stable).not.toHaveProperty('website');
        });
    });

    describe('parseVolunteerExperienceList', () => {
        it('should parse multiple volunteer experiences', () => {
            const volunteers: LiVolunteerExperience[] = [
                { companyName: 'Red Cross', role: 'Helper' },
                { companyName: 'Food Bank', role: 'Organizer' },
                { companyName: 'Library', role: 'Tutor' }
            ];

            const result = parseVolunteerExperienceList(volunteers, mockDb);

            expect(result.legacy).toHaveLength(3);
            expect(result.stable).toHaveLength(3);
            expect(result.legacy[0].organization).toBe('Red Cross');
            expect(result.legacy[1].organization).toBe('Food Bank');
            expect(result.legacy[2].organization).toBe('Library');
        });

        it('should handle empty volunteer array', () => {
            const result = parseVolunteerExperienceList([], mockDb);

            expect(result.legacy).toEqual([]);
            expect(result.stable).toEqual([]);
        });

        it('should preserve order of experiences', () => {
            const volunteers: LiVolunteerExperience[] = [
                { companyName: 'Organization A', role: 'Role A' },
                { companyName: 'Organization B', role: 'Role B' },
                { companyName: 'Organization C', role: 'Role C' }
            ];

            const result = parseVolunteerExperienceList(volunteers, mockDb);

            expect(result.legacy.map((v) => v.organization)).toEqual(['Organization A', 'Organization B', 'Organization C']);
        });
    });

    describe('extractCauses', () => {
        it('should extract unique causes', () => {
            const volunteers: LiVolunteerExperience[] = [
                { companyName: 'Org 1', role: 'Role 1', cause: 'Education' },
                { companyName: 'Org 2', role: 'Role 2', cause: 'Health' },
                { companyName: 'Org 3', role: 'Role 3', cause: 'Environment' }
            ];

            const causes = extractCauses(volunteers);

            expect(causes).toHaveLength(3);
            expect(causes).toContain('Education');
            expect(causes).toContain('Health');
            expect(causes).toContain('Environment');
        });

        it('should deduplicate causes', () => {
            const volunteers: LiVolunteerExperience[] = [
                { companyName: 'Org 1', role: 'Role 1', cause: 'Education' },
                { companyName: 'Org 2', role: 'Role 2', cause: 'Education' },
                { companyName: 'Org 3', role: 'Role 3', cause: 'Health' }
            ];

            const causes = extractCauses(volunteers);

            expect(causes).toHaveLength(2);
            expect(causes).toContain('Education');
            expect(causes).toContain('Health');
        });

        it('should handle volunteers without causes', () => {
            const volunteers: LiVolunteerExperience[] = [
                { companyName: 'Org 1', role: 'Role 1' },
                { companyName: 'Org 2', role: 'Role 2', cause: 'Health' }
            ];

            const causes = extractCauses(volunteers);

            expect(causes).toEqual(['Health']);
        });

        it('should handle empty array', () => {
            const causes = extractCauses([]);
            expect(causes).toEqual([]);
        });
    });

    describe('groupByOrganization', () => {
        it('should group by organization', () => {
            const volunteers: LiVolunteerExperience[] = [
                { companyName: 'Red Cross', role: 'Helper' },
                { companyName: 'Red Cross', role: 'Coordinator' },
                { companyName: 'Food Bank', role: 'Volunteer' }
            ];

            const grouped = groupByOrganization(volunteers);

            expect(Object.keys(grouped)).toHaveLength(2);
            expect(grouped['Red Cross']).toHaveLength(2);
            expect(grouped['Food Bank']).toHaveLength(1);
        });

        it('should handle volunteers without organization', () => {
            const volunteers: LiVolunteerExperience[] = [{ companyName: undefined, role: 'Helper' }];

            const grouped = groupByOrganization(volunteers);

            expect(grouped['Unknown']).toHaveLength(1);
        });

        it('should handle empty array', () => {
            const grouped = groupByOrganization([]);
            expect(Object.keys(grouped)).toHaveLength(0);
        });
    });

    describe('calculateTotalDuration', () => {
        it('should calculate duration in months', () => {
            const volunteers: LiVolunteerExperience[] = [
                {
                    companyName: 'Org 1',
                    role: 'Role 1',
                    timePeriod: {
                        startDate: { year: 2020, month: 1 },
                        endDate: { year: 2020, month: 12 }
                    }
                }
            ];

            const duration = calculateTotalDuration(volunteers);

            expect(duration).toBe(11); // Jan to Dec (11 months difference)
        });

        it('should handle multiple volunteer experiences', () => {
            const volunteers: LiVolunteerExperience[] = [
                {
                    companyName: 'Org 1',
                    role: 'Role 1',
                    timePeriod: {
                        startDate: { year: 2020, month: 1 },
                        endDate: { year: 2020, month: 6 }
                    }
                },
                {
                    companyName: 'Org 2',
                    role: 'Role 2',
                    timePeriod: {
                        startDate: { year: 2021, month: 1 },
                        endDate: { year: 2021, month: 6 }
                    }
                }
            ];

            const duration = calculateTotalDuration(volunteers);

            expect(duration).toBe(10); // 5 months + 5 months
        });

        it('should handle ongoing volunteer work', () => {
            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth() + 1;

            const volunteers: LiVolunteerExperience[] = [
                {
                    companyName: 'Org',
                    role: 'Role',
                    timePeriod: {
                        startDate: { year: currentYear, month: 1 }
                        // No end date
                    }
                }
            ];

            const duration = calculateTotalDuration(volunteers);

            expect(duration).toBeGreaterThanOrEqual(0);
        });

        it('should handle volunteers without dates', () => {
            const volunteers: LiVolunteerExperience[] = [{ companyName: 'Org', role: 'Role' }];

            const duration = calculateTotalDuration(volunteers);

            expect(duration).toBe(0);
        });

        it('should handle volunteers with only start year', () => {
            const volunteers: LiVolunteerExperience[] = [
                {
                    companyName: 'Org',
                    role: 'Role',
                    timePeriod: {
                        startDate: { year: 2020 },
                        endDate: { year: 2021 }
                    }
                }
            ];

            const duration = calculateTotalDuration(volunteers);

            expect(duration).toBeGreaterThanOrEqual(0);
        });
    });

    describe('formatDuration', () => {
        it('should format less than a month', () => {
            expect(formatDuration(0)).toBe('Less than a month');
        });

        it('should format single month', () => {
            expect(formatDuration(1)).toBe('1 month');
        });

        it('should format multiple months', () => {
            expect(formatDuration(6)).toBe('6 months');
        });

        it('should format single year', () => {
            expect(formatDuration(12)).toBe('1 year');
        });

        it('should format multiple years', () => {
            expect(formatDuration(24)).toBe('2 years');
        });

        it('should format years and months', () => {
            expect(formatDuration(14)).toBe('1 year 2 months');
            expect(formatDuration(25)).toBe('2 years 1 month');
            expect(formatDuration(30)).toBe('2 years 6 months');
        });
    });

    describe('Edge Cases', () => {
        it('should handle null/undefined fields', () => {
            const volunteer: LiVolunteerExperience = {
                companyName: undefined,
                role: undefined,
                description: undefined
            };

            const result = parseVolunteerExperience(volunteer, mockDb);

            expect(result.legacy.organization).toBe('');
            expect(result.legacy.position).toBe('');
            expect(result.legacy.summary).toBe('');
        });

        it('should handle special characters in organization name', () => {
            const volunteer: LiVolunteerExperience = {
                companyName: "St. Mary's Hospital & Clinic (Non-Profit)",
                role: 'Volunteer'
            };

            const result = parseVolunteerExperience(volunteer, mockDb);

            expect(result.legacy.organization).toBe("St. Mary's Hospital & Clinic (Non-Profit)");
        });

        it('should handle unicode in description', () => {
            const volunteer: LiVolunteerExperience = {
                companyName: 'Global Aid',
                role: 'Volunteer',
                description: 'Helped communities in 中国 🌍'
            };

            const result = parseVolunteerExperience(volunteer, mockDb);

            expect(result.legacy.summary).toContain('中国');
            expect(result.legacy.summary).toContain('🌍');
        });

        it('should handle very long descriptions', () => {
            const longDescription = 'A'.repeat(5000);
            const volunteer: LiVolunteerExperience = {
                companyName: 'Org',
                role: 'Role',
                description: longDescription
            };

            const result = parseVolunteerExperience(volunteer, mockDb);

            expect(result.legacy.summary).toBe(longDescription);
            expect(result.legacy.summary).toHaveLength(5000);
        });
    });
});
