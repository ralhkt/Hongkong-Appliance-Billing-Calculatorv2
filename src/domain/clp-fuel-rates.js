// CLP monthly fuel cost adjustment (港仙/度 → HKD/kWh). Sources: CLP tariff pages & news, 2026.
export const CLP_FUEL_RATES_HKD = {
    '2026-01': 0.394,
    '2026-02': 0.394,
    '2026-03': 0.392,
    '2026-04': 0.398,
    '2026-05': 0.404,
    '2026-06': 0.426
};

export function getClpFuelRate(yearMonth, fallback = 0.394) {
    return CLP_FUEL_RATES_HKD[yearMonth] ?? fallback;
}

export function averageClpFuelRate(yearMonths, fallback = 0.394) {
    if (!yearMonths?.length) return fallback;
    const rates = yearMonths.map((month) => getClpFuelRate(month, fallback));
    return rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
}

/** Latest YYYY-MM key present in CLP_FUEL_RATES_HKD (update when adding monthly rates). */
export function getLatestClpFuelRateMonth() {
    const keys = Object.keys(CLP_FUEL_RATES_HKD).sort();
    return keys[keys.length - 1] ?? null;
}

export function formatClpFuelRatesAsOfLabel(locale = 'zh-HK') {
    const monthKey = getLatestClpFuelRateMonth();
    if (!monthKey) return '';
    const [year, month] = monthKey.split('-').map((part) => parseInt(part, 10));
    if (locale === 'en') {
        const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${names[month - 1]} ${year}`;
    }
    return `${year}年${month}月`;
}

export function monthsSinceFuelRateUpdate(referenceDate = new Date()) {
    const latest = getLatestClpFuelRateMonth();
    if (!latest) return Infinity;
    const [year, month] = latest.split('-').map((part) => parseInt(part, 10));
    const refYear = referenceDate.getFullYear();
    const refMonth = referenceDate.getMonth() + 1;
    return (refYear - year) * 12 + (refMonth - month);
}

if (typeof globalThis !== 'undefined') {
    globalThis.CLP_FUEL_RATES_HKD = CLP_FUEL_RATES_HKD;
    globalThis.getClpFuelRate = getClpFuelRate;
    globalThis.getLatestClpFuelRateMonth = getLatestClpFuelRateMonth;
    globalThis.formatClpFuelRatesAsOfLabel = formatClpFuelRatesAsOfLabel;
    globalThis.monthsSinceFuelRateUpdate = monthsSinceFuelRateUpdate;
}