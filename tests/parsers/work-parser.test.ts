import { parseWorkPosition, parseWorkPositionList, extractHighlights, parseWorkPositionWithHighlights, LiWorkPosition, WorkParserDb } from '../../src/parsers/work-parser';

describe('Work Experience Parser', () => {
    let mockDb: WorkParserDb;

    beforeEach(() => {
        mockDb = {
            entitiesByUrn: {}
        };
    });

    describe('parseWorkPosition', () => {
        it('should parse basic work position info', () => {
            const position: LiWorkPosition = {
                companyName: 'Google',
                title: 'Software Engineer',
                description: 'Worked on search algorithms',
                locationName: 'Mountain View, CA'
            };

            const result = parseWorkPosition(position, mockDb);

            expect(result.legacy.company).toBe('Google');
            expect(result.legacy.position).toBe('Software Engineer');
            expect(result.legacy.summary).toBe('Worked on search algorithms');
            expect(result.legacy.highlights).toEqual([]);
        });

        it('should parse stable format correctly', () => {
            const position: LiWorkPosition = {
                companyName: 'Microsoft',
                title: 'Senior Developer',
                description: 'Led Azure team',
                locationName: 'Redmond, WA'
            };

            const result = parseWorkPosition(position, mockDb);

            expect(result.stable.name).toBe('Microsoft');
            expect(result.stable.position).toBe('Senior Developer');
            expect(result.stable.summary).toBe('Led Azure team');
            expect(result.stable.location).toBe('Redmond, WA');
        });

        it('should handle undefined fields gracefully', () => {
            const position: LiWorkPosition = {
                companyName: 'Test Company'
                // Missing other fields
            };

            const result = parseWorkPosition(position, mockDb);

            expect(result.legacy.company).toBe('Test Company');
            expect(result.legacy.position).toBe('');
            expect(result.legacy.summary).toBe('');
            expect(result.legacy.website).toBe('');
            expect(result.stable.location).toBe('');
        });

        it('should parse dates when provided', () => {
            const position: LiWorkPosition = {
                companyName: 'Apple',
                title: 'Designer',
                timePeriod: {
                    startDate: { year: 2018, month: 3 },
                    endDate: { year: 2021, month: 8 }
                }
            };

            const result = parseWorkPosition(position, mockDb);

            expect(result.legacy.startDate).toBe('2018-03-01');
            expect(result.legacy.endDate).toBe('2021-08-31');
            expect(result.stable.startDate).toBe('2018-03-01');
            expect(result.stable.endDate).toBe('2021-08-31');
        });

        it('should extract company website from URN', () => {
            const position: LiWorkPosition = {
                companyName: 'Tesla',
                title: 'Engineer',
                companyUrn: 'urn:li:company:12345'
            };

            // Mock the database with getElementByUrn method
            const mockDbWithMethod: any = {
                entitiesByUrn: {
                    'urn:li:company:12345': {
                        url: 'https://tesla.com',
                        universalName: 'tesla'
                    }
                },
                getElementByUrn: (urn: string) => mockDbWithMethod.entitiesByUrn[urn]
            };

            const result = parseWorkPosition(position, mockDbWithMethod);

            // companyLiPageFromCompanyUrn should extract the LinkedIn company page
            expect(result.legacy.website).toContain('tesla');
            expect(result.stable.url).toContain('tesla');
        });

        it('should handle empty companyUrn', () => {
            const position: LiWorkPosition = {
                companyName: 'Startup Inc',
                title: 'Founder'
            };

            const result = parseWorkPosition(position, mockDb);

            expect(result.legacy.website).toBe('');
            expect(result.stable.url).toBe('');
        });

        it('should handle current positions (no end date)', () => {
            const position: LiWorkPosition = {
                companyName: 'Current Company',
                title: 'Developer',
                timePeriod: {
                    startDate: { year: 2020, month: 1 }
                    // No end date
                }
            };

            const result = parseWorkPosition(position, mockDb);

            expect(result.legacy.startDate).toBe('2020-01-01');
            expect(result.legacy.endDate).toBe(''); // Still working there
        });
    });

    describe('parseWorkPositionList', () => {
        it('should parse multiple work positions', () => {
            const positions: LiWorkPosition[] = [
                {
                    companyName: 'Company A',
                    title: 'Role A'
                },
                {
                    companyName: 'Company B',
                    title: 'Role B'
                },
                {
                    companyName: 'Company C',
                    title: 'Role C'
                }
            ];

            const result = parseWorkPositionList(positions, mockDb);

            expect(result.legacy).toHaveLength(3);
            expect(result.stable).toHaveLength(3);
            expect(result.legacy[0].company).toBe('Company A');
            expect(result.legacy[1].company).toBe('Company B');
            expect(result.legacy[2].company).toBe('Company C');
        });

        it('should handle empty positions array', () => {
            const result = parseWorkPositionList([], mockDb);

            expect(result.legacy).toEqual([]);
            expect(result.stable).toEqual([]);
        });

        it('should preserve order of positions', () => {
            const positions: LiWorkPosition[] = [
                { companyName: 'First Job', title: 'Junior' },
                { companyName: 'Second Job', title: 'Mid' },
                { companyName: 'Third Job', title: 'Senior' }
            ];

            const result = parseWorkPositionList(positions, mockDb);

            expect(result.legacy.map((w) => w.company)).toEqual(['First Job', 'Second Job', 'Third Job']);
        });
    });

    describe('extractHighlights', () => {
        it('should extract bullet points with •', () => {
            const description = `
Some intro text.
• Improved performance by 50%
• Led team of 5 developers
• Shipped 3 major features
Other text.
            `;

            const highlights = extractHighlights(description);

            expect(highlights).toEqual(['Improved performance by 50%', 'Led team of 5 developers', 'Shipped 3 major features']);
        });

        it('should extract bullet points with -', () => {
            const description = `
Responsibilities:
- Designed system architecture
- Mentored junior developers
- Reduced bugs by 40%
            `;

            const highlights = extractHighlights(description);

            expect(highlights).toEqual(['Designed system architecture', 'Mentored junior developers', 'Reduced bugs by 40%']);
        });

        it('should extract bullet points with *', () => {
            const description = `
* Built microservices platform
* Implemented CI/CD pipeline
* Achieved 99.9% uptime
            `;

            const highlights = extractHighlights(description);

            expect(highlights).toEqual(['Built microservices platform', 'Implemented CI/CD pipeline', 'Achieved 99.9% uptime']);
        });

        it('should extract numbered achievements', () => {
            const description = `
Key achievements:
1. Increased revenue by $1M
2. Reduced costs by 30%
3. Improved customer satisfaction
            `;

            const highlights = extractHighlights(description);

            expect(highlights).toEqual(['Increased revenue by $1M', 'Reduced costs by 30%', 'Improved customer satisfaction']);
        });

        it('should extract numbered achievements with parentheses', () => {
            const description = `
1) First achievement
2) Second achievement
3) Third achievement
            `;

            const highlights = extractHighlights(description);

            expect(highlights).toEqual(['First achievement', 'Second achievement', 'Third achievement']);
        });

        it('should respect maxHighlights limit', () => {
            const description = `
• Point 1
• Point 2
• Point 3
• Point 4
• Point 5
• Point 6
• Point 7
            `;

            const highlights = extractHighlights(description, 3);

            expect(highlights).toHaveLength(3);
            expect(highlights).toEqual(['Point 1', 'Point 2', 'Point 3']);
        });

        it('should handle mixed bullet types', () => {
            const description = `
• Bullet point
- Hyphen point
* Asterisk point
1. Numbered point
            `;

            const highlights = extractHighlights(description);

            expect(highlights).toEqual(['Bullet point', 'Hyphen point', 'Asterisk point', 'Numbered point']);
        });

        it('should return empty array for undefined description', () => {
            const highlights = extractHighlights(undefined);
            expect(highlights).toEqual([]);
        });

        it('should return empty array for description without bullets', () => {
            const description = 'Just a regular paragraph without any bullet points.';
            const highlights = extractHighlights(description);
            expect(highlights).toEqual([]);
        });

        it('should trim whitespace from extracted highlights', () => {
            const description = `
•    Extra spaces at start
-    And here too    
            `;

            const highlights = extractHighlights(description);

            expect(highlights).toEqual(['Extra spaces at start', 'And here too']);
        });
    });

    describe('parseWorkPositionWithHighlights', () => {
        it('should parse with highlights when enabled', () => {
            const position: LiWorkPosition = {
                companyName: 'Tech Corp',
                title: 'Developer',
                description: `
Worked on various projects:
• Built API gateway
• Implemented authentication
• Optimized database queries
                `
            };

            const result = parseWorkPositionWithHighlights(position, mockDb, true);

            expect(result.legacy.highlights).toEqual(['Built API gateway', 'Implemented authentication', 'Optimized database queries']);
            expect(result.stable.highlights).toEqual(result.legacy.highlights);
        });

        it('should not extract highlights when disabled', () => {
            const position: LiWorkPosition = {
                companyName: 'Tech Corp',
                title: 'Developer',
                description: `
• Achievement 1
• Achievement 2
                `
            };

            const result = parseWorkPositionWithHighlights(position, mockDb, false);

            expect(result.legacy.highlights).toEqual([]);
            expect(result.stable.highlights).toEqual([]);
        });

        it('should handle position without description', () => {
            const position: LiWorkPosition = {
                companyName: 'Tech Corp',
                title: 'Developer'
                // No description
            };

            const result = parseWorkPositionWithHighlights(position, mockDb, true);

            expect(result.legacy.highlights).toEqual([]);
        });
    });

    describe('Edge Cases', () => {
        it('should handle null/undefined fields', () => {
            const position: LiWorkPosition = {
                companyName: undefined,
                title: undefined,
                description: undefined,
                locationName: undefined
            };

            const result = parseWorkPosition(position, mockDb);

            expect(result.legacy.company).toBe('');
            expect(result.legacy.position).toBe('');
            expect(result.legacy.summary).toBe('');
            expect(result.stable.location).toBe('');
        });

        it('should handle very long descriptions', () => {
            const longDescription = 'A'.repeat(10000);
            const position: LiWorkPosition = {
                companyName: 'Company',
                title: 'Role',
                description: longDescription
            };

            const result = parseWorkPosition(position, mockDb);

            expect(result.legacy.summary).toBe(longDescription);
            expect(result.legacy.summary).toHaveLength(10000);
        });

        it('should handle special characters in company name', () => {
            const position: LiWorkPosition = {
                companyName: 'Company & Co. (Pty) Ltd.',
                title: 'Developer'
            };

            const result = parseWorkPosition(position, mockDb);

            expect(result.legacy.company).toBe('Company & Co. (Pty) Ltd.');
        });

        it('should handle unicode characters in description', () => {
            const position: LiWorkPosition = {
                companyName: 'Global Corp',
                title: 'Developer',
                description: '开发了新功能 🚀 Développé des fonctionnalités'
            };

            const result = parseWorkPosition(position, mockDb);

            expect(result.legacy.summary).toContain('开发了新功能');
            expect(result.legacy.summary).toContain('🚀');
            expect(result.legacy.summary).toContain('Développé');
        });
    });
});
