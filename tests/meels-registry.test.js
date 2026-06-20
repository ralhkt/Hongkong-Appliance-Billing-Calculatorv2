import { describe, it, expect } from 'vitest';
import {
    cleanTrailingPartialCjk,
    looksLikeModelCode,
    normalizeMeelsToken,
    scoreModelMatch,
    searchMeelsRegistry,
    similarityRatio,
    splitLookupQuery,
    validateMeelsLookupInput
} from '../src/domain/meels-registry.js';

const SAMPLE = [
    {
        brandEn: 'Panasonic',
        brandZh: '樂聲牌',
        model: 'NR-BV320X',
        annualKwh: 265,
        category: 'refrigerator',
        grade: 1
    },
    {
        brandEn: 'Siemens',
        brandZh: '西門子',
        model: 'KI38VA00HK',
        annualKwh: 283,
        category: 'refrigerator',
        grade: 5
    },
    {
        brandEn: 'DAIKIN',
        brandZh: '大金',
        model: 'FTXS25EVMA8 / RXS25EBVMA',
        annualKwh: 263,
        category: 'room_ac',
        grade: 2
    }
];

describe('MEELS registry search', () => {
    it('normalizes model tokens for matching', () => {
        expect(normalizeMeelsToken('NR-BV320X')).toBe('nrbv320x');
        expect(normalizeMeelsToken('FTXS25EVMA8 / RXS25EBVMA')).toBe('ftxs25evma8rxs25ebvma');
    });

    it('finds exact brand and model matches', () => {
        const hit = searchMeelsRegistry(SAMPLE, 'Panasonic', 'NR-BV320X', ['refrigerator']);
        expect(hit.ok).toBe(true);
        expect(hit.result.annualKwh).toBe(265);
        expect(hit.result.confidence).toBe('high');
    });

    it('supports Chinese brand names and aliases', () => {
        expect(searchMeelsRegistry(SAMPLE, '樂聲牌', 'NR-BV320X', ['refrigerator']).ok).toBe(true);
        expect(searchMeelsRegistry(SAMPLE, '大金', 'FTXS25EVMA8', ['room_ac']).result.annualKwh).toBe(263);
    });

    it('tolerates minor model typos', () => {
        const typo = searchMeelsRegistry(SAMPLE, 'Siemens', 'KI38VA00H', ['refrigerator']);
        expect(typo.ok).toBe(true);
        expect(typo.result.model).toBe('KI38VA00HK');
        expect(typo.result.confidence).not.toBe('high');
    });

    it('strips accidental trailing partial Chinese from brand input', () => {
        expect(cleanTrailingPartialCjk('Panasonic，大')).toBe('Panasonic');
        expect(cleanTrailingPartialCjk('panasonic （可')).toBe('panasonic');
        expect(cleanTrailingPartialCjk('Panasonic（可留空）')).toBe('Panasonic');
        expect(splitLookupQuery('Panasonic，大', 'NR-BV320X').brand).toBe('Panasonic');
        expect(splitLookupQuery('panasonic （可', 'NR-BV320X').brand).toBe('panasonic');
    });

    it('tolerates brand typos like Panasonc', () => {
        const typoBrand = searchMeelsRegistry(SAMPLE, 'Panasonc', 'NR-BV320X', ['refrigerator']);
        expect(typoBrand.ok).toBe(true);
        expect(typoBrand.result.annualKwh).toBe(265);
    });

    it('splits combined brand+model typed in one field', () => {
        const split = splitLookupQuery('Panasonic NR-BV320X', '');
        expect(split.brand).toBe('Panasonic');
        expect(split.model).toBe('NR-BV320X');
        const hit = searchMeelsRegistry(SAMPLE, split.brand, split.model, ['refrigerator']);
        expect(hit.ok).toBe(true);
    });

    it('matches partial indoor unit model codes', () => {
        const partial = searchMeelsRegistry(SAMPLE, 'Daikin', 'FTXS25EVMA8', ['room_ac']);
        expect(partial.ok).toBe(true);
        expect(partial.result.annualKwh).toBe(263);
    });

    it('allows model-only lookup for distinctive model codes', () => {
        const modelOnly = searchMeelsRegistry(SAMPLE, '', 'KI38VA00HK', ['refrigerator']);
        expect(modelOnly.ok).toBe(true);
        expect(modelOnly.result.brand).toBe('Siemens');
    });

    it('accepts model typed only in the brand field', () => {
        const split = splitLookupQuery('NR-BV320X', '');
        expect(split.brand).toBe('');
        expect(split.model).toBe('NR-BV320X');
        const hit = searchMeelsRegistry(SAMPLE, split.brand, split.model, ['refrigerator']);
        expect(hit.ok).toBe(true);
        expect(hit.result.annualKwh).toBe(265);
    });

    it('detects model-like codes', () => {
        expect(looksLikeModelCode('KI38VA00HK')).toBe(true);
        expect(looksLikeModelCode('9290030080')).toBe(true);
        expect(looksLikeModelCode('Panasonic')).toBe(false);
    });

    it('requires brand when model-only match is ambiguous', () => {
        const ambiguous = validateMeelsLookupInput('', 'NR');
        expect(ambiguous.ok).toBe(false);
    });

    it('scores string similarity for typo detection', () => {
        expect(similarityRatio('siemens', 'siemans')).toBeGreaterThan(0.8);
        expect(scoreModelMatch('NR-BV320', 'NR-BV320X')).toBeGreaterThan(60);
    });

    it('returns not found for unknown models', () => {
        const miss = searchMeelsRegistry(SAMPLE, 'Unknown', 'ZZ-999', ['refrigerator']);
        expect(miss.ok).toBe(false);
    });
});