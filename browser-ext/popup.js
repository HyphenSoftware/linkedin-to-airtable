/**
 * =============================
 * =        Constants          =
 * =============================
 */

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
 * Generate injectable code for capturing a value from the contentScript scope and passing back via message
 * @param {string} valueToCapture - Name of the scoped variable to capture
 * @param {string} [optKey] - Key to use as message identifier. Defaults to valueToCapture
 */
const createMessageSenderInjectable = (valueToCapture, optKey) => {
    return `chrome.runtime.sendMessage('${extensionId}', {
        key: '${optKey || valueToCapture}',
        value: ${valueToCapture}
    });`;
};
const createMainInstanceCode = `
isDebug = window.location.href.includes('li2jr_debug=true');
window.LinkedinToResumeJson = isDebug ? LinkedinToResumeJson : window.LinkedinToResumeJson;
// Reuse existing instance if possible
liToJrInstance = typeof(liToJrInstance) !== 'undefined' ? liToJrInstance : new LinkedinToResumeJson(isDebug);
`;
const getLangStringsCode = `(async () => {
    const supported = await liToJrInstance.getSupportedLocales();
    const user = liToJrInstance.getViewersLocalLang();
    const payload = {
        supported,
        user
    }
    ${createMessageSenderInjectable('payload', 'locales')}
})();
`;

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
 * Get JS string that can be eval'ed to get the program to run and show output
 * Note: Be careful of strings versus vars, escaping, etc.
 * @param {SchemaVersion} version
 */
const getRunAndShowCode = (version) => {
    return `liToJrInstance.preferLocale = '${getSelectedLang()}';liToJrInstance.parseAndShowOutput('${version}');`;
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
 * @param {Object[]} api_endpoints - api endpoints
 * @param {string} api_endpoints[].name - name of the endpoint
 * @param {string} api_endpoints[].url - URL
 */
const loadApiEndpoints = (api_endpoints) => {
    API_SELECT.innerHTML = '';
    api_endpoints.forEach((api_endpoint) => {
        if (api_endpoint) {
            const option = document.createElement('option');
            option.value = api_endpoint.url;
            option.innerText = api_endpoint.name;
            API_SELECT.appendChild(option);
        }
    });
    toggleEnabled(api_endpoints.length > 0);
};

/**
 * Set the desired export lang on the exporter instance
 * - Use `null` to unset
 * @param {string | null} lang
 */
const setLang = (lang) => {
    chrome.tabs.executeScript(
        {
            code: `liToJrInstance.preferLocale = '${lang}';`
        },
        () => {
            chrome.tabs.executeScript({
                code: `console.log(liToJrInstance);console.log(liToJrInstance.preferLocale);`
            });
        }
    );
};

/**
 * Set the desired API endpoint on the exporter instance
 * - Use `null` to unset
 * @param {string | null} endpoint
 */
const setApiEndpoint = (endpoint) => {
    chrome.tabs.executeScript(
        {
            code: `liToJrInstance.apiEndpoint = '${endpoint}';`
        },
        () => {
            chrome.tabs.executeScript({
                code: `console.log(liToJrInstance);console.log(liToJrInstance.apiEndpoint);`
            });
        }
    );
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
    console.log(message);
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
    const runAndShowCode = getRunAndShowCode(versionOption);
    chrome.tabs.executeScript(
        {
            code: `${runAndShowCode}`
        },
        () => {
            setTimeout(() => {
                // Close popup
                window.close();
            }, 700);
        }
    );
});

document.getElementById('liToApiButton').addEventListener('click', async () => {
    console.log('selected API endpoint: ', getSelectedAPIEndpoint());
    showLoader(true);
    chrome.tabs.executeScript({
        code: `liToJrInstance.preferLocale = '${getSelectedLang()}';liToJrInstance.parseAndSendToApi('${getSelectedAPIEndpoint()}');`
    });
});

document.getElementById('liToJsonDownloadButton').addEventListener('click', () => {
    chrome.tabs.executeScript({
        code: `liToJrInstance.preferLocale = '${getSelectedLang()}';liToJrInstance.parseAndDownload();`
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

chrome.tabs.executeScript(
    {
        file: 'main.js'
    },
    () => {
        chrome.tabs.executeScript({
            code: `${createMainInstanceCode}${getLangStringsCode}`
        });
    }
);

getSpecVersion().then((spec) => {
    SPEC_SELECT.value = spec;
});
