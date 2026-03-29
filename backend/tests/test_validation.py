"""
Tests for input validation: AMP send, RAG upload, and core API endpoints.
"""
import io
import sys
import os
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

# Add backend root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app, AmpSendRequest, _RAG_MAX_FILE_BYTES, _RAG_ALLOWED_EXT

client = TestClient(app)


# ---------------------------------------------------------------------------
# AmpSendRequest validator tests
# ---------------------------------------------------------------------------

class TestAmpSendRequest:
    def _valid(self, **overrides):
        defaults = {"recipient": "hermes", "subject": "hello", "message": "test body", "type": "notification"}
        return {**defaults, **overrides}

    def test_valid_passes(self):
        req = AmpSendRequest(**self._valid())
        assert req.recipient == "hermes"

    def test_recipient_strips_whitespace(self):
        req = AmpSendRequest(**self._valid(recipient="  hermes  "))
        assert req.recipient == "hermes"

    def test_recipient_empty_fails(self):
        with pytest.raises(ValidationError, match="recipient required"):
            AmpSendRequest(**self._valid(recipient="   "))

    def test_recipient_too_long_fails(self):
        with pytest.raises(ValidationError, match="too long"):
            AmpSendRequest(**self._valid(recipient="a" * 101))

    def test_recipient_invalid_chars_fails(self):
        with pytest.raises(ValidationError, match="invalid characters"):
            AmpSendRequest(**self._valid(recipient="bad;injection"))

    def test_recipient_at_sign_allowed(self):
        req = AmpSendRequest(**self._valid(recipient="iris@teamirs.local"))
        assert req.recipient == "iris@teamirs.local"

    def test_subject_too_long_fails(self):
        with pytest.raises(ValidationError, match="too long"):
            AmpSendRequest(**self._valid(subject="x" * 201))

    def test_message_empty_fails(self):
        with pytest.raises(ValidationError, match="message required"):
            AmpSendRequest(**self._valid(message="   "))

    def test_message_too_long_fails(self):
        with pytest.raises(ValidationError, match="too long"):
            AmpSendRequest(**self._valid(message="x" * 4001))

    def test_invalid_type_fails(self):
        with pytest.raises(ValidationError, match="type must be one of"):
            AmpSendRequest(**self._valid(type="shell_exec"))

    def test_all_valid_types(self):
        for t in ("notification", "request", "task", "response"):
            req = AmpSendRequest(**self._valid(type=t))
            assert req.type == t


# ---------------------------------------------------------------------------
# RAG upload endpoint — extension and size gating
# ---------------------------------------------------------------------------

class TestRagUpload:
    def _upload(self, filename: str, content: bytes = b"data"):
        return client.post(
            "/api/rag/upload",
            files={"file": (filename, io.BytesIO(content), "application/octet-stream")},
        )

    def test_allowed_txt(self):
        # Should not return 400 (may fail for other reasons on CI, but not ext/size)
        r = self._upload("notes.txt", b"hello world")
        assert r.status_code != 400

    def test_disallowed_exe_returns_400(self):
        r = self._upload("evil.exe", b"MZ\x90\x00")
        assert r.status_code == 400
        assert "not allowed" in r.json()["detail"].lower()

    def test_disallowed_sh_returns_400(self):
        r = self._upload("script.sh", b"#!/bin/bash")
        assert r.status_code == 400

    def test_disallowed_js_returns_400(self):
        r = self._upload("payload.js", b"console.log(1)")
        assert r.status_code == 400

    def test_oversized_file_returns_413(self):
        big = b"x" * (_RAG_MAX_FILE_BYTES + 1)
        r = self._upload("huge.txt", big)
        assert r.status_code == 413

    def test_allowed_extensions_set(self):
        assert ".pdf" in _RAG_ALLOWED_EXT
        assert ".txt" in _RAG_ALLOWED_EXT
        assert ".exe" not in _RAG_ALLOWED_EXT
        assert ".sh" not in _RAG_ALLOWED_EXT


# ---------------------------------------------------------------------------
# Core API smoke tests
# ---------------------------------------------------------------------------

class TestCoreEndpoints:
    def test_health_returns_200(self):
        r = client.get("/api/health")
        assert r.status_code == 200

    def test_agents_returns_list(self):
        r = client.get("/api/agents")
        assert r.status_code == 200
        data = r.json()
        assert "agents" in data
        assert isinstance(data["agents"], list)

    def test_status_returns_200(self):
        r = client.get("/api/status")
        assert r.status_code == 200

    def test_amp_bad_type_returns_422(self):
        r = client.post("/api/amp/send", json={
            "recipient": "hermes",
            "subject": "test",
            "message": "body",
            "type": "DROP TABLE users;",
        })
        assert r.status_code == 422

    def test_amp_missing_recipient_returns_422(self):
        r = client.post("/api/amp/send", json={
            "subject": "test",
            "message": "body",
        })
        assert r.status_code == 422
