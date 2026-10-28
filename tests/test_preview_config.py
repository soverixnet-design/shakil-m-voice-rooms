#!/usr/bin/env python3
"""Unit checks for the isolated LiveKit frontend vhost and staging flags."""
import importlib.util
from pathlib import Path
import unittest

SCRIPTS = Path(__file__).resolve().parents[1] / "deploy" / "digitalocean"


def module(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / (name + ".py"))
    instance = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(instance)
    return instance


nginx = module("configure_preview_nginx")
voice = module("enable_preview_voice")


class PreviewTest(unittest.TestCase):
    def test_find_only_existing_livekit_tls_vhost(self):
        conf = """
server {
    server_name voice.soverixnet.online;
    location / {
        proxy_pass http://127.0.0.1:7880;
    }
}
server {
    server_name api.soverixnet.online;
    location / {
        proxy_pass http://127.0.0.1:4301;
    }
}
"""
        matches = nginx.matching_block(conf)
        self.assertEqual(len(matches), 1)
        patched = conf[:matches[0]] + nginx.LOCATION + conf[matches[0]:]
        self.assertIn("alias /opt/shakilm-preview/current/;", patched)
        self.assertIn("proxy_pass http://127.0.0.1:7880;", patched)
        self.assertIn("proxy_pass http://127.0.0.1:4301;", patched)
        self.assertEqual(len(nginx.matching_block(patched)), 1)

    def test_preview_origin_and_mode_change_only(self):
        original = (
            "LIVEKIT_ENABLED=true\n"
            "LIVEKIT_API_KEY=fake_key\n"
            "LIVEKIT_API_SECRET=fake_test_secret_that_is_never_printed\n"
            "ALLOWED_ORIGINS=https://earnbd.work,https://www.earnbd.work\n"
        )
        result = voice.change(original)
        self.assertIn("LIVEKIT_PRIMARY_FOR_UNSET_ROOMS=true\n", result)
        self.assertIn("https://voice.soverixnet.online", result)
        self.assertIn("LIVEKIT_API_SECRET=fake_test_secret_that_is_never_printed", result)
        self.assertEqual(voice.change(result), result)

    def test_duplicate_private_settings_rejected(self):
        with self.assertRaises(ValueError):
            voice.change("ALLOWED_ORIGINS=a\nALLOWED_ORIGINS=b\n")
        with self.assertRaises(ValueError):
            voice.change("ALLOWED_ORIGINS=a\nLIVEKIT_PRIMARY_FOR_UNSET_ROOMS=false\nLIVEKIT_PRIMARY_FOR_UNSET_ROOMS=true\n")


if __name__ == "__main__":
    unittest.main()
