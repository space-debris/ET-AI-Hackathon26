import http.client
import json
import threading
import uuid
from pathlib import Path

from api.server import FinSageHTTPServer


def _request(server, method, path, body=None, headers=None):
    connection = http.client.HTTPConnection(server.server_address[0], server.server_address[1], timeout=30)
    connection.request(method, path, body=body, headers=headers or {})
    response = connection.getresponse()
    payload = response.read()
    session_id = response.getheader("X-Session-Id")
    content_type = response.getheader("Content-Type") or ""
    connection.close()
    return response.status, payload, session_id, content_type


def _build_multipart(file_path: Path, field_name: str = "file"):
    boundary = f"----FinSageBoundary{uuid.uuid4().hex}"
    file_bytes = file_path.read_bytes()
    parts = [
        (
            f"--{boundary}\r\n"
            f'Content-Disposition: form-data; name="{field_name}"; filename="{file_path.name}"\r\n'
            "Content-Type: application/pdf\r\n\r\n"
        ).encode("utf-8"),
        file_bytes,
        f"\r\n--{boundary}--\r\n".encode("utf-8"),
    ]
    return boundary, b"".join(parts)


def test_tax_compare_endpoint_returns_validated_values():
    server = FinSageHTTPServer(("127.0.0.1", 0))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        profile = {
            "age": 34,
            "annual_income": 2400000,
            "monthly_expenses": 80000,
            "existing_investments": {"MF": 1800000, "PPF": 600000},
            "target_retirement_age": 50,
            "target_monthly_corpus": 150000,
            "risk_profile": "moderate",
            "base_salary": 1800000,
            "hra_received": 360000,
            "rent_paid": 480000,
            "metro_city": True,
            "section_80c": 150000,
            "nps_contribution": 50000,
            "medical_insurance_premium": 25000,
            "home_loan_interest": 0,
        }

        status, payload, _, _ = _request(
            server,
            "POST",
            "/api/tax/compare",
            body=json.dumps(profile).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )

        data = json.loads(payload.decode("utf-8"))
        assert status == 200
        assert data["tax_analysis"]["old_total_tax"] == 366600.0
        assert data["tax_analysis"]["new_total_tax"] == 292500.0
        assert data["tax_analysis"]["recommended_regime"] == "new"
        assert data["tax_analysis"]["savings_amount"] == 74100.0
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


def test_upload_and_cached_analytics_endpoints_share_session():
    server = FinSageHTTPServer(("127.0.0.1", 0))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        boundary, body = _build_multipart(Path("data/sample_cams_detailed.pdf"))
        status, payload, session_id, content_type = _request(
            server,
            "POST",
            "/api/portfolio/upload",
            body=body,
            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        )

        upload_data = json.loads(payload.decode("utf-8"))
        assert status == 200
        assert session_id
        assert "application/json" in content_type
        assert len(upload_data["analytics"]["holdings"]) == 6

        status, payload, _, _ = _request(
            server,
            "GET",
            "/api/portfolio/analytics",
            headers={"X-Session-Id": session_id},
        )

        analytics_data = json.loads(payload.decode("utf-8"))
        assert status == 200
        assert analytics_data["analytics"]["overall_xirr"] == 0.121
        assert analytics_data["analytics"]["expense_ratio_drag_inr"] == 5644.85
        assert len(analytics_data["analytics"]["holdings"]) == 6
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)
