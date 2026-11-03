# Online Banking Portal: Reflected XSS Vulnerability & Defense

**Course:** Web Server Vulnerabilities & Defense  
**Instructor:** Dr. Soumyadev Maity  
**Category:** Cross-Site Scripting (XSS)  
**Variant:** Reflected XSS  
**Application Context:** Apex Trust Internet Banking System  
**Deadline:** 03 November 2026 (Tuesday), 23:59  

---

## 1. Ownership Declaration (Table 3)

| Member Name | Roll Number | Category | Variant Implemented |
|---|---|---|---|
| *(Your Full Name)* | *(Your Roll No)* | Cross-Site Scripting (XSS) | Reflected XSS |

---

## 2. Quick Start & Execution

Ensure Node.js is installed, then launch both servers with a single command:

```bash
# Install dependencies (only required once)
npm install

# Run both Vulnerable (3001) and Secure (3002) instances simultaneously
npm run dev
```

### Server Endpoints:
- **Vulnerable Banking Portal:** [http://localhost:3001](http://localhost:3001)
- **Hardened Banking Portal:** [http://localhost:3002](http://localhost:3002)
- **Threat Model & Architecture View:** [http://localhost:3001/scenario](http://localhost:3001/scenario)

---

## 3. Real-World Context: The Two Sides of Reflected XSS

In high-value applications like online banking, Reflected XSS represents a critical vulnerability because malicious JavaScript runs within the user's authenticated origin context.

```
+----------------------------------------------------------------------------------------------------+
|                                    REFLECTED XSS ATTACK LIFECYCLE                                  |
+----------------------------------------------------------------------------------------------------+
|                                                                                                    |
|  [ATTACKER SIDE]                                           [USER / VICTIM SIDE]                    |
|                                                                                                    |
|  1. Finds unencoded reflection sink                       2. Authenticated in banking session      |
|     in transaction search endpoint                           (active balance, session state)       |
|            |                                                               |                       |
|  3. Crafts weaponized link with payload:                                  |                       |
|     http://localhost:3001/transactions?q=<script>...                       |                       |
|            |                                                               |                       |
|  4. Social Engineering / Phishing:                                         |                       |
|     Sends email: "Suspicious charge detected! Click to review" ----------> 5. Victim clicks link    |
|                                                                                    |               |
|                                                            [BANKING WEB SERVER]   |               |
|                                                            6. Server reflects <script> in HTML    |
|                                                                       |                           |
|                                                            7. Browser parses script tag and       |
|                                                               executes in user's trusted session   |
|                                                                                                    |
|  [HIGH-RISK EXPLOITATION PATHWAYS IN BANKING]                                                      |
|  - Fake Credential Prompt: Injects a modal "Session timeout - enter password to verify identity"  |
|  - Client-Side Transfer: Issues API calls (fetch('/api/transfer')) authenticated as the victim    |
|  - Session Hijacking: Accesses document.cookie (if HttpOnly is omitted)                           |
+----------------------------------------------------------------------------------------------------+
```

---

## 4. Assessment Deliverables (Table 2 Requirements)

### (a) Vulnerable Implementation
- **File:** `app.js` (Port 3001 instance)
- **Endpoint:** `GET /transactions`
- **Flawed Code:**
  ```javascript
  const query = req.query.q || "";
  // Flaw: Unsanitized user query interpolated directly into response HTML string
  const queryDisplay = `<div class="alert">Showing query results for: <strong>${query}</strong></div>`;
  ```

### (b) Working Exploit
- **Exact Payload:**
  ```html
  <script>alert('XSS: Banking Session Compromised!')</script>
  ```
- **Execution URL:**
  ```
  http://localhost:3001/transactions?q=<script>alert('XSS: Banking Session Compromised!')</script>
  ```
- **Behavior:** The browser receives the payload verbatim, parses the `<script>` tag, and executes JavaScript inside the bank's security origin.

### (c) Root Cause
The web server extracts untrusted input from the HTTP request query parameter (`req.query.q`) and dynamically concatenates it into the response HTML document without **context-aware output encoding**, **input sanitization**, or **Content Security Policy (CSP)**. Consequently, the browser's HTML parser cannot distinguish legitimate application code from attacker-supplied script elements.

### (d) Mitigation Implemented (Port 3002)
- **Implemented Technique:** Context-Aware HTML-Entity Encoding.
- **Code Fix:**
  ```javascript
  function escapeHtml(str) {
    if (typeof str !== "string") return "";
    return str
      .replace(/&/g, "&amp;")   // 1. Ampersand must be replaced first
      .replace(/</g, "&lt;")    // 2. Disarms opening HTML tags (<script>)
      .replace(/>/g, "&gt;")    // 3. Disarms closing HTML tags
      .replace(/"/g, "&quot;")  // 4. Disarms attribute breakout (double quotes)
      .replace(/'/g, "&#39;");  // 5. Disarms attribute breakout (single quotes)
  }

  // Applied in GET /transactions on Port 3002:
  const safeQuery = escapeHtml(req.query.q || "");
  const queryDisplay = `<div>Showing query results for: <strong>${safeQuery}</strong></div>`;
  ```
- **Verification:** Loading the identical exploit link on the secure server:
  ```
  http://localhost:3002/transactions?q=<script>alert('XSS: Banking Session Compromised!')</script>
  ```
  The payload renders strictly as benign visible text (`&lt;script&gt;...&lt;/script&gt;`). No script execution occurs.

### (e) Other Mitigations (Theory from Lecture Slides)
Beyond manual entity encoding, lecture slides present the following industry-standard defenses:

1. **Framework Auto-Escaping:**
   Modern template engines (such as React JSX, Angular templates, Handlebars `{{}}`, or EJS `<%= %>`) treat values as data rather than executable markup by default. Unless explicitly bypassed with dangerous APIs (e.g. `dangerouslySetInnerHTML`), variables are automatically context-encoded.

2. **HTML Sanitization (for Rich Text/HTML inputs):**
   When an application legitimately needs to allow user-submitted HTML (e.g., banking messaging attachments or formatted support tickets), pure encoding would break formatting. Libraries like **DOMPurify** parse the HTML tree and strip out malicious nodes (`<script>`, `<iframe>`, `onload=`, `javascript:` URIs) while retaining safe markup (`<b>`, `<i>`, `<p>`).

3. **Content Security Policy (CSP):**
   A defense-in-depth HTTP header (`Content-Security-Policy: default-src 'self'; script-src 'self'`) restricts where scripts can be executed from. A strict CSP disables inline script execution (such as injected `<script>` tags or `onerror=` handlers) even if an injection flaw exists in the HTML.

4. **HttpOnly Cookie Flag:**
   Configuring session cookies with the `HttpOnly` flag (`Set-Cookie: session=xyz; HttpOnly; Secure; SameSite=Strict`) forbids client-side JavaScript access via `document.cookie`. While this does not prevent XSS execution itself, it neutralizes session hijacking via cookie theft.

5. **Safe DOM Sinks:**
   On the client side, avoiding dangerous DOM manipulation sinks like `element.innerHTML` or `document.write()` in favor of safe APIs such as `element.textContent` or `element.innerText` ensures that user input cannot be reinterpreted as executable markup by the client runtime.

---

## 5. Viva Preparation: Key Questions & Clear Answers

| Question | Answer for Viva |
|---|---|
| **Why is this called "Reflected" XSS?** | Because the payload is not persisted on the server (like in Stored XSS). It travels in the request (e.g., query param) and is reflected immediately in the HTTP response. |
| **Why doesn't anti-CSRF token protect against XSS?** | CSRF tokens protect against cross-site requests, but XSS executes **inside** the origin. Malicious JavaScript running via XSS can read the CSRF token directly from the DOM and perform valid authenticated actions. |
| **Why must `&` be escaped first in `escapeHtml`?** | If you replace `<` with `&lt;` first and then replace `&` with `&amp;`, the existing `&lt;` will be re-encoded into `&amp;lt;` (double-encoding bug). |
| **Why doesn't HttpOnly completely solve XSS?** | HttpOnly protects session cookies from `document.cookie`, but an attacker can still perform actions directly via `fetch()` (client-side forgery), log keystrokes, or display fake login modals (DOM phishing). |
| **What is the difference between sanitization and encoding?** | Encoding turns executable characters into harmless display entities (neutralizing all HTML). Sanitization strips out dangerous elements while preserving safe HTML markup. |
