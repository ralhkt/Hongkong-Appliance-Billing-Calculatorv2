export const ONBOARDING_STORAGE_KEY = 'hk_onboarding_v1_done';

export const ONBOARDING_SLIDES = [
    {
        title: '掃描或手動輸入',
        titleEn: 'Scan or enter manually',
        body: '拍攝 MEELS 能源標籤自動填寫 kWh，或跳過掃描直接輸入參數。',
        bodyEn: 'Photograph the MEELS label to auto-fill kWh, or skip and enter details yourself.'
    },
    {
        title: '查看電費估算',
        titleEn: 'See your estimate',
        body: '選擇電器類型與電力公司，即時估算年費與月費。',
        bodyEn: 'Pick appliance type and provider to estimate annual and monthly cost.'
    },
    {
        title: '管理全屋電器',
        titleEn: 'Manage all appliances',
        body: '儲存電器至「我的電器」，用累進制電價估算全屋年費。',
        bodyEn: 'Save appliances to My Home and estimate whole-house bills with block tariffs.'
    }
];

export function shouldShowOnboarding(storage, { key = ONBOARDING_STORAGE_KEY } = {}) {
    try {
        return storage?.getItem(key) !== '1';
    } catch {
        return false;
    }
}

export function markOnboardingComplete(storage, { key = ONBOARDING_STORAGE_KEY } = {}) {
    try {
        storage?.setItem(key, '1');
        return true;
    } catch {
        return false;
    }
}

if (typeof globalThis !== 'undefined') {
    globalThis.ONBOARDING_SLIDES = ONBOARDING_SLIDES;
    globalThis.shouldShowOnboarding = shouldShowOnboarding;
    globalThis.markOnboardingComplete = markOnboardingComplete;
}