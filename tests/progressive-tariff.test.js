import { describe, it, expect } from 'vitest';

const HK_PROGRESSIVE_TARIFFS = {
    clp: {
        id: 'clp',
        label: '中電 CLP',
        fuelCharge: 0.394,
        averageNet: 1.406,
        blocks: [
            { upTo: 400, basic: 0.91, label: '首 400 度' },
            { upTo: 800, basic: 1.114, label: '401–800 度' },
            { upTo: Infinity, basic: 1.308, label: '超過 800 度' }
        ]
    },
    hke: {
        id: 'hke',
        label: '港燈 HKE',
        fuelCharge: 0.354,
        averageNet: 1.633,
        blocks: [
            { upTo: 150, basic: 0.863, label: '首 150 度' },
            { upTo: Infinity, basic: 1.794, label: '超過 1,500 度' }
        ]
    }
};

class ProgressiveTariffCalculator {
    static formatBlockRangeLabel(block) {
        if (block.label.startsWith('首') || block.label.startsWith('超過')) {
            return `每月${block.label}`;
        }
        return `每月 ${block.label}`;
    }

    static formatProgressiveTariffSummary(tariff) {
        const rates = tariff.blocks.map((block) => block.basic + tariff.fuelCharge);
        const min = Math.min(...rates);
        const max = Math.max(...rates);
        return `${tariff.label} · ${tariff.blocks.length} 個收費分段 · 每度 HK$${min.toFixed(3)}–${max.toFixed(3)}`;
    }

    static formatProgressiveTariffHtml(tariff, monthlyKwh = 0, itemCount = 0) {
        const intro = `<p class="tariff-note-intro"><strong>${tariff.label} 累進制電價</strong>：按<strong>每月</strong>總用電量分段計費。落在同一分段內的<strong>每一度電</strong>，均按該段電價收費（基本電費 + 燃料調整費），各段「用電量 × 該段電價」相加得出月費，再乘以 12 個月估算年費。<span class="tariff-note-en">Progressive tariff: each kWh within a monthly usage block is charged at that block's rate (basic + fuel). Block subtotals sum to the monthly bill.</span></p>`;

        const tiers = tariff.blocks.map((block) => {
            const net = block.basic + tariff.fuelCharge;
            const range = this.formatBlockRangeLabel(block);
            return `<li><span class="tariff-tier-range">${range}</span><span class="tariff-tier-rate">每度 HK$${net.toFixed(3)}</span><span class="tariff-tier-detail">基本電費 HK$${block.basic.toFixed(3)} + 燃料費 HK$${tariff.fuelCharge.toFixed(3)} = 淨電價 HK$${net.toFixed(3)}/kWh</span></li>`;
        }).join('');

        const foot = itemCount > 0 && monthlyKwh > 0
            ? `<p class="tariff-note-foot">依你電器庫估算，全屋月均約 <strong>${monthlyKwh.toFixed(0)} 度</strong>，按以上各段逐月累加計算下方年費（比逐件用平均電價相加更貼近實際帳單）。</p>`
            : `<p class="tariff-note-foot">儲存電器後，將按全屋估算月用量套用以上分段計算年費。</p>`;

        return `${intro}<ul class="tariff-tier-list">${tiers}</ul>${foot}`;
    }
}

describe('ProgressiveTariffCalculator copy', () => {
    it('summarises tier count and rate range', () => {
        const summary = ProgressiveTariffCalculator.formatProgressiveTariffSummary(HK_PROGRESSIVE_TARIFFS.clp);
        expect(summary).toBe('中電 CLP · 3 個收費分段 · 每度 HK$1.304–1.702');
    });

    it('lists per-kWh net rate for each CLP block', () => {
        const html = ProgressiveTariffCalculator.formatProgressiveTariffHtml(HK_PROGRESSIVE_TARIFFS.clp);
        expect(html).toContain('每月首 400 度');
        expect(html).toContain('每度 HK$1.304');
        expect(html).toContain('每月 401–800 度');
        expect(html).toContain('每度 HK$1.508');
        expect(html).toContain('每月超過 800 度');
        expect(html).toContain('每度 HK$1.702');
    });

    it('lists per-kWh net rate for HKE blocks', () => {
        const html = ProgressiveTariffCalculator.formatProgressiveTariffHtml(HK_PROGRESSIVE_TARIFFS.hke);
        expect(html).toContain('港燈 HKE');
        expect(html).toContain('每度 HK$1.217');
        expect(html).toContain('每度 HK$2.148');
    });
});