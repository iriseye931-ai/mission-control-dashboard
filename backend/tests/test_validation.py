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

from main import (
    app,
    AmpSendRequest,
    PermissionAuditRequest,
    RouteTaskRequest,
    TaskSubmitRequest,
    _RAG_MAX_FILE_BYTES,
    _RAG_ALLOWED_EXT,
    _finalize_agents,
    _recommend_route,
)

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

    def test_routing_summary_returns_200(self):
        r = client.get("/api/routing")
        assert r.status_code == 200

    def test_permission_audit_returns_200(self):
        r = client.get("/api/permissions/audit")
        assert r.status_code == 200
        data = r.json()
        assert "entries" in data
        assert "summary" in data

    def test_routing_recommend_premium_task(self):
        r = client.post("/api/routing/recommend", json={
            "task": "Review this tricky refactor and decide the architecture before final merge"
        })
        assert r.status_code == 200
        data = r.json()
        assert data["task_class"] == "premium"

    def test_routing_recommend_routine_task(self):
        r = client.post("/api/routing/recommend", json={
            "task": "Summarize the last 10 AMP messages and generate a short status report"
        })
        assert r.status_code == 200
        data = r.json()
        assert data["task_class"] == "routine"


class TestRoutingValidation:
    def test_route_task_request_rejects_empty(self):
        with pytest.raises(ValidationError, match="task required"):
            RouteTaskRequest(task="   ")

    def test_task_submit_request_rejects_empty(self):
        with pytest.raises(ValidationError, match="task required"):
            TaskSubmitRequest(task="   ")

    def test_recommend_route_prefers_hermes_for_routine(self):
        rec = _recommend_route(
            "Summarize the latest mesh status",
            [
                {"name": "hermes", "routing_group": "local-default"},
                {"name": "atlas", "routing_group": "premium-pool", "runtime_status": "online"},
            ],
        )
        assert rec["recommended_agent"] == "hermes"

    def test_recommend_route_prefers_premium_for_hard_tasks(self):
        rec = _recommend_route(
            "Plan the architecture and review this refactor",
            [
                {"name": "hermes", "routing_group": "local-default"},
                {"name": "atlas", "routing_group": "premium-pool", "runtime_status": "online", "activity_status": "live"},
                {"name": "claude", "routing_group": "premium-pool", "runtime_status": "offline", "activity_status": "stale"},
            ],
        )
        assert rec["recommended_agent"] == "atlas"
        assert rec["fallback_agent"] == "claude"

    def test_recommend_route_prefers_sidecar_for_summary_work(self):
        rec = _recommend_route(
            "Summarize the current cron failures and routing status",
            [
                {
                    "name": "hermes",
                    "routing_group": "local-default",
                    "local_profiles": [
                        {"name": "profile:default", "display_name": "default", "hermes_profile": "default", "installed": True},
                        {"name": "profile:mesh-sidecar", "display_name": "mesh-sidecar", "hermes_profile": "mesh-sidecar", "installed": True},
                    ],
                },
            ],
        )
        assert rec["recommended_agent"] == "hermes"
        assert rec["recommended_profile"] == "profile:mesh-sidecar"
        assert rec["recommended_profile_display"] == "mesh-sidecar"

    def test_recommend_route_falls_back_when_code_specialist_missing(self):
        rec = _recommend_route(
            "Implement a React bug fix and patch the TypeScript tests",
            [
                {
                    "name": "hermes",
                    "routing_group": "local-default",
                    "local_profiles": [
                        {"name": "profile:default", "display_name": "default", "hermes_profile": "default", "installed": True},
                        {"name": "code-specialist", "installed": False},
                    ],
                },
            ],
        )
        assert rec["recommended_agent"] == "hermes"
        assert rec["recommended_profile"] == "profile:default"
        assert rec["recommended_profile_display"] == "default"

    def test_routing_summary_exposes_hermes_profile_guidance(self):
        import main as main_mod

        summary = main_mod._build_routing_summary(
            [
                {
                    "name": "hermes",
                    "routing_group": "local-default",
                    "local_profiles": [
                        {"name": "profile:default", "display_name": "default", "hermes_profile": "default"},
                        {"name": "profile:mesh-sidecar", "display_name": "mesh-sidecar", "hermes_profile": "mesh-sidecar"},
                        {"name": "profile:mesh-reasoning", "display_name": "mesh-reasoning", "hermes_profile": "mesh-reasoning"},
                    ],
                },
                {"name": "atlas", "routing_group": "premium-pool", "availability_status": "available"},
            ],
            {},
            {"status": "up", "primary_cause": {"kind": "healthy"}},
        )
        assert summary["profile_guidance"]["routine"] == "default"
        assert summary["profile_guidance"]["summary"] == "mesh-sidecar"
        assert summary["profile_guidance"]["reasoning"] == "mesh-reasoning"


class TestTaskSubmitEndpoint:
    def test_submit_task_routes_without_dispatch(self):
        r = client.post("/api/tasks/submit", json={
            "task": "Summarize the last 10 AMP messages and generate a short status report",
            "dispatch": False,
        })
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "routed"
        assert data["recommended_agent"] == "hermes"
        assert data["recommended_profile"] in {"workhorse", "sidecar"}

    def test_submit_task_premium_can_defer_when_unavailable(self, monkeypatch):
        import main as main_mod
        monkeypatch.setitem(main_mod._state, "routing_summary", {
            "policy": "local-first",
            "premium_available": [],
        })
        monkeypatch.setitem(main_mod._state, "agents", [
            {"name": "atlas", "routing_group": "premium-pool"},
            {"name": "claude", "routing_group": "premium-pool"},
            {"name": "hermes", "routing_group": "local-default"},
        ])
        r = client.post("/api/tasks/submit", json={
            "task": "Review this tricky refactor and decide the architecture before final merge",
            "dispatch": False,
        })
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "deferred"


class TestAvailabilityEndpoint:
    def test_set_availability_override(self, tmp_path, monkeypatch):
        import main as main_mod
        monkeypatch.setattr(main_mod, "AVAILABILITY_OVERRIDES_PATH", tmp_path / "availability.json")
        monkeypatch.setattr(main_mod, "PERMISSION_AUDIT_LOG_PATH", tmp_path / "permission_audit.jsonl")
        monkeypatch.setitem(main_mod._state, "permission_audit_summary", {})
        r = client.post("/api/availability", json={
            "agent": "claude",
            "availability": "rate_limited",
            "note": "Anthropic limit reached",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert data["overrides"]["claude"]["availability"] == "rate_limited"
        audit = client.get("/api/permissions/audit?last=5").json()
        assert audit["entries"][-1]["tool"] == "availability-override"
        assert audit["entries"][-1]["decision"] == "allow"


class TestPresenceClassification:
    def test_finalize_agents_marks_registered_agents_distinct_from_offline(self):
        agents = [
            {
                "name": "hermes",
                "runtime_status": "offline",
                "status": "offline",
                "registration_status": "registered",
                "orchestration_status": "idle",
                "local_profiles": [],
            },
            {
                "name": "browser",
                "runtime_status": "offline",
                "status": "offline",
                "registration_status": "local-only",
                "orchestration_status": "unregistered",
                "local_profiles": [],
            },
        ]
        services = {
            "hermes_gateway": {"status": "down", "detail": {}},
            "aimaestro": {"status": "up"},
        }

        result = _finalize_agents(agents, services, {"hermes": None, "browser": None})

        hermes = next(agent for agent in result if agent["name"] == "hermes")
        browser = next(agent for agent in result if agent["name"] == "browser")
        assert hermes["presence"]["status"] == "registered"
        assert hermes["presence"]["kind"] == "external-registration"
        assert browser["presence"]["status"] == "offline"
        assert browser["presence"]["kind"] == "local-runtime"


class TestPermissionAudit:
    def test_permission_audit_request_rejects_invalid_decision(self):
        with pytest.raises(ValidationError, match="decision must be one of"):
            PermissionAuditRequest(source="codex", decision="approve", mode="default")

    def test_permission_audit_round_trip(self, tmp_path, monkeypatch):
        import main as main_mod

        monkeypatch.setattr(main_mod, "PERMISSION_AUDIT_LOG_PATH", tmp_path / "permission_audit.jsonl")
        monkeypatch.setitem(main_mod._state, "permission_audit_summary", {})

        r = client.post("/api/permissions/audit", json={
            "source": "codex",
            "agent": "atlas",
            "tool": "exec_command",
            "decision": "allow",
            "mode": "default",
            "reason": "safe local read",
            "input_summary": "rg -n mesh backend/main.py",
        })
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert body["entry"]["decision"] == "allow"
        assert body["summary"]["decision_counts"]["allow"] == 1

        r = client.get("/api/permissions/audit?last=10")
        assert r.status_code == 200
        data = r.json()
        assert len(data["entries"]) == 1
        assert data["entries"][0]["tool"] == "exec_command"
        assert data["summary"]["count"] == 1


class TestLocalProfileActions:
    def test_start_profile_requires_installed_model(self, monkeypatch, tmp_path):
        import main as main_mod

        monkeypatch.setattr(main_mod, "PERMISSION_AUDIT_LOG_PATH", tmp_path / "permission_audit.jsonl")
        monkeypatch.setitem(main_mod._state, "permission_audit_summary", {})
        monkeypatch.setitem(main_mod._state, "agents", [
            {
                "name": "hermes",
                "local_profiles": [
                    {
                        "name": "code-specialist",
                        "mode": "on-demand",
                        "installed": False,
                        "running": False,
                        "model_path": "/tmp/missing-model",
                        "base_url": "http://127.0.0.1:8084/v1",
                        "port": 8084,
                    }
                ],
            }
        ])
        r = client.post("/api/local-profiles/action", json={
            "agent": "hermes",
            "profile": "code-specialist",
            "action": "start",
        })
        assert r.status_code == 400
        assert "model not installed" in r.json()["detail"]
        audit = client.get("/api/permissions/audit?last=5").json()
        assert audit["entries"][-1]["tool"] == "local-profile-action"
        assert audit["entries"][-1]["decision"] == "deny"

    def test_stop_profile_without_pid_is_ok(self, monkeypatch):
        import main as main_mod
        monkeypatch.setitem(main_mod._state, "agents", [
            {
                "name": "hermes",
                "local_profiles": [
                    {
                        "name": "code-specialist",
                        "mode": "on-demand",
                        "installed": True,
                        "running": False,
                        "model_path": "/tmp/model",
                        "base_url": "http://127.0.0.1:8084/v1",
                        "port": 8084,
                    }
                ],
            }
        ])
        r = client.post("/api/local-profiles/action", json={
            "agent": "hermes",
            "profile": "code-specialist",
            "action": "stop",
        })
        assert r.status_code == 200
        assert r.json()["status"] in {"not_running", "stopped"}

    def test_finalize_agents_adds_hermes_native_default_profile(self, monkeypatch, tmp_path):
        import main as main_mod

        hermes_home = tmp_path / ".hermes"
        hermes_home.mkdir(parents=True)
        (hermes_home / "config.yaml").write_text(
            "model:\n"
            "  model: /tmp/qwen\n"
            "  provider: custom\n"
            "  base_url: http://127.0.0.1:8081/v1\n"
        )
        monkeypatch.setattr(main_mod, "HERMES_HOME", hermes_home)
        monkeypatch.setattr(main_mod, "HERMES_PROFILES_DIR", hermes_home / "profiles")
        monkeypatch.setattr(main_mod, "LOCAL_BIN_DIR", tmp_path / ".local" / "bin")

        agents = [{
            "name": "hermes",
            "runtime_status": "offline",
            "status": "offline",
            "registration_status": "local-only",
            "orchestration_status": "unknown",
            "local_profiles": [],
        }]
        services = {"hermes_gateway": {"status": "down", "detail": {}}, "aimaestro": {"status": "down"}}

        result = main_mod._finalize_agents(agents, services, {"hermes": None})
        hermes = result[0]
        native = next(profile for profile in hermes["local_profiles"] if profile["name"] == "profile:default")
        assert native["profile_kind"] == "hermes-native"
        assert native["installed"] is True
        assert native["hermes_profile"] == "default"
        assert native["base_url"] == "http://127.0.0.1:8081/v1"

    def test_start_hermes_native_profile_runs_gateway(self, monkeypatch, tmp_path):
        import main as main_mod

        hermes_home = tmp_path / ".hermes"
        profile_home = hermes_home / "profiles" / "coder"
        profile_home.mkdir(parents=True)
        hermes_bin = tmp_path / "bin" / "hermes"
        hermes_bin.parent.mkdir(parents=True)
        hermes_bin.write_text("#!/bin/sh\n")
        monkeypatch.setattr(main_mod, "HERMES_HOME", hermes_home)
        monkeypatch.setattr(main_mod, "HERMES_PROFILES_DIR", hermes_home / "profiles")
        monkeypatch.setattr(main_mod, "HERMES_BIN", hermes_bin)
        monkeypatch.setattr(main_mod, "PERMISSION_AUDIT_LOG_PATH", tmp_path / "permission_audit.jsonl")
        monkeypatch.setitem(main_mod._state, "permission_audit_summary", {})
        monkeypatch.setitem(main_mod._state, "agents", [
            {
                "name": "hermes",
                "local_profiles": [
                    {
                        "name": "profile:coder",
                        "profile_kind": "hermes-native",
                        "hermes_profile": "coder",
                        "installed": True,
                        "running": False,
                    }
                ],
            }
        ])

        class _Proc:
            returncode = 0
            stdout = "gateway started"
            stderr = ""

        monkeypatch.setattr(main_mod.subprocess, "run", lambda *args, **kwargs: _Proc())

        r = client.post("/api/local-profiles/action", json={
            "agent": "hermes",
            "profile": "profile:coder",
            "action": "start",
        })
        assert r.status_code == 200
        body = r.json()
        assert body["status"] == "started"
        assert body["profile_kind"] == "hermes-native"
        assert body["hermes_profile"] == "coder"
