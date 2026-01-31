const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

// Read the code
const code = fs.readFileSync('js/themes.js', 'utf8');

// Mock function helper
function runThemeTest(themeParam, localStorageTheme, expectedTheme) {
    // Setup mocks
    const mockDocument = {
        createElement: (tag) => {
            if (tag === 'link') return { href: '', rel: '' };
            return {};
        },
        head: {
            appendChild: (el) => {
                mockDocument.head.lastChild = el;
            }
        },
        lastChild: null
    };

    // Construct valid URL string
    const urlString = 'http://localhost/' + (themeParam ? `?theme=${encodeURIComponent(themeParam)}` : '');

    const mockLocation = {
        href: urlString,
        origin: 'http://localhost',
        pathname: '/writeups/',
        hash: ''
    };

    const mockLocalStorage = {
        getItem: () => localStorageTheme
    };

    const mockNavigator = {
        userAgent: 'test-agent'
    };

    // Create sandbox
    const sandbox = {
        document: mockDocument,
        location: mockLocation,
        localStorage: mockLocalStorage,
        navigator: mockNavigator,
        URL: URL, // Pass global URL class
        BroadcastChannel: class {
            constructor(name) {}
            onmessage(event) {}
        },
        alert: () => {}, // mock alert
        window: {},
        onkeyup: null,
        console: console // allow logging if needed
    };
    sandbox.window = sandbox;

    // Run code
    vm.createContext(sandbox);
    vm.runInContext(code, sandbox);

    // Verify
    const loadedHref = sandbox.document.head.lastChild ? sandbox.document.head.lastChild.href : null;
    if (!loadedHref) {
         throw new Error('No stylesheet loaded');
    }

    const expectedHref = '/writeups/themes/' + encodeURIComponent(expectedTheme);

    // Check if expected matches actual
    if (loadedHref !== expectedHref) {
        throw new Error(`Failed for input "${themeParam || localStorageTheme}". Expected ${expectedHref}, got ${loadedHref}`);
    }
}

console.log('Running Theme Security Tests...');

// Test 1: Valid theme via URL
try {
    runThemeTest('cyberpunk.css', null, 'cyberpunk.css');
    console.log('✅ Passed: Valid theme via URL');
} catch (e) {
    console.error('❌ Failed: Valid theme via URL', e);
    process.exit(1);
}

// Test 2: Invalid theme via URL (Path Traversal attempt)
try {
    runThemeTest('../evil.js', null, 'default.css');
    console.log('✅ Passed: Path traversal blocked');
} catch (e) {
    console.error('❌ Failed: Path traversal blocked', e);
    process.exit(1);
}

// Test 3: Invalid theme via URL (Unknown theme)
try {
    runThemeTest('hacker.css', null, 'default.css');
    console.log('✅ Passed: Unknown theme blocked');
} catch (e) {
    console.error('❌ Failed: Unknown theme blocked', e);
    process.exit(1);
}

// Test 4: Valid theme via LocalStorage
try {
    runThemeTest(null, 'comic.css', 'comic.css');
    console.log('✅ Passed: Valid theme via LocalStorage');
} catch (e) {
    console.error('❌ Failed: Valid theme via LocalStorage', e);
    process.exit(1);
}

// Test 5: Invalid theme via LocalStorage
try {
    runThemeTest(null, 'malicious.css', 'default.css');
    console.log('✅ Passed: Invalid theme via LocalStorage blocked');
} catch (e) {
    console.error('❌ Failed: Invalid theme via LocalStorage blocked', e);
    process.exit(1);
}

// Test 6: Summarizer theme (Virtual)
try {
    runThemeTest('summarizer.css', null, 'summarizer.css');
    console.log('✅ Passed: Virtual theme allowed');
} catch (e) {
    console.error('❌ Failed: Virtual theme allowed', e);
    process.exit(1);
}

console.log('All tests passed!');
