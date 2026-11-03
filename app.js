// =============================================================================
//  CYBERSECURITY LAB: REFLECTED CROSS-SITE SCRIPTING (XSS) DEMONSTRATION
//  TWO-SIDED ARCHITECTURE: ATTACKER SIDE (PORT 4000) vs USER SIDE (PORT 3001 & 3002)
// =============================================================================
//
//  Course           : Web Server Vulnerabilities & Defense
//  Category         : Cross-Site Scripting (XSS)
//  Variant          : Reflected XSS
//  Instructor       : Dr. Soumyadev Maity
//  Submission Due   : 03 November 2026, 23:59
//
//  How to execute:
//    npm run dev
//
//  Port Architecture:
//    • Port 4000 → ATTACKER SIDE: Phishing Delivery Server ("EvilCorp Lure Portal")
//    • Port 3001 → USER SIDE: Apex Trust Online Banking (Vulnerable Instance)
//    • Port 3002 → USER SIDE: Apex Trust Online Banking (Secured / Hardened Instance)
//
// =============================================================================

const express = require("express");

// -----------------------------------------------------------------------------
// SHARED MOCK DATA: SIMULATED BANKING LEDGER
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


// =============================================================================
// =============================================================================
// WEBSITE 1: THE ATTACKER SIDE (PORT 4000)
// =============================================================================
// =============================================================================
//
// What this website represents:
//   In a real-world Reflected XSS attack, the malicious link does NOT originate
//   from the bank itself. The attacker operates an external system (a spoofed
//   email campaign, an attacker-controlled web forum, a malicious ad, or SMS).
//
//   This server simulates the Attacker's Phishing Delivery Infrastructure:
//   1. The attacker crafts a targeted URL embedding a JavaScript payload into
//      the bank's vulnerable ?q= transaction search parameter.
//   2. The attacker drafts a high-urgency lure email: "Suspicious charge detected!"
//   3. The victim opens their email on this site and clicks the weaponized link.
// =============================================================================

const attackerApp = express();
const ATTACKER_PORT = 4000;

// The educational PoC payload
const EXPLOIT_PAYLOAD = "<script>alert('🚨 XSS EXECUTED!\\n\\nOrigin: ' + document.domain + '\\nVictim Active Session: Authenticated\\nArbitrary JavaScript is running inside the bank!')</script>";
const ENCODED_PAYLOAD = encodeURIComponent(EXPLOIT_PAYLOAD);

const VULN_ATTACK_URL = `http://localhost:3001/transactions?q=${ENCODED_PAYLOAD}`;
const SAFE_ATTACK_URL = `http://localhost:3002/transactions?q=${ENCODED_PAYLOAD}`;

attackerApp.get("/", (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Attacker Command Center & Phishing Simulation</title>
      <style>
        :root {
          --dark-bg: #0f172a;
          --dark-surface: #1e293b;
          --dark-border: #334155;
          --red: #ef4444;
          --red-dark: #dc2626;
          --green: #22c55e;
          --text: #f8fafc;
          --text-muted: #94a3b8;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { background: var(--dark-bg); color: var(--text); padding-bottom: 50px; }
        header { background: #020617; border-bottom: 1px solid var(--dark-border); padding: 1.25rem 2rem; display: flex; justify-content: space-between; align-items: center; }
        .badge { background: var(--red); color: white; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; letter-spacing: 0.05em; }
        .container { max-width: 1000px; margin: 2rem auto; padding: 0 1rem; }
        
        .card { background: var(--dark-surface); border: 1px solid var(--dark-border); border-radius: 10px; padding: 1.5rem; margin-bottom: 1.5rem; }
        .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--dark-border); }
        .card-title { font-size: 1.2rem; font-weight: 700; color: #f1f5f9; display: flex; align-items: center; gap: 0.5rem; }

        /* Mock Webmail UI */
        .email-client { background: #ffffff; color: #1e293b; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3); }
        .email-header { background: #f1f5f9; padding: 1rem 1.5rem; border-bottom: 1px solid #cbd5e1; }
        .email-field { font-size: 0.85rem; margin-bottom: 0.35rem; }
        .email-field strong { color: #475569; display: inline-block; width: 70px; }
        .email-subject { font-size: 1.1rem; font-weight: 700; color: #0f172a; margin-top: 0.5rem; }
        .email-body { padding: 1.5rem; line-height: 1.6; font-size: 0.95rem; }
        .email-bank-logo { font-size: 1.1rem; font-weight: 800; color: #1e3a8a; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; }
        
        .cta-btn { display: inline-block; background: #dc2626; color: white !important; font-weight: 700; text-decoration: none; padding: 0.85rem 1.75rem; border-radius: 6px; margin: 1.25rem 0; box-shadow: 0 2px 4px rgba(220, 38, 38, 0.4); }
        .cta-btn:hover { background: #b91c1c; }

        .cta-btn-safe { display: inline-block; background: #16a34a; color: white !important; font-weight: 700; text-decoration: none; padding: 0.85rem 1.75rem; border-radius: 6px; margin: 1.25rem 0; }
        .cta-btn-safe:hover { background: #15803d; }

        .code-box { background: #020617; color: #38bdf8; font-family: monospace; font-size: 0.85rem; padding: 1rem; border-radius: 6px; word-break: break-all; margin: 0.75rem 0; border: 1px solid #1e293b; }
        .flow-step { display: flex; gap: 1rem; margin-bottom: 1rem; align-items: flex-start; }
        .step-num { background: var(--red); color: white; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.8rem; flex-shrink: 0; }
        .step-text { font-size: 0.9rem; line-height: 1.5; color: #cbd5e1; }
      </style>
    </head>
    <body>
      <header>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.5rem;">🕵️</span>
          <div>
            <div style="font-size: 1.1rem; font-weight: 700;">Attacker Simulation Portal</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">External Delivery Infrastructure (Port 4000)</div>
          </div>
        </div>
        <span class="badge">SIDE 1: ATTACKER PERSPECTIVE</span>
      </header>

      <div class="container">
        
        <!-- Explanation Card -->
        <div class="card" style="border-left: 4px solid var(--red);">
          <div class="card-header">
            <h2 class="card-title"><span>🎯</span> Phase 1: Attack Vector Construction</h2>
          </div>
          <p style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 0.75rem;">
            The attacker has performed reconnaissance and found that Apex Trust Bank's transaction search endpoint reflects user input directly.
            The attacker crafts a weaponized hyperlink embedding JavaScript into the <span style="color: #38bdf8; font-family: monospace;">?q=</span> parameter:
          </p>
          <div class="code-box">${VULN_ATTACK_URL}</div>
        </div>

        <!-- Simulated Phishing Inbox -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title"><span>📧</span> Phase 2: Victim's Mailbox (Simulated Social Engineering Delivery)</h2>
            <span style="font-size: 0.8rem; color: var(--text-muted);">Victim: alex.mercer@company.com</span>
          </div>
          <p style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 1rem;">
            The victim receives this spoofed banking email. Notice how the email induces urgency to trick the user into clicking:
          </p>

          <!-- Email Client Container -->
          <div class="email-client">
            <div class="email-header">
              <div class="email-field"><strong>From:</strong> Apex Fraud Prevention &lt;alerts@apex-trust-security.fake&gt;</div>
              <div class="email-field"><strong>To:</strong> Alex Mercer &lt;alex.mercer@company.com&gt;</div>
              <div class="email-field"><strong>Date:</strong> 03 November 2026 21:05</div>
              <div class="email-subject">⚠️ URGENT: Unrecognized Wire Withdrawal of $1,850.00</div>
            </div>

            <div class="email-body">
              <div class="email-bank-logo">
                <span>🏛️</span> Apex Trust Online Banking — Security Center
              </div>
              <p>Dear Valued Customer Alex Mercer,</p>
              <br>
              <p>Our automated fraud monitoring algorithms detected an unusual outward transfer attempt of <strong>$1,850.00</strong> originating from an unrecognized IP address.</p>
              <br>
              <p>If you did not authorize this transaction, please review your active transaction ledger immediately and cancel the pending transfer:</p>

              <!-- THIS IS THE WORKING EXPLOIT LINK SENT BY THE ATTACKER -->
              <div style="text-align: center; margin: 1.5rem 0;">
                <a href="${VULN_ATTACK_URL}" target="_blank" class="cta-btn">
                  🔍 Click Here to Review Disputed Transaction (Vulnerable Server) &rarr;
                </a>
                <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.5rem;">
                  Links directly to: <code>http://localhost:3001/transactions?q=&lt;script&gt;...</code>
                </div>
              </div>

              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 1.5rem 0;">

              <!-- SECURE COMPARISON LINK -->
              <p style="font-size: 0.9rem; color: #475569;">
                <strong>Test Defense Mitigation:</strong> Click the button below to send the exact same payload to the <strong>Hardened / Secure</strong> instance (Port 3002):
              </p>
              <div style="text-align: center; margin-top: 0.75rem;">
                <a href="${SAFE_ATTACK_URL}" target="_blank" class="cta-btn-safe">
                  🛡️ Click Here to Send Same Payload to Hardened Server (Port 3002) &rarr;
                </a>
              </div>

              <br>
              <p style="font-size: 0.8rem; color: #94a3b8;">
                Apex Trust Security Department | Fraud Prevention Operations | Automated Notification
              </p>
            </div>
          </div>
        </div>

        <!-- Flowchart -->
        <div class="card">
          <div class="card-header">
            <h2 class="card-title"><span>⚡</span> What Happens When the User Clicks?</h2>
          </div>
          
          <div class="flow-step">
            <div class="step-num">1</div>
            <div class="step-text">
              <strong>User Clicks Link:</strong> The user believes this is an authentic security warning from Apex Trust Bank and clicks the button.
            </div>
          </div>

          <div class="flow-step">
            <div class="step-num">2</div>
            <div class="step-text">
              <strong>Request Dispatched:</strong> The user's browser opens <span style="font-family: monospace; color: #38bdf8;">http://localhost:3001/transactions?q=&lt;script&gt;...</span> with the user's active session cookies.
            </div>
          </div>

          <div class="flow-step">
            <div class="step-num">3</div>
            <div class="step-text">
              <strong>Unencoded Reflection:</strong> The vulnerable bank server inserts the raw <span style="font-family: monospace; color: #ef4444;">&lt;script&gt;</span> tag into the response HTML without entity escaping.
            </div>
          </div>

          <div class="flow-step">
            <div class="step-num">4</div>
            <div class="step-text">
              <strong>Execution in Bank Origin:</strong> The user's browser parses the injected script and executes it inside the bank's security boundary.
            </div>
          </div>
        </div>

      </div>
    </body>
    </html>
  `);
});


// =============================================================================
// =============================================================================
// WEBSITE 2: THE USER SIDE — APEX TRUST ONLINE BANKING (PORTS 3001 & 3002)
// =============================================================================
// =============================================================================

function renderBankPage({ isSecure, query, filteredTransactions }) {
  const port = isSecure ? 3002 : 3001;
  const instanceBadge = isSecure ? "SECURE INSTANCE (PORT 3002)" : "VULNERABLE INSTANCE (PORT 3001)";
  const badgeColor = isSecure ? "#16a34a" : "#dc2626";

  // Table rows
  const rows = filteredTransactions.map(t => `
    <tr>
      <td style="padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; font-size: 0.9rem;">${t.date}</td>
      <td style="padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; font-size: 0.9rem;"><strong>${isSecure ? escapeHtml(t.description) : t.description}</strong></td>
      <td style="padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; font-size: 0.9rem;"><span style="background: #f1f5f9; padding: 0.2rem 0.5rem; border-radius: 4px; font-family: monospace;">${isSecure ? escapeHtml(t.category) : t.category}</span></td>
      <td style="padding: 0.75rem 1rem; border-bottom: 1px solid #e2e8f0; font-size: 0.9rem; font-weight: 600; color: ${t.amount.startsWith('+') ? '#16a34a' : '#0f172a'};">${t.amount}</td>
    </tr>
  `).join("");

  // Search reflection display
  let searchBanner = "";
  if (query) {
    if (isSecure) {
      // SECURE: entity-escaped
      const safeQuery = escapeHtml(query);
      searchBanner = `
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 1rem; margin-bottom: 1.5rem; color: #166534;">
          <strong>🔍 Showing transaction results for:</strong> <code>${safeQuery}</code>
          <div style="font-size: 0.8rem; margin-top: 0.25rem; color: #15803d;">
            ✅ MITIGATION ACTIVE: Input escaped via escapeHtml(). Rendered as inert text.
          </div>
        </div>
      `;
    } else {
      // VULNERABLE: raw interpolation!
      searchBanner = `
        <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 1rem; margin-bottom: 1.5rem; color: #991b1b;">
          <strong>🔍 Showing transaction results for:</strong> <strong>${query}</strong>
          <div style="font-size: 0.8rem; margin-top: 0.25rem; color: #b91c1c;">
            ⚠️ FLAW: The server reflected the query string parameter directly into the page without escaping!
          </div>
        </div>
      `;
    }
  }

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Apex Trust Online Banking | ${isSecure ? 'Secure' : 'Vulnerable'}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { background: #f8fafc; color: #0f172a; line-height: 1.5; padding-bottom: 50px; }
        header { background: #172554; color: white; padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; }
        .badge { background: ${badgeColor}; color: white; padding: 0.3rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; }
        .nav { background: white; border-bottom: 1px solid #e2e8f0; padding: 0 2rem; display: flex; gap: 1.5rem; }
        .nav a { padding: 0.85rem 0; text-decoration: none; color: #64748b; font-size: 0.9rem; font-weight: 600; border-bottom: 2px solid transparent; }
        .nav a.active { color: #1e3a8a; border-bottom-color: #1e3a8a; }
        .container { max-width: 1000px; margin: 2rem auto; padding: 0 1rem; }
        .card { background: white; border-radius: 8px; border: 1px solid #e2e8f0; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
        .stat-box { background: #f8fafc; padding: 1rem; border-radius: 6px; border: 1px solid #e2e8f0; }
        .stat-label { font-size: 0.75rem; color: #64748b; text-transform: uppercase; font-weight: 700; }
        .stat-val { font-size: 1.35rem; font-weight: 700; color: #0f172a; margin-top: 0.25rem; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #f8fafc; padding: 0.75rem 1rem; font-size: 0.8rem; font-weight: 700; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; text-align: left; }
      </style>
    </head>
    <body>
      <header>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.5rem;">🏛️</span>
          <div>
            <div style="font-size: 1.15rem; font-weight: 700;">Apex Trust Online Banking</div>
            <div style="font-size: 0.75rem; color: #cbd5e1;">Logged in user: Alex Mercer (Checking Account)</div>
          </div>
        </div>
        <div>
          <span class="badge">${instanceBadge}</span>
        </div>
      </header>

      <nav class="nav">
        <a href="/" class="active">Account Overview</a>
        <a href="/transactions">Transaction History</a>
        <a href="http://localhost:4000" target="_blank" style="color: #dc2626; margin-left: auto;">
          🕵️ Open Attacker Phishing Simulator (Port 4000) &rarr;
        </a>
      </nav>

      <div class="container">
        <!-- Account Overview Card -->
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h2>Account Overview</h2>
            <span style="font-size: 0.85rem; color: #16a34a; font-weight: 600;">● Session Active</span>
          </div>
          <div class="stat-grid">
            <div class="stat-box">
              <div class="stat-label">Available Balance</div>
              <div class="stat-val" style="color: #16a34a;">${MOCK_ACCOUNT.balance}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Account Number</div>
              <div class="stat-val">${MOCK_ACCOUNT.accountNumber}</div>
            </div>
            <div class="stat-box">
              <div class="stat-label">Routing Number</div>
              <div class="stat-val">${MOCK_ACCOUNT.routingNumber}</div>
            </div>
          </div>
        </div>

        <!-- Transaction Ledger & Search Results -->
        <div class="card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3>Transaction Activity</h3>
            <span style="font-size: 0.85rem; color: #64748b;">${filteredTransactions.length} records</span>
          </div>

          <form action="/transactions" method="GET" style="display: flex; gap: 0.5rem; margin-bottom: 1.25rem;">
            <input type="text" name="q" value="${isSecure ? escapeHtml(query) : query}" placeholder="Search merchant or description..." style="flex: 1; padding: 0.65rem 1rem; border: 1px solid #cbd5e1; border-radius: 6px;">
            <button type="submit" style="background: #1e3a8a; color: white; border: none; padding: 0.65rem 1.25rem; border-radius: 6px; font-weight: 600; cursor: pointer;">Search</button>
          </form>

          ${searchBanner}

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Description / Payee</th>
                <th>Category</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="4" style="text-align:center; padding: 1.5rem; color: #64748b;">No matching transactions.</td></tr>'}
            </tbody>
          </table>
        </div>

      </div>
    </body>
    </html>
  `;
}


// -----------------------------------------------------------------------------
// VULNERABLE INSTANCE ROUTING (PORT 3001)
// -----------------------------------------------------------------------------
const vulnApp = express();
const VULN_PORT = 3001;

vulnApp.get("/", (_req, res) => {
  res.send(renderBankPage({ isSecure: false, query: "", filteredTransactions: MOCK_TRANSACTIONS }));
});

vulnApp.get("/transactions", (req, res) => {
  const query = req.query.q || "";
  const filtered = query
    ? MOCK_TRANSACTIONS.filter(t => t.description.toLowerCase().includes(query.toLowerCase()) || t.category.toLowerCase().includes(query.toLowerCase()))
    : MOCK_TRANSACTIONS;

  res.send(renderBankPage({ isSecure: false, query, filteredTransactions: filtered }));
});


// -----------------------------------------------------------------------------
// SECURE INSTANCE ROUTING (PORT 3002) - MITIGATION IMPLEMENTED
// -----------------------------------------------------------------------------
const safeApp = express();
const SAFE_PORT = 3002;

// The single implemented mitigation: Context-aware HTML entity encoding
function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")   // 1. Must replace ampersands first to prevent double-encoding
    .replace(/</g, "&lt;")    // 2. Disarms opening HTML tags (<script>)
    .replace(/>/g, "&gt;")    // 3. Disarms closing HTML tags
    .replace(/"/g, "&quot;")  // 4. Disarms attribute breakout (double quotes)
    .replace(/'/g, "&#39;");  // 5. Disarms attribute breakout (single quotes)
}

safeApp.get("/", (_req, res) => {
  res.send(renderBankPage({ isSecure: true, query: "", filteredTransactions: MOCK_TRANSACTIONS }));
});

safeApp.get("/transactions", (req, res) => {
  const query = req.query.q || "";
  const filtered = query
    ? MOCK_TRANSACTIONS.filter(t => t.description.toLowerCase().includes(query.toLowerCase()) || t.category.toLowerCase().includes(query.toLowerCase()))
    : MOCK_TRANSACTIONS;

  res.send(renderBankPage({ isSecure: true, query, filteredTransactions: filtered }));
});


// =============================================================================
// LAUNCH ALL THREE PORTS CONCURRENTLY
// =============================================================================

attackerApp.listen(ATTACKER_PORT, () => {
  console.log("\n" + "=".repeat(78));
  console.log(`  [1] ATTACKER SIDE SERVER RUNNING        ->  http://localhost:${ATTACKER_PORT}`);
  console.log(`      Phishing Webmail & Attack Lure: http://localhost:${ATTACKER_PORT}`);
  console.log("=".repeat(78));
});

vulnApp.listen(VULN_PORT, () => {
  console.log(`  [2] USER SIDE (VULNERABLE BANK) RUNNING ->  http://localhost:${VULN_PORT}`);
  console.log(`      Account Dashboard             : http://localhost:${VULN_PORT}`);
  console.log(`      Transaction Search            : http://localhost:${VULN_PORT}/transactions`);
  console.log("=".repeat(78));
});

safeApp.listen(SAFE_PORT, () => {
  console.log(`  [3] USER SIDE (HARDENED BANK) RUNNING   ->  http://localhost:${SAFE_PORT}`);
  console.log(`      Hardened Account Dashboard    : http://localhost:${SAFE_PORT}`);
  console.log(`      Hardened Search (Escaped)     : http://localhost:${SAFE_PORT}/transactions`);
  console.log("=".repeat(78) + "\n");
});
