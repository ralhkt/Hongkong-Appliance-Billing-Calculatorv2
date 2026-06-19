import { describe, it, expect, beforeAll } from 'vitest';
import { ApplianceSearchService, APPLIANCE_SEARCH_ALIASES } from '../src/domain/appliance-search.js';

const TEST_CATALOG = {
    refrigerator: { label: '雪櫃 Refrigerator', group: '冷凍冷藏' },
    room_ac: { label: '冷氣機 AC (一般)', group: '冷氣空調' },
    room_ac_split: { label: '分體冷氣 Split AC', group: '冷氣空調' },
    washing: { label: '洗衣機 Washer', group: '洗衣乾衣' },
    tv: { label: '電視 TV', group: '影音顯示' },
    custom: { label: '其他/手動 Custom', group: '其他' }
};

const TEST_GROUPS = [
    { id: 'cold', title: '冷凍冷藏 Cooling', types: ['refrigerator'] },
    { id: 'ac', title: '冷氣空調 AC & Air', types: ['room_ac_split', 'room_ac'] },
    { id: 'laundry', title: '洗衣乾衣 Laundry', types: ['washing'] },
    { id: 'av', title: '影音顯示 AV', types: ['tv'] },
    { id: 'other', title: '其他 Other', types: ['custom'] }
];

describe('ApplianceSearchService', () => {
    let search;

    beforeAll(() => {
        search = new ApplianceSearchService(TEST_CATALOG, TEST_GROUPS);
    });

    it('returns all groups when query is empty', () => {
        const groups = search.filterGroups('');
        expect(groups).toHaveLength(TEST_GROUPS.length);
        expect(groups.flatMap((g) => g.types)).toHaveLength(6);
    });

    it('matches English abbreviation AC to air conditioners', () => {
        const results = search.search('ac');
        const typeIds = results.map((r) => r.typeId);
        expect(typeIds).toContain('room_ac');
        expect(typeIds).toContain('room_ac_split');
    });

    it('matches Chinese 冷氣', () => {
        const results = search.search('冷氣');
        expect(results.some((r) => r.typeId === 'room_ac')).toBe(true);
    });

    it('matches fridge to refrigerator', () => {
        const top = search.search('fridge')[0];
        expect(top?.typeId).toBe('refrigerator');
    });

    it('matches 洗衣機 to washing machine', () => {
        const top = search.search('洗衣機')[0];
        expect(top?.typeId).toBe('washing');
    });

    it('matches TV case-insensitively', () => {
        const top = search.search('tv')[0];
        expect(top?.typeId).toBe('tv');
    });

    it('returns empty groups for unknown query', () => {
        expect(search.filterGroups('zzznomatch')).toHaveLength(0);
        expect(search.hasMatches('zzznomatch')).toBe(false);
    });

    it('ranks exact alias above partial label match', () => {
        const results = search.search('washer');
        expect(results[0]?.typeId).toBe('washing');
    });

    it('exposes bilingual alias table for all catalog keys', () => {
        Object.keys(TEST_CATALOG).forEach((typeId) => {
            expect(APPLIANCE_SEARCH_ALIASES[typeId]?.length).toBeGreaterThan(0);
        });
    });
});