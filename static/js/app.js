document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("draft-form");
  const docTypeInput = document.getElementById("doc-type");
  const titleInput = document.getElementById("title");
  const whenInput = document.getElementById("when");
  const whereInput = document.getElementById("where");
  const whoInput = document.getElementById("who");
  const howToApplyInput = document.getElementById("how-to-apply");
  const contactInput = document.getElementById("contact");
  const meetingTitleInput = document.getElementById("meeting-title");
  const hostDeptInput = document.getElementById("host-dept");
  const reportWhenInput = document.getElementById("report-when");
  const reportWhereInput = document.getElementById("report-where");
  const agendaInput = document.getElementById("agenda");
  const agendaResultsInput = document.getElementById("agenda-results");
  const recipientInput = document.getElementById("recipient");
  const toneInput = document.getElementById("tone");
  const saveFactsBtn = document.getElementById("save-facts-btn");
  const loadFactsBtn = document.getElementById("load-facts-btn");

  const FACT_CARDS_STORAGE_KEY = "doc_draft_fact_cards";

  const errorBox = document.getElementById("error-box");
  const loadingBox = document.getElementById("loading-box");
  const generateBtn = document.getElementById("generate-btn");
  const draftOutput = document.getElementById("draft-output");
  const draftPreview = document.getElementById("draft-preview");
  const tabPreview = document.getElementById("tab-preview");
  const tabEdit = document.getElementById("tab-edit");
  const copyBtn = document.getElementById("copy-btn");
  const downloadBtn = document.getElementById("download-btn");
  const fillSampleBtn = document.getElementById("fill-sample-btn");

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatInline(text) {
    let html = escapeHtml(text);
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    html = html.replace(/\[확인 필요\]/g, '<span class="needs-check">[확인 필요]</span>');
    return html;
  }

  function renderMarkdown(md) {
    if (!md || !md.trim()) {
      return '<p class="preview-placeholder">왼쪽에서 문서 정보를 입력하고 [초안 생성] 버튼을 누르면 이곳에 초안이 보기 좋게 표시됩니다.</p>';
    }

    const lines = md.replace(/\r\n/g, "\n").split("\n");
    const htmlParts = [];
    let inUl = false;
    let inOl = false;
    let tableRows = [];

    function closeLists() {
      if (inUl) {
        htmlParts.push("</ul>");
        inUl = false;
      }
      if (inOl) {
        htmlParts.push("</ol>");
        inOl = false;
      }
    }

    function flushTable() {
      if (tableRows.length === 0) return;
      let tableHtml = "<table>";
      tableRows.forEach((row, idx) => {
        const cells = row
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim());

        if (idx === 1 && cells.every((c) => /^:?-{2,}:?$/.test(c))) {
          return;
        }
        const tag = idx === 0 ? "th" : "td";
        const rowHtml = cells.map((c) => `<${tag}>${formatInline(c)}</${tag}>`).join("");
        tableHtml += `<tr>${rowHtml}</tr>`;
      });
      tableHtml += "</table>";
      htmlParts.push(tableHtml);
      tableRows = [];
    }

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      const trimmed = line.trim();

      if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
        closeLists();
        tableRows.push(trimmed);
        continue;
      } else {
        flushTable();
      }

      if (!trimmed) {
        closeLists();
        continue;
      }

      if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
        closeLists();
        htmlParts.push("<hr />");
        continue;
      }

      const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)$/);
      if (headingMatch) {
        closeLists();
        const level = headingMatch[1].length;
        htmlParts.push(`<h${level}>${formatInline(headingMatch[2])}</h${level}>`);
        continue;
      }

      if (trimmed.startsWith(">")) {
        closeLists();
        htmlParts.push(`<blockquote>${formatInline(trimmed.slice(1).trim())}</blockquote>`);
        continue;
      }

      const ulMatch = trimmed.match(/^[-*]\s+(.*)$/);
      if (ulMatch) {
        if (inOl) {
          htmlParts.push("</ol>");
          inOl = false;
        }
        if (!inUl) {
          htmlParts.push("<ul>");
          inUl = true;
        }
        htmlParts.push(`<li>${formatInline(ulMatch[1])}</li>`);
        continue;
      }

      const olMatch = trimmed.match(/^\d+\.\s+(.*)$/);
      if (olMatch) {
        if (inUl) {
          htmlParts.push("</ul>");
          inUl = false;
        }
        if (!inOl) {
          htmlParts.push("<ol>");
          inOl = true;
        }
        htmlParts.push(`<li>${formatInline(olMatch[1])}</li>`);
        continue;
      }

      closeLists();
      htmlParts.push(`<p>${formatInline(trimmed)}</p>`);
    }

    closeLists();
    flushTable();
    return htmlParts.join("\n");
  }

  function updatePreviewAndButtons() {
    const text = draftOutput.value;
    draftPreview.innerHTML = renderMarkdown(text);
    const hasContent = text.trim().length > 0;
    copyBtn.disabled = !hasContent;
    downloadBtn.disabled = !hasContent;
  }

  function switchTab(mode) {
    if (mode === "edit") {
      tabEdit.classList.add("active");
      tabPreview.classList.remove("active");
      draftPreview.classList.add("hidden");
      draftOutput.classList.remove("hidden");
      draftOutput.focus();
    } else {
      tabPreview.classList.add("active");
      tabEdit.classList.remove("active");
      draftPreview.classList.remove("hidden");
      draftOutput.classList.add("hidden");
      updatePreviewAndButtons();
    }
  }

  tabPreview.addEventListener("click", () => switchTab("preview"));
  tabEdit.addEventListener("click", () => switchTab("edit"));
  draftOutput.addEventListener("input", updatePreviewAndButtons);

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
  }

  function hideError() {
    errorBox.textContent = "";
    errorBox.classList.add("hidden");
  }

  function setLoading(isLoading) {
    if (isLoading) {
      loadingBox.classList.remove("hidden");
      generateBtn.disabled = true;
      generateBtn.textContent = "생성 중...";
      copyBtn.disabled = true;
      downloadBtn.disabled = true;
    } else {
      loadingBox.classList.add("hidden");
      generateBtn.disabled = false;
      generateBtn.textContent = "초안 생성";
    }
  }

  function getSelectedPromptType() {
    const selected = document.querySelector('input[name="prompt_type"]:checked');
    return selected ? selected.value : "B";
  }

  function sanitizeFilename(name) {
    return name.replace(/[\\/:*?"<>|]/g, "_").trim() || "문서_초안";
  }

  function markdownToPlainText(md) {
    const lines = md.replace(/\r\n/g, "\n").split("\n");
    const result = [];

    for (const rawLine of lines) {
      let line = rawLine.trimEnd();
      const trimmed = line.trim();

      // 표 구분선(|---|---|)은 건너뜁니다.
      if (/^\|[\s:|-]+\|$/.test(trimmed) && trimmed.includes("-")) {
        continue;
      }

      // 표 행(| 항목 | 내용 |)을 깔끔한 텍스트로 변환합니다.
      if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
        const cells = trimmed
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim());
        line = cells.join("  |  ");
      } else if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
        line = "────────────────────";
      } else {
        // 제목 기호(#) 제거
        line = line.replace(/^\s*#{1,6}\s+/, "");
        // 인용 기호(>) 제거
        line = line.replace(/^\s*>\s?/, "");
        // 글머리 기호(-, *)를 깔끔한 점(•)으로 변경
        line = line.replace(/^(\s*)[-*]\s+/, "$1• ");
      }

      // 인라인 마크다운 기호(**, *, `) 제거
      line = line
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/`([^`]+)`/g, "$1");

      result.push(line);
    }

    return result.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    hideError();

    const docType = docTypeInput.value.trim();
    const title = titleInput.value.trim();

    // 화면 측 필수 입력 검증
    if (!docType) {
      showError("문서 종류를 선택해 주세요.");
      docTypeInput.focus();
      return;
    }

    if (!title) {
      showError("제목을 입력해 주세요.");
      titleInput.focus();
      return;
    }

    const payload = {
      doc_type: docType,
      title: title,
      when: whenInput.value.trim(),
      where: whereInput.value.trim(),
      who: whoInput.value.trim(),
      how_to_apply: howToApplyInput.value.trim(),
      contact: contactInput.value.trim(),
      recipient: recipientInput.value.trim(),
      tone: toneInput.value,
      prompt_type: getSelectedPromptType(),
    };

    setLoading(true);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          const gate = document.getElementById("auth-gate");
          const shell = document.getElementById("app-shell");
          if (gate && shell) {
            shell.classList.add("hidden");
            gate.classList.remove("hidden");
          }
        }
        showError(data.error || "초안 생성 중 오류가 발생했습니다. 다시 시도해 주세요.");
        if (draftOutput.value.trim()) {
          copyBtn.disabled = false;
          downloadBtn.disabled = false;
        }
        return;
      }

      draftOutput.value = data.draft || "";
      updatePreviewAndButtons();
      switchTab("preview");
    } catch (error) {
      showError("서버와 통신할 수 없습니다. 서버가 실행 중인지 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  });

  copyBtn.addEventListener("click", async () => {
    const rawText = draftOutput.value;
    if (!rawText.trim()) {
      return;
    }

    const plainText = markdownToPlainText(rawText);
    const htmlContent = `<div>${renderMarkdown(rawText)}</div>`;

    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard && navigator.clipboard.write) {
        const item = new ClipboardItem({
          "text/plain": new Blob([plainText], { type: "text/plain" }),
          "text/html": new Blob([htmlContent], { type: "text/html" }),
        });
        await navigator.clipboard.write([item]);
      } else {
        await navigator.clipboard.writeText(plainText);
      }
    } catch (error) {
      try {
        await navigator.clipboard.writeText(plainText);
      } catch (fallbackError) {
        const tempArea = document.createElement("textarea");
        tempArea.value = plainText;
        document.body.appendChild(tempArea);
        tempArea.select();
        document.execCommand("copy");
        document.body.removeChild(tempArea);
      }
    }

    const originalText = copyBtn.textContent;
    copyBtn.textContent = "복사 완료!";
    setTimeout(() => {
      copyBtn.textContent = originalText;
    }, 1500);
  });

  downloadBtn.addEventListener("click", () => {
    const text = draftOutput.value;
    if (!text.trim()) {
      return;
    }

    const filename = `${sanitizeFilename(titleInput.value)}.md`;
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  fillSampleBtn.addEventListener("click", () => {
    hideError();
    docTypeInput.value = "안내문";
    titleInput.value = "2026학년도 동계 비교과 특강 수강생 모집 안내";
    whenInput.value = "2026. 12. 21.(월) ~ 12. 23.(수) 14:00~17:00";
    whereInput.value = "미래관 201호 대강의실";
    whoInput.value = "본교 학부 재학생 80명(선착순)";
    howToApplyInput.value = "학생역량통합관리시스템 온라인 신청";
    contactInput.value = "교수학습지원센터 (02-1234-5678)";
    recipientInput.value = "전체 학부 재학생";
    toneInput.value = "공식적";

    const promptBRadio = document.querySelector('input[name="prompt_type"][value="B"]');
    if (promptBRadio) {
      promptBRadio.checked = true;
    }
  });

  function flashButtonText(button, temporaryText) {
    const originalText = button.textContent;
    button.textContent = temporaryText;
    setTimeout(() => {
      button.textContent = originalText;
    }, 1500);
  }

  saveFactsBtn.addEventListener("click", () => {
    hideError();
    const factCards = {
      when: whenInput.value.trim(),
      where: whereInput.value.trim(),
      who: whoInput.value.trim(),
      how_to_apply: howToApplyInput.value.trim(),
      contact: contactInput.value.trim(),
      meeting_title: meetingTitleInput ? meetingTitleInput.value.trim() : "",
      host_dept: hostDeptInput ? hostDeptInput.value.trim() : "",
      report_when: reportWhenInput ? reportWhenInput.value.trim() : "",
      report_where: reportWhereInput ? reportWhereInput.value.trim() : "",
      agenda: agendaInput ? agendaInput.value.trim() : "",
      agenda_results: agendaResultsInput ? agendaResultsInput.value.trim() : "",
    };

    try {
      localStorage.setItem(FACT_CARDS_STORAGE_KEY, JSON.stringify(factCards));
      flashButtonText(saveFactsBtn, "저장 완료!");
    } catch (error) {
      showError("브라우저 저장소(localStorage)에 저장할 수 없습니다.");
    }
  });

  loadFactsBtn.addEventListener("click", () => {
    hideError();
    try {
      const saved = localStorage.getItem(FACT_CARDS_STORAGE_KEY);
      if (!saved) {
        showError("저장된 사실 카드가 없습니다. 먼저 [저장] 버튼을 눌러 주세요.");
        return;
      }

      const factCards = JSON.parse(saved);
      whenInput.value = factCards.when || "";
      whereInput.value = factCards.where || "";
      whoInput.value = factCards.who || "";
      howToApplyInput.value = factCards.how_to_apply || "";
      contactInput.value = factCards.contact || "";
      if (meetingTitleInput) meetingTitleInput.value = factCards.meeting_title || "";
      if (hostDeptInput) hostDeptInput.value = factCards.host_dept || "";
      if (reportWhenInput) reportWhenInput.value = factCards.report_when || "";
      if (reportWhereInput) reportWhereInput.value = factCards.report_where || "";
      if (agendaInput) agendaInput.value = factCards.agenda || "";
      if (agendaResultsInput) agendaResultsInput.value = factCards.agenda_results || "";

      flashButtonText(loadFactsBtn, "불러오기 완료!");
    } catch (error) {
      showError("저장된 사실 카드를 불러오는 중 오류가 발생했습니다.");
    }
  });

  // 1. 접속 비밀번호 인증 (8자리 이상)
  const authGate = document.getElementById("auth-gate");
  const appShell = document.getElementById("app-shell");
  const authForm = document.getElementById("auth-form");
  const authPasswordInput = document.getElementById("auth-password");
  const authError = document.getElementById("auth-error");
  const authSubmitBtn = document.getElementById("auth-submit-btn");
  const logoutBtn = document.getElementById("logout-btn");

  function showAuthError(message) {
    authError.textContent = message;
    authError.classList.remove("hidden");
  }

  function hideAuthError() {
    authError.textContent = "";
    authError.classList.add("hidden");
  }

  if (authForm) {
    authForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      hideAuthError();

      const password = authPasswordInput.value.trim();
      if (password.length < 8) {
        showAuthError("비밀번호는 8자리 이상 입력해 주세요.");
        authPasswordInput.focus();
        return;
      }

      authSubmitBtn.disabled = true;
      authSubmitBtn.textContent = "확인 중...";

      try {
        const response = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const data = await response.json();

        if (!response.ok) {
          showAuthError(data.error || "비밀번호를 확인해 주세요.");
          authPasswordInput.focus();
          return;
        }

        authPasswordInput.value = "";
        authGate.classList.add("hidden");
        appShell.classList.remove("hidden");
      } catch (error) {
        showAuthError("서버와 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.");
      } finally {
        authSubmitBtn.disabled = false;
        authSubmitBtn.textContent = "입장하기";
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await fetch("/api/logout", { method: "POST" });
      } catch (error) {
        // 네트워크 오류가 있어도 화면은 잠금 상태로 전환합니다.
      }
      appShell.classList.add("hidden");
      authGate.classList.remove("hidden");
      authPasswordInput.focus();
    });
  }

  // 2. PWA 서비스 워커 등록 및 설치 안내 팝업 (안드로이드 크롬 / 아이폰 사파리)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  const pwaPopup = document.getElementById("pwa-install-popup");
  const pwaInstallBtn = document.getElementById("pwa-install-btn");
  const pwaDismissBtn = document.getElementById("pwa-dismiss-btn");
  const pwaIosGuide = document.getElementById("pwa-ios-guide");
  const pwaInstallDesc = document.getElementById("pwa-install-desc");
  const PWA_DISMISS_KEY = "pwa_install_dismissed_until";

  let deferredPrompt = null;

  function isDismissedRecently() {
    try {
      const until = Number(localStorage.getItem(PWA_DISMISS_KEY) || "0");
      return Date.now() < until;
    } catch (error) {
      return false;
    }
  }

  function dismissPwaPopup() {
    if (pwaPopup) {
      pwaPopup.classList.add("hidden");
    }
    try {
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      localStorage.setItem(PWA_DISMISS_KEY, String(Date.now() + sevenDaysMs));
    } catch (error) {
      // localStorage 사용 불가 환경은 무시합니다.
    }
  }

  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    if (!isStandalone && !isDismissedRecently() && pwaPopup) {
      pwaInstallDesc.textContent = "안드로이드/PC 홈 화면에 앱처럼 설치할 수 있어요.";
      pwaIosGuide.classList.add("hidden");
      pwaPopup.classList.remove("hidden");
    }
  });

  if (isIos && isSafari && !isStandalone && !isDismissedRecently() && pwaPopup) {
    pwaInstallDesc.textContent = "아이폰 사파리에서 홈 화면에 추가해 앱처럼 쓸 수 있어요.";
    pwaPopup.classList.remove("hidden");
  }

  if (pwaInstallBtn) {
    pwaInstallBtn.addEventListener("click", async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (choice && choice.outcome === "accepted") {
          pwaPopup.classList.add("hidden");
        }
        return;
      }

      if (isIos && isSafari && pwaIosGuide) {
        pwaIosGuide.classList.remove("hidden");
        pwaInstallBtn.classList.add("hidden");
      }
    });
  }

  if (pwaDismissBtn) {
    pwaDismissBtn.addEventListener("click", dismissPwaPopup);
  }
});
