/**
 * Tests for Certificate Parser
 */

import { parseCertificate, parseCertificationList } from '../../src/parsers/certificate-parser';

describe('Certificate Parser', () => {
    describe('parseCertificate', () => {
        it('should parse basic certificate information', () => {
            const cert = {
                name: 'AWS Certified Solutions Architect',
                authority: 'Amazon Web Services',
                url: 'https://aws.amazon.com/certification/',
                timePeriod: {
                    startDate: {
                        year: 2023,
                        month: 6
                    }
                }
            };

            const result = parseCertificate(cert, true);

            expect(result.name).toBe('AWS Certified Solutions Architect');
            expect(result.issuer).toBe('Amazon Web Services');
            expect(result.date).toBe('2023-06');
            expect(result.url).toBe('https://aws.amazon.com/certification/');
        });

        it('should handle certificate with company object', () => {
            const cert = {
                name: 'Professional Scrum Master',
                company: {
                    name: 'Scrum.org'
                },
                timePeriod: {
                    startDate: {
                        year: 2022
                    }
                }
            };

            const result = parseCertificate(cert, true);

            expect(result.name).toBe('Professional Scrum Master');
            expect(result.issuer).toBe('Scrum.org');
            expect(result.date).toBe('2022');
        });

        it('should handle missing optional fields', () => {
            const cert = {
                name: 'Some Certificate'
            };

            const result = parseCertificate(cert, true);

            expect(result.name).toBe('Some Certificate');
            expect(result.issuer).toBe('');
            expect(result.date).toBe('');
            expect(result.url).toBe('');
        });
    });

    describe('parseCertificationList', () => {
        it('should parse a list of certificates', () => {
            const certs = [
                {
                    name: 'Certificate 1',
                    authority: 'Issuer 1',
                    timePeriod: {
                        startDate: {
                            year: 2023
                        }
                    }
                },
                {
                    name: 'Certificate 2',
                    authority: 'Issuer 2',
                    timePeriod: {
                        startDate: {
                            year: 2022
                        }
                    }
                }
            ];

            const result = parseCertificationList(certs);

            expect(result.legacy).toHaveLength(2);
            expect(result.stable).toHaveLength(2);
            expect(result.stable[0].name).toBe('Certificate 1');
            expect(result.stable[1].name).toBe('Certificate 2');
        });

        it('should handle empty certificate list', () => {
            const result = parseCertificationList([]);

            expect(result.legacy).toEqual([]);
            expect(result.stable).toEqual([]);
        });
    });
});

