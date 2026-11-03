"""Stored XSS teaching application.

This application is intentionally vulnerable on the default route (/) so it can
be demonstrated locally for the Web Server Security assignment.  The safe
version runs on a separate port and renders the same stored comments with
context-aware HTML encoding.
"""

from __future__ import annotations

import html
import os
import sqlite3
import threading
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse


APP_DIR = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("XSS_DB_PATH", APP_DIR / "guestbook.sqlite3"))
HOST = "127.0.0.1"
VULNERABLE_PORT = int(os.environ.get("VULNERABLE_PORT", "8000"))
SAFE_PORT = int(os.environ.get("SAFE_PORT", "8001"))

IMPACT_PAYLOAD = """<script>
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
</script>"""


def init_db(db_path: Path = DB_PATH) -> None:
    """Create the small persistent comment store if it does not exist."""
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
    try:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                display_name TEXT NOT NULL,
                body TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.commit()
    finally:
        connection.close()


def save_comment(display_name: str, body: str, db_path: Path = DB_PATH) -> None:
    """Persist a comment.  The body is deliberately stored unchanged."""
    connection = sqlite3.connect(db_path)
    try:
        connection.execute(
            "INSERT INTO comments (display_name, body) VALUES (?, ?)",
            (display_name, body),
        )
        connection.commit()
    finally:
        connection.close()


def load_comments(db_path: Path = DB_PATH) -> list[sqlite3.Row]:
    connection = sqlite3.connect(db_path)
    try:
        connection.row_factory = sqlite3.Row
        return connection.execute(
            "SELECT id, display_name, body, created_at FROM comments ORDER BY id DESC"
        ).fetchall()
    finally:
        connection.close()


def render_comment_body(body: str, vulnerable: bool) -> str:
    """Return the HTML inserted into the comment body element.

    VULNERABLE CODE PATH: the vulnerable mode returns user-controlled text
    directly, so a stored <script> element is interpreted by every visitor's
    browser.  The safe mode is the implemented mitigation.
    """
    if vulnerable:
        return body  # INTENTIONAL STORED XSS SINK FOR THE ASSIGNMENT
    return html.escape(body, quote=True)


def page_html(*, vulnerable: bool, comments: list[sqlite3.Row], notice: str = "") -> str:
    current_port = VULNERABLE_PORT if vulnerable else SAFE_PORT
    other_port = SAFE_PORT if vulnerable else VULNERABLE_PORT
    mode_title = "Vulnerable demonstration" if vulnerable else "Mitigated demonstration"
    mode_description = (
        "This page intentionally inserts stored comment text as HTML. Open this page "
        "after posting the payload to see it execute for any visitor."
        if vulnerable
        else "This page uses context-aware output encoding. The same stored payload is "
        "shown as text and does not execute."
    )
    mode_badge = "INTENTIONALLY VULNERABLE" if vulnerable else "OUTPUT ENCODING ENABLED"
    other_url = f"http://{HOST}:{other_port}/"
    other_label = f"Open {'mitigated' if vulnerable else 'vulnerable'} view on port {other_port}"
    notice_html = f'<div class="notice">{html.escape(notice)}</div>' if notice else ""

    comment_cards: list[str] = []
    for comment in comments:
        name = html.escape(comment["display_name"], quote=True)
        created = html.escape(comment["created_at"], quote=True)
        body = render_comment_body(comment["body"], vulnerable)
        comment_cards.append(
            f"""
            <article class="comment-card">
              <div class="comment-meta"><strong>{name}</strong><span>{created}</span></div>
              <div class="comment-body">{body}</div>
            </article>
            """
        )
    comments_html = "\n".join(comment_cards) or (
        '<div class="empty">No comments yet. Add the first one below.</div>'
    )

    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Campus Voice | Stored XSS Lab</title>
  <link rel="stylesheet" href="/static/app.css">
</head>
<body>
  <main class="shell">
    <header class="hero">
      <div class="eyebrow">WEB SECURITY LAB · STORED XSS</div>
      <h1>Campus Voice</h1>
      <p>A public feedback wall for the student community.</p>
    </header>

    <section class="mode-panel {"vulnerable" if vulnerable else "safe"}">
      <div>
        <span class="badge">{mode_badge}</span>
        <h2>{mode_title} · port {current_port}</h2>
        <p>{mode_description}</p>
      </div>
      <a class="mode-link" href="{other_url}">{other_label} ↗</a>
    </section>

    {notice_html}

    <section class="grid">
      <div>
        <div class="section-heading">
          <h2>Community feedback</h2>
          <span>{len(comments)} saved</span>
        </div>
        <div class="comments">{comments_html}</div>
      </div>

      <aside class="composer">
        <h2>Leave feedback</h2>
        <p>Normal behavior: a visitor posts a message and everyone can read it.</p>
        <form method="post" action="/comment">
          <label for="display_name">Display name</label>
          <input id="display_name" name="display_name" maxlength="60" required placeholder="e.g. Aisha">
          <label for="body">Message</label>
          <textarea id="body" name="body" maxlength="3000" required placeholder="Share something with campus..."></textarea>
          <button type="submit">Publish feedback</button>
        </form>
        <div class="demo-tip">
          <strong>Impact payload</strong>
          <details>
            <summary>Show local-only takeover demo</summary>
            <pre>{html.escape(IMPACT_PAYLOAD)}</pre>
          </details>
        </div>
      </aside>
    </section>

    <footer>
      <span>Local educational demo · data is stored in guestbook.sqlite3</span>
      <a href="/about">How to demonstrate</a>
    </footer>
  </main>
</body>
</html>"""


def about_html(vulnerable: bool) -> str:
    other_port = SAFE_PORT if vulnerable else VULNERABLE_PORT
    current_mode = "vulnerable" if vulnerable else "mitigated"
    other_mode = "mitigated" if vulnerable else "vulnerable"
    return f"""<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Demonstration notes | Campus Voice</title><link rel="stylesheet" href="/static/app.css"></head>
<body><main class="shell narrow">
  <a class="back" href="/">← Back to Campus Voice ({current_mode} port)</a>
  <header class="hero compact"><div class="eyebrow">ASSIGNMENT NOTES</div><h1>Stored XSS walkthrough</h1>
  <p>Everything below is scoped to this local application.</p></header>
  <section class="notes">
    <h2>1. Normal user behavior</h2>
    <p>A visitor enters a display name and feedback message. The server stores the message in SQLite and the public feedback wall displays it to later visitors.</p>
    <h2>2. Working exploit</h2>
    <p>On the vulnerable view, submit this exact message:</p>
    <pre>&lt;script&gt;alert('Stored XSS executed')&lt;/script&gt;</pre>
    <p>After the form redirects, the browser loads the vulnerable port, reads the stored record, and executes the script. Open a new private window or another browser to show that another visitor triggers the same stored payload.</p>
    <h2>3. Root cause</h2>
    <p>The application stores attacker-controlled feedback and later inserts the body directly into an HTML element without output encoding. The browser interprets the stored <code>&lt;script&gt;</code> as code.</p>
    <h2>4. Implemented mitigation</h2>
    <p>Open the <a href="http://{HOST}:{other_port}/">{other_mode} port ({other_port})</a>. It reads the same database but applies context-aware HTML encoding with Python's <code>html.escape</code>. The exact payload is then displayed literally and does not execute.</p>
    <h2>5. Other XSS mitigations to explain</h2>
    <p>Framework auto-escaping prevents untrusted text from becoming markup by default. A sanitizer is appropriate when a feature intentionally permits a restricted subset of rich HTML. A Content Security Policy can reduce the impact of script execution but should complement output encoding. HttpOnly cookies limit JavaScript access to session cookies, and safe DOM sinks such as <code>textContent</code> avoid interpreting strings as HTML. Encoding must match the output context.</p>
    <h2>Impact payload</h2>
    <p>This local-only payload replaces the page with an attacker-style overlay and mirrors text typed into its own input. It demonstrates page takeover and input observation without making a network request:</p>
    <pre>{html.escape(IMPACT_PAYLOAD)}</pre>
    <h2>Ownership declaration</h2>
    <table><thead><tr><th>Member name</th><th>Roll number</th><th>Category</th><th>Variant</th></tr></thead>
    <tbody><tr><td>Fill in</td><td>Fill in</td><td>Cross-Site Scripting</td><td>Stored XSS</td></tr></tbody></table>
  </section>
</main></body></html>"""


CSS = """
:root { color-scheme: light; --ink: #172033; --muted: #63708a; --line: #dce3ef; --blue: #335cff; --blue-dark: #1c36a8; --red: #b42318; --red-bg: #fff2f0; --green: #087443; --green-bg: #edfff5; }
* { box-sizing: border-box; }
body { margin: 0; background: #f5f7fb; color: var(--ink); font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.5; }
a { color: var(--blue-dark); }
.shell { max-width: 1120px; margin: 0 auto; padding: 44px 24px 28px; }
.shell.narrow { max-width: 850px; }
.hero { padding: 22px 0 30px; }
.hero.compact { padding-bottom: 20px; }
.eyebrow { color: var(--blue); font-size: .74rem; font-weight: 800; letter-spacing: .14em; }
h1, h2, p { margin-top: 0; }
h1 { font-size: clamp(2.3rem, 5vw, 4.6rem); letter-spacing: -.06em; line-height: .98; margin: 10px 0 14px; }
.hero p { color: var(--muted); font-size: 1.1rem; }
.mode-panel { align-items: center; border: 1px solid; border-radius: 16px; display: flex; gap: 20px; justify-content: space-between; margin: 12px 0 25px; padding: 21px 24px; }
.mode-panel.vulnerable { background: var(--red-bg); border-color: #f4b7b1; }
.mode-panel.safe { background: var(--green-bg); border-color: #a6dfc1; }
.mode-panel h2 { font-size: 1.18rem; margin: 8px 0 4px; }
.mode-panel p { color: #526078; margin: 0; max-width: 730px; }
.badge { border-radius: 999px; font-size: .7rem; font-weight: 800; letter-spacing: .08em; padding: 5px 9px; }
.vulnerable .badge { background: #fbd0cb; color: var(--red); }
.safe .badge { background: #c9f4db; color: var(--green); }
.mode-link, .back { font-weight: 750; white-space: nowrap; }
.notice { background: #e8efff; border: 1px solid #b9c9ff; border-radius: 10px; color: #263d8e; margin: 0 0 20px; padding: 12px 15px; }
.grid { display: grid; gap: 28px; grid-template-columns: minmax(0, 1.55fr) minmax(280px, .8fr); }
.section-heading { align-items: baseline; display: flex; justify-content: space-between; margin-bottom: 12px; }
.section-heading h2 { margin: 0; }
.section-heading span { color: var(--muted); font-size: .9rem; }
.comments { display: grid; gap: 12px; }
.comment-card, .composer, .notes { background: #fff; border: 1px solid var(--line); border-radius: 14px; box-shadow: 0 7px 22px rgba(27, 49, 95, .05); }
.comment-card { padding: 17px 19px; }
.comment-meta { align-items: center; display: flex; gap: 10px; justify-content: space-between; margin-bottom: 10px; }
.comment-meta span { color: var(--muted); font-size: .78rem; }
.comment-body { overflow-wrap: anywhere; }
.composer { align-self: start; padding: 21px; }
.composer h2 { margin-bottom: 5px; }
.composer > p { color: var(--muted); font-size: .9rem; }
label { display: block; font-size: .86rem; font-weight: 750; margin: 16px 0 6px; }
input, textarea { border: 1px solid #cbd4e3; border-radius: 8px; display: block; font: inherit; padding: 10px 11px; width: 100%; }
textarea { min-height: 130px; resize: vertical; }
input:focus, textarea:focus { border-color: var(--blue); outline: 3px solid #dbe3ff; }
button { background: var(--blue); border: 0; border-radius: 8px; color: #fff; cursor: pointer; font: inherit; font-weight: 750; margin-top: 17px; padding: 11px 15px; width: 100%; }
button:hover { background: var(--blue-dark); }
.demo-tip { background: #f4f6fa; border-radius: 9px; color: var(--muted); font-size: .78rem; margin-top: 19px; padding: 11px; }
.demo-tip code { background: #e7ebf3; border-radius: 4px; display: block; margin-top: 7px; overflow-wrap: anywhere; padding: 5px; }
.empty { background: #fff; border: 1px dashed #c9d3e2; border-radius: 12px; color: var(--muted); padding: 25px; text-align: center; }
footer { border-top: 1px solid var(--line); color: var(--muted); display: flex; font-size: .8rem; justify-content: space-between; margin-top: 35px; padding-top: 17px; }
.back { display: inline-block; margin-bottom: 28px; text-decoration: none; }
.notes { padding: 26px 30px; }
.notes h2 { font-size: 1.2rem; margin: 22px 0 7px; }
.notes h2:first-child { margin-top: 0; }
.notes p { color: #46536a; }
pre { background: #172033; border-radius: 8px; color: #f2f5ff; overflow-x: auto; padding: 14px 16px; }
.notes code { background: #edf0f6; border-radius: 4px; padding: 2px 4px; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid var(--line); padding: 9px; text-align: left; }
th { background: #f2f5fa; }
@media (max-width: 760px) { .mode-panel, footer { align-items: flex-start; flex-direction: column; } .grid { grid-template-columns: 1fr; } .shell { padding-top: 25px; } }
"""


class DemoHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True

    def __init__(self, address: tuple[str, int], handler_class: type[BaseHTTPRequestHandler], *, vulnerable: bool):
        super().__init__(address, handler_class)
        self.vulnerable = vulnerable


def create_server(port: int, vulnerable: bool) -> DemoHTTPServer:
    return DemoHTTPServer((HOST, port), GuestbookHandler, vulnerable=vulnerable)


class GuestbookHandler(BaseHTTPRequestHandler):
    server_version = "CampusVoice/1.0"

    def send_html(self, content: str, status: HTTPStatus = HTTPStatus.OK) -> None:
        encoded = content.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self) -> None:  # noqa: N802 - required by BaseHTTPRequestHandler
        parsed = urlparse(self.path)
        vulnerable = self.server.vulnerable  # type: ignore[attr-defined]
        if parsed.path == "/static/app.css":
            encoded = CSS.encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/css; charset=utf-8")
            self.send_header("Content-Length", str(len(encoded)))
            self.end_headers()
            self.wfile.write(encoded)
            return
        if parsed.path == "/about":
            self.send_html(about_html(vulnerable))
            return
        if parsed.path != "/":
            self.send_error(HTTPStatus.NOT_FOUND, "Page not found")
            return

        query = parse_qs(parsed.query)
        notice = query.get("notice", [""])[0]
        self.send_html(
            page_html(
                vulnerable=vulnerable,
                comments=load_comments(),
                notice=notice,
            )
        )

    def do_POST(self) -> None:  # noqa: N802 - required by BaseHTTPRequestHandler
        parsed = urlparse(self.path)
        if parsed.path != "/comment":
            self.send_error(HTTPStatus.NOT_FOUND, "Page not found")
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length > 16_000:
            self.send_error(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "Request too large")
            return
        fields = parse_qs(self.rfile.read(length).decode("utf-8"), keep_blank_values=True)
        display_name = fields.get("display_name", [""])[0].strip()
        body = fields.get("body", [""])[0].strip()
        if not display_name or not body:
            self.send_response(HTTPStatus.SEE_OTHER)
            self.send_header("Location", f"/?{urlencode({'notice': 'Both fields are required.'})}")
            self.end_headers()
            return
        if len(display_name) > 60 or len(body) > 3000:
            self.send_response(HTTPStatus.SEE_OTHER)
            self.send_header("Location", f"/?{urlencode({'notice': 'Please keep the message within the displayed limits.'})}")
            self.end_headers()
            return

        save_comment(display_name, body)
        self.send_response(HTTPStatus.SEE_OTHER)
        self.send_header("Location", f"/?{urlencode({'notice': 'Feedback published.'})}")
        self.end_headers()

    def log_message(self, format: str, *args: object) -> None:
        print(f"[{self.log_date_time_string()}] {format % args}")


def run() -> None:
    init_db()
    vulnerable_server = create_server(VULNERABLE_PORT, vulnerable=True)
    safe_server = create_server(SAFE_PORT, vulnerable=False)
    servers = (vulnerable_server, safe_server)
    threads = tuple(
        threading.Thread(target=server.serve_forever, name=f"campus-voice-{server.server_port}", daemon=True)
        for server in servers
    )
    for thread in threads:
        thread.start()
    print(f"Vulnerable demo: http://{HOST}:{VULNERABLE_PORT}/")
    print(f"Mitigated demo:   http://{HOST}:{SAFE_PORT}/")
    stop_event = threading.Event()
    try:
        stop_event.wait()
    except KeyboardInterrupt:
        print("\nStopping Campus Voice")
    finally:
        for server in servers:
            server.shutdown()
            server.server_close()


if __name__ == "__main__":
    run()
