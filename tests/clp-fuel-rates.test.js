import { describe, it, expect } from 'vitest';
import {
    CLP_FUEL_RATES_HKD,
    formatClpFuelRatesAsOfLabel,
    getLatestClpFuelRateMonth,
    monthsSinceFuelRateUpdate
} from '../src/domain/clp-fuel-rates.js';

describe('clp fuel rates metadata', () => {
    it('tracks the latest month in the rates table', () => {
        const latest = getLatestClpFuelRateMonth();
        expect(latest).toBeTruthy();
        expect(CLP_FUEL_RATES_HKD[latest]).toBeGreaterThan(0);
    });

    it('formats bilingual as-of labels', () => {
        expect(formatClpFuelRatesAsOfLabel('zh-HK')).toMatch(/\d{4}年\d{1,2}月/);
        expect(formatClpFuelRatesAsOfLabel('en')).toMatch(/[A-Z][a-z]{2} \d{4}/);
    });

    it('keeps fuel rates within two months of the current calendar month', () => {
        expect(monthsSinceFuelRateUpdate(new Date())).toBeLessThanOrEqual(2);
    });
});