"""Minimal HTTP API for the React frontend."""

from __future__ import annotations

import cgi
import io
import json
import logging
import tempfile
import uuid
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse

from agents.advisory_agent import AdvisoryAgent
from agents.analytics_agent import AnalyticsAgent
from agents.compliance_agent import ComplianceAgent
from agents.orchestrator import FinSageOrchestrator
from agents.parser_agent import ParserAgent
from frontend.utils.report_generator import generate_pdf
from shared.schemas import AdvisoryReport, FinalReport, PortfolioAnalytics, UserFinancialProfile


logger = logging.getLogger(__name__)


@dataclass
class ApiError(Exception):
    status: int
    message: str


def _model_dump(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    if isinstance(value, list):
        return [_model_dump(item) for item in value]
    if isinstance(value, dict):
        return {key: _model_dump(item) for key, item in value.items()}
    return value


def _coerce_analytics(payload: Any) -> Optional[PortfolioAnalytics]:
    if payload is None:
        return None
    if isinstance(payload, PortfolioAnalytics):
        return payload
    if isinstance(payload, dict):
        return PortfolioAnalytics(**payload)
    raise TypeError(f"Unexpected analytics payload: {type(payload)}")


def _coerce_report(final_data: Any = None, advisory_data: Any = None) -> Optional[FinalReport | AdvisoryReport]:
    if final_data:
        if isinstance(final_data, FinalReport):
            return final_data
        if isinstance(final_data, dict):
            return FinalReport(**final_data)
    if advisory_data:
        if isinstance(advisory_data, FinalReport | AdvisoryReport):
            return advisory_data
        if isinstance(advisory_data, dict):
            try:
                return FinalReport(**advisory_data)
            except Exception:
                return AdvisoryReport(**advisory_data)
    return None


def _extract_pipeline_outputs(result: dict) -> tuple[Optional[PortfolioAnalytics], Optional[FinalReport | AdvisoryReport], list[str]]:
    analytics = _coerce_analytics(result.get("analytics"))
    report = _coerce_report(
        final_data=result.get("final_report"),
        advisory_data=result.get("advisory_report"),
    )
    return analytics, report, result.get("errors", [])


def _profile_signature(profile: UserFinancialProfile) -> str:
    return json.dumps(profile.model_dump(mode="json"), sort_keys=True)


def _save_temp_pdf(file_bytes: bytes) -> str:
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
        temp_file.write(file_bytes)
        return temp_file.name


def _delete_temp_pdf(path: str) -> None:
    try:
        Path(path).unlink(missing_ok=True)
    except Exception:
        logger.debug("Failed to delete temp file %s", path, exc_info=True)


class SessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, dict[str, Any]] = {}

    def get(self, session_id: str) -> dict[str, Any]:
        session = self._sessions.get(session_id)
        if session is None:
            session = {
                "analytics": None,
                "report": None,
                "errors": [],
                "upload_filename": None,
                "user_profile": None,
                "user_profile_signature": None,
            }
            self._sessions[session_id] = session
        return session


def _run_profile_only(profile: UserFinancialProfile) -> tuple[Optional[PortfolioAnalytics], Optional[FinalReport | AdvisoryReport], list[str]]:
    orchestrator = FinSageOrchestrator()
    result = orchestrator.run_pipeline(user_profile=profile)
    return _extract_pipeline_outputs(result)


def _run_analytics_only(file_bytes: bytes) -> tuple[PortfolioAnalytics, list[str]]:
    pdf_path = _save_temp_pdf(file_bytes)
    try:
        parser = ParserAgent()
        raw_text = parser.parse_pdf(pdf_path)
        transactions = parser.extract_transactions(raw_text)
        if not transactions:
            raise ApiError(HTTPStatus.UNPROCESSABLE_ENTITY, "Could not extract any transactions from the uploaded PDF.")
        analytics = AnalyticsAgent().calculate_portfolio(transactions, raw_text=raw_text)
        if not analytics.holdings:
            raise ApiError(HTTPStatus.UNPROCESSABLE_ENTITY, "Statement parsing completed but no live holdings were produced.")
        return analytics, []
    finally:
        _delete_temp_pdf(pdf_path)


def _run_report_from_cached_analytics(
    analytics: PortfolioAnalytics,
    profile: UserFinancialProfile,
) -> tuple[Optional[FinalReport | AdvisoryReport], list[str]]:
    advisory_state = AdvisoryAgent().run(
        {
            "analytics": analytics.model_dump(mode="json"),
            "user_profile": profile.model_dump(mode="json"),
            "errors": [],
        }
    )
    report = _coerce_report(advisory_data=advisory_state.get("advisory_report"))
    errors = advisory_state.get("errors", [])

    if report is None:
        return None, errors

    compliance_state = ComplianceAgent().run(
        {
            "advisory_report": report.model_dump(mode="json"),
            "errors": errors,
        }
    )
    final_report = _coerce_report(final_data=compliance_state.get("final_report"))
    return final_report or report, compliance_state.get("errors", errors)


def _run_tax_only(profile: UserFinancialProfile) -> tuple[Any, list[str]]:
    tax_analysis = AdvisoryAgent().generate_tax_analysis(profile)
    return tax_analysis, []


def _run_fire_only(profile: UserFinancialProfile) -> tuple[Any, list[str]]:
    fire_plan = AdvisoryAgent().generate_fire_plan(profile)
    return fire_plan, []


def _ensure_report(session: dict[str, Any]) -> tuple[Optional[FinalReport | AdvisoryReport], list[str]]:
    analytics = session.get("analytics")
    profile = session.get("user_profile")

    if analytics is None:
        raise ApiError(HTTPStatus.CONFLICT, "Upload and process a CAMS or KFintech statement first.")
    if profile is None:
        raise ApiError(HTTPStatus.CONFLICT, "Save a profile on the FIRE or Tax page before requesting advisory outputs.")

    report, errors = _run_report_from_cached_analytics(analytics, profile)
    session["report"] = report
    session["errors"] = errors
    session["user_profile_signature"] = _profile_signature(profile)
    return report, errors


class FinSageHTTPServer(ThreadingHTTPServer):
    def __init__(self, server_address: tuple[str, int]):
        super().__init__(server_address, FinSageRequestHandler)
        self.sessions = SessionStore()


class FinSageRequestHandler(BaseHTTPRequestHandler):
    server: FinSageHTTPServer

    def log_message(self, format: str, *args: Any) -> None:
        logger.info("%s - %s", self.address_string(), format % args)

    def do_OPTIONS(self) -> None:
        self.send_response(HTTPStatus.NO_CONTENT)
        self._send_common_headers()
        self.end_headers()

    def do_GET(self) -> None:
        self._handle_request("GET")

    def do_POST(self) -> None:
        self._handle_request("POST")

    def do_PUT(self) -> None:
        self._handle_request("PUT")

    def _handle_request(self, method: str) -> None:
        try:
            session_id, session = self._get_session()
            path = urlparse(self.path).path
            payload = None

            if method in {"POST", "PUT"}:
                content_type = self.headers.get("Content-Type", "")
                if content_type.startswith("application/json"):
                    payload = self._read_json_body()
                elif content_type.startswith("multipart/form-data"):
                    payload = self._read_multipart_body()
                else:
                    payload = {}

            if method == "POST" and path == "/api/portfolio/upload":
                response = self._handle_portfolio_upload(session, payload)
            elif method == "GET" and path == "/api/portfolio/analytics":
                response = self._handle_portfolio_analytics(session)
            elif method == "GET" and path == "/api/portfolio/rebalancing":
                response = self._handle_rebalancing(session)
            elif method == "POST" and path == "/api/fire/generate":
                response = self._handle_fire(session, payload)
            elif method == "PUT" and path == "/api/fire/update":
                response = self._handle_fire(session, payload)
            elif method == "POST" and path == "/api/tax/compare":
                response = self._handle_tax(session, payload)
            elif method == "POST" and path == "/api/tax/optimize":
                response = self._handle_tax_optimizations(session, payload)
            elif method == "GET" and path == "/api/health/score":
                response = self._handle_health(session)
            elif method == "GET" and path == "/api/user/profile":
                response = self._handle_get_profile(session)
            elif method == "PUT" and path == "/api/user/profile":
                response = self._handle_update_profile(session, payload)
            elif method == "POST" and path == "/api/pipeline/run":
                response = self._handle_pipeline_run(session, payload)
            elif method == "GET" and path == "/api/report":
                response = self._handle_report(session)
            elif method == "GET" and path == "/api/report/download":
                return self._handle_report_download(session_id, session)
            else:
                raise ApiError(HTTPStatus.NOT_FOUND, f"Unsupported endpoint: {path}")

            self._write_json(response, status=HTTPStatus.OK, session_id=session_id)
        except ApiError as exc:
            self._write_json({"detail": exc.message}, status=exc.status)
        except Exception as exc:
            logger.exception("Unhandled API error")
            self._write_json({"detail": str(exc)}, status=HTTPStatus.INTERNAL_SERVER_ERROR)

    def _send_common_headers(self, session_id: Optional[str] = None) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Session-Id")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
        self.send_header("Access-Control-Expose-Headers", "X-Session-Id")
        if session_id:
            self.send_header("X-Session-Id", session_id)

    def _write_json(self, payload: Any, status: int = HTTPStatus.OK, session_id: Optional[str] = None) -> None:
        body = json.dumps(_model_dump(payload)).encode("utf-8")
        self.send_response(status)
        self._send_common_headers(session_id=session_id)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self) -> dict[str, Any]:
        content_length = int(self.headers.get("Content-Length", "0"))
        if content_length <= 0:
            return {}
        return json.loads(self.rfile.read(content_length).decode("utf-8"))

    def _read_multipart_body(self) -> dict[str, Any]:
        environ = {
            "REQUEST_METHOD": self.command,
            "CONTENT_TYPE": self.headers.get("Content-Type", ""),
            "CONTENT_LENGTH": self.headers.get("Content-Length", "0"),
        }
        form = cgi.FieldStorage(fp=self.rfile, headers=self.headers, environ=environ)
        payload: dict[str, Any] = {}
        for key in form.keys():
            item = form[key]
            if isinstance(item, list):
                item = item[0]
            if item.filename:
                payload[key] = {
                    "filename": item.filename,
                    "content": item.file.read(),
                }
            else:
                payload[key] = item.value
        return payload

    def _get_session(self) -> tuple[str, dict[str, Any]]:
        session_id = self.headers.get("X-Session-Id") or str(uuid.uuid4())
        return session_id, self.server.sessions.get(session_id)

    def _profile_from_payload(self, payload: dict[str, Any]) -> UserFinancialProfile:
        try:
            return UserFinancialProfile(**payload)
        except Exception as exc:
            raise ApiError(HTTPStatus.BAD_REQUEST, f"Invalid profile payload: {exc}") from exc

    def _handle_portfolio_upload(self, session: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
        file_item = payload.get("file")
        if not file_item:
            raise ApiError(HTTPStatus.BAD_REQUEST, "A PDF file is required for statement upload.")

        analytics, errors = _run_analytics_only(file_item["content"])
        session["analytics"] = analytics
        session["errors"] = errors
        session["upload_filename"] = file_item["filename"]
        session["report"] = None

        if session.get("user_profile") is not None:
            report, report_errors = _run_report_from_cached_analytics(analytics, session["user_profile"])
            session["report"] = report
            session["errors"] = report_errors

        return {
            "success": True,
            "message": "Statement processed successfully.",
            "analytics": analytics,
        }

    def _handle_portfolio_analytics(self, session: dict[str, Any]) -> dict[str, Any]:
        analytics = session.get("analytics")
        if analytics is None:
            raise ApiError(HTTPStatus.NOT_FOUND, "No portfolio analytics are cached for this session yet.")
        return {"analytics": analytics}

    def _handle_rebalancing(self, session: dict[str, Any]) -> dict[str, Any]:
        report = session.get("report")
        if report is None:
            report, _ = _ensure_report(session)
        if report is None or not report.rebalancing_plan:
            raise ApiError(HTTPStatus.NOT_FOUND, "No rebalancing recommendations are available for the current session.")
        return {"rebalancing_plan": report.rebalancing_plan}

    def _handle_fire(self, session: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
        profile = self._profile_from_payload(payload)
        session["user_profile"] = profile
        session["user_profile_signature"] = _profile_signature(profile)
        session["report"] = None
        fire_plan, errors = _run_fire_only(profile)
        session["errors"] = errors

        if fire_plan is None:
            error_text = errors[-1] if errors else "FIRE plan generation failed."
            raise ApiError(HTTPStatus.SERVICE_UNAVAILABLE, error_text)

        return {"fire_plan": fire_plan}

    def _handle_tax(self, session: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
        profile = self._profile_from_payload(payload)
        session["user_profile"] = profile
        session["user_profile_signature"] = _profile_signature(profile)
        tax_analysis, errors = _run_tax_only(profile)
        session["errors"] = errors

        if tax_analysis is None:
            error_text = errors[-1] if errors else "Tax comparison failed."
            raise ApiError(HTTPStatus.SERVICE_UNAVAILABLE, error_text)

        return {"tax_analysis": tax_analysis}

    def _handle_tax_optimizations(self, session: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
        result = self._handle_tax(session, payload)
        tax_analysis = result["tax_analysis"]
        return {
            "suggestions": tax_analysis.additional_instruments,
            "totalPotentialSaving": tax_analysis.savings_amount,
        }

    def _handle_health(self, session: dict[str, Any]) -> dict[str, Any]:
        report = session.get("report")
        if report is None:
            report, _ = _ensure_report(session)
        if report is None or not report.health_score:
            raise ApiError(HTTPStatus.NOT_FOUND, "No health score is available for the current session.")
        return {"health_score": report.health_score}

    def _handle_get_profile(self, session: dict[str, Any]) -> dict[str, Any]:
        profile = session.get("user_profile")
        if profile is None:
            raise ApiError(HTTPStatus.NOT_FOUND, "No profile has been saved for this session yet.")
        return {"profile": profile}

    def _handle_update_profile(self, session: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
        profile = self._profile_from_payload(payload)
        session["user_profile"] = profile
        session["user_profile_signature"] = _profile_signature(profile)
        session["report"] = None
        return {"profile": profile}

    def _handle_pipeline_run(self, session: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
        file_item = payload.get("file")
        profile_value = payload.get("profile")
        profile_payload = json.loads(profile_value) if isinstance(profile_value, str) else profile_value
        profile = self._profile_from_payload(profile_payload) if profile_payload else None

        if not file_item and profile is None:
            raise ApiError(HTTPStatus.BAD_REQUEST, "Provide a profile, a PDF statement, or both.")

        if file_item:
            pdf_path = _save_temp_pdf(file_item["content"])
        else:
            pdf_path = None

        try:
            result = FinSageOrchestrator().run_pipeline(pdf_path=pdf_path, user_profile=profile)
        finally:
            if pdf_path:
                _delete_temp_pdf(pdf_path)

        analytics, report, errors = _extract_pipeline_outputs(result)
        session["analytics"] = analytics
        session["report"] = report
        session["errors"] = errors
        session["upload_filename"] = file_item["filename"] if file_item else session.get("upload_filename")
        if profile is not None:
            session["user_profile"] = profile
            session["user_profile_signature"] = _profile_signature(profile)

        return {
            "analytics": analytics,
            "fire_plan": report.fire_plan if report else None,
            "tax_analysis": report.tax_analysis if report else None,
            "health_score": report.health_score if report else None,
            "rebalancing_plan": report.rebalancing_plan if report else None,
            "errors": errors,
        }

    def _handle_report(self, session: dict[str, Any]) -> dict[str, Any]:
        report = session.get("report")
        if report is None and session.get("analytics") is not None and session.get("user_profile") is not None:
            report, _ = _ensure_report(session)
        if report is None and session.get("analytics") is None:
            raise ApiError(HTTPStatus.NOT_FOUND, "No report is available for the current session.")
        return {"report": report or {"analytics_only": True, "available": True}}

    def _handle_report_download(self, session_id: str, session: dict[str, Any]) -> None:
        report = session.get("report")
        analytics = session.get("analytics")
        if report is None and analytics is not None and session.get("user_profile") is not None:
            report, _ = _ensure_report(session)
        if report is None and analytics is None:
            raise ApiError(HTTPStatus.NOT_FOUND, "No report is available for download.")

        pdf_bytes = generate_pdf(
            analytics=analytics,
            advisory_report=report,
            final_report=report if isinstance(report, FinalReport) else None,
        )
        if isinstance(pdf_bytes, str):
            pdf_bytes = pdf_bytes.encode("latin-1")

        self.send_response(HTTPStatus.OK)
        self._send_common_headers(session_id=session_id)
        self.send_header("Content-Type", "application/pdf")
        self.send_header("Content-Disposition", 'attachment; filename="finsage-report.pdf"')
        self.send_header("Content-Length", str(len(pdf_bytes)))
        self.end_headers()
        self.wfile.write(pdf_bytes)


def run_server(host: str = "0.0.0.0", port: int = 8000) -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    server = FinSageHTTPServer((host, port))
    logger.info("Starting FinSage API server on http://%s:%s", host, port)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Stopping FinSage API server")
    finally:
        server.server_close()
