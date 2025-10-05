/**
 * Certificate Parser
 *
 * Parses LinkedIn certification data into JSON Resume format
 */

import { noNullOrUndef } from '../utilities';

/**
 * Parse a single LinkedIn certification
 */
export function parseCertificate(cert: any, isDash: boolean = false): any {
    const name = cert.name || '';
    const authority = cert.authority || cert.company?.name || '';
    const url = cert.url || cert.licenseNumber || '';

    // Parse date
    let date = '';
    if (cert.timePeriod) {
        if (cert.timePeriod.startDate) {
            const { startDate } = cert.timePeriod;
            date = `${startDate.year || ''}${startDate.month ? `-${String(startDate.month).padStart(2, '0')}` : ''}`;
        }
    } else if (cert.displayedOn) {
        // Some certs might have displayedOn field
        const displayDate = cert.displayedOn;
        if (displayDate.year) {
            date = `${displayDate.year}${displayDate.month ? `-${String(displayDate.month).padStart(2, '0')}` : ''}`;
        }
    }

    return noNullOrUndef({
        name,
        issuer: authority,
        date,
        url
    });
}

/**
 * Parse a list of certifications
 */
export function parseCertificationList(certifications: any[]): { legacy: any[]; stable: any[] } {
    const legacyCerts: any[] = [];
    const stableCerts: any[] = [];

    for (const cert of certifications) {
        const parsed = parseCertificate(cert, true);

        // Legacy schema doesn't have certificates, so we'll add to stable only
        // But keep both arrays for consistency
        stableCerts.push(parsed);
        legacyCerts.push(parsed);
    }

    return {
        legacy: legacyCerts,
        stable: stableCerts
    };
}
