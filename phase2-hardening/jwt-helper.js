/**
 * Phase 2 Utility: Ephemeral JWT Token Generator & Verifier
 * Demonstrates 60-second TTL token generation with opaque UUID for Articulate 360 / Web Media Wrappers.
 */
const crypto = require('crypto');

// Simulated secret key (in production, use RSA/ECDSA private key from Google Secret Manager)
const JWT_SECRET = process.env.JWT_SECRET || 'healthcare_master_hmac_secret_key_2026';

function base64UrlEncode(str) {
    return Buffer.from(str)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

function base64UrlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return Buffer.from(str, 'base64').toString('utf8');
}

/**
 * Creates an ephemeral JWT containing an opaque UUID with 60-second TTL
 */
function createEphemeralLtiToken(uuid, activityId) {
    const now = Math.floor(Date.now() / 1000);
    const ttlSeconds = 60; // 60s TTL per Phase 2 spec

    const header = {
        alg: 'HS256',
        typ: 'JWT'
    };

    const payload = {
        iss: 'https://auth.hospital-platform.org',
        sub: uuid, // Opaque UUID only - NO PII
        aud: 'https://lrs-gateway.internal.hospital.org',
        exp: now + ttlSeconds,
        iat: now,
        nbf: now,
        scope: 'xapi:write',
        activity_id: activityId || 'http://lrs-poc.internal/activities/compliance-video-module'
    };

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));

    const signature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * Validates the ephemeral JWT and returns decoded payload if valid
 */
function verifyEphemeralLtiToken(token) {
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new Error('Invalid token structure');
    }

    const [encodedHeader, encodedPayload, signature] = parts;

    const expectedSignature = crypto
        .createHmac('sha256', JWT_SECRET)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    if (signature !== expectedSignature) {
        throw new Error('Cryptographic signature verification failed');
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
        throw new Error(`Token expired. Expired at ${payload.exp}, current time ${now}`);
    }

    return payload;
}

// Self-test if executed directly
if (require.main === module) {
    console.log('=== Testing Phase 2 Ephemeral JWT Generation (60s TTL) ===');
    const testUuid = 'usr_9a4f2c18-912b-4ec5-b1a8-99d701a89c33';
    const token = createEphemeralLtiToken(testUuid);
    console.log('Generated Token:\n', token);

    const verified = verifyEphemeralLtiToken(token);
    console.log('\nVerified Token Payload (Notice: sub is opaque UUID, no PII):');
    console.log(JSON.stringify(verified, null, 2));

    const sampleUrl = `https://storage.googleapis.com/hospital-courses/module/index.html?lti_token=${token}`;
    console.log('\nPhase 2 URL Structure:');
    console.log(sampleUrl);
}

module.exports = {
    createEphemeralLtiToken,
    verifyEphemeralLtiToken
};
