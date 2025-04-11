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
 */
const getSelectedAPIEndpoint = () => {
    return API_SELECT.value;
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
 * @param {string} apiEndpoints[].url - URL
 */
const loadApiEndpoints = (apiEndpoints) => {
    API_SELECT.innerHTML = '';
    apiEndpoints.forEach((apiEndpoint) => {
        if (apiEndpoint) {
            const option = document.createElement('option');
            option.value = apiEndpoint.url;
            option.innerText = apiEndpoint.name;
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
                liToJrInstance.apiEndpoint = endpointValue;
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
                liToJrInstance.parseAndSendToApi(endpoint, 'subcontractor');
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
                liToJrInstance.parseAndSendToApi(endpoint, 'contact');
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

LANG_SELECT.addEventListener('change', () => {
    setLang(getSelectedLang());
});

API_SELECT.addEventListener('change', () => {
    setApiEndpoint(getSelectedAPIEndpoint());
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
                            .then((json) => loadApiEndpoints(json));
                    }
                });
        });
});

getSpecVersion().then((spec) => {
    SPEC_SELECT.value = spec;
});
