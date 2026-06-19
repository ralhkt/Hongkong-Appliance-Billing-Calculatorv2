import { describe, it, expect } from 'vitest';
import {
    buildGrokLookupPrompt,
    extractJsonFromModelText,
    extractTextFromXaiResponse,
    inferApplianceType,
    parseLookupPayload,
    formatLookupApiError,
    isLookupBillingError,
    processLookupModelText,
    validateLookupInput,
    validateLookupResult
} from '../src/domain/appliance-lookup.js';

describe('appliance lookup (Grok paste flow)', () => {
    it('validates brand and model input', () => {
        expect(validateLookupInput('Panasonic', 'NR-BV320').ok).toBe(true);
        expect(validateLookupInput('P', 'NR-BV320').ok).toBe(false);
    });

    it('builds a structured Grok prompt', () => {
        const prompt = buildGrokLookupPrompt('Panasonic', 'NR-BV320');
        expect(prompt).toContain('Panasonic');
        expect(prompt).toContain('NR-BV320');
        expect(prompt).toContain('annualKwh');
        expect(prompt).toContain('emsd.gov.hk');
    });

    it('parses JSON pasted from Grok', () => {
        const parsed = parseLookupPayload({
            annualKwh: 265,
            applianceCategory: 'refrigerator',
            confidence: 'high',
            sourceUrl: 'https://example.com',
            summary: 'MEELS'
        });
        expect(parsed.annualKwh).toBe(265);
        expect(parsed.applianceType).toBe('refrigerator');
    });

    it('extracts kWh from free text when JSON missing', () => {
        const raw = extractJsonFromModelText('該型號年耗電量：312 kWh（MEELS 標籤）');
        expect(raw.annualKwh).toBe(312);
    });

    it('infers appliance types from bilingual categories', () => {
        expect(inferApplianceType('雪櫃 Refrigerator')).toBe('refrigerator');
        expect(inferApplianceType('分體冷氣')).toBe('room_ac_split');
    });

    it('validates lookup confidence', () => {
        expect(validateLookupResult({ annualKwh: 300, confidence: 'low' }).warn).toBe(true);
        expect(validateLookupResult({ annualKwh: 300, confidence: 'high' }).ok).toBe(true);
    });

    it('extracts text from xAI responses payloads', () => {
        expect(extractTextFromXaiResponse({ output_text: '{"annualKwh":300}' })).toContain('300');
        expect(extractTextFromXaiResponse({
            output: [{
                type: 'message',
                content: [{ type: 'output_text', text: '{"annualKwh":265}' }]
            }]
        })).toContain('265');
    });

    it('detects xAI billing errors and formats friendly messages', () => {
        expect(isLookupBillingError('You do not have any credits or licenses')).toBe(true);
        expect(formatLookupApiError('no credits')).toContain('console.x.ai/billing');
    });

    it('processes pasted model text into validated lookup results', () => {
        const { parsed, validation } = processLookupModelText(
            '{"annualKwh":312,"applianceCategory":"refrigerator","confidence":"high"}',
            'Panasonic',
            'NR-BV320'
        );
        expect(parsed.annualKwh).toBe(312);
        expect(parsed.brand).toBe('Panasonic');
        expect(validation.ok).toBe(true);
    });
});