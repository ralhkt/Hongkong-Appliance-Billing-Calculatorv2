import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

function readJson(relativePath) {
    return JSON.parse(readFileSync(resolve(root, relativePath), 'utf8'));
}

function readText(relativePath) {
    return readFileSync(resolve(root, relativePath), 'utf8');
}

describe('release config', () => {
    it('aligns npm and iOS marketing versions', () => {
        const { version } = readJson('package.json');
        const pbxproj = readText('ios/App/App.xcodeproj/project.pbxproj');
        expect(version).toBe('2.1.0');
        expect(pbxproj).toMatch(/MARKETING_VERSION = 2\.1\.0;/);
    });

    it('declares camera and photo library privacy usage strings', () => {
        const plist = readText('ios/App/App/Info.plist');
        expect(plist).toContain('NSCameraUsageDescription');
        expect(plist).toContain('NSPhotoLibraryUsageDescription');
        expect(plist).toContain('NSPhotoLibraryAddUsageDescription');
    });

    it('surfaces in-app privacy guidance in the help sheet', () => {
        const html = readText('index.html');
        expect(html).toContain('私隱：相機／相簿只用於掃描標籤');
        expect(html).toContain('data stays on-device unless you export a backup');
    });

    it('parses index.html inline script without syntax errors', () => {
        const html = readText('index.html');
        const match = html.match(/<script>\s*([\s\S]*?)<\/script>\s*<\/body>/);
        expect(match, 'inline script block').toBeTruthy();
        expect(() => new Function(match[1])).not.toThrow();
    });

    it('builds esbuild bundles for domain and app layers', () => {
        const html = readText('index.html');
        expect(html).toContain('js/domain.bundle.js');
        expect(html).toContain('js/app.bundle.js');
        expect(html).not.toContain('js/domain/appliance-search.js');
    });

    it('exposes simplified model lookup search flow with Grok fallback', () => {
        const html = readText('index.html');
        expect(html).toContain('id="lookupSearchBtn"');
        expect(html).toContain('id="lookupResultKwh"');
        expect(html).toContain('fetchLookup');
        expect(html).toContain('searchMeelsRegistry');
        expect(html).toContain('id="lookupFallbackWrap"');
        expect(html).toContain('meels-index.json');
    });
});