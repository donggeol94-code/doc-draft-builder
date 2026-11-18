document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("draft-form");
  const docTypeInput = document.getElementById("doc-type");
  const titleInput = document.getElementById("title");
  const whenInput = document.getElementById("when");
  const whereInput = document.getElementById("where");
  const whoInput = document.getElementById("who");
  const howToApplyInput = document.getElementById("how-to-apply");
  const contactInput = document.getElementById("contact");
  const recipientInput = document.getElementById("recipient");
  const toneInput = document.getElementById("tone");

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
});
