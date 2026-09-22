/**
 * Mock Trax LRS (xAPI 1.0.3 Conformance Service)
 * Implements xAPI /statements endpoint for local verification
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '8000', 10);
const STORE_FILE = path.join(__dirname, 'lrs_statements.json');
let statements = [];

function loadStatements() {
    try {
        if (fs.existsSync(STORE_FILE)) {
            statements = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
        }
    } catch (e) {
        statements = [];
    }
}

function saveStatements() {
    try {
        fs.writeFileSync(STORE_FILE, JSON.stringify(statements, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to save statements:', e.message);
    }
}

loadStatements();

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;

    // Normalize path trailing slash
    if (!pathname.endsWith('/')) {
        pathname += '/';
    }

    // CORS Headers for static web portal & iframe requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Experience-API-Version');
    res.setHeader('X-Experience-API-Version', '1.0.3');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // xAPI Statements Endpoint
    if (pathname === '/xapi/statements/' || pathname === '/statements/') {
        // GET Statements
        if (req.method === 'GET') {
            loadStatements();
            const since = parsedUrl.query.since;
            const verb = parsedUrl.query.verb;
            const limit = parseInt(parsedUrl.query.limit || '100', 10);

            let filtered = [...statements];

            if (since) {
                const sinceDate = new Date(since);
                filtered = filtered.filter(s => new Date(s.stored || s.timestamp) > sinceDate);
            }

            if (verb) {
                filtered = filtered.filter(s => s.verb && s.verb.id === verb);
            }

            // Sort by stored timestamp ascending
            filtered.sort((a, b) => new Date(a.stored) - new Date(b.stored));

            const result = filtered.slice(0, limit);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                statements: result,
                more: ""
            }));
            return;
        }

        // POST Statements
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                try {
                    let incoming = JSON.parse(body);
                    let stmtsToSave = Array.isArray(incoming) ? incoming : [incoming];
                    let ids = [];

                    for (let stmt of stmtsToSave) {
                        if (!stmt.id) {
                            stmt.id = crypto.randomUUID();
                        }
                        if (!stmt.stored) {
                            stmt.stored = new Date().toISOString();
                        }
                        if (!stmt.timestamp) {
                            stmt.timestamp = stmt.stored;
                        }

                        ids.push(stmt.id);
                        statements.push(stmt);
                    }

                    saveStatements();

                    console.log(`[Trax LRS] Stored ${stmtsToSave.length} statement(s): ${ids.join(', ')}`);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(ids));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Invalid xAPI JSON payload: ' + e.message }));
                }
            });
            return;
        }
    }

    // Health check
    if (pathname === '/health/' || pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', statements_count: statements.length }));
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint Not Found' }));
});

server.listen(PORT, () => {
    console.log(`[Mock Trax LRS] Running at http://localhost:${PORT}/xapi/`);
});
