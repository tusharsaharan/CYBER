// =============================================================================
//  CYBERSECURITY LAB: REFLECTED CROSS-SITE SCRIPTING (XSS) IN ONLINE BANKING
// =============================================================================
//
//  Course           : Web Server Vulnerabilities & Defense
//  Category         : Cross-Site Scripting (XSS)
//  Variant          : Reflected XSS
//  Target Scenario  : "Apex Trust" Online Banking Application
//  Instructor       : Dr. Soumyadev Maity
//  Submission Due   : 03 November 2026, 23:59
//
//  How to execute:
//    npm run dev
//
//  Architecture:
//    • Port 3001 → Vulnerable Online Banking App ("Apex Trust - Vulnerable")
//    • Port 3002 → Secure Online Banking App ("Apex Trust - Hardened")
// =============================================================================

const express = require("express");

// -----------------------------------------------------------------------------
// MOCK DATA: SIMULATED BANKING DATABASE
// -----------------------------------------------------------------------------
const MOCK_ACCOUNT = {
  holder: "Alex Mercer",
  accountNumber: "ACT-8492-9102",
  accountType: "Premier Checking",
  balance: "$14,820.50",
  routingNumber: "021000089",
};

const MOCK_TRANSACTIONS = [
  { id: "TX-1001", date: "2026-11-01", description: "Direct Deposit - Global Tech Payroll", category: "Income", amount: "+$4,500.00" },
  { id: "TX-1002", date: "2026-10-30", description: "Metropolitan Utility Service - Electricity", category: "Utilities", amount: "-$145.20" },
  { id: "TX-1003", date: "2026-10-28", description: "Whole Foods Market - Groceries", category: "Food & Dining", amount: "-$86.40" },
  { id: "TX-1004", date: "2026-10-25", description: "Apex Mortgage Transfer", category: "Housing", amount: "-$1,850.00" },
  { id: "TX-1005", date: "2026-10-22", description: "Cloudflare Subscription", category: "Services", amount: "-$20.00" },
];

// -----------------------------------------------------------------------------
// SHARED STYLING: MODERN BANKING UI TEMPLATE
// -----------------------------------------------------------------------------
function renderBankLayout({ title, isSecure, port, activeTab, content }) {
  const badgeColor = isSecure ? "#16a34a" : "#dc2626";
  const badgeText = isSecure ? "SECURE INSTANCE (PORT 3002)" : "VULNERABLE INSTANCE (PORT 3001)";
  const brandName = "Apex Trust Online Banking";

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${title} | ${brandName}</title>
      <style>
        :root {
          --primary: #1e3a8a;
          --primary-dark: #172554;
          --bg: #f8fafc;
          --surface: #ffffff;
          --text: #0f172a;
          --text-muted: #64748b;
          --border: #e2e8f0;
          --accent-red: #ef4444;
          --accent-green: #22c55e;
          --accent-yellow: #f59e0b;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; }
        body { background: var(--bg); color: var(--text); line-height: 1.5; padding-bottom: 60px; }
        header { background: var(--primary-dark); color: white; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; }
        .logo-group { display: flex; align-items: center; gap: 0.75rem; }
        .logo-icon { font-size: 1.5rem; background: rgba(255,255,255,0.15); padding: 0.35rem 0.6rem; border-radius: 8px; }
        .brand-title { font-size: 1.25rem; font-weight: 700; letter-spacing: -0.025em; }
        .instance-pill { font-size: 0.75rem; font-weight: 700; padding: 0.3rem 0.75rem; border-radius: 9999px; background: ${badgeColor}; color: white; letter-spacing: 0.05em; }
        
        .nav-bar { background: var(--surface); border-bottom: 1px solid var(--border); padding: 0 2rem; display: flex; gap: 1.5rem; }
        .nav-link { padding: 1rem 0; text-decoration: none; color: var(--text-muted); font-size: 0.95rem; font-weight: 500; border-bottom: 2px solid transparent; }
        .nav-link.active { color: var(--primary); border-bottom-color: var(--primary); font-weight: 600; }
        .nav-link:hover { color: var(--primary); }

        .container { max-width: 1100px; margin: 2rem auto; padding: 0 1rem; }
        
        .card { background: var(--surface); border-radius: 10px; border: 1px solid var(--border); padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border); }
        .card-title { font-size: 1.15rem; font-weight: 600; color: var(--text); }

        .account-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
        .account-stat { background: #f1f5f9; padding: 1rem; border-radius: 8px; }
        .account-stat-label { font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
        .account-stat-val { font-size: 1.35rem; font-weight: 700; color: var(--text); margin-top: 0.25rem; }

        .search-box { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
        .search-input { flex: 1; padding: 0.75rem 1rem; border: 1px solid var(--border); border-radius: 6px; font-size: 0.95rem; }
        .search-input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.1); }
        .btn-primary { background: var(--primary); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; font-weight: 600; cursor: pointer; }
        .btn-primary:hover { background: var(--primary-dark); }

        table { width: 100%; border-collapse: collapse; text-align: left; }
        th { background: #f8fafc; padding: 0.75rem 1rem; font-size: 0.8rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; border-bottom: 1px solid var(--border); }
        td { padding: 0.85rem 1rem; font-size: 0.9rem; border-bottom: 1px solid var(--border); }
        tr:last-child td { border-bottom: none; }
        .amount-pos { color: var(--accent-green); font-weight: 600; }
        .amount-neg { color: var(--text); font-weight: 600; }

        .alert-banner { padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; display: flex; gap: 0.75rem; align-items: flex-start; }
        .alert-danger { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }
        .alert-success { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; }
        .alert-info { background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; }
        
        .code-block { background: #1e293b; color: #f8fafc; padding: 1rem; border-radius: 6px; font-family: "Courier New", Courier, monospace; font-size: 0.85rem; overflow-x: auto; margin: 0.5rem 0; }
        .code-inline { background: #e2e8f0; color: #334155; padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace; font-size: 0.9em; }

        .diagram-step { display: flex; gap: 1rem; margin-bottom: 1rem; align-items: flex-start; }
        .step-number { background: var(--primary); color: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; flex-shrink: 0; }
        .step-content { flex: 1; }
      </style>
    </head>
    <body>
      <header>
        <div class="logo-group">
          <span class="logo-icon">🏛️</span>
          <div>
            <div class="brand-title">${brandName}</div>
            <div style="font-size: 0.75rem; color: #cbd5e1;">Enterprise Internet Banking Demo</div>
          </div>
        </div>
        <div>
          <span class="instance-pill">${badgeText}</span>
        </div>
      </header>

      <nav class="nav-bar">
        <a href="/" class="nav-link ${activeTab === 'dashboard' ? 'active' : ''}">Account Dashboard</a>
        <a href="/transactions" class="nav-link ${activeTab === 'transactions' ? 'active' : ''}">Transaction Search</a>
        <a href="/scenario" class="nav-link ${activeTab === 'scenario' ? 'active' : ''}">Attack vs Defense Analysis</a>
      </nav>

      <main class="container">
        ${content}
      </main>
    </body>
    </html>
  `;
}


// =============================================================================
// APP 1: VULNERABLE ONLINE BANKING INSTANCE (PORT 3001)
// =============================================================================
//
// Root Cause Analysis (Item c):
//   In the transaction search endpoint (GET /transactions?q=...), the user-
//   supplied query string parameter (req.query.q) is directly interpolated
//   into the HTML response markup without output encoding or sanitization.
//
// Flawed Code Path (Item a):
//   const query = req.query.q || "";
//   res.send(`... <div class="results-banner">Showing results for: ${query}</div> ...`);
//
// Exploit Vector (Item b):
//   When a victim clicks a link like:
//   http://localhost:3001/transactions?q=<script>alert('XSS: Banking Session Compromised!')</script>
//   The browser interprets the unescaped <script> tag as valid HTML markup,
//   executing the JavaScript under the trusted origin: http://localhost:3001
// =============================================================================

const vulnApp = express();
const VULN_PORT = 3001;

// 1. Dashboard View
vulnApp.get("/", (_req, res) => {
  const content = `
    <div class="alert-banner alert-danger">
      <div>⚠️</div>
      <div>
        <strong>Security Notice:</strong> This instance is intentionally configured with a 
        <strong>Reflected Cross-Site Scripting (XSS)</strong> vulnerability in the Transaction Search module.
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Welcome, ${MOCK_ACCOUNT.holder}</h2>
        <span style="font-size: 0.85rem; color: var(--text-muted);">Session Status: Authenticated</span>
      </div>
      <div class="account-grid">
        <div class="account-stat">
          <div class="account-stat-label">Available Balance</div>
          <div class="account-stat-val" style="color: var(--accent-green);">${MOCK_ACCOUNT.balance}</div>
        </div>
        <div class="account-stat">
          <div class="account-stat-label">Account Number</div>
          <div class="account-stat-val">${MOCK_ACCOUNT.accountNumber}</div>
        </div>
        <div class="account-stat">
          <div class="account-stat-label">Account Type</div>
          <div class="account-stat-val" style="font-size: 1.1rem; padding-top: 0.2rem;">${MOCK_ACCOUNT.accountType}</div>
        </div>
        <div class="account-stat">
          <div class="account-stat-label">Routing Number</div>
          <div class="account-stat-val">${MOCK_ACCOUNT.routingNumber}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Quick Action: Search Transaction Ledger</h3>
        <a href="/transactions" style="color: var(--primary); font-size: 0.9rem; text-decoration: none;">View Full History &rarr;</a>
      </div>
      <form action="/transactions" method="GET" class="search-box">
        <input type="text" name="q" class="search-input" placeholder="Search payee, vendor or keyword (e.g. Payroll, Whole Foods, Mortgage)..." required>
        <button type="submit" class="btn-primary">Search Records</button>
      </form>
      <p style="font-size: 0.85rem; color: var(--text-muted);">
        Tip: The search parameter is reflected directly onto the page without escaping.
      </p>
    </div>
  `;

  res.send(renderBankLayout({
    title: "Vulnerable Dashboard",
    isSecure: false,
    port: VULN_PORT,
    activeTab: "dashboard",
    content
  }));
});

// 2. Vulnerable Transaction Search (THE VULNERABLE ROUTE)
vulnApp.get("/transactions", (req, res) => {
  const query = req.query.q || "";

  // Filter transactions matching query
  const filtered = query
    ? MOCK_TRANSACTIONS.filter(t => 
        t.description.toLowerCase().includes(query.toLowerCase()) || 
        t.category.toLowerCase().includes(query.toLowerCase())
      )
    : MOCK_TRANSACTIONS;

  const rows = filtered.map(t => `
    <tr>
      <td>${t.date}</td>
      <td><strong>${t.description}</strong></td>
      <td><span class="code-inline">${t.category}</span></td>
      <td class="${t.amount.startsWith('+') ? 'amount-pos' : 'amount-neg'}">${t.amount}</td>
    </tr>
  `).join("");

  // VULNERABLE REFLECTION:
  // `query` is interpolated directly into the HTML response without escapeHtml()!
  const queryDisplay = query 
    ? `<div class="alert-banner alert-danger">
         <div>🔍</div>
         <div>Showing query results for: <strong>${query}</strong></div>
       </div>`
    : "";

  const content = `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Account Activity & Transaction Filter</h2>
        <span style="font-size: 0.85rem; color: var(--text-muted);">${filtered.length} record(s) found</span>
      </div>

      <form action="/transactions" method="GET" class="search-box">
        <input type="text" name="q" value="${query}" class="search-input" placeholder="Search by merchant, category, or keyword...">
        <button type="submit" class="btn-primary">Filter Ledger</button>
      </form>

      ${queryDisplay}

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description / Merchant</th>
            <th>Category</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">No records found.</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="card" style="border-left: 4px solid var(--accent-red);">
      <h3 style="color: var(--accent-red); margin-bottom: 0.5rem;">🚨 Reflected XSS Exploit Verification</h3>
      <p style="font-size: 0.9rem; margin-bottom: 0.75rem;">
        Click or copy the link below to simulate a victim clicking an attacker's phishing link:
      </p>
      <div class="code-block">http://localhost:3001/transactions?q=&lt;script&gt;alert('XSS: Banking Session Compromised!')&lt;/script&gt;</div>
      <p style="margin-top: 0.5rem;">
        <a href="/transactions?q=<script>alert('XSS: Banking Session Compromised!')</script>" 
           style="background: #dc2626; color: white; padding: 0.4rem 0.8rem; border-radius: 4px; text-decoration: none; font-size: 0.85rem; font-weight: 600; display: inline-block;">
          ⚡ Test Working Exploit in Browser
        </a>
      </p>
    </div>
  `;

  res.send(renderBankLayout({
    title: "Transactions (Vulnerable)",
    isSecure: false,
    port: VULN_PORT,
    activeTab: "transactions",
    content
  }));
});

// 3. Attack vs Defense Threat Analysis View
vulnApp.get("/scenario", (_req, res) => {
  const content = renderScenarioContent(false);
  res.send(renderBankLayout({
    title: "Attack Model Analysis",
    isSecure: false,
    port: VULN_PORT,
    activeTab: "scenario",
    content
  }));
});


// =============================================================================
// APP 2: SECURE / HARDENED ONLINE BANKING INSTANCE (PORT 3002)
// =============================================================================
//
// Implemented Mitigation (Item d):
//   Context-Aware HTML Entity Encoding.
//   Every piece of untrusted user input reflected in HTML elements or attributes
//   is encoded before interpolation.
//
// Why this works:
//   The function replaces special characters (<, >, &, ", ') with their
//   corresponding HTML character references (&lt;, &gt;, &amp;, &quot;, &#39;).
//   The browser displays them as literal text instead of parsing them as script.
// =============================================================================

const safeApp = express();
const SAFE_PORT = 3002;

// IMPLEMENTED DEFENSE: HTML-Entity Encoding Function
function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")   // 1. Must replace ampersands first to prevent double-encoding
    .replace(/</g, "&lt;")    // 2. Disarms opening HTML tags (<script>)
    .replace(/>/g, "&gt;")    // 3. Disarms closing HTML tags
    .replace(/"/g, "&quot;")  // 4. Prevents breakout from double-quoted attributes
    .replace(/'/g, "&#39;");  // 5. Prevents breakout from single-quoted attributes
}

// 1. Secure Dashboard View
safeApp.get("/", (_req, res) => {
  const content = `
    <div class="alert-banner alert-success">
      <div>🛡️</div>
      <div>
        <strong>Security Notice:</strong> This instance implements strict 
        <strong>Context-Aware Output Encoding</strong>. Injected scripts are rendered harmlessly as plain text.
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Welcome, ${MOCK_ACCOUNT.holder}</h2>
        <span style="font-size: 0.85rem; color: var(--accent-green); font-weight: 600;">Security Controls: Active</span>
      </div>
      <div class="account-grid">
        <div class="account-stat">
          <div class="account-stat-label">Available Balance</div>
          <div class="account-stat-val" style="color: var(--accent-green);">${MOCK_ACCOUNT.balance}</div>
        </div>
        <div class="account-stat">
          <div class="account-stat-label">Account Number</div>
          <div class="account-stat-val">${MOCK_ACCOUNT.accountNumber}</div>
        </div>
        <div class="account-stat">
          <div class="account-stat-label">Account Type</div>
          <div class="account-stat-val" style="font-size: 1.1rem; padding-top: 0.2rem;">${MOCK_ACCOUNT.accountType}</div>
        </div>
        <div class="account-stat">
          <div class="account-stat-label">Routing Number</div>
          <div class="account-stat-val">${MOCK_ACCOUNT.routingNumber}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Search Transaction Ledger (Secured)</h3>
        <a href="/transactions" style="color: var(--primary); font-size: 0.9rem; text-decoration: none;">View Full History &rarr;</a>
      </div>
      <form action="/transactions" method="GET" class="search-box">
        <input type="text" name="q" class="search-input" placeholder="Search payee, vendor or keyword..." required>
        <button type="submit" class="btn-primary">Search Records</button>
      </form>
    </div>
  `;

  res.send(renderBankLayout({
    title: "Secure Dashboard",
    isSecure: true,
    port: SAFE_PORT,
    activeTab: "dashboard",
    content
  }));
});

// 2. Secure Transaction Search (THE MITIGATED ROUTE)
safeApp.get("/transactions", (req, res) => {
  const rawQuery = req.query.q || "";
  
  // MITIGATION APPLIED HERE:
  const safeQuery = escapeHtml(rawQuery);

  const filtered = rawQuery
    ? MOCK_TRANSACTIONS.filter(t => 
        t.description.toLowerCase().includes(rawQuery.toLowerCase()) || 
        t.category.toLowerCase().includes(rawQuery.toLowerCase())
      )
    : MOCK_TRANSACTIONS;

  const rows = filtered.map(t => `
    <tr>
      <td>${t.date}</td>
      <td><strong>${escapeHtml(t.description)}</strong></td>
      <td><span class="code-inline">${escapeHtml(t.category)}</span></td>
      <td class="${t.amount.startsWith('+') ? 'amount-pos' : 'amount-neg'}">${t.amount}</td>
    </tr>
  `).join("");

  // SECURE REFLECTION:
  // Notice we render `safeQuery` (HTML-encoded), NOT rawQuery!
  const queryDisplay = rawQuery 
    ? `<div class="alert-banner alert-success">
         <div>🔍</div>
         <div>Showing query results for: <strong>${safeQuery}</strong></div>
       </div>`
    : "";

  const content = `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Account Activity & Transaction Filter (Hardened)</h2>
        <span style="font-size: 0.85rem; color: var(--text-muted);">${filtered.length} record(s) found</span>
      </div>

      <form action="/transactions" method="GET" class="search-box">
        <input type="text" name="q" value="${safeQuery}" class="search-input" placeholder="Search by merchant, category, or keyword...">
        <button type="submit" class="btn-primary">Filter Ledger</button>
      </form>

      ${queryDisplay}

      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Description / Merchant</th>
            <th>Category</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rows || '<tr><td colspan="4" style="text-align:center; color: var(--text-muted);">No records found.</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="card" style="border-left: 4px solid var(--accent-green);">
      <h3 style="color: var(--accent-green); margin-bottom: 0.5rem;">🛡️ Blocked Exploit Verification</h3>
      <p style="font-size: 0.9rem; margin-bottom: 0.75rem;">
        Testing the exact same attack payload against the secured server:
      </p>
      <div class="code-block">http://localhost:3002/transactions?q=&lt;script&gt;alert('XSS: Banking Session Compromised!')&lt;/script&gt;</div>
      <p style="margin-top: 0.5rem;">
        <a href="/transactions?q=<script>alert('XSS: Banking Session Compromised!')</script>" 
           style="background: #16a34a; color: white; padding: 0.4rem 0.8rem; border-radius: 4px; text-decoration: none; font-size: 0.85rem; font-weight: 600; display: inline-block;">
          🛡️ Verify Payload is Rendered as Plain Text (Fails to Execute)
        </a>
      </p>
    </div>
  `;

  res.send(renderBankLayout({
    title: "Transactions (Secure)",
    isSecure: true,
    port: SAFE_PORT,
    activeTab: "transactions",
    content
  }));
});

// 3. Secure Threat Analysis View
safeApp.get("/scenario", (_req, res) => {
  const content = renderScenarioContent(true);
  res.send(renderBankLayout({
    title: "Attack Model Analysis (Hardened)",
    isSecure: true,
    port: SAFE_PORT,
    activeTab: "scenario",
    content
  }));
});


// -----------------------------------------------------------------------------
// REUSABLE EDUCATIONAL VIEW: TWO SIDES (ATTACKER VS VICTIM) THREAT MODEL
// -----------------------------------------------------------------------------
function renderScenarioContent(isSecure) {
  return `
    <div class="card">
      <div class="card-header">
        <h2 class="card-title">Reflected XSS: Comprehensive Attack & Defense Model</h2>
        <span class="code-inline">Vulnerability Variant: Reflected XSS</span>
      </div>
      <p style="margin-bottom: 1.5rem; color: var(--text-muted);">
        Understanding the two sides of a Reflected XSS attack in high-value web applications like online banking.
      </p>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem;">
        <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; padding: 1.25rem;">
          <h3 style="color: #be123c; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
            <span>🎯</span> Side 1: The Attacker's Workflow
          </h3>
          <ul style="padding-left: 1.25rem; font-size: 0.9rem; line-height: 1.7; color: #4c0519;">
            <li><strong>Reconnaissance:</strong> Attacker discovers the bank's transaction search endpoint reflects query parameters directly into the DOM.</li>
            <li><strong>Weaponized Link Construction:</strong> Attacker crafts a targeted URL embedding script logic into the <span class="code-inline">?q=</span> parameter.</li>
            <li><strong>Delivery / Social Engineering:</strong> Attacker emails the victim with a spoofed banking alert: <em>"Suspicious transaction detected on your account! Review details here: [Malicious URL]"</em>.</li>
            <li><strong>Exploitation Goal:</strong> The script executes inside the victim's authenticated browser session under the bank's legitimate origin (<span class="code-inline">http://localhost:3001</span>).</li>
          </ul>
        </div>

        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 1.25rem;">
          <h3 style="color: #15803d; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
            <span>👤</span> Side 2: The Victim / User's Context
          </h3>
          <ul style="padding-left: 1.25rem; font-size: 0.9rem; line-height: 1.7; color: #14532d;">
            <li><strong>Active Session:</strong> The victim is already logged in to their online banking portal (holding active session tokens and account state).</li>
            <li><strong>Implicit Trust:</strong> The victim clicks the link believing it points to their real banking provider (domain name matches legitimate portal).</li>
            <li><strong>Browser Context:</strong> The browser loads the bank's real page, but because the server reflects unencoded markup, it parses the injected script.</li>
            <li><strong>Impact:</strong> The script has full access to the Document Object Model (DOM), local storage, and can trigger background requests on the user's behalf.</li>
          </ul>
        </div>
      </div>

      <div class="card" style="background: #f8fafc; border: 1px solid var(--border);">
        <h3 style="margin-bottom: 1rem;">End-to-End Execution Flowchart</h3>
        
        <div class="diagram-step">
          <div class="step-number">1</div>
          <div class="step-content">
            <strong>Attacker identifies unencoded reflection sink</strong>
            <p style="font-size: 0.85rem; color: var(--text-muted);">The server interpolates <span class="code-inline">req.query.q</span> into <span class="code-inline">&lt;strong&gt;\${query}&lt;/strong&gt;</span>.</p>
          </div>
        </div>

        <div class="diagram-step">
          <div class="step-number">2</div>
          <div class="step-content">
            <strong>Social engineering vector delivers the payload</strong>
            <p style="font-size: 0.85rem; color: var(--text-muted);">Attacker lures logged-in victim via phishing email, chat message, or forum link.</p>
          </div>
        </div>

        <div class="diagram-step">
          <div class="step-number">3</div>
          <div class="step-content">
            <strong>Server reflects payload in HTTP response</strong>
            <p style="font-size: 0.85rem; color: var(--text-muted);">The bank web server mirrors the attacker's script back in the response body.</p>
          </div>
        </div>

        <div class="diagram-step">
          <div class="step-number">4</div>
          <div class="step-content">
            <strong>Browser executes script in victim's origin context (Vulnerable) vs Rendered as Text (Secure)</strong>
            <p style="font-size: 0.85rem; color: var(--text-muted);">
              ${isSecure 
                ? '<span style="color: var(--accent-green); font-weight: 600;">[SECURE] escapeHtml() converts characters to entities; browser renders harmless text.</span>' 
                : '<span style="color: var(--accent-red); font-weight: 600;">[VULNERABLE] Browser parser constructs an executable &lt;script&gt; node and triggers execution.</span>'}
            </p>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 style="margin-bottom: 0.75rem;">Theoretical Post-Exploitation Risks in Banking Contexts</h3>
        <p style="font-size: 0.9rem; margin-bottom: 1rem;">
          In real-world incidents, adversaries leverage arbitrary JavaScript execution in high-security apps to accomplish:
        </p>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
          <div style="background: white; border: 1px solid var(--border); border-radius: 6px; padding: 1rem;">
            <strong>1. DOM Phishing / Credential Prompts</strong>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">
              The injected script dynamically inserts a fake modal over the banking UI: <em>"Session expired for security. Please re-enter your password and 2FA token to continue."</em> Because the URL bar shows the legitimate bank domain, victims are easily deceived.
            </p>
          </div>
          <div style="background: white; border: 1px solid var(--border); border-radius: 6px; padding: 1rem;">
            <strong>2. Client-Side Request Forgery</strong>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">
              The script executes authenticated API calls (e.g. <span class="code-inline">fetch('/api/transfer')</span>) with the user's active session. Traditional CSRF tokens in the DOM can be read directly by XSS, bypassing anti-CSRF defenses.
            </p>
          </div>
          <div style="background: white; border: 1px solid var(--border); border-radius: 6px; padding: 1rem;">
            <strong>3. Session Token Exfiltration</strong>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">
              If session cookies lack the <span class="code-inline">HttpOnly</span> attribute, the script can read <span class="code-inline">document.cookie</span> to hijack the active session.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
}


// =============================================================================
// SERVER STARTUP
// =============================================================================

vulnApp.listen(VULN_PORT, () => {
  console.log("\n" + "=".repeat(75));
  console.log(`  [!] VULNERABLE BANKING APP RUNNING  ->  http://localhost:${VULN_PORT}`);
  console.log(`      Dashboard : http://localhost:${VULN_PORT}`);
  console.log(`      Search    : http://localhost:${VULN_PORT}/transactions`);
  console.log(`      Analysis  : http://localhost:${VULN_PORT}/scenario`);
  console.log(`      Exploit   : http://localhost:${VULN_PORT}/transactions?q=<script>alert('XSS: Banking Session Compromised!')</script>`);
  console.log("=".repeat(75));
});

safeApp.listen(SAFE_PORT, () => {
  console.log("\n" + "=".repeat(75));
  console.log(`  [+] SECURE / HARDENED APP RUNNING  ->  http://localhost:${SAFE_PORT}`);
  console.log(`      Dashboard : http://localhost:${SAFE_PORT}`);
  console.log(`      Search    : http://localhost:${SAFE_PORT}/transactions`);
  console.log(`      Analysis  : http://localhost:${SAFE_PORT}/scenario`);
  console.log(`      Test Block: http://localhost:${SAFE_PORT}/transactions?q=<script>alert('XSS: Banking Session Compromised!')</script>`);
  console.log("=".repeat(75) + "\n");
});
