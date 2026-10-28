"""Read-only regression tests for the EarnBD API sidecar Nginx route."""
import importlib.util
from pathlib import Path
import unittest

FILE = Path(__file__).resolve().parents[1] / "deploy" / "digitalocean" / "configure_earnbd_nginx.py"
spec = importlib.util.spec_from_file_location("earnbd_nginx", FILE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

EXISTING = """server {
    server_name api.soverixnet.online;
    location = /app { return 301 /app/; }
    location / { proxy_pass http://127.0.0.1:4301; }
}
"""


class EarnbdNginxTests(unittest.TestCase):
    def test_adds_only_isolated_prefix_and_preserves_akira(self):
        updated = module.candidate_config(EXISTING)
        self.assertIn("location ^~ /earnbd/", updated)
        self.assertIn("proxy_pass http://127.0.0.1:4317/;", updated)
        self.assertIn("proxy_pass http://127.0.0.1:4301;", updated)
        self.assertIn("location = /app", updated)
        self.assertIsNone(module.candidate_config(updated))

    def test_refuses_conflicting_route(self):
        original = EXISTING.replace("location / {", "location ^~ /earnbd/ { return 403; }\n    location / {")
        with self.assertRaisesRegex(ValueError, "ROUTE_CONFLICT"):
            module.candidate_config(original)

    def test_refuses_unknown_akira_vhost(self):
        with self.assertRaisesRegex(ValueError, "AKIRA_VHOST_AMBIGUOUS"):
            module.candidate_config(EXISTING.replace("4301", "4302"))


if __name__ == "__main__":
    unittest.main()
