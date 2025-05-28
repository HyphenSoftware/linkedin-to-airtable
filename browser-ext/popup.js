// @ts-nocheck
/**
 * =============================
 * =        Constants          =
 * =============================
 */

/** @typedef {'legacy' | 'stable' | 'beta'} SchemaVersion */

/**
 * @typedef {Object} LinkedinToResumeJson
 * @property {string} preferLocale - The preferred locale for the resume
 * @property {string} apiEndpoint - The API endpoint for sending data
 * @property {function(string, string): void} parseAndSendToApi - Function to parse and send data to API
 * @property {function(): void} parseAndDownload - Function to parse and download data
 * @property {function(string): void} parseAndShowOutput - Function to parse and show output
 * @property {function(): Promise<string[]>} getSupportedLocales - Function to get supported locales
 * @property {function(): string} getViewersLocalLang - Function to get viewer's local language
 */

// We'll initialize this after the content script is loaded
let liToJrInstance;

const extensionId = chrome.runtime.id;

const STORAGE_KEYS = {
    schemaVersion: 'schemaVersion'
};
const SPEC_SELECT = /** @type {HTMLSelectElement} */ (document.getElementById('specSelect'));
/** @type {SchemaVersion[]} */
const SPEC_OPTIONS = ['legacy', 'stable', 'beta'];
/** @type {HTMLSelectElement} */
const LANG_SELECT = document.querySelector('.langSelect');
/** @type {HTMLSelectElement} */
const API_SELECT = document.querySelector('.apiSelect');

/**
 * Get the currently selected lang locale in the selector
 */
const getSelectedLang = () => {
    return LANG_SELECT.value;
};

/**
 * Get the currently selected API endpoint from the selector
 * @returns {{importUrl: string, checkUrl: string} | null}
 */
const getSelectedAPIEndpoint = () => {
    const { value } = API_SELECT;
    if (!value || value === 'none') {
        return null;
    }
    return JSON.parse(value);
};

/**
 * Toggle enabled state of popup
 * @param {boolean} isEnabled
 */
const toggleEnabled = (isEnabled) => {
    document.querySelectorAll('.toggle').forEach((elem) => {
        elem.classList.remove(isEnabled ? 'disabled' : 'enabled');
        elem.classList.add(isEnabled ? 'enabled' : 'disabled');
    });
};

/**
 * Toggle loader while doing API requests
 * @param {boolean} isEnabled
 */
const showLoader = (isEnabled) => {
    document.querySelectorAll('.loader').forEach((elem) => {
        if (isEnabled) {
            elem.classList.remove('hidden');
        } else {
            elem.classList.add('hidden');
        }
    });
};

/**
 * Load list of language strings to be displayed as options
 * @param {string[]} langs
 */
const loadLangs = (langs) => {
    LANG_SELECT.innerHTML = '';
    langs.forEach((lang) => {
        const option = document.createElement('option');
        option.value = lang;
        option.innerText = lang;
        LANG_SELECT.appendChild(option);
    });
    toggleEnabled(langs.length > 0);
};

/**
 * Load list of API endpoints to be displayed as options
 * @param {Object[]} apiEndpoints - api endpoints
 * @param {string} apiEndpoints[].name - name of the endpoint
 * @param {string} apiEndpoints[].importUrl - URL for import
 * @param {string} apiEndpoints[].checkUrl - URL for checking profile
 */
const loadApiEndpoints = (apiEndpoints) => {
    API_SELECT.innerHTML = '';
    apiEndpoints.forEach((endpoint) => {
        if (endpoint && endpoint.name) {
            const option = document.createElement('option');
            option.value = JSON.stringify({
                importUrl: endpoint.importUrl,
                checkUrl: endpoint.checkUrl
            });
            option.innerText = endpoint.name;
            API_SELECT.appendChild(option);
        }
    });
    toggleEnabled(apiEndpoints.length > 0);
};

/**
 * Set the desired export lang on the exporter instance
 * - Use `null` to unset
 * @param {string | null} lang
 */
const setLang = (lang) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: (langValue) => {
                liToJrInstance.preferLocale = langValue;
            },
            args: [lang]
        });
    });
};

/**
 * Set the desired API endpoint on the exporter instance
 * - Use `null` to unset
 * @param {string | null} endpoint
 */
const setApiEndpoint = (endpoint) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: (endpointValue) => {
                liToJrInstance.apiEndpoint = endpointValue?.importUrl || null;
            },
            args: [endpoint]
        });
    });
};

/** @param {SchemaVersion} version */
const setSpecVersion = (version) => {
    chrome.storage.sync.set({
        [STORAGE_KEYS.schemaVersion]: version
    });
};

/**
 * Get user's preference for JSONResume Spec Version
 * @returns {Promise<SchemaVersion>}
 */
const getSpecVersion = () => {
    // Fallback value will be what is already selected in dropdown
    const fallbackVersion = /** @type {SchemaVersion} */ (SPEC_SELECT.value);
    return new Promise((res) => {
        try {
            chrome.storage.sync.get([STORAGE_KEYS.schemaVersion], (result) => {
                const storedSetting = result[STORAGE_KEYS.schemaVersion] || '';
                if (SPEC_OPTIONS.includes(storedSetting)) {
                    res(storedSetting);
                } else {
                    res(fallbackVersion);
                }
            });
        } catch (err) {
            console.error(err);
            res(fallbackVersion);
        }
    });
};

/**
 * Update the UI to show profile status
 * @param {{subcontractor: boolean, contact: boolean, error?: string} | 'loading'} status
 */
const updateProfileStatus = (status) => {
    console.log('Updating profile status:', status);

    // Update subcontractor button
    const subcontractorButton = document.getElementById('liToSubcontractor');
    if (subcontractorButton) {
        if (status === 'loading') {
            subcontractorButton.style.backgroundColor = '#808080';
            subcontractorButton.title = 'Checking profile status...';
            subcontractorButton.disabled = true;
        } else {
            subcontractorButton.style.backgroundColor = status.subcontractor ? '#4CAF50' : '#f44336';
            subcontractorButton.title = status.subcontractor ? 'Profile exists as subcontractor' : 'Add as Subcontractor';
            subcontractorButton.disabled = false;
        }
    }

    // Update contact button
    const contactButton = document.getElementById('liToContact');
    if (contactButton) {
        if (status === 'loading') {
            contactButton.style.backgroundColor = '#808080';
            contactButton.title = 'Checking profile status...';
            contactButton.disabled = true;
        } else {
            contactButton.style.backgroundColor = status.contact ? '#4CAF50' : '#f44336';
            contactButton.title = status.contact ? 'Profile exists as contact' : 'Add as Contact';
            contactButton.disabled = false;
        }
    }

    // Update status text
    const statusElement = document.getElementById('profileStatus');
    if (!statusElement) {
        const statusDiv = document.createElement('div');
        statusDiv.id = 'profileStatus';
        statusDiv.className = 'fullCenter';
        document.body.insertBefore(statusDiv, document.querySelector('.fullCenter'));
    }

    const statusDiv = document.getElementById('profileStatus');
    if (status === 'loading') {
        statusDiv.innerHTML = '<div class="status-indicator loading">Checking profile status...</div>';
    } else if (status.error) {
        statusDiv.innerHTML = `<div class="status-indicator error">${status.error}</div>`;
    } else {
        const innerHtml = [];
        innerHtml.push(`<div class="status-indicator ${status.subcontractor ? 'exists' : 'not-exists'}">${status.subcontractor ? 'Profile exists as subcontractor' : 'Subcontractor not found'}</div>`);
        innerHtml.push(`<div class="status-indicator ${status.contact ? 'exists' : 'not-exists'}">${status.contact ? 'Profile exists as contact' : 'Contact not found'}</div>`);
        statusDiv.innerHTML = innerHtml.join('');
    }
};

/**
 * =============================
 * =   Setup Event Listeners   =
 * =============================
 */

chrome.runtime.onMessage.addListener((message, sender) => {
    if (sender.id === extensionId && message.key === 'locales') {
        /** @type {{supported: string[], user: string}} */
        const { supported, user } = message.value;
        // Make sure user's own locale comes as first option
        if (supported.includes(user)) {
            supported.splice(supported.indexOf(user), 1);
        }
        supported.unshift(user);
        loadLangs(supported);

        const url = chrome.runtime.getURL('./endpoints.json');
        fetch(url)
            .then((response) => response.json())
            .then((json) => loadApiEndpoints(json));
    } else if (sender.id === extensionId && message.key === 'profileCheckResult') {
        updateProfileStatus(message.value);
    }
});

document.getElementById('liToJsonButton').addEventListener('click', async () => {
    const versionOption = await getSpecVersion();
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting
            .executeScript({
                target: { tabId: tabs[0].id },
                func: (version) => {
                    liToJrInstance.preferLocale = window.liToJrInstance.getViewersLocalLang();
                    liToJrInstance.parseAndShowOutput(version);
                },
                args: [versionOption]
            })
            .then(() => {
                setTimeout(() => {
                    // Close popup
                    window.close();
                }, 700);
            });
    });
});

document.getElementById('liToSubcontractor').addEventListener('click', async () => {
    showLoader(true);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: (lang, endpoint) => {
                liToJrInstance.preferLocale = lang;
                liToJrInstance.parseAndSendToApi(endpoint.importUrl, 'subcontractor');
            },
            args: [getSelectedLang(), getSelectedAPIEndpoint()]
        });
    });
});

document.getElementById('liToContact').addEventListener('click', async () => {
    showLoader(true);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: (lang, endpoint) => {
                liToJrInstance.preferLocale = lang;
                liToJrInstance.parseAndSendToApi(endpoint.importUrl, 'contact');
            },
            args: [getSelectedLang(), getSelectedAPIEndpoint()]
        });
    });
});

document.getElementById('liToJsonDownloadButton').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: (lang) => {
                liToJrInstance.preferLocale = lang;
                liToJrInstance.parseAndDownload();
            },
            args: [getSelectedLang()]
        });
    });
});

document.getElementById('debugCheckButton').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: (endpoint) => {
                liToJrInstance.checkProfileExists(endpoint.checkUrl);
            },
            args: [getSelectedAPIEndpoint()]
        });
    });
});

LANG_SELECT.addEventListener('change', () => {
    setLang(getSelectedLang());
});

API_SELECT.addEventListener('change', () => {
    const selectedEndpoint = getSelectedAPIEndpoint();
    setApiEndpoint(selectedEndpoint);
    // Check profile status when API endpoint changes
    if (selectedEndpoint) {
        // Show loading state in popup
        updateProfileStatus('loading');
        chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
            chrome.scripting.executeScript({
                target: { tabId: activeTabs[0].id },
                func: (endpoint) => {
                    // Only execute the profile check in content script
                    liToJrInstance.checkProfileExists(endpoint.checkUrl);
                },
                args: [selectedEndpoint]
            });
        });
    } else {
        // If no endpoint is selected, reset the UI
        updateProfileStatus({ subcontractor: false, contact: false });
    }
});

SPEC_SELECT.addEventListener('change', () => {
    setSpecVersion(/** @type {SchemaVersion} */ (SPEC_SELECT.value));
});

/**
 * =============================
 * =           Init            =
 * =============================
 */
document.getElementById('versionDisplay').innerText = chrome.runtime.getManifest().version;

// Initialize the content script and get the liToJrInstance
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.scripting
        .executeScript({
            target: { tabId: tabs[0].id },
            files: ['main.js']
        })
        .then(() => {
            chrome.scripting
                .executeScript({
                    target: { tabId: tabs[0].id },
                    func: () => {
                        const isDebug = window.location.href.includes('li2jr_debug=true');
                        // eslint-disable-next-line no-undef
                        window.LinkedinToResumeJson = isDebug ? LinkedinToResumeJson : window.LinkedinToResumeJson;
                        // Reuse existing instance if possible
                        // eslint-disable-next-line no-undef
                        window.liToJrInstance = typeof window.liToJrInstance !== 'undefined' ? window.liToJrInstance : new LinkedinToResumeJson(isDebug);
                        return window.liToJrInstance;
                    }
                })
                .then((results) => {
                    // Get the liToJrInstance from the content script
                    if (results && results[0] && results[0].result) {
                        liToJrInstance = results[0].result;

                        // Now that we have liToJrInstance, we can get the supported locales
                        chrome.scripting
                            .executeScript({
                                target: { tabId: tabs[0].id },
                                func: () => {
                                    return window.liToJrInstance.getSupportedLocales();
                                }
                            })
                            .then((localeResults) => {
                                if (localeResults && localeResults[0] && localeResults[0].result) {
                                    const supported = localeResults[0].result;
                                    const user = liToJrInstance.getViewersLocalLang();

                                    // Make sure user's own locale comes as first option
                                    if (supported.includes(user)) {
                                        supported.splice(supported.indexOf(user), 1);
                                    }
                                    supported.unshift(user);
                                    loadLangs(supported);
                                }
                            });

                        // Load API endpoints
                        const url = chrome.runtime.getURL('./endpoints.json');
                        fetch(url)
                            .then((response) => response.json())
                            .then((json) => {
                                console.log('Loaded API endpoints:', json);
                                loadApiEndpoints(json);
                                // Check profile status after loading endpoints
                                if (API_SELECT.value) {
                                    console.log('Initial API endpoint selected:', API_SELECT.value);
                                    // Add a small delay to ensure the UI is ready
                                    setTimeout(() => {
                                        const selectedEndpoint = getSelectedAPIEndpoint();
                                        if (selectedEndpoint) {
                                            // Show loading state in popup
                                            updateProfileStatus('loading');
                                            chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
                                                chrome.scripting.executeScript({
                                                    target: { tabId: activeTabs[0].id },
                                                    func: (endpoint) => {
                                                        // Only execute the profile check in content script
                                                        liToJrInstance.checkProfileExists(endpoint.checkUrl);
                                                    },
                                                    args: [selectedEndpoint]
                                                });
                                            });
                                        }
                                    }, 100);
                                } else {
                                    console.log('No initial API endpoint selected');
                                }
                            });
                    }
                });
        });
});

getSpecVersion().then((spec) => {
    SPEC_SELECT.value = spec;
});
