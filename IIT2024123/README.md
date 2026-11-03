# Campus Voice — Stored XSS Variant

This is a small, local-only teaching application for the **Stored XSS** variant in the Web Server Security assignment. It models a public campus feedback wall: a normal visitor submits feedback, the server stores it in SQLite, and later visitors read the saved feedback.

## Run it

Python 3.10+ is enough; there are no third-party dependencies.

```powershell
python app.py
```

The process starts both versions:

- Vulnerable: <http://127.0.0.1:8000/>
- Mitigated: <http://127.0.0.1:8001/>

Both ports read the same `guestbook.sqlite3`, which is created automatically.

## Two-minute demonstration

1. Open the default **Vulnerable demonstration** page at `http://127.0.0.1:8000/`.
2. Submit any normal feedback first to show expected behavior.
3. Submit the following exact message as another feedback entry:

   ```html
   <script>alert('Stored XSS executed')</script>
   ```

4. After the redirect, the alert appears. Refreshing the page or opening it in another browser/private window triggers the same stored payload again, demonstrating that it affects later visitors rather than only the submitting request.
5. Open `http://127.0.0.1:8001/`. The same record is present, but the exact payload is displayed as text and does not execute.
6. Point to `render_comment_body()` in `app.py` as the vulnerable sink and the `html.escape()` branch as the implemented mitigation.

### Higher-impact local-only demonstration payload

For a stronger viva demonstration, submit this payload on port `8000` instead of the alert payload:

```html
<script>
(() => {
  const overlay = document.createElement("div");
  overlay.id = "xss-impact-demo";
  overlay.style.cssText = [
    "position:fixed;inset:0;z-index:99999;",
    "background:#160b12;color:#fff;",
    "padding:10vh 8vw;font:18px system-ui"
  ].join("");
  overlay.innerHTML = [
    "<h1 style='color:#ff6b6b'>Stored XSS: page takeover demonstrated</h1>",
    "<p>This attacker-controlled script can rewrite the page and observe input.</p>",
    "<p>Nothing leaves this browser.</p>",
    "<label>Type harmless demo text: <input id='xss-demo-input'></label>",
    "<p>Locally observed value: <code id='xss-captured'></code></p>",
    "<button id='xss-close'>Close demonstration</button>"
  ].join("");
  document.body.prepend(overlay);
  const input = document.getElementById("xss-demo-input");
  const captured = document.getElementById("xss-captured");
  input.addEventListener("input", () => { captured.textContent = input.value; });
  document.getElementById("xss-close").addEventListener("click", () => overlay.remove());
})();
</script>
```

When a later visitor opens port `8000`, this stored script takes over the page and mirrors text typed into its injected field. It demonstrates the real security impact—same-origin JavaScript can rewrite the UI and observe user input—without exfiltrating data, reading real credentials, or making a network request. On port `8001`, the same payload is rendered literally and does not execute.

## Assignment explanation

### Vulnerable implementation

The port `8000` route loads stored comments and calls `render_comment_body(body, vulnerable=True)`. That code returns attacker-controlled `body` unchanged before placing it inside the comment HTML. The value is stored in SQLite first, so the script remains present after the original POST request.

### Root cause

Untrusted feedback is rendered in an HTML context without context-aware output encoding. The browser treats the stored `<script>` element as executable JavaScript whenever a visitor loads the feedback wall.

### Mitigation implemented

The port `8001` route renders the same database records with `html.escape(body, quote=True)`. The browser receives `&lt;script&gt;...&lt;/script&gt;` as text, so the same payload fails to execute while normal feedback remains readable.

### Other mitigations to explain at the viva

Framework auto-escaping prevents untrusted strings from becoming markup by default. A sanitizer is suitable when a feature intentionally permits a restricted subset of rich HTML. A Content Security Policy can reduce the impact of script execution but should complement output encoding. `HttpOnly` cookies prevent JavaScript from reading session cookies, and safe DOM sinks such as `textContent` avoid parsing strings as HTML. Encoding must always match the output context.

## Ownership declaration

| Member name | Roll number | Category | Variant implemented |
|---|---|---|---|
| Fill in | Fill in | Cross-Site Scripting (XSS) | Stored XSS |

## Checks

```powershell
python -m unittest -v
python -m py_compile app.py test_app.py
```
