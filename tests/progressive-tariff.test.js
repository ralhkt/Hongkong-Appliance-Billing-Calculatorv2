import { describe, it, expect } from 'vitest';
import { HK_PROGRESSIVE_TARIFFS, ProgressiveTariffCalculator } from '../src/domain/progressive-tariff.js';

describe('ProgressiveTariffCalculator', () => {
    it('summarises tier count and rate range', () => {
        const summary = ProgressiveTariffCalculator.formatProgressiveTariffSummary(HK_PROGRESSIVE_TARIFFS.clp);
        expect(summary).toBe('中電 CLP · 3 個收費分段 · 每度 HK$1.304–1.702');
    });

    it('lists per-kWh net rate for each CLP block', () => {
        const html = ProgressiveTariffCalculator.formatProgressiveTariffHtml(HK_PROGRESSIVE_TARIFFS.clp);
        expect(html).toContain('每月首 400 度');
        expect(html).toContain('基本每度 HK$0.910');
        expect(html).toContain('燃料調整費');
        expect(html).toContain('每月 401–800 度');
        expect(html).toContain('基本每度 HK$1.114');
        expect(html).toContain('每月超過 800 度');
        expect(html).toContain('基本每度 HK$1.308');
    });

    it('computes household annual bill from items', () => {
        const totals = ProgressiveTariffCalculator.getHouseholdTotals([
            { annualKwh: 1200, annualCost: 1680 }
        ], 'clp');
        expect(totals.annualKwh).toBe(1200);
        expect(totals.annualCost).toBeGreaterThan(0);
        expect(totals.tariff.id).toBe('clp');
        expect(totals.monthlyBreakdown.basicMonthly).toBeGreaterThan(0);
        expect(totals.monthlyBreakdown.fuelMonthly).toBeGreaterThan(0);
    });

    it('renders household calculation breakdown html', () => {
        const html = ProgressiveTariffCalculator.formatProgressiveTariffHtml(
            HK_PROGRESSIVE_TARIFFS.clp,
            658,
            3,
            0.403
        );
        expect(html).toContain('你的全屋估算計算');
        expect(html).toContain('燃料調整費 Fuel');
        expect(html).toContain('每月小計 Monthly subtotal');
        expect(html).toContain('× 12 個月');
    });

    it('lists per-kWh net rate for HKE blocks', () => {
        const html = ProgressiveTariffCalculator.formatProgressiveTariffHtml(HK_PROGRESSIVE_TARIFFS.hke);
        expect(html).toContain('港燈 HKE');
        expect(html).toContain('基本每度 HK$0.863');
        expect(html).toContain('基本每度 HK$1.794');
    });
});