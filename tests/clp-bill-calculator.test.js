import { describe, it, expect } from 'vitest';
import '../src/domain/progressive-tariff.js';
import '../src/domain/clp-fuel-rates.js';
import {
    ClpBillCalculator,
    formatClpBillLinesHtml
} from '../src/domain/clp-bill-calculator.js';
import { ProgressiveTariffCalculator, HK_PROGRESSIVE_TARIFFS } from '../src/domain/progressive-tariff.js';

const REAL_BILL = {
    startDate: '2026-04-11',
    endDate: '2026-06-12',
    totalKwh: 1316,
    basicCharge: 1416.29,
    fuelCharge: 534.67,
    broughtForward: 0.53,
    roundingCarry: -0.49
};

describe('ProgressiveTariffCalculator basic + fuel split', () => {
    it('charges block 3 when monthly usage exceeds 800 kWh', () => {
        const basic = ProgressiveTariffCalculator.basicMonthlyBill(1316, HK_PROGRESSIVE_TARIFFS.clp);
        expect(basic).toBeCloseTo(1484.528, 2);
    });

    it('keeps fuel adjustment separate from progressive tiers', () => {
        const basic = ProgressiveTariffCalculator.basicMonthlyBill(658, HK_PROGRESSIVE_TARIFFS.clp);
        const fuel = ProgressiveTariffCalculator.fuelMonthlyBill(658, 0.394);
        expect(basic).toBeCloseTo(651.412, 2);
        expect(fuel).toBeCloseTo(259.252, 2);
    });
});

describe('ClpBillCalculator bill line items', () => {
    it('totals CLP bill lines exactly without monthly kWh', () => {
        const result = ClpBillCalculator.calculateFromBillLines(REAL_BILL);

        expect(result.totalKwh).toBe(1316);
        expect(result.basic).toBe(1416.29);
        expect(result.fuel).toBe(534.67);
        expect(result.broughtForward).toBe(0.53);
        expect(result.roundingCarry).toBe(-0.49);
        expect(result.total).toBe(1951);
        expect(result.impliedFuelRate).toBeCloseTo(0.4063, 3);
        expect(result.impliedAllInRate).toBeCloseTo(1.4825, 3);
    });

    it('infers monthly kWh split from bill amounts', () => {
        const result = ClpBillCalculator.calculateFromBillLines(REAL_BILL);
        const monthKwh = result.months.map((month) => month.kwh);
        expect(monthKwh.reduce((sum, value) => sum + value, 0)).toBe(1316);
        expect(result.calculatedFuel).toBeCloseTo(534.67, 1);
        expect(result.calculatedBasic).toBeCloseTo(1416.29, 0);
    });

    it('calculates period bill from billLines shortcut', () => {
        const result = ClpBillCalculator.calculatePeriodBill({
            ...REAL_BILL,
            billLines: {
                basicCharge: REAL_BILL.basicCharge,
                fuelCharge: REAL_BILL.fuelCharge,
                broughtForward: REAL_BILL.broughtForward,
                roundingCarry: REAL_BILL.roundingCarry
            }
        });

        expect(result.total).toBe(1951);
    });

    it('scales reference bill for similar usage', () => {
        const reference = ClpBillCalculator.calculateFromBillLines(REAL_BILL);
        const estimate = ClpBillCalculator.estimateFromReferenceBill({
            referenceBill: reference,
            totalKwh: 658
        });

        expect(estimate.totalKwh).toBe(658);
        expect(estimate.total).toBeCloseTo(975.5, 0);
        expect(estimate.scale).toBeCloseTo(0.5, 2);
    });

    it('renders bill line html with carry-over rows', () => {
        const bill = ClpBillCalculator.calculateFromBillLines(REAL_BILL);
        const html = formatClpBillLinesHtml(bill);
        expect(html).toContain('上期撥來 Brought forward');
        expect(html).toContain('零數撥入下次 Rounding carry');
        expect(html).toContain('HK$1951.00');
    });
});

describe('ClpBillCalculator estimates', () => {
    it('uses monthly fuel rates for proportional split estimate', () => {
        const proportional = ClpBillCalculator.calculatePeriodBill({
            startDate: REAL_BILL.startDate,
            endDate: REAL_BILL.endDate,
            totalKwh: REAL_BILL.totalKwh
        });

        expect(proportional.fuel).toBeCloseTo(534.66, 1);
        expect(proportional.total).toBeLessThan(1951);
        expect(proportional.source).toBe('estimated');
    });
});