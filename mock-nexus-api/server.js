/**
 * Mock Learning Nexus REST API Server
 * Emulates the enterprise LMS / Learning Nexus completion & telemetry registry
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { scanMediaWrappers } = require('./catalog-scanner');

const PORT = parseInt(process.env.PORT || '4000', 10);
const EXPECTED_TOKEN = process.env.NEXUS_API_KEY || 'nexus_sec_key_poc_2026';

// Persistent stores
const COMPLETIONS_FILE = path.join(__dirname, 'completions_store.json');
const TELEMETRY_FILE = path.join(__dirname, 'telemetry_store.json');

let completions = [];
let telemetry = [];

function loadStores() {
    try {
        if (fs.existsSync(COMPLETIONS_FILE)) {
            completions = JSON.parse(fs.readFileSync(COMPLETIONS_FILE, 'utf8'));
        }
    } catch (e) {
        completions = [];
    }

    try {
        if (fs.existsSync(TELEMETRY_FILE)) {
            telemetry = JSON.parse(fs.readFileSync(TELEMETRY_FILE, 'utf8'));
        }
    } catch (e) {
        telemetry = [];
    }
}

function saveCompletions() {
    try {
        fs.writeFileSync(COMPLETIONS_FILE, JSON.stringify(completions, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to save completions:', e.message);
    }
}

function saveTelemetry() {
    try {
        fs.writeFileSync(TELEMETRY_FILE, JSON.stringify(telemetry, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to save telemetry:', e.message);
    }
}

loadStores();

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // CORS headers for local/GCS browser dashboard integration
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Experience-API-Version');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Serve Dashboard HTML
    if (pathname === '/' || pathname === '/dashboard' || pathname === '/dashboard.html') {
        const filePath = path.join(__dirname, 'dashboard.html');
        if (fs.existsSync(filePath)) {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(fs.readFileSync(filePath));
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Dashboard file not found');
        }
        return;
    }

    // GET /api/v1/learning-objects (Live Auto-Discovery & Classification of Media Wrappers)
    if (pathname === '/api/v1/learning-objects' && req.method === 'GET') {
        const wrappersDir = process.env.MEDIA_WRAPPERS_DIR || path.join(__dirname, '..', 'media-wrappers');
        const catalog = scanMediaWrappers(wrappersDir);

        // Also sync catalog.json into wrappersDir for static fallback if accessible
        try {
            const catalogFile = path.join(wrappersDir, 'catalog.json');
            fs.writeFileSync(catalogFile, JSON.stringify(catalog, null, 2), 'utf8');
        } catch (e) {
            // Read-only filesystem is tolerated
        }

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({
            status: 'success',
            count: catalog.length,
            catalog: catalog
        }));
        return;
    }

    // GET /api/v1/completions (List certified completions)
    if (pathname === '/api/v1/completions' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'success',
            count: completions.length,
            completions: completions
        }));
        return;
    }

    // GET /api/v1/telemetry (List all user actions and progress events)
    if (pathname === '/api/v1/telemetry' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'success',
            count: telemetry.length,
            telemetry: telemetry
        }));
        return;
    }

    // POST /api/v1/telemetry (Receive progress, launch, or interaction events)
    if (pathname === '/api/v1/telemetry' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const payload = JSON.parse(body);
                const existingIdx = telemetry.findIndex(t => t.statement_id && t.statement_id === payload.statement_id);
                if (existingIdx === -1) {
                    telemetry.unshift({
                        id: `tel_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
                        ...payload,
                        received_at: new Date().toISOString()
                    });
                    // Keep maximum 200 telemetry items
                    if (telemetry.length > 200) telemetry.pop();
                    saveTelemetry();
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'recorded' }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: err.message }));
            }
        });
        return;
    }

    // POST /api/v1/completions (Receive certified course completion from Data Bridge)
    if (pathname === '/api/v1/completions' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const payload = JSON.parse(body);

                // Prevent duplicate completions for the same xAPI statement id
                const existingIdx = completions.findIndex(c => 
                    c.xapi_statement_id && c.xapi_statement_id === payload.xapi_statement_id
                );

                if (existingIdx >= 0) {
                    completions[existingIdx] = { ...completions[existingIdx], ...payload, updated_at: new Date().toISOString() };
                    saveCompletions();
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        status: 'updated',
                        message: 'Completion record updated',
                        completion: completions[existingIdx]
                    }));
                    return;
                }

                const record = {
                    id: payload.completion_id || `cmp_${Date.now()}`,
                    ...payload,
                    received_at: new Date().toISOString()
                };

                completions.unshift(record);
                saveCompletions();

                console.log(`[Learning Nexus API] Received completion for ${record.user?.name} (${record.user?.email}) - Course: ${record.course?.title}`);

                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    status: 'success',
                    message: 'Completion recorded in Learning Nexus',
                    record_id: record.id
                }));
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Malformed JSON payload: ' + err.message }));
            }
        });
        return;
    }

    // POST /api/v1/completions/clear (Reset for testing)
    if (pathname === '/api/v1/completions/clear' && (req.method === 'POST' || req.method === 'GET')) {
        completions = [];
        telemetry = [];
        saveCompletions();
        saveTelemetry();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'cleared', count: 0 }));
        return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, () => {
    console.log(`[Learning Nexus Mock API] Running at http://localhost:${PORT}/`);
    console.log(`[Learning Nexus Mock API] Dashboard available at http://localhost:${PORT}/dashboard.html`);
});
