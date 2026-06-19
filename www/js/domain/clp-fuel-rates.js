// CLP monthly fuel cost adjustment (港仙/度 → HKD/kWh). Sources: CLP tariff pages & news, 2026.
const CLP_FUEL_RATES_HKD = {
    '2026-01': 0.394,
    '2026-02': 0.394,
    '2026-03': 0.392,
    '2026-04': 0.398,
    '2026-05': 0.404,
    '2026-06': 0.426
};

function getClpFuelRate(yearMonth, fallback = 0.394) {
    return CLP_FUEL_RATES_HKD[yearMonth] ?? fallback;
}

function averageClpFuelRate(yearMonths, fallback = 0.394) {
    if (!yearMonths?.length) return fallback;
    const rates = yearMonths.map((month) => getClpFuelRate(month, fallback));
    return rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
}

if (typeof globalThis !== 'undefined') {
    globalThis.CLP_FUEL_RATES_HKD = CLP_FUEL_RATES_HKD;
    globalThis.getClpFuelRate = getClpFuelRate;
}