import hashlib
import hmac
import os
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request, send_from_directory, session
from google import genai

# .env 파일에서 환경변수(GEMINI_API_KEY, APP_PASSWORD 등)를 불러옵니다.
load_dotenv()

app = Flask(__name__)

_configured_secret = os.getenv("FLASK_SECRET_KEY", "").strip()
_configured_password = os.getenv("APP_PASSWORD", "").strip()
app.secret_key = _configured_secret or hashlib.sha256(
    f"doc-draft-builder:{_configured_password}".encode("utf-8")
).hexdigest()
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

ALLOWED_DOC_TYPES = ["보도자료", "안내문", "기안문", "결과 보고", "업무 메일"]
ALLOWED_TONES = ["공식적", "친근한"]
MODEL_NAME = "gemini-3.5-flash-lite"


def build_prompt_a(data: dict) -> str:
    """Prompt A: 입력 정보로 해당 문서를 작성해 달라고만 간단히 요청합니다."""
    if data["doc_type"] == "결과 보고":
        return (
            "다음 회의 정보를 바탕으로 대학 행정 '결과 보고(회의록)' 초안을 작성해 주세요.\n"
            "회의제목, 일시, 장소, 주관부서, 회의 안건, 안건별 결과 요약을 깔끔하게 정리하고,\n"
            "열람 및 결재가 가능하도록 마크다운 표 형태의 결재라인(구분: 기안(담당) / 검토(팀장) / 결재(부서장), 성명·직위, 결재(서명), 결재일자)을 반드시 포함해 주세요.\n\n"
            f"- 문서 제목: {data['title']}\n"
            f"- 회의제목: {data['meeting_title'] or '미입력'}\n"
            f"- 일시: {data['when'] or '미입력'}\n"
            f"- 장소: {data['where'] or '미입력'}\n"
            f"- 주관부서: {data['host_dept'] or '미입력'}\n"
            f"- 회의 안건: {data['agenda'] or '미입력'}\n"
            f"- 안건별 결과 요약: {data['agenda_results'] or '미입력'}\n"
            f"- 받는 사람: {data['recipient'] or '미입력'}\n"
            f"- 어조: {data['tone']}\n"
        )

    return (
        f"다음 입력 정보를 바탕으로 '{data['doc_type']}' 초안을 작성해 주세요.\n\n"
        f"- 문서 종류: {data['doc_type']}\n"
        f"- 제목: {data['title']}\n"
        f"- 받는 사람: {data['recipient'] or '미입력'}\n"
        f"- 어조: {data['tone']}\n"
        f"- 일시: {data['when'] or '미입력'}\n"
        f"- 장소: {data['where'] or '미입력'}\n"
        f"- 대상: {data['who'] or '미입력'}\n"
        f"- 신청 방법: {data['how_to_apply'] or '미입력'}\n"
        f"- 문의처: {data['contact'] or '미입력'}\n"
    )


def build_prompt_b(data: dict) -> str:
    """Prompt B: 대학 행정 문서 체크리스트와 환각 방지([확인 필요]) 규칙을 적용합니다."""
    if data["doc_type"] == "결과 보고":
        return (
            "당신은 꼼꼼한 대학 행정 실무자입니다. 아래 회의 정보를 바탕으로 '결과 보고(회의록)' 초안을 작성해 주세요.\n\n"
            "[대학 행정 결과 보고서 작성 체크리스트]\n"
            "1. 회의 개요(회의제목, 일시, 장소, 주관부서)와 회의 안건, 안건별 결과 요약을 체계적으로 정리하세요.\n"
            "2. 6하원칙(누가, 언제, 어디서, 무엇을, 어떻게, 왜)이 빠짐없이 반영되도록 점검하세요.\n"
            "3. 대학 행정 문서에 어울리는 정중한 공식 문체를 기본으로 하되, 선택된 어조를 반영하세요.\n"
            "4. 문서 상단 또는 하단에 열람·결재용 결재라인을 반드시 마크다운 표로 작성하세요.\n"
            "   (열: 구분 | 기안(담당) | 검토(팀장) | 결재(부서장), 행: 성명/직위 | 결재(서명) | 결재일자)\n\n"
            "[매우 중요한 절대 규칙]\n"
            "- 입력에 없는 내용은 절대 지어내지 말고 [확인 필요]로 표시하세요.\n"
            "- 비어 있는 항목은 임의로 추측해서 채우지 말고 반드시 [확인 필요]로 적으세요.\n\n"
            "[입력 정보]\n"
            f"- 문서 제목: {data['title']}\n"
            f"- 회의제목: {data['meeting_title'] or '[확인 필요]'}\n"
            f"- 일시: {data['when'] or '[확인 필요]'}\n"
            f"- 장소: {data['where'] or '[확인 필요]'}\n"
            f"- 주관부서: {data['host_dept'] or '[확인 필요]'}\n"
            f"- 회의 안건: {data['agenda'] or '[확인 필요]'}\n"
            f"- 안건별 결과 요약: {data['agenda_results'] or '[확인 필요]'}\n"
            f"- 받는 사람: {data['recipient'] or '[확인 필요]'}\n"
            f"- 어조: {data['tone']}\n"
        )

    return (
        f"당신은 꼼꼼한 대학 행정 실무자입니다. 아래 입력 정보를 바탕으로 '{data['doc_type']}' 초안을 작성해 주세요.\n\n"
        "[대학 행정 문서 작성 체크리스트]\n"
        "1. 6하원칙(누가, 언제, 어디서, 무엇을, 어떻게, 왜)이 문서에 빠짐없이 자연스럽게 반영되도록 점검하세요.\n"
        "2. 대학 행정 문서에 어울리는 정중한 공식 문체를 기본으로 하되, 선택된 어조를 반영하세요.\n"
        "3. 문서 하단 또는 적절한 위치에 문의처를 반드시 포함하세요.\n\n"
        "[매우 중요한 절대 규칙]\n"
        "- 입력에 없는 내용은 절대 지어내지 말고 [확인 필요]로 표시하세요.\n"
        "- 비어 있거나 '미입력'으로 표시된 항목(예: 일시, 장소, 대상, 신청 방법, 문의처, 받는 사람 등)은 임의로 추측해서 채우지 말고 반드시 [확인 필요]로 적으세요.\n\n"
        "[입력 정보]\n"
        f"- 문서 종류: {data['doc_type']}\n"
        f"- 제목: {data['title']}\n"
        f"- 받는 사람: {data['recipient'] or '[확인 필요]'}\n"
        f"- 어조: {data['tone']}\n"
        f"- 일시: {data['when'] or '[확인 필요]'}\n"
        f"- 장소: {data['where'] or '[확인 필요]'}\n"
        f"- 대상: {data['who'] or '[확인 필요]'}\n"
        f"- 신청 방법: {data['how_to_apply'] or '[확인 필요]'}\n"
        f"- 문의처: {data['contact'] or '[확인 필요]'}\n"
    )


@app.route("/")
def index():
    """메인 화면(index.html)을 보여줍니다."""
    authenticated = bool(session.get("authenticated"))
    return render_template("index.html", authenticated=authenticated)


@app.route("/manifest.json")
def manifest():
    """PWA 매니페스트 파일을 루트 경로에서 제공합니다."""
    return send_from_directory("static", "manifest.json", mimetype="application/manifest+json")


@app.route("/sw.js")
def service_worker():
    """PWA 서비스 워커를 루트 스코프에서 제공합니다."""
    response = send_from_directory("static", "sw.js", mimetype="application/javascript")
    response.headers["Cache-Control"] = "no-cache"
    return response


@app.route("/api/login", methods=["POST"])
def login():
    """접속 비밀번호(8자리 이상)를 확인하고 세션을 인증합니다."""
    expected_password = os.getenv("APP_PASSWORD", "").strip()
    if len(expected_password) < 8:
        app.logger.error("APP_PASSWORD 환경변수가 8자리 이상으로 설정되어 있지 않습니다.")
        return jsonify({
            "error": "서버에 접속 비밀번호(APP_PASSWORD, 8자리 이상)가 설정되지 않았습니다."
        }), 500

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "잘못된 요청 형식입니다."}), 400

    password = (payload.get("password") or "").strip()
    if len(password) < 8:
        return jsonify({"error": "비밀번호는 8자리 이상 입력해 주세요."}), 400

    if not hmac.compare_digest(password, expected_password):
        return jsonify({"error": "비밀번호가 올바르지 않습니다."}), 401

    session["authenticated"] = True
    return jsonify({"ok": True})


@app.route("/api/logout", methods=["POST"])
def logout():
    """현재 세션을 잠금 상태로 되돌립니다."""
    session.pop("authenticated", None)
    return jsonify({"ok": True})


@app.route("/api/generate", methods=["POST"])
def generate_draft():
    """사용자 입력을 검증하고 Gemini API를 호출해 문서 초안을 생성합니다."""
    if not session.get("authenticated"):
        return jsonify({"error": "비밀번호 인증이 필요합니다. 먼저 비밀번호를 입력해 주세요."}), 401

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({"error": "잘못된 요청 형식입니다. 다시 시도해 주세요."}), 400

    doc_type = (payload.get("doc_type") or "").strip()
    title = (payload.get("title") or "").strip()

    # 서버 측 필수 입력 검증
    if not doc_type:
        return jsonify({"error": "문서 종류를 선택해 주세요."}), 400
    if doc_type not in ALLOWED_DOC_TYPES:
        return jsonify({"error": "지원하지 않는 문서 종류입니다."}), 400
    if not title:
        return jsonify({"error": "제목을 입력해 주세요."}), 400

    tone = (payload.get("tone") or "공식적").strip()
    if tone not in ALLOWED_TONES:
        tone = "공식적"

    prompt_type = (payload.get("prompt_type") or "B").strip().upper()
    if prompt_type not in ("A", "B"):
        prompt_type = "B"

    data = {
        "doc_type": doc_type,
        "title": title,
        "when": (payload.get("when") or "").strip(),
        "where": (payload.get("where") or "").strip(),
        "who": (payload.get("who") or "").strip(),
        "how_to_apply": (payload.get("how_to_apply") or "").strip(),
        "contact": (payload.get("contact") or "").strip(),
        "recipient": (payload.get("recipient") or "").strip(),
        "tone": tone,
    }

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        app.logger.error("GEMINI_API_KEY 환경변수가 설정되어 있지 않습니다.")
        return jsonify({
            "error": "API 키 설정을 찾을 수 없습니다. 프로젝트 폴더의 .env 파일에 GEMINI_API_KEY가 올바르게 입력되어 있는지 확인해 주세요."
        }), 500

    prompt = build_prompt_a(data) if prompt_type == "A" else build_prompt_b(data)

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
        )
        draft_text = (response.text or "").strip()
        if not draft_text:
            app.logger.warning("Gemini API가 빈 응답을 반환했습니다.")
            return jsonify({
                "error": "AI가 초안을 생성하지 못했습니다. 입력 내용을 조금 더 구체적으로 적은 뒤 다시 시도해 주세요."
            }), 502

        return jsonify({"draft": draft_text})
    except Exception:
        app.logger.exception("Gemini API 호출 중 오류가 발생했습니다.")
        return jsonify({
            "error": "초안을 생성하는 중 문제가 발생했습니다. 잠시 후 다시 시도하거나 인터넷 연결 및 API 키 상태를 확인해 주세요."
        }), 500


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
