# Web Security Assignment — OS Command Injection (In-band)

## Ownership Declaration

| Field | Value |
|---|---|
| Name | *[Your Name]* |
| Roll Number | *[Your Roll Number]* |
| Category | OS Command Injection |
| Variant | In-band (output returned) |
| Instructor | Dr. Soumyadev Maity |

> Fill in your name and roll number above before submission.

---

## 1. What this project is

**NetDiag Pro** is a mock internal network-operations dashboard that lets a logged-in admin "ping" a host from the browser. The `host` parameter is the injection point.

Three servers run simultaneously:

| Port | Role |
|---|---|
| **4000** | Attacker Command Center — recon console + exploit launcher + live telemetry |
| **3001** | NetDiag Pro — **vulnerable** instance (`exec()` with string concatenation) |
| **3002** | NetDiag Pro — **hardened** instance (`execFile()` + allow-list validation) |

## 2. Setup

```bash
npm install
npm run dev
```

Then open all three in your browser:
- http://localhost:4000 — Attacker Command Center
- http://localhost:3001 — Vulnerable target
- http://localhost:3002 — Hardened target

**Note:** the diagnostic tool shells out to the system `ping` binary. This ships by default on Windows, macOS, and virtually all Linux distros, so no extra install is normally needed. If your environment lacks it, install `iputils-ping` (Linux) — the injection and mitigation logic do not depend on `ping` itself; they depend on how the `host` string reaches the shell.

## 3. Demo walkthrough

1. Open the **Attacker Command Center** (4000) and read the recon log — it walks through how the vulnerable parameter was discovered.
2. Leave the target selector on **Port 3001 (Vulnerable)** and click **Launch Attack** with the default payload `10.0.0.1; whoami`. The response panel shows the ping output *followed by the output of `whoami`* — proof of in-band command injection (the injected command's result is returned directly in the HTTP response, no blind inference needed).
3. Switch the target selector to **Port 3002 (Hardened)** and launch the same payload. The server now responds with a validation rejection instead of executing anything.
4. Open http://localhost:3001 and http://localhost:3002 directly to see the two "sides" of the same corporate UI — identical look, different safety.

---

## 4. Rubric Deliverables

### (a) Vulnerable Implementation

**File:** `app.js` — route `GET /api/ping` on the **port 3001** app (search the file for `<<< VULNERABLE LINE >>>`).

```js
vulnApp.get('/api/ping', (req, res) => {
  const host = req.query.host || '';
  // <<< VULNERABLE LINE >>>
  const cmd = `ping -c 1 ${host}`;
  exec(cmd, { timeout: 5000 }, (err, stdout, stderr) => {
    res.json({ output: stdout || stderr });
  });
});
```

The user-controlled `host` value is concatenated directly into a shell command string, which is then handed to `child_process.exec()`.

### (b) Working Exploit

Delivered via the Attacker Command Center (port 4000 → `/attack?port=3001&payload=...`), or directly:

```
GET http://localhost:3001/api/ping?host=10.0.0.1;%20whoami
```

Payload: **`10.0.0.1; whoami`**

Observed in-band response (output returned directly in the JSON body, no need for timing or blind inference):

```json
{ "output": "PING 10.0.0.1 ...\n...\nroot\n" }
```

The `whoami` output (`root`, or your actual shell user) is appended after the legitimate ping output — proving arbitrary command execution on the server. Other proven payloads: `10.0.0.1 && id`, `10.0.0.1; cat /etc/hostname`.

### (c) Root Cause

The application builds a shell command by **string-concatenating unvalidated user input** (`host`) and executes it with `child_process.exec()`, which runs the string through `/bin/sh -c`. Because a real shell interprets metacharacters (`;`, `&&`, `|`, `` ` ``, `$(...)`), any attacker-supplied shell syntax is executed as additional commands rather than being treated as a literal hostname.

### (d) Mitigation Implemented (port 3002)

**File:** `app.js` — route `GET /api/ping` on the **port 3002** app (search for `MITIGATION IMPLEMENTED`).

The one mitigation graded here: **replace `exec()` (shell string) with `execFile()` (argument vector, no shell)**, combined with allow-list input validation as a first line of defense:

```js
const HOSTNAME_ALLOWLIST = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62})(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}))*$/;

hardApp.get('/api/ping', (req, res) => {
  const host = (req.query.host || '').trim();
  if (!host || host.length > 253 || !HOSTNAME_ALLOWLIST.test(host)) {
    return res.status(400).json({ error: 'Rejected: invalid hostname/IP.' });
  }
  execFile('ping', ['-c', '1', host], { timeout: 5000 }, (err, stdout, stderr) => {
    res.json({ output: stdout || stderr });
  });
});
```

`execFile()` calls the `ping` binary directly via `execve()` with an explicit **argument array**. Each array element is passed to the program as one literal argument — the string is never handed to `/bin/sh` for interpretation, so shell metacharacters lose their special meaning even if they somehow slipped past validation.

**Proof the same payload now fails:** `GET http://localhost:3002/api/ping?host=10.0.0.1;%20whoami` → `400 Bad Request`, `{"error":"Rejected: \"10.0.0.1; whoami\" is not a valid hostname/IP ..."}`. The request never reaches `execFile()`.

### (e) Other Mitigations (Theory, from lecture slides)

Beyond the one mitigation implemented in code, defense-in-depth for OS command injection also includes:

- **Avoid the shell entirely wherever possible.** Any API that spawns a process without invoking `/bin/sh` or `cmd.exe` (e.g. `execve`-family calls, language-specific "spawn without shell" APIs) removes the entire class of shell-metacharacter injection, independent of input validation.
- **Argument vectors over string commands.** Even when a shell cannot be avoided, passing arguments as a discrete array (as done in part (d)) rather than interpolating them into one command string prevents the OS from re-parsing user data as shell syntax.
- **Allow-list input validation.** Define the narrowest possible pattern for what a legitimate value can look like (e.g. a strict hostname/IPv4 regex) and reject everything else, rather than trying to deny-list "dangerous" characters, which is easy to bypass (encoding, unusual metacharacters, newlines).
- **Least privilege.** The OS account/service running the application should have the minimum permissions necessary — no shell access, restricted filesystem permissions, no ability to spawn arbitrary binaries — so that even a successful injection has limited blast radius.

---

## 5. Viva Q&A Cheat Sheet

**Q: What's the difference between in-band and blind command injection?**
A: In-band means the injected command's output is returned directly in the application's response (as seen here — the `whoami` result appears right in the JSON). Blind injection gives no output back, so the attacker infers success indirectly — e.g. via response timing (`sleep 5`) or out-of-band side channels (DNS/HTTP callbacks).

**Q: Why does `exec()` let shell metacharacters matter but `execFile()` doesn't?**
A: `exec()` runs the given string through `/bin/sh -c "<string>"` — a real shell that parses `;`, `&&`, `|`, backticks, etc. `execFile()` calls `execve()` directly with the binary path and an argument array; there's no shell in the loop to interpret those characters, so `;` or `&&` in an argument is just a literal character passed to the program, not a command separator.

**Q: Isn't input validation alone (without `execFile`) enough?**
A: It helps, but validation logic can have bugs or be bypassed (encoding tricks, unexpected locale/unicode behavior, incomplete regexes). Avoiding the shell removes the vulnerability class structurally, which is why it's the stronger, defense-in-depth-preferred fix. The two together (seen in port 3002) are best practice.

**Q: Why not just blacklist characters like `;` and `|`?**
A: Blacklists are inherently incomplete — attackers find characters/encodings the list didn't anticipate (newlines, `$IFS`, Unicode look-alikes, etc.). Allow-listing the exact shape of valid input (e.g. a hostname regex) is far more robust because it enumerates what's *permitted*, not what's *forbidden*.

**Q: What real-world impact can OS command injection have?**
A: Full remote code execution as the application's OS user — reading/exfiltrating files, installing malware/backdoors, pivoting further into the internal network, or disrupting services. Severity depends on the privileges of the process (here, whatever user runs the Node server).

**Q: How does the attack demo in this project work end-to-end?**
A: The Attacker Command Center (port 4000) is a separate server that crafts a payload (`10.0.0.1; whoami`), sends it as an HTTP request to the target's `/api/ping` endpoint, and displays the raw JSON response — exactly what a real attacker's browser or script would do against the vulnerable port 3001 instance. The same payload sent to port 3002 is rejected before it ever reaches a system call.

**Q: Where in the code is the actual fix?**
A: `app.js`, the port-3002 `/api/ping` handler — allow-list regex check, then `execFile('ping', ['-c','1', host], ...)` instead of `exec(`ping -c 1 ${host}`)`.
