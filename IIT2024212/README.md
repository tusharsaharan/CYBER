# Cyber Security (IT-30001) — Autumn Semester 2026
## Web Server Security: Exploitation & Mitigation Project
**Department of Information Technology, Indian Institute of Information Technology Allahabad (IIITA)**  
**Course Instructor:** Dr. Soumyadev Maity  

---

## Table 3: Ownership Declaration

| Member Name | Roll Number | Vulnerability Category | Variant Implemented |
| :--- | :--- | :--- | :--- |
| **Lakshya Gupta** | **IIT2024212** | **Cross-Site Request Forgery (CSRF)** | **GET-based forged action** |

*(Note: If working in a group, teammates can append their assigned categories and variants to this table.)*

---

## Executive Summary & Architecture Overview

This project implements an end-to-end laboratory demonstrating the **exploitation and defense of Cross-Site Request Forgery (CSRF) via GET-based forged actions**.

The system features a **Two-Sided Architecture** running three independent HTTP services concurrently through a single entrypoint:

```
                          TWO-SIDED ARCHITECTURE
===========================================================================
SIDE 1: ATTACKER ADVERSARY PLATFORM
  ├── Port 4000: ShadowOps Reconnaissance Console & Phishing Lure Portal
  │              • Hosts deceptive lure page (e.g., $500 Gift Card Claim)
  │              • Conceals hidden subresource exploit payload: <img> tag
  │              • Live telemetry monitor & click tracker
  └── Adversary Goal: Force victim's browser to execute unauthorized transfer
===========================================================================
SIDE 2: TARGET WEB APPLICATION (ApexTrust Corporate NetBanking)
  ├── Port 3001: VULNERABLE INSTANCE
  │              • Violates RFC 7231 by processing transfers via HTTP GET
  │              • Relies purely on ambient browser credentials (session cookies)
  │              • No Anti-CSRF token or intent validation
  │              • Result: CSRF attack succeeds; Alice loses $1,500.00
  │
  └── Port 3002: HARDENED INSTANCE (Active Defense)
                 • Rejects state-changing GET requests with HTTP 405 Method Not Allowed
                 • Enforces HTTP POST with cryptographically secure Anti-CSRF Synchronizer Token
                 • SameSite cookie hardening ('Lax' / 'Strict')
                 • Result: Same payload fails; Alice's balance remains untouched ($10,000.00)
===========================================================================
```

---

## Quickstart & Setup Instructions

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher
* Any modern web browser (Google Chrome, Mozilla Firefox, Microsoft Edge)

### Installation & Execution
1. Clone or navigate to the repository directory:
   ```bash
   cd Assignment4
   ```
2. Install project dependencies:
   ```bash
   npm install
   ```
3. Launch all three services concurrently with a single command:
   ```bash
   npm run dev
   ```

You will see the console confirmation:
```text
[+] SIDE 1: Attacker Platform listening on http://localhost:4000
[+] SIDE 2A: Target Bank (VULNERABLE) listening on http://localhost:3001
[+] SIDE 2B: Target Bank (HARDENED) listening on http://localhost:3002
=================================================================================
All three environments are running concurrently!
1. Target Bank (Vulnerable): http://localhost:3001
2. Target Bank (Hardened):   http://localhost:3002
3. Attacker Console:         http://localhost:4000
=================================================================================
```

4. **Run the Automated Verification Test Suite**:
   In a separate terminal, execute:
   ```bash
   node test_exploit.js
   ```
   This script programmatically demonstrates the attack succeeding against Port 3001 and being blocked against Port 3002.

---

## Rubric Deliverables (Table 2 of Assignment Brief)

### (a) Vulnerable Implementation
* **File Location**: [`app.js`](app.js)
* **Vulnerable Endpoint**: `GET /api/transfer` on Port 3001
* **Vulnerable Code Path**:
```javascript
// app.js (Lines ~255-295 on Port 3001)
appVuln.get('/api/transfer', (req, res) => {
    const sender = req.session ? req.session.username : null;
    const recipient = req.query.recipient;
    const amount = parseFloat(req.query.amount);
    
    // Authenticates solely through ambient session cookie
    if (!sender || !dbVuln.users[sender]) {
        return res.status(401).send('Unauthorized');
    }

    // Flaw: State-changing transaction performed directly from GET query parameters
    dbVuln.users[sender].balance -= amount;
    dbVuln.users[recipient].balance += amount;

    // Transaction committed without checking user intent or CSRF token!
    dbVuln.transactions.push({
        from: sender,
        to: recipient,
        amount,
        timestamp: new Date().toLocaleTimeString(),
        note: 'FORGED GET CSRF REQUEST'
    });
    ...
});
```

#### Flaw Breakdown:
1. **Misuse of HTTP GET Method**: In standard HTTP semantics (RFC 7231 / RFC 9110), `GET` is designated as a "safe" and "idempotent" retrieval method. By allowing financial balance mutations over `GET`, the server exposes the endpoint to subresource embedding.
2. **Blind Reliance on Ambient Credentials**: The browser automatically transmits the session cookie (`apextrust_session_vuln`) with every cross-site request made to `http://localhost:3001`. The server trusts the cookie as proof of user *identity*, while completely failing to verify user *intent*.
3. **Absence of Anti-CSRF Synchronizer Tokens**: There is no cryptographically unpredictable token tied to the request that a cross-origin adversary cannot read.

---

### (b) Working Exploit
* **Attacker Delivery Host**: `http://localhost:4000`
* **Exploit Vector**: Subresource embedding via an HTML `<img>` tag placed within an external lure webpage.
* **Exact Exploit Payload**:
```html
<!-- Hosted on adversary site: http://localhost:4000/trap?targetPort=3001 -->
<img src="http://localhost:3001/api/transfer?recipient=mallory&amount=1500" 
     alt="Promotional Tracker" 
     width="0" 
     height="0" 
     style="display:none;" />
```

#### Exploit Execution Walkthrough:
1. **Victim Authentication**: The victim (Alice) logs into her online banking portal at `http://localhost:3001`. The server sets an authentication session cookie: `apextrust_session_vuln=alice-vuln-token-99214`. Alice's initial balance is **$10,000.00**.
2. **Phishing / Lure Delivery**: The adversary lures Alice into visiting the attacker's website on Port 4000 (`http://localhost:4000/trap?targetPort=3001`), disguised as a "Free $500 Gift Card Claim" promotion.
3. **Silent Subresource Trigger**: As the browser renders the attacker's page, the HTML parsing engine encounters the hidden `<img>` tag.
4. **Ambient Credential Transmission**: To fetch the image source, the victim's browser dispatches an asynchronous HTTP GET request to `http://localhost:3001/api/transfer?recipient=mallory&amount=1500`. Because browsers automatically attach stored cookies belonging to the target domain, Alice's active session cookie is included in the request headers.
5. **Unauthorized Execution**: The vulnerable server on Port 3001 parses the cookie, authenticates the request as coming from Alice, deducts **$1,500.00** from Alice's account, and credits **$1,500.00** to Mallory (the attacker).
6. **Telemetry & Ledger Evidence**:
   - Alice's balance drops from **$10,000.00** to **$8,500.00**.
   - Mallory's balance increases from **$250.00** to **$1,750.00**.
   - The transaction log on Port 3001 registers: `🚨 FORGED GET CSRF REQUEST`.

---

### (c) Root Cause (1–2 Sentences)
> The root cause of GET-based CSRF is that the application violates HTTP specifications (RFC 7231) by executing state-changing transactions over the safe and idempotent HTTP `GET` method, while relying exclusively on ambient browser credentials (session cookies) without validating explicit user intent or requiring an unforgeable, origin-bound secret.

---

### (d) Mitigation Implemented (Port 3002)
* **Defense Category**: **Method Restriction & Anti-CSRF Synchronizer Token Pattern**
* **File Location**: [`app.js`](app.js) (Lines ~370-460)
* **Code Implementation**:
```javascript
// 1. Strict rejection of state-changing GET requests (Port 3002)
appHardened.get('/api/transfer', (req, res) => {
    logAudit(dbHardened, {
        method: 'GET',
        path: req.originalUrl,
        status: 405,
        detail: '🛡️ ATTACK DEFENDED: State-changing GET requests are strictly prohibited (HTTP 405 Method Not Allowed).'
    });
    // Immediately block the request
    res.status(405).send('<h1>405 Method Not Allowed</h1><p>Transfers require POST with CSRF Token.</p>');
});

// 2. State changes restricted to POST with validated Anti-CSRF Synchronizer Token
appHardened.post('/api/transfer', (req, res) => {
    const submittedToken = req.body.csrf_token || req.headers['x-csrf-token'];
    const expectedToken = req.session ? req.session.csrfToken : null;

    // Cryptographic token validation
    if (!submittedToken || submittedToken !== expectedToken) {
        return res.status(403).send('403 Forbidden: Invalid Anti-CSRF Token');
    }

    // Transfer proceeds only if token is valid
    ...
});
```

#### Why the Exact Same Exploit Fails on Port 3002:
1. When the adversary lures Alice to `http://localhost:4000/trap?targetPort=3002`, the browser's embedded `<img>` tag issues:
   `GET http://localhost:3002/api/transfer?recipient=mallory&amount=1500`
2. Port 3002 intercepts the request, verifies that the route is a state mutation requested via `GET`, and immediately aborts the operation with **`HTTP 405 Method Not Allowed`**.
3. No fund deduction occurs. Alice's balance remains strictly protected at **$10,000.00**.
4. Even if the attacker attempts to forge a POST request, the request is rejected with **`HTTP 403 Forbidden`** because the attacker cannot read or predict Alice's per-session Anti-CSRF Synchronizer Token due to the browser's **Same-Origin Policy (SOP)**.
5. In addition, session cookies on Port 3002 are configured with `SameSite=Lax`, preventing ambient transmission on cross-site requests.

---

### (e) Other Mitigations (Theory from Lecture Slides)

#### 1. Cross-Site Request Forgery (CSRF) Mitigations:
* **Anti-CSRF (Synchronizer) Tokens**: A cryptographically random, unpredictable value generated by the server and tied to the user's current session. Rendered inside hidden form fields, it must be echoed back in state-changing requests. Since the Same-Origin Policy (SOP) prevents cross-origin scripts from reading responses, an attacker cannot retrieve or forge the token.
* **SameSite Cookie Attribute (`Strict` / `Lax`)**: The `SameSite` attribute controls whether cookies are sent with cross-site requests. `SameSite=Strict` ensures cookies are never sent in cross-site contexts (even on top-level navigation). `SameSite=Lax` permits cookies only on top-level safe GET navigations while withholding them on cross-site subresource requests (`<img>`, `<iframe>`) and cross-site `POST` submissions, effectively eliminating CSRF at the browser level.
* **Re-Authentication for Sensitive Actions**: Requiring users to re-enter their current password, provide a One-Time Password (OTP), or pass a CAPTCHA before executing critical transactions (e.g., balance transfers, password changes). Even if a forged request is submitted, it fails in the absence of interactive user re-authentication.
* **Avoiding State-Changing GET Requests**: Ensuring strict adherence to RESTful principles where `GET` is purely safe and idempotent (RFC 7231). State mutations must only be accepted via `POST`, `PUT`, or `DELETE`, preventing simple subresource embedding attacks (`<img>`, `<script>`).
* **Origin & Referer Header Verification**: Inspecting incoming `Origin` and `Referer` headers on state-changing endpoints and strictly comparing them against the expected server hostname or an allow-list of trusted origins.

#### 2. SQL Injection (SQLi) Mitigations:
* **Parameterized Queries (Prepared Statements)**: Ensures database engines treat user input strictly as literal data rather than executable SQL syntax, completely neutralizing syntax breakout.
* **Allow-List Input Validation**: Restricts input fields to acceptable patterns (e.g., alphanumeric, regex) and rejects unexpected characters before query formulation.
* **Least-Privilege Database Accounts**: Configuring web application database users with minimal necessary permissions (e.g., `SELECT`, `INSERT` on specific tables; no `DROP`, `ALTER`, or administrative system access).
* **Safe Error Handling**: Suppressing verbose database stack traces and error diagnostics in production, returning generic user-friendly messages to prevent informative leakage during reconnaissance.

#### 3. OS Command Injection Mitigations:
* **Avoid System Shell Execution**: Bypassing command shells entirely (`sh`, `bash`, `cmd.exe`) and avoiding unsafe functions like `exec()`, `system()`, or `popen()`.
* **Parameterized Execution with Argument Vectors**: Using safe APIs such as Node.js `child_process.execFile()` or Python `subprocess.run(shell=False)` where arguments are passed as explicit array elements rather than concatenated into a single shell command string.
* **Strict Allow-Listing of Arguments**: Enforcing whitelist checks against predefined safe values (e.g., allowing only valid IP addresses via regex) before passing parameters to utilities.
* **Least Privilege Isolation**: Running the application daemon inside restricted service accounts or sandboxed container environments with minimal filesystem and execution privileges.

#### 4. Cross-Site Scripting (XSS) Mitigations:
* **Context-Aware Output Encoding**: Escaping untrusted data depending on its insertion context (HTML body, HTML attribute, JavaScript context, CSS, or URL) using proper entity encoding (e.g., `&` to `&amp;`, `<` to `&lt;`).
* **Framework Auto-Escaping**: Utilizing modern web template engines (React, Angular, Jinja2, EJS) that automatically escape variables by default.
* **HTML Sanitizers (DOMPurify)**: Parsing and stripping unsafe tags (`<script>`, `<iframe>`) and event handlers (`onload`, `onerror`) when user-supplied rich text HTML must be rendered.
* **Content Security Policy (CSP)**: An HTTP response header restricting the sources from which scripts, images, and other resources can be loaded or executed, disallowing inline script execution.
* **HttpOnly Cookie Flag**: Flagging sensitive session cookies as `HttpOnly` so client-side JavaScript cannot access them via `document.cookie`, mitigating credential theft via XSS.

---

## Spoken Video Script (2–3 Minutes)

Use this word-for-word spoken narration while recording your screen demonstration for the assignment submission.

```text
[0:00 - 0:25] INTRODUCTION & OWNERSHIP
"Hello, my name is Lakshya Gupta, roll number IIT2024212. 
This is my demonstration for the Web Server Security assignment in Cyber Security (IT-30001), 
taught by Dr. Soumyadev Maity at IIIT Allahabad.
My assigned vulnerability category is Cross-Site Request Forgery (CSRF), 
and I have implemented Variant 1: GET-based forged action."

[0:25 - 0:50] ARCHITECTURE WALKTHROUGH
"To demonstrate this attack realistically, I built a two-sided architecture running three 
concurrent services using Node.js and Express:
- On Port 4000, we have the Attacker's environment: a reconnaissance console and phishing platform.
- On Port 3001, we have our target application: the ApexTrust NetBanking portal in its vulnerable state.
- On Port 3002, we have the exact same banking portal, but with implemented defense mechanisms active."

[0:50 - 1:30] DEMONSTRATING THE VULNERABILITY (PORT 3001)
"First, let's look at the vulnerable application on Port 3001. 
Our victim, Alice, is logged in with an active session cookie, and her current balance is $10,000.
In the source code at line 255 of app.js, the transfer route is exposed over HTTP GET without 
any CSRF token or user intent verification.

Now, let's switch to the adversary side on Port 4000. 
The attacker creates a phishing lure page disguised as a '$500 Gift Card Claim'. 
Behind the scenes, the page conceals a hidden HTML image tag pointing to:
'http://localhost:3001/api/transfer?recipient=mallory&amount=1500'.

When Alice visits this lure page, her browser automatically attempts to load the image. 
Because the browser automatically attaches Alice's stored session cookie with the cross-site GET request, 
the bank server processes the transfer.
Switching back to the Port 3001 dashboard and refreshing, we see Alice's balance has dropped to $8,500, 
and $1,500 has been transferred to Mallory. The exploit succeeded without Alice ever knowing."

[1:30 - 2:15] DEMONSTRATING THE MITIGATION (PORT 3002)
"Now, let's observe our hardened implementation on Port 3002.
Here, Alice also has $10,000. 
In app.js on line 400, our implemented defense strictly adheres to RFC 7231: 
State-changing transactions over HTTP GET are rejected immediately with HTTP 405 Method Not Allowed. 
Furthermore, fund transfers require HTTP POST with an Anti-CSRF Synchronizer Token, 
and the session cookie is secured with SameSite=Lax.

Now, we launch the exact same attack payload from Port 4000 targeting Port 3002.
As we can see on screen, the request fails with '405 Method Not Allowed'. 
Checking Alice's dashboard on Port 3002, her balance remains completely untouched at $10,000.00, 
and the live server audit log records: 'ATTACK DEFENDED: Blocked GET transfer attempt'.
The vulnerability is completely neutralized."

[2:15 - 2:45] CONCLUSION & THEORY SUMMARY
"In conclusion, GET-based CSRF occurs when applications perform state mutations over safe GET methods 
relying solely on ambient browser credentials. 
Beyond enforcing safe HTTP methods and Synchronizer Tokens, other mitigations covered in our lecture slides 
include SameSite cookie attributes, re-authentication for critical actions, and Origin header verification. 
Thank you!"
```

---

## Viva Q&A Preparation Cheat Sheet

Be prepared to answer these specific questions during your oral viva with Dr. Soumyadev Maity:

### Q1: What makes a GET-based CSRF vulnerability particularly dangerous compared to a POST-based CSRF?
**Answer**: With POST-based CSRF, an attacker must typically construct and automatically submit an HTML `<form>` using JavaScript (`document.forms[0].submit()`). If the victim has JavaScript disabled, or if the form is in an isolated sandbox, the attack fails. In contrast, **GET-based CSRF requires zero JavaScript**. An attacker can trigger the forged request using standard HTML subresource tags like `<img src="...">`, `<iframe src="...">`, `<link rel="stylesheet">`, or even an email client rendering HTML images. The browser fetches subresources immediately and automatically attaches ambient session cookies.

### Q2: Why is using HTTP GET for state-changing operations a fundamental violation of web standards?
**Answer**: Under RFC 7231 (HTTP/1.1 Semantics) and RFC 9110, HTTP `GET` is explicitly defined as a **safe** and **idempotent** method. "Safe" means the request represents an information retrieval that does not alter the server's state. When developers allow state changes (like fund transfers) over GET, intermediaries, web crawlers (like Googlebot), browser pre-fetchers, and subresource tags can trigger side effects without authorization.

### Q3: How does the Anti-CSRF Synchronizer Token Pattern prevent this attack?
**Answer**: In the Synchronizer Token Pattern, the server generates a cryptographically random, unguessable token tied to the user's active session. When rendering a legitimate web page, this token is inserted into the form or JavaScript state. When submitting a request, the client must echo this token. A cross-origin adversary website (e.g., on Port 4000) cannot read the token from Port 3002 due to the browser's **Same-Origin Policy (SOP)**. Therefore, any forged request generated by an attacker lacks the valid token and is rejected with `403 Forbidden`.

### Q4: Does CORS (Cross-Origin Resource Sharing) protect against CSRF attacks?
**Answer**: **No.** This is a common misconception. CORS is a mechanism that permits or restricts whether a client script can *read* the response of a cross-origin request. However, CSRF is a *state-changing* attack: the server executes the action upon receiving the request, regardless of whether the attacker's script can read the resulting response. In GET-based CSRF using `<img>`, CORS does not even apply because `<img>` tags are simple subresources that do not use the Fetch/XHR CORS pipeline.

### Q5: What is the difference between `SameSite=Lax` and `SameSite=Strict`?
**Answer**:
- `SameSite=Strict`: The browser never sends the cookie in any cross-site request, not even when the user clicks an external hyperlink to the site.
- `SameSite=Lax`: The cookie is withheld on cross-site subresource requests (such as `<img>`, `<iframe>`, and cross-site `POST` requests), but is sent when a user follows a regular top-level GET navigation (such as clicking a normal link from an external site). `SameSite=Lax` neutralizes both subresource GET-based CSRF and cross-site POST form CSRF.

---

## File Structure

```text
Assignment4/
├── app.js               # Main executable serving Ports 4000, 3001, and 3002
├── package.json         # NPM manifest with "scripts": { "dev": "node app.js" }
├── test_exploit.js      # Automated programmatic test verification suite
└── README.md            # Comprehensive documentation, rubric answers & viva script
```
