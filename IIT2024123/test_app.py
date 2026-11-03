import html
import tempfile
import unittest
from pathlib import Path

import app


class StoredXSSTests(unittest.TestCase):
    def test_demo_servers_have_separate_modes(self) -> None:
        vulnerable_server = app.create_server(0, vulnerable=True)
        safe_server = app.create_server(0, vulnerable=False)
        try:
            self.assertNotEqual(vulnerable_server.server_port, safe_server.server_port)
            self.assertTrue(vulnerable_server.vulnerable)
            self.assertFalse(safe_server.vulnerable)
        finally:
            vulnerable_server.server_close()
            safe_server.server_close()

    def test_comment_is_persisted_and_loaded_unchanged(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            db_path = Path(directory) / "test.sqlite3"
            app.init_db(db_path)
            payload = "<script>alert('Stored XSS executed')</script>"

            app.save_comment("student", payload, db_path)
            comments = app.load_comments(db_path)

            self.assertEqual(comments[0]["body"], payload)

    def test_vulnerable_view_inserts_payload_and_safe_view_encodes_it(self) -> None:
        payload = "<script>alert('Stored XSS executed')</script>"

        self.assertEqual(app.render_comment_body(payload, vulnerable=True), payload)
        self.assertEqual(
            app.render_comment_body(payload, vulnerable=False),
            html.escape(payload, quote=True),
        )


if __name__ == "__main__":
    unittest.main()
