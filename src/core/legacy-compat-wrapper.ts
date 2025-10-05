/**
 * Legacy Compatibility Wrapper
 * 
 * Provides backward compatibility with the old LinkedinToResumeJson constructor function API.
 * This wrapper makes the new LinkedInExtractor class work exactly like the old API
 * so existing browser extension and bookmarklet code continues to work without changes.
 * 
 * @deprecated This wrapper exists for backward compatibility only. New code should use LinkedInExtractor directly.
 */

import { LinkedInExtractor, ExtractorOptions } from './linkedin-extractor';
import { sendToApi } from '../utilities';

/**
 * Legacy API wrapper class that mimics the old LinkedinToResumeJson constructor function
 */
export class LinkedinToResumeJsonCompat {
    private extractor: LinkedInExtractor;
    public profileId: string;
    public profileUrnId: string | null = null;
    public profileParseSummary: any = null;
    public lastScannedLocale: string | null = null;
    public preferLocale: string | null = null;
    public apiEndpoint: string | null = null;
    public scannedPageUrl: string = '';
    public parseSuccess: boolean = false;
    public getFullSkills: boolean;
    public preferApi: boolean;
    public debug: boolean;
    public debugConsole: Console;
    public internals?: any;

    constructor(OPT_debug?: boolean, OPT_preferApi?: boolean, OPT_getFullSkills?: boolean) {
        // Convert old-style arguments to new options object
        const options: ExtractorOptions = {
            debug: typeof OPT_debug === 'boolean' ? OPT_debug : false,
            preferApi: typeof OPT_preferApi === 'boolean' ? OPT_preferApi : true,
            getFullSkills: typeof OPT_getFullSkills === 'boolean' ? OPT_getFullSkills : true
        };

        this.extractor = new LinkedInExtractor(options);
        
        // Copy properties for compatibility
        this.debug = options.debug ?? false;
        this.preferApi = options.preferApi ?? true;
        this.getFullSkills = options.getFullSkills ?? true;
        
        // Get profileId from extractor
        this.profileId = (this.extractor as any).profileId || '';
        
        // Set up debug console
        this.debugConsole = (this.extractor as any).debugConsole;

        if (this.debug) {
            console.warn('LinkedinToResumeJson - DEBUG mode is ON (using new LinkedInExtractor under the hood)');
        }
    }

    /**
     * Parse profile and download as JSON file
     */
    async parseAndDownload(version: 'legacy' | 'stable' = 'stable'): Promise<void> {
        try {
            const result = await this.extractor.extractProfile();
            
            if (result.success) {
                this.parseSuccess = true;
                this.profileParseSummary = result.summary;
                this.lastScannedLocale = result.locale;
                this.profileUrnId = result.profileUrnId || null;
                
                // Download using the extractor's method
                this.extractor.downloadProfile(version);
            } else {
                this.parseSuccess = false;
                throw new Error(result.error || 'Profile extraction failed');
            }
        } catch (error) {
            this.parseSuccess = false;
            console.error('Error in parseAndDownload:', error);
            throw error;
        }
    }

    /**
     * Parse profile and send to API
     */
    async parseAndSendToApi(url: string, entity: string = 'subcontractor', version: 'legacy' | 'stable' = 'stable'): Promise<any> {
        try {
            const result = await this.extractor.extractProfile();
            
            if (result.success) {
                this.parseSuccess = true;
                this.profileParseSummary = result.summary;
                this.lastScannedLocale = result.locale;
                this.profileUrnId = result.profileUrnId || null;
                this.apiEndpoint = url;
                
                // Get the appropriate JSON format
                const jsonData = version === 'legacy' ? result.legacy : result.stable;
                
                // Wrap in payload object with entity type (as expected by the API)
                const payload = {
                    entity: entity,
                    data: jsonData
                };
                
                // Send to API using the utility function
                // Note: sendToApi signature is (data, endpoint)
                return await sendToApi(JSON.stringify(payload, null, 2), url);
            } else {
                this.parseSuccess = false;
                throw new Error(result.error || 'Profile extraction failed');
            }
        } catch (error) {
            this.parseSuccess = false;
            console.error('Error in parseAndSendToApi:', error);
            throw error;
        }
    }

    /**
     * Parse profile and show output in modal
     */
    async parseAndShowOutput(version: 'legacy' | 'stable' = 'stable'): Promise<any> {
        try {
            const result = await this.extractor.extractProfile();
            
            if (result.success) {
                this.parseSuccess = true;
                this.profileParseSummary = result.summary;
                this.lastScannedLocale = result.locale;
                this.profileUrnId = result.profileUrnId || null;
                
                // Get the appropriate JSON format
                const jsonData = version === 'legacy' ? result.legacy : result.stable;
                
                // Show the modal with the JSON data
                this.showModal(jsonData);
                return jsonData;
            } else {
                this.parseSuccess = false;
                throw new Error(result.error || 'Profile extraction failed');
            }
        } catch (error) {
            this.parseSuccess = false;
            console.error('Error in parseAndShowOutput:', error);
            throw error;
        }
    }

    /**
     * Get profile ID from current URL
     */
    getProfileId(): string {
        return (this.extractor as any).getProfileId();
    }

    /**
     * Get viewer's local language
     */
    getViewersLocalLang(): string {
        return (this.extractor as any).getViewersLocalLang();
    }

    /**
     * Get supported locales
     */
    async getSupportedLocales(): Promise<string[]> {
        // Return a static list of supported locales
        // The new implementation doesn't have dynamic locale discovery
        return [
            'en_US',
            'es_ES',
            'pt_BR',
            'fr_FR',
            'de_DE',
            'it_IT',
            'nl_NL',
            'pl_PL',
            'ru_RU',
            'ja_JP',
            'ko_KR',
            'zh_CN',
            'zh_TW'
        ];
    }

    /**
     * Check if profile exists (for API integration)
     */
    async checkProfileExists(checkUrl: string): Promise<any> {
        try {
            const currentUrl = window.location.href.split('?')[0];
            this.debugConsole.log('Checking profile with:', {
                currentUrl,
                checkUrl
            });

            const response = await fetch(checkUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({ url: currentUrl })
            });

            if (!response.ok) {
                const errorMessage = `Failed to check profile status: ${response.status} ${response.statusText}`;
                this.debugConsole.error(errorMessage);
                
                // Send message to extension if available
                if (typeof chrome !== 'undefined' && chrome.runtime) {
                    chrome.runtime.sendMessage({
                        key: 'profileCheckResult',
                        value: { error: errorMessage }
                    });
                }
                
                return { error: errorMessage };
            }

            const data = await response.json();
            this.debugConsole.log('Profile check response:', data);

            // Send result back to popup if extension available
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({
                    key: 'profileCheckResult',
                    value: data
                });
            }

            return data;
        } catch (error: any) {
            const errorMessage = `Network error: ${error.message}`;
            this.debugConsole.error('Error checking profile status:', error);
            
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({
                    key: 'profileCheckResult',
                    value: { error: errorMessage }
                });
            }
            
            return { error: errorMessage };
        }
    }

    /**
     * Show the output modal with the results
     */
    showModal(jsonResume: any): void {
        const toolPrefix = 'jtzLiToResumeJson';
        const modalWrapperId = `${toolPrefix}_modalWrapper`;
        let modalWrapper = document.getElementById(modalWrapperId);
        
        if (modalWrapper) {
            modalWrapper.style.display = 'block';
        } else {
            this.injectStyles();
            modalWrapper = document.createElement('div');
            modalWrapper.id = modalWrapperId;
            modalWrapper.innerHTML = `<div class="${toolPrefix}_modal">
                <div class="${toolPrefix}_topBar">
                    <div class="${toolPrefix}_titleText">Profile Export:</div>
                    <div class="${toolPrefix}_closeButton">X</div>
                </div>
                <div class="${toolPrefix}_modalBody">
                    <textarea id="${toolPrefix}_exportTextField">Export will appear here...</textarea>
                </div>
            </div>`;
            document.body.appendChild(modalWrapper);
            
            // Add event listeners
            modalWrapper.addEventListener('click', (evt) => {
                // Check if click was on modal content, or wrapper (outside content, to trigger close)
                if ((evt.target as HTMLElement).id === modalWrapperId) {
                    this.closeModal();
                }
            });
            
            const closeButton = modalWrapper.querySelector(`.${toolPrefix}_closeButton`);
            if (closeButton) {
                closeButton.addEventListener('click', () => {
                    this.closeModal();
                });
            }
            
            const textarea = modalWrapper.querySelector(`#${toolPrefix}_exportTextField`) as HTMLTextAreaElement;
            if (textarea) {
                textarea.addEventListener('click', () => {
                    textarea.select();
                });
            }
        }
        
        // Actually set textarea text
        const outputTextArea = modalWrapper.querySelector(`#${toolPrefix}_exportTextField`) as HTMLTextAreaElement;
        if (outputTextArea) {
            outputTextArea.value = JSON.stringify(jsonResume, null, 2);
        }
    }

    /**
     * Close the modal
     */
    closeModal(): void {
        const toolPrefix = 'jtzLiToResumeJson';
        const modalWrapperId = `${toolPrefix}_modalWrapper`;
        const modalWrapper = document.getElementById(modalWrapperId);
        if (modalWrapper) {
            modalWrapper.style.display = 'none';
        }
    }

    /**
     * Inject CSS styles for the modal
     */
    private injectStyles(): void {
        const toolPrefix = 'jtzLiToResumeJson';
        const styleId = `${toolPrefix}_styles`;
        
        // Check if styles are already injected
        if (document.getElementById(styleId)) {
            return;
        }
        
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.innerText = `#${toolPrefix}_modalWrapper {
            width: 100%;
            height: 100%;
            position: fixed;
            top: 0;
            left: 0;
            background-color: rgba(0, 0, 0, 0.8);
            z-index: 99999999999999999999999999999999
        }
        .${toolPrefix}_modal {
            width: 80%;
            margin-top: 10%;
            margin-left: 10%;
            background-color: white;
            padding: 20px;
            border-radius: 13px;
        }
        .${toolPrefix}_topBar {
            width: 100%;
            position: relative;
        }
        .${toolPrefix}_titleText {
            text-align: center;
            font-size: x-large;
            width: 100%;
            padding-top: 8px;
        }
        .${toolPrefix}_closeButton {
            position: absolute;
            top: 0px;
            right: 0px;
            padding: 0px 8px;
            margin: 3px;
            border: 4px double black;
            border-radius: 10px;
            font-size: x-large;
            cursor: pointer;
        }
        .${toolPrefix}_modalBody {
            width: 90%;
            margin-left: 5%;
            margin-top: 20px;
            padding-top: 8px;
        }
        #${toolPrefix}_exportTextField {
            width: 100%;
            min-height: 300px;
            font-family: monospace;
            font-size: 12px;
        }`;
        document.body.appendChild(styleElement);
    }

    /**
     * Legacy method to get URL without query string
     */
    private getUrlWithoutQuery(): string {
        return window.location.href.split('?')[0];
    }
}

