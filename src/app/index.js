import {
    CLP_BILL_REFERENCE_KEY,
    CLP_PUBLIC_API,
    CLP_TARIFF_ENDPOINTS,
    CLP_TARIFF_FALLBACK,
    HKE_TARIFF_FALLBACK,
    HOME_LIBRARY_KEY,
    HOUSEHOLD_PROVIDER_KEY,
    LOOKUP_WORKER_URL_KEY,
    LOOKUP_WORKER_URL_DEFAULT,
    SAVED_APPLIANCES_KEY,
    TENANT_REFERENCE_RATE
} from './constants.js';
import { CLPTariffService } from './clp-tariff-service.js';
import { HomeLibraryStore } from './home-library-store.js';
import { LabelOCRService } from './label-ocr-service.js';

Object.assign(globalThis, {
    CLP_PUBLIC_API,
    CLP_TARIFF_FALLBACK,
    HKE_TARIFF_FALLBACK,
    TENANT_REFERENCE_RATE,
    CLP_TARIFF_ENDPOINTS,
    SAVED_APPLIANCES_KEY,
    HOME_LIBRARY_KEY,
    HOUSEHOLD_PROVIDER_KEY,
    CLP_BILL_REFERENCE_KEY,
    LOOKUP_WORKER_URL_KEY,
    LOOKUP_WORKER_URL_DEFAULT,
    CLPTariffService,
    HomeLibraryStore,
    LabelOCRService
});