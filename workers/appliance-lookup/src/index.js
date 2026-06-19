import {
    buildGrokLookupPrompt,
    extractTextFromXaiResponse,
    formatLookupApiError,
    processLookupModelText,
    validateLookupInput
} from '../../../src/domain/appliance-lookup.js';

const XAI_RESPONSES_URL = 'https://api.x.ai/v1/responses';
const XAI_MODEL = 'grok-4-1-fast-non-reasoning';
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json; charset=utf-8'
        }
    });
}

async function callXaiLookup(env, brand, model) {
    const apiKey = env.XAI_API_KEY;
    if (!apiKey) {
        throw new Error('Worker missing XAI_API_KEY secret');
    }

    const prompt = buildGrokLookupPrompt(brand, model);
    const response = await fetch(XAI_RESPONSES_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: XAI_MODEL,
            input: [{ role: 'user', content: prompt }],
            tools: [{ type: 'web_search' }]
        })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const detail = payload?.error?.message || payload?.error || `xAI HTTP ${response.status}`;
        throw new Error(formatLookupApiError(String(detail)));
    }

    const text = extractTextFromXaiResponse(payload);
    return processLookupModelText(text, brand, model);
}

export default {
    async fetch(request, env) {
        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: CORS_HEADERS });
        }

        if (request.method !== 'POST') {
            return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
        }

        let body;
        try {
            body = await request.json();
        } catch {
            return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400);
        }

        const validation = validateLookupInput(body?.brand, body?.model);
        if (!validation.ok) {
            return jsonResponse({ ok: false, error: validation.message }, 400);
        }

        try {
            const { parsed, validation: resultCheck } = await callXaiLookup(
                env,
                validation.brand,
                validation.model
            );

            if (!resultCheck.ok) {
                return jsonResponse({ ok: false, error: resultCheck.message, result: parsed }, 422);
            }

            return jsonResponse({
                ok: true,
                result: parsed,
                validation: resultCheck
            });
        } catch (err) {
            return jsonResponse({
                ok: false,
                error: err?.message || 'Lookup failed'
            }, 502);
        }
    }
};