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
            { upTo: 300, basic: 1.002, label: '151–300 度' },
            { upTo: 500, basic: 1.141, label: '301–500 度' },
            { upTo: 700, basic: 1.377, label: '501–700 度' },
            { upTo: 1000, basic: 1.516, label: '701–1,000 度' },
            { upTo: 1500, basic: 1.655, label: '1,001–1,500 度' },
            { upTo: Infinity, basic: 1.794, label: '超過 1,500 度' }
        ]
    }
};

class ProgressiveTariffCalculator {
    static basicMonthlyBill(kwh, tariff) {
        if (!Number.isFinite(kwh) || kwh <= 0) return 0;
        let remaining = kwh;
        let cost = 0;
        let prevCap = 0;

        for (const block of tariff.blocks) {
            const cap = block.upTo === Infinity ? Infinity : block.upTo;
            const blockSize = cap === Infinity ? remaining : cap - prevCap;
            const inBlock = Math.min(remaining, blockSize);
            if (inBlock <= 0) break;
            cost += inBlock * block.basic;
            remaining -= inBlock;
            prevCap = cap === Infinity ? prevCap + inBlock : cap;
            if (remaining <= 0) break;
        }
        return cost;
    }

    static fuelMonthlyBill(kwh, fuelRate) {
        if (!Number.isFinite(kwh) || kwh <= 0 || !Number.isFinite(fuelRate)) return 0;
        return kwh * fuelRate;
    }

    static monthlyBill(kwh, tariff, fuelRate = tariff.fuelCharge) {
        return this.basicMonthlyBill(kwh, tariff) + this.fuelMonthlyBill(kwh, fuelRate);
    }

    static annualBill(annualKwh, tariff, fuelRate = tariff.fuelCharge) {
        const monthlyKwh = annualKwh / 12;
        return this.monthlyBill(monthlyKwh, tariff, fuelRate) * 12;
    }

    static effectiveRate(annualKwh, tariff, fuelRate = tariff.fuelCharge) {
        if (!annualKwh) return 0;
        return this.annualBill(annualKwh, tariff, fuelRate) / annualKwh;
    }

    static getMonthlyTierBreakdown(kwh, tariff) {
        if (!Number.isFinite(kwh) || kwh <= 0) return [];
        let remaining = kwh;
        let prevCap = 0;
        const tiers = [];

        for (const block of tariff.blocks) {
            const cap = block.upTo === Infinity ? Infinity : block.upTo;
            const blockSize = cap === Infinity ? remaining : cap - prevCap;
            const inBlock = Math.min(remaining, blockSize);
            if (inBlock <= 0) break;
            tiers.push({
                label: block.label,
                rangeLabel: this.formatBlockRangeLabel(block),
                kwh: inBlock,
                basicRate: block.basic,
                basicSubtotal: inBlock * block.basic
            });
            remaining -= inBlock;
            prevCap = cap === Infinity ? prevCap + inBlock : cap;
            if (remaining <= 0) break;
        }
        return tiers;
    }

    static buildMonthlyBillBreakdown(monthlyKwh, tariff, fuelRate = tariff.fuelCharge) {
        const tiers = this.getMonthlyTierBreakdown(monthlyKwh, tariff);
        const basicMonthly = tiers.reduce((sum, tier) => sum + tier.basicSubtotal, 0);
        const fuelMonthly = this.fuelMonthlyBill(monthlyKwh, fuelRate);
        return {
            monthlyKwh,
            tiers,
            basicMonthly,
            fuelMonthly,
            fuelRate,
            monthlyTotal: basicMonthly + fuelMonthly
        };
    }

    static formatMoneyHkd(amount) {
        if (!Number.isFinite(amount)) return 'HK$0.00';
        return `HK$${amount.toFixed(2)}`;
    }

    static formatMonthlyBillBreakdownHtml(breakdown, options = {}) {
        if (!breakdown || breakdown.monthlyKwh <= 0) return '';

        const {
            title = '每月計算明細 · Monthly bill breakdown',
            footnote = '',
            showAnnualScale = false
        } = options;

        const tierLines = breakdown.tiers.map((tier) => (
            `<li><span class="tariff-tier-range">${tier.rangeLabel}</span>`
            + `<span class="tariff-tier-rate">${this.formatMoneyHkd(tier.basicSubtotal)}</span>`
            + `<span class="tariff-tier-detail">${tier.kwh.toFixed(0)} 度 × 基本 HK$${tier.basicRate.toFixed(3)}</span></li>`
        )).join('');

        const fuelDetail = breakdown.fuelRateNote
            ? `${breakdown.monthlyKwh.toFixed(0)} 度 × HK$${breakdown.fuelRate.toFixed(3)} · ${breakdown.fuelRateNote}`
            : `${breakdown.monthlyKwh.toFixed(0)} 度 × HK$${breakdown.fuelRate.toFixed(3)}`;

        const lines = [
            tierLines,
            `<li><span class="tariff-tier-range">燃料調整費 Fuel</span>`
            + `<span class="tariff-tier-rate">${this.formatMoneyHkd(breakdown.fuelMonthly)}</span>`
            + `<span class="tariff-tier-detail">${fuelDetail}</span></li>`,
            `<li><span class="tariff-tier-range">每月小計 Monthly subtotal</span>`
            + `<span class="tariff-tier-rate">${this.formatMoneyHkd(breakdown.monthlyTotal)}</span>`
            + `<span class="tariff-tier-detail">基本 ${this.formatMoneyHkd(breakdown.basicMonthly)} + 燃料 ${this.formatMoneyHkd(breakdown.fuelMonthly)}</span></li>`
        ].join('');

        const annualLine = showAnnualScale
            ? `<p class="tariff-note-foot">${this.formatMoneyHkd(breakdown.monthlyTotal)}/月 × 12 個月 `
            + `= 年費 <strong>${this.formatMoneyHkd(breakdown.monthlyTotal * 12)}</strong></p>`
            : '';

        return `<div class="tariff-calc-breakdown">`
            + `<p class="tariff-calc-title">${title}</p>`
            + `<ul class="tariff-tier-list">${lines}</ul>`
            + `${annualLine}${footnote}`
            + `</div>`;
    }

    static formatResultsCalculationHtml({
        annualKwh,
        flatRate,
        flatAnnual,
        breakdown,
        providerLabel
    }) {
        if (!breakdown || breakdown.monthlyKwh <= 0) return '';

        const flatIntro = `<p class="tariff-note-intro"><strong>本次估算</strong>：年耗電 `
            + `<strong>${annualKwh.toFixed(0)} kWh</strong> × 淨電價 HK$${flatRate.toFixed(3)} `
            + `= <strong>${this.formatMoneyHkd(flatAnnual)}</strong>`
            + `<span class="tariff-note-en">This result uses the selected net tariff (basic + fuel reference rate).</span></p>`;

        const progressive = this.formatMonthlyBillBreakdownHtml(breakdown, {
            title: `${providerLabel} 累進制參考（月均 ${breakdown.monthlyKwh.toFixed(0)} 度）· Progressive reference`,
            footnote: `<p class="tariff-note-foot">單件電器估算用淨電價；累進制僅供對照實際帳單結構。`
                + `<span class="tariff-note-en">Single-appliance estimate uses flat net rate; progressive breakdown shows how a real bill is structured.</span></p>`
        });

        return `${flatIntro}${progressive}`;
    }

    static getHouseholdTotals(items, providerId, fuelRate = null) {
        const tariff = HK_PROGRESSIVE_TARIFFS[providerId] || HK_PROGRESSIVE_TARIFFS.clp;
        const resolvedFuelRate = Number.isFinite(fuelRate) ? fuelRate : tariff.fuelCharge;
        const annualKwh = items.reduce((sum, item) => sum + (item.annualKwh || 0), 0);
        const flatAnnualCost = items.reduce((sum, item) => sum + (item.annualCost || 0), 0);
        const monthlyKwh = annualKwh / 12;
        const monthlyBreakdown = this.buildMonthlyBillBreakdown(monthlyKwh, tariff, resolvedFuelRate);
        const progressiveAnnualCost = monthlyBreakdown.monthlyTotal * 12;

        return {
            count: items.length,
            annualKwh,
            monthlyKwh,
            annualCost: progressiveAnnualCost,
            monthlyCost: progressiveAnnualCost / 12,
            flatAnnualCost,
            effectiveRate: annualKwh ? progressiveAnnualCost / annualKwh : 0,
            fuelRate: resolvedFuelRate,
            monthlyBreakdown,
            tariff
        };
    }

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

    static formatProgressiveTariffHtml(tariff, monthlyKwh = 0, itemCount = 0, fuelRate = tariff.fuelCharge) {
        const intro = `<p class="tariff-note-intro"><strong>${tariff.label} 累進制電價</strong>：按<strong>每月</strong>總用電量分段計算<strong>基本電費</strong>；<strong>燃料調整費</strong>則按該月每度電另行收取（每月費率可不同）。各月「基本電費 + 燃料調整費」相加得出帳單總額。<span class="tariff-note-en">Progressive basic charge is calculated per calendar month; fuel adjustment is a separate per-kWh charge that may change monthly.</span></p>`;

        const tiers = tariff.blocks.map((block) => {
            const net = block.basic + tariff.fuelCharge;
            const range = this.formatBlockRangeLabel(block);
            return `<li><span class="tariff-tier-range">${range}</span><span class="tariff-tier-rate">基本每度 HK$${block.basic.toFixed(3)}</span><span class="tariff-tier-detail">參考淨電價（含燃料費 HK$${tariff.fuelCharge.toFixed(3)}）≈ HK$${net.toFixed(3)}/kWh</span></li>`;
        }).join('');

        const foot = itemCount > 0 && monthlyKwh > 0
            ? `<p class="tariff-note-foot">依你電器庫估算，全屋月均約 <strong>${monthlyKwh.toFixed(0)} 度</strong>，下方列出逐月計算過程（比逐件用平均電價相加更貼近實際帳單）。</p>`
            : `<p class="tariff-note-foot">儲存電器後，將按全屋估算月用量套用以下分段計算年費。</p>`;

        let calculation = '';
        if (itemCount > 0 && monthlyKwh > 0) {
            const breakdown = this.buildMonthlyBillBreakdown(monthlyKwh, tariff, fuelRate);
            if (tariff.id === 'clp') {
                breakdown.fuelRateNote = '2026 年月均燃料費估算';
            }
            calculation = this.formatMonthlyBillBreakdownHtml(breakdown, {
                title: `你的全屋估算計算（月均 ${monthlyKwh.toFixed(0)} 度）· Your household estimate`,
                showAnnualScale: true,
                footnote: tariff.id === 'clp'
                    ? '<p class="tariff-note-foot">實際帳單燃料費逐月調整（如 4月 39.8¢、6月 42.6¢）；兩月合併帳單亦按各月用量分別累進。'
                    + '<span class="tariff-note-en">Actual bills use monthly fuel rates; bimonthly bills apply progressive tiers per calendar month.</span></p>'
                    : ''
            });
        }

        return `${intro}<ul class="tariff-tier-list">${tiers}</ul>${foot}${calculation}`;
    }
}

if (typeof globalThis !== 'undefined') {
    globalThis.HK_PROGRESSIVE_TARIFFS = HK_PROGRESSIVE_TARIFFS;
    globalThis.ProgressiveTariffCalculator = ProgressiveTariffCalculator;
}