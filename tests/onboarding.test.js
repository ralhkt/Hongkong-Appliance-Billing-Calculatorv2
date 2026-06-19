import { describe, it, expect } from 'vitest';
import {
    ONBOARDING_SLIDES,
    shouldShowOnboarding,
    markOnboardingComplete,
    ONBOARDING_STORAGE_KEY
} from '../src/domain/onboarding.js';

describe('onboarding', () => {
    it('has three slides', () => {
        expect(ONBOARDING_SLIDES).toHaveLength(3);
    });

    it('shows onboarding when not completed', () => {
        const storage = { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = v; } };
        expect(shouldShowOnboarding(storage)).toBe(true);
    });

    it('hides onboarding after completion', () => {
        const storage = { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = v; } };
        markOnboardingComplete(storage);
        expect(storage.data[ONBOARDING_STORAGE_KEY]).toBe('1');
        expect(shouldShowOnboarding(storage)).toBe(false);
    });
});