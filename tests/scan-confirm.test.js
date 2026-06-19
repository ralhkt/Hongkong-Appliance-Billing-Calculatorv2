import { describe, it, expect } from 'vitest';
import { AUTO_ADVANCE_AFTER_SCAN, validateScanForApply } from '../src/domain/scan-confirm.js';

describe('scan-confirm', () => {
    it('never auto-advances to results after scan', () => {
        expect(AUTO_ADVANCE_AFTER_SCAN).toBe(false);
    });

    it('rejects missing kWh', () => {
        expect(validateScanForApply(null).ok).toBe(false);
        expect(validateScanForApply(0).code).toBe('missing_kwh');
    });

    it('warns on low kWh but allows override path', () => {
        const result = validateScanForApply(5);
        expect(result.ok).toBe(false);
        expect(result.code).toBe('kwh_low');
        expect(result.warnOnly).toBe(true);
    });

    it('accepts plausible kWh', () => {
        expect(validateScanForApply(285).ok).toBe(true);
    });
});