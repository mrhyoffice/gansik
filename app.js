(() => {
  "use strict";

  const config = window.APP_CONFIG || {};
  const form = document.querySelector("#snack-form");
  const submitButton = form.querySelector("[type='submit']");
  const statusMessage = document.querySelector("#form-status");
  const noteInput = document.querySelector("#note");
  const noteCount = document.querySelector("#note-count");
  const successDialog = document.querySelector("#success-dialog");
  const successSummary = document.querySelector("#success-summary");
  const historyList = document.querySelector("#history-list");
  const refreshHistoryButton = document.querySelector("#refresh-history");

  let pendingRequestId = null;
  let responseTimer = null;
  let historyRequest = null;

  const isConfigured = () =>
    /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(
      String(config.WEB_APP_URL || "").trim(),
    );

  noteInput.addEventListener("input", () => {
    noteCount.textContent = String(noteInput.value.length);
  });

  form.querySelectorAll("input, textarea").forEach((control) => {
    control.addEventListener("input", () => {
      if (control.checkValidity() && control.value.trim() !== "") {
        control.closest(".field-group")?.classList.remove("invalid");
      }
    });
  });

  function validateForm() {
    let firstInvalid = null;
    form.querySelectorAll(".field-group").forEach((group) => {
      const control = group.querySelector("input[required], textarea[required]");
      if (!control) return;
      const valid = control.checkValidity() && control.value.trim() !== "";
      group.classList.toggle("invalid", !valid);
      if (!valid && !firstInvalid) firstInvalid = control;
    });

    if (firstInvalid) {
      firstInvalid.focus();
      return false;
    }
    return true;
  }

  function setSubmitting(submitting) {
    submitButton.disabled = submitting;
    submitButton.classList.toggle("is-loading", submitting);
    submitButton.querySelector(".button-label").textContent = submitting ? "접수 중" : "신청하기";
  }

  function newRequestId() {
    return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    statusMessage.textContent = "";
    if (!validateForm()) return;

    if (!isConfigured()) {
      statusMessage.textContent = "아직 Google Apps Script가 연결되지 않았습니다.";
      return;
    }

    pendingRequestId = newRequestId();
    document.querySelector("#request-id").value = pendingRequestId;
    document.querySelector("#request-origin").value = window.location.origin;
    form.action = config.WEB_APP_URL;
    setSubmitting(true);

    responseTimer = window.setTimeout(() => {
      setSubmitting(false);
      pendingRequestId = null;
      statusMessage.textContent = "응답이 늦어지고 있습니다. 잠시 후 다시 확인해 주세요.";
    }, 20000);

    form.submit();
  });

  window.addEventListener("message", (event) => {
    const payload = event.data;
    if (!payload || payload.source !== "miraehaeyang-snack" || payload.requestId !== pendingRequestId) return;

    window.clearTimeout(responseTimer);
    setSubmitting(false);

    if (!payload.ok) {
      statusMessage.textContent = payload.message || "신청 처리 중 오류가 발생했습니다.";
      pendingRequestId = null;
      return;
    }

    const snackName = document.querySelector("#snackName").value.trim();
    successSummary.textContent = `‘${snackName}’ 신청을 관리자에게 전달했습니다.`;
    form.reset();
    noteCount.textContent = "0";
    pendingRequestId = null;
    successDialog.showModal();
    loadHistory();
  });

  document.querySelector("#close-dialog").addEventListener("click", () => successDialog.close());
  successDialog.addEventListener("click", (event) => {
    if (event.target === successDialog) successDialog.close();
  });

  function showHistoryMessage(icon, message) {
    historyList.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const iconElement = document.createElement("span");
    iconElement.setAttribute("aria-hidden", "true");
    iconElement.textContent = icon;
    const text = document.createElement("p");
    text.textContent = message;
    empty.append(iconElement, text);
    historyList.append(empty);
  }

  function renderHistory(items) {
    historyList.replaceChildren();
    if (!Array.isArray(items) || items.length === 0) {
      showHistoryMessage("🍪", "아직 신청된 간식이 없습니다.");
      return;
    }

    items.forEach((item) => {
      const row = document.createElement("article");
      row.className = "history-item";

      const icon = document.createElement("span");
      icon.className = "history-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "🍪";

      const info = document.createElement("div");
      info.className = "history-info";
      const name = document.createElement("p");
      name.className = "history-name";
      name.textContent = item.snackName;
      const meta = document.createElement("p");
      meta.className = "history-meta";
      meta.textContent = item.requestedAt;
      info.append(name, meta);

      const status = document.createElement("span");
      status.className = `status-pill${item.status === "완료" ? " complete" : ""}`;
      status.textContent = item.status || "접수";
      row.append(icon, info, status);
      historyList.append(row);
    });
  }

  function loadHistory() {
    if (!isConfigured()) {
      showHistoryMessage("🍩", "신청 내역이 없습니다.");
      return;
    }

    if (historyRequest) historyRequest.cleanup();
    refreshHistoryButton.disabled = true;
    showHistoryMessage("⏳", "신청 내역을 불러오는 중입니다.");

    const callbackName = `__snackHistory_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const script = document.createElement("script");
    let timer;

    const cleanup = () => {
      window.clearTimeout(timer);
      delete window[callbackName];
      script.remove();
      refreshHistoryButton.disabled = false;
      historyRequest = null;
    };

    historyRequest = { cleanup };
    window[callbackName] = (payload) => {
      cleanup();
      if (!payload?.ok) {
        showHistoryMessage("⚠️", payload?.message || "신청 내역을 불러오지 못했습니다.");
        return;
      }
      renderHistory(payload.items);
    };

    script.onerror = () => {
      cleanup();
      showHistoryMessage("⚠️", "신청 내역을 불러오지 못했습니다.");
    };
    timer = window.setTimeout(script.onerror, 12000);
    script.src = `${config.WEB_APP_URL}?callback=${encodeURIComponent(callbackName)}&_=${Date.now()}`;
    document.body.append(script);
  }

  refreshHistoryButton.addEventListener("click", loadHistory);
  loadHistory();
})();
