/**
 * COMPONENT 03: Data Bridge Interface
 * Serverless Cloud Function polling Trax LRS for statements (progress, launches, completions)
 * and synchronizing records to the Learning Nexus REST API.
 */
const fs = require('fs');
const path = require('path');

// Configuration from Environment Variables
const CONFIG = {
    LRS_ENDPOINT: (process.env.LRS_ENDPOINT || 'http://localhost:8000/xapi/').replace(/\/+$/, '') + '/',
    LRS_AUTH: process.env.LRS_AUTH || 'Basic cG9jX3VzZXI6cG9jX3Bhc3M=',
    LRS_VERSION: process.env.LRS_VERSION || '1.0.3',

    NEXUS_API_URL: (process.env.NEXUS_API_URL || 'http://localhost:4000/api/v1/completions').replace(/\/+$/, ''),
    NEXUS_TELEMETRY_URL: (process.env.NEXUS_TELEMETRY_URL || (process.env.NEXUS_API_URL ? process.env.NEXUS_API_URL.replace(/\/completions\/?$/, '/telemetry') : 'http://localhost:4000/api/v1/telemetry')).replace(/\/+$/, ''),
    NEXUS_API_KEY: process.env.NEXUS_API_KEY || 'nexus_sec_key_poc_2026',

    WATERMARK_FILE: process.env.WATERMARK_FILE || path.join(__dirname, 'watermark.json'),

    POLL_INTERVAL_MS: parseInt(process.env.POLL_INTERVAL_MS || '3000', 10),
    MAX_RETRIES: 3
};

const COMPLETION_VERBS = [
    'http://adlnet.gov/expapi/verbs/completed',
    'http://adlnet.gov/expapi/verbs/passed'
];

function getWatermark() {
    try {
        if (fs.existsSync(CONFIG.WATERMARK_FILE)) {
            const raw = fs.readFileSync(CONFIG.WATERMARK_FILE, 'utf8');
            const data = JSON.parse(raw);
            return data.lastTimestamp || null;
        }
    } catch (err) {
        console.warn('[Data Bridge] Could not read watermark file, starting fresh:', err.message);
    }
    return null;
}

function saveWatermark(timestamp) {
    try {
        fs.writeFileSync(CONFIG.WATERMARK_FILE, JSON.stringify({
            lastTimestamp: timestamp,
            updatedAt: new Date().toISOString()
        }, null, 2), 'utf8');
    } catch (err) {
        console.error('[Data Bridge] Error saving watermark:', err.message);
    }
}

async function fetchStatementsFromLRS(sinceTimestamp) {
    const url = new URL(CONFIG.LRS_ENDPOINT + 'statements');
    if (sinceTimestamp) {
        url.searchParams.set('since', sinceTimestamp);
    }
    url.searchParams.set('limit', '100');

    let authHeader = CONFIG.LRS_AUTH;
    if (!authHeader.toLowerCase().startsWith('basic ') && !authHeader.toLowerCase().startsWith('bearer ')) {
        authHeader = 'Basic ' + authHeader;
    }

    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            'X-Experience-API-Version': CONFIG.LRS_VERSION,
            'Authorization': authHeader,
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Trax LRS query failed (Status ${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data.statements || (Array.isArray(data) ? data : []);
}

async function postJsonWithRetry(targetUrl, payload) {
    let attempt = 0;
    while (attempt < CONFIG.MAX_RETRIES) {
        try {
            const response = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${CONFIG.NEXUS_API_KEY}`
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                return await response.json().catch(() => ({}));
            }
        } catch (netErr) {
            // Retry
        }

        attempt++;
        if (attempt < CONFIG.MAX_RETRIES) {
            await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 300));
        }
    }
}

/**
 * Core Polling and Sync Logic
 */
async function pollAndSync() {
    const since = getWatermark();
    let statements = [];

    try {
        statements = await fetchStatementsFromLRS(since);
    } catch (err) {
        return { synced: 0, error: err.message };
    }

    if (statements.length === 0) return { synced: 0, total: 0 };

    let syncedCount = 0;
    let latestTimestamp = since;

    for (const stmt of statements) {
        const verbId = stmt.verb?.id || '';
        const verbDisplay = stmt.verb?.display?.['en-US'] || verbId.split('/').pop() || 'interacted';
        const timestamp = stmt.timestamp || stmt.stored;

        if (timestamp && (!latestTimestamp || new Date(timestamp) > new Date(latestTimestamp))) {
            latestTimestamp = timestamp;
        }

        let learnerName = 'Unknown Learner';
        let learnerEmail = 'unknown@example.com';

        if (stmt.actor) {
            learnerName = Array.isArray(stmt.actor.name) ? stmt.actor.name[0] : (stmt.actor.name || learnerName);
            let rawMbox = Array.isArray(stmt.actor.mbox) ? stmt.actor.mbox[0] : (stmt.actor.mbox || '');
            learnerEmail = rawMbox.replace(/^mailto:/i, '') || learnerEmail;
        }

        const activityId = stmt.object?.id || 'unknown_activity';
        const activityName = stmt.object?.definition?.name?.['en-US'] 
            || stmt.object?.definition?.name 
            || activityId.split('/').pop();

        // Extract progress % or dwell
        let progressVal = null;
        if (stmt.result?.extensions) {
            progressVal = stmt.result.extensions['https://w3id.org/xapi/video/extensions/progress']
                || stmt.result.extensions['http://lrs-poc.internal/extensions/page-progress'];
        }

        // 1. Sync to Telemetry / User Actions Stream
        const telemetryPayload = {
            statement_id: stmt.id,
            user: { name: learnerName, email: learnerEmail },
            course: { id: activityId, title: activityName },
            action: verbDisplay.toUpperCase(),
            progress: progressVal !== null ? Math.round(progressVal * 100) : (stmt.result?.completion ? 100 : null),
            duration: stmt.result?.duration || null,
            timestamp: timestamp || new Date().toISOString()
        };
        await postJsonWithRetry(CONFIG.NEXUS_TELEMETRY_URL, telemetryPayload);

        // 2. If Completed or Passed, Sync to Official Completions Registry
        const isCompletion = COMPLETION_VERBS.includes(verbId) || stmt.result?.completion === true;
        if (isCompletion) {
            let scaledScore = stmt.result?.score?.scaled;
            let scorePercent = scaledScore !== undefined ? Math.round(scaledScore * 100) : 100;

            const completionPayload = {
                completion_id: stmt.id || `cmp_${Date.now()}`,
                xapi_statement_id: stmt.id,
                user: { name: learnerName, email: learnerEmail },
                course: { id: activityId, title: activityName },
                status: 'completed',
                score: scorePercent,
                completed_at: timestamp || new Date().toISOString(),
                synced_at: new Date().toISOString(),
                metadata: { source_lrs: 'Trax LRS (Cloud Run)', verb: verbId }
            };

            await postJsonWithRetry(CONFIG.NEXUS_API_URL, completionPayload);
            syncedCount++;
            console.log(`[Data Bridge] Synced completion: ${learnerName} -> ${activityName}`);
        }
    }

    if (latestTimestamp && latestTimestamp !== since) {
        saveWatermark(latestTimestamp);
    }

    return { synced: syncedCount, total: statements.length };
}

async function dataBridgeHttpEntry(req, res) {
    try {
        const result = await pollAndSync();
        res.status(200).json({ status: 'success', result });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
}

if (require.main === module) {
    console.log(`[Data Bridge] Active. Polling Trax LRS every ${CONFIG.POLL_INTERVAL_MS / 1000}s...`);
    pollAndSync();
    setInterval(pollAndSync, CONFIG.POLL_INTERVAL_MS);
}

module.exports = { pollAndSync, dataBridgeHttpEntry, CONFIG };
