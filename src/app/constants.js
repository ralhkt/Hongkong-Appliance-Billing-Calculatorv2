export const CLP_PUBLIC_API = 'https://api.clp.com.hk/evcharger/list';
export const CLP_TARIFF_FALLBACK = './data/clp-tariff.json';
export const HKE_TARIFF_FALLBACK = './data/hke-tariff.json';
export const TENANT_REFERENCE_RATE = 1.600;
export const CLP_TARIFF_ENDPOINTS = [
    'https://api.clp.com.hk/tariff/residential',
    'https://api.clp.com.hk/tariff/current',
    'https://api.clp.com.hk/residential/tariff',
    'https://api.clp.com.hk/ts1/ms/website/billCalculator/getResidentialTariff'
];

export const SAVED_APPLIANCES_KEY = 'hk_saved_appliances_v1';
export const HOME_LIBRARY_KEY = 'hk_home_library_v1';
export const HOUSEHOLD_PROVIDER_KEY = 'hk_household_provider_v1';
export const CLP_BILL_REFERENCE_KEY = 'hk_clp_bill_reference_v1';
export const LOOKUP_WORKER_URL_KEY = 'hk_lookup_worker_url_v1';
export const LOOKUP_WORKER_URL_DEFAULT = 'https://hk-appliance-lookup.ralhkt.workers.dev';