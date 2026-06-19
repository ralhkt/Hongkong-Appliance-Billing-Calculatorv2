import {
    CLP_PUBLIC_API,
    CLP_TARIFF_ENDPOINTS,
    CLP_TARIFF_FALLBACK
} from './constants.js';

export class CLPTariffService {
    constructor() {
        this.tariff = null;
        this.apiConnected = false;
        this.apiCheckedAt = null;
    }

    async verifyClpPublicApi() {
        const response = await fetch(CLP_PUBLIC_API, {
            headers: { Accept: 'application/json' },
            cache: 'no-store'
        });
        if (!response.ok) {
            throw new Error(`CLP API HTTP ${response.status}`);
        }
        const payload = await response.json();
        if (payload.code !== 200 || !payload.data) {
            throw new Error('CLP API returned unexpected payload');
        }
        this.apiConnected = true;
        this.apiCheckedAt = new Date();
        return payload;
    }

    async tryLiveTariffEndpoints() {
        for (const url of CLP_TARIFF_ENDPOINTS) {
            try {
                const response = await fetch(url, {
                    headers: { Accept: 'application/json' },
                    cache: 'no-store'
                });
                if (!response.ok) continue;
                const payload = await response.json();
                const parsed = this.parseTariffPayload(payload);
                if (parsed) {
                    parsed.source = 'CLP Public API';
                    parsed.sourceUrl = url;
                    return parsed;
                }
            } catch (_) {
                /* try next endpoint */
            }
        }
        return null;
    }

    parseTariffPayload(payload) {
        const data = payload?.data ?? payload;
        if (!data || typeof data !== 'object') return null;

        const net = Number(
            data.netTariff ?? data.net_tariff ?? data.averageNetTariff
            ?? data.residential?.netTariff ?? data.residential?.net_tariff
        );
        const basic = Number(data.basicTariff ?? data.basic_tariff ?? data.residential?.basicTariff);
        const fuel = Number(data.fuelCharge ?? data.fuel_charge ?? data.residential?.fuelCharge);

        if (!Number.isFinite(net) || net <= 0) return null;

        const toHkd = (value) => (value > 10 ? value / 100 : value);

        return {
            provider: 'CLP Power Hong Kong Limited',
            effectiveDate: data.effectiveDate ?? data.effective_date ?? null,
            residential: {
                netTariff: toHkd(net),
                basicTariff: Number.isFinite(basic) ? toHkd(basic) : null,
                fuelCharge: Number.isFinite(fuel) ? toHkd(fuel) : null
            },
            lastUpdated: new Date().toISOString()
        };
    }

    async fetchFallbackTariff() {
        const response = await fetch(CLP_TARIFF_FALLBACK, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Tariff fallback HTTP ${response.status}`);
        }
        return response.json();
    }

    async fetchLatestTariff() {
        await this.verifyClpPublicApi();
        const liveTariff = await this.tryLiveTariffEndpoints();
        if (liveTariff) {
            this.tariff = liveTariff;
            return liveTariff;
        }

        const fallback = await this.fetchFallbackTariff();
        this.tariff = {
            ...fallback,
            source: `${fallback.source} (official tariff data)`,
            apiVerified: true,
            apiEndpoint: CLP_PUBLIC_API,
            apiCheckedAt: this.apiCheckedAt?.toISOString() ?? null
        };
        return this.tariff;
    }
}

// HK MEELS
