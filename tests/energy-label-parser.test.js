import { describe, it, expect, beforeAll } from 'vitest';
import { EnergyLabelParser } from '../src/domain/energy-label-parser.js';

const TEST_CATALOG = {
    refrigerator: {
        labelRatedHours: 8760,
        suggestedUsageHours: 8760,
        ocrRegex: /雪櫃|冰箱|refrigerat/i
    },
    room_ac: {
        labelRatedHours: 1136,
        suggestedUsageHours: 1104,
        ocrRegex: /冷氣|空調|room\s*air/i
    },
    custom: {
        labelRatedHours: 1200,
        suggestedUsageHours: null,
        ocrRegex: null
    }
};

describe('EnergyLabelParser', () => {
    beforeAll(() => {
        EnergyLabelParser.configure({ catalog: TEST_CATALOG });
    });

    it('parses annual kWh from MEELS-style text', () => {
        const text = '產品類型 雪櫃\n年耗電量 Annual Energy Consumption 285 kWh\n能源效益級別 Grade 1';
        const result = EnergyLabelParser.parse(text);
        expect(result.kWh).toBe(285);
        expect(result.productType).toBe('refrigerator');
    });

    it('does not confuse grade 5 with 5 kWh when annual kWh present', () => {
        const text = '能源效益級別 5級\n年耗電量 320 kWh';
        const result = EnergyLabelParser.parse(text);
        expect(result.kWh).toBe(320);
        expect(result.grade).toBe(5);
    });

    it('detects room air conditioner type', () => {
        const text = 'Room Air Conditioner 冷氣機\nAnnual Energy Consumption 450 kWh';
        const result = EnergyLabelParser.parse(text);
        expect(result.productType).toBe('room_ac');
        expect(result.kWh).toBe(450);
    });
});