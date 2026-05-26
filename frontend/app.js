const API_BASE = "/api/documents";

const fileInput = document.querySelector("#fileInput");
const dropZone = document.querySelector("#dropZone");
const selectedFiles = document.querySelector("#selectedFiles");
const uploadButton = document.querySelector("#uploadButton");
const uploadStatus = document.querySelector("#uploadStatus");
const documentList = document.querySelector("#documentList");
const searchInput = document.querySelector("#searchInput");
const refreshButton = document.querySelector("#refreshButton");
const emptyState = document.querySelector("#emptyState");
const documentDetail = document.querySelector("#documentDetail");
const detailTitle = document.querySelector("#detailTitle");
const detailType = document.querySelector("#detailType");
const detailStats = document.querySelector("#detailStats");
const textView = document.querySelector("#textView");
const summaryView = document.querySelector("#summaryView");
const chatView = document.querySelector("#chatView");
const metadataView = document.querySelector("#metadataView");
const downloadLink = document.querySelector("#downloadLink");
const deleteButton = document.querySelector("#deleteButton");
const contentSearchInput = document.querySelector("#contentSearchInput");
const contentSearchResults = document.querySelector("#contentSearchResults");
const exportControl = document.querySelector("#exportControl");
const exportFormat = document.querySelector("#exportFormat");
const exportButton = document.querySelector("#exportButton");
const exportStatus = document.querySelector("#exportStatus");
const chatMessages = document.querySelector("#chatMessages");
const chatInput = document.querySelector("#chatInput");
const chatButton = document.querySelector("#chatButton");

let documents = [];
let selectedDocumentId = null;
let currentDocument = null;
let currentSummary = null;

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatBytes = (bytes) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const setUploadStatus = (message, type = "") => {
  uploadStatus.textContent = message;
  uploadStatus.className = `status-text ${type}`.trim();
};

const updateSelectedFiles = () => {
  const files = Array.from(fileInput.files || []);
  selectedFiles.textContent = files.length
    ? files.map((file) => `${file.name} (${formatBytes(file.size)})`).join(", ")
    : "";
};

const setStats = () => {
  document.querySelector("#totalDocs").textContent = documents.length;
  document.querySelector("#totalPages").textContent = documents.reduce((sum, doc) => sum + (doc.page_count || 0), 0);
  document.querySelector("#totalWords").textContent = documents.reduce((sum, doc) => sum + (doc.word_count || 0), 0);
  document.querySelector("#ocrDocs").textContent = documents.filter((doc) => doc.ocr_used).length;
};

const updateExportLink = () => {
  exportStatus.textContent = "";
  exportStatus.className = "inline-status";
};

const filenameFromDisposition = (disposition, fallback) => {
  const match = /filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i.exec(disposition || "");
  const encodedName = match?.[1] || match?.[2];
  return encodedName ? decodeURIComponent(encodedName) : fallback;
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const renderDocuments = () => {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = documents.filter((doc) => doc.original_filename.toLowerCase().includes(query));

  documentList.innerHTML = "";
  if (!filtered.length) {
    documentList.innerHTML = '<div class="empty-state"><p>No documents found.</p></div>';
    return;
  }

  filtered.forEach((doc) => {
    const item = document.createElement("button");
    item.className = `document-item ${doc.id === selectedDocumentId ? "active" : ""}`;
    item.type = "button";
    item.innerHTML = `
      <span class="document-name">${escapeHtml(doc.original_filename)}</span>
      <span class="document-meta">${escapeHtml(doc.file_type.toUpperCase())} - ${doc.page_count || 0} pages - ${formatBytes(doc.file_size)}</span>
      <span class="status-pill ${doc.status === "failed" ? "failed" : ""}">${escapeHtml(doc.status)}</span>
      ${doc.error_message ? `<span class="document-meta">${escapeHtml(doc.error_message)}</span>` : ""}
    `;
    item.addEventListener("click", () => loadDocument(doc.id));
    documentList.appendChild(item);
  });
};

const loadDocuments = async () => {
  try {
    const response = await fetch(API_BASE);
    if (!response.ok) throw new Error("Could not load documents.");
    const data = await response.json();
    documents = data.documents || [];
    setStats();
    renderDocuments();
  } catch (error) {
    documentList.innerHTML = `<div class="empty-state"><p>${escapeHtml(error.message)}</p></div>`;
  }
};

const setActiveTab = (name) => {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === name);
  });

  document.querySelectorAll(".tab-panel").forEach((panel) => {
    const isActive = panel.dataset.panel === name;
    panel.classList.toggle("hidden", !isActive);
    panel.setAttribute("aria-hidden", String(!isActive));
  });

  if (name === "summary") loadSummary();
  if (name === "chat" && !chatMessages.children.length) {
    addChatMessage("Ask me anything about the extracted text in this document.", "assistant");
  }
};

const renderMetadata = (metadataSections) => {
  const sections = Object.entries(metadataSections || {});
  if (!sections.length) {
    metadataView.innerHTML = '<div class="metadata-empty">No metadata was extracted for this file.</div>';
    return;
  }

  metadataView.innerHTML = sections
    .map(([sectionName, values]) => {
      const rows = Object.entries(values || {}).filter(([, value]) => value !== "" && value !== null && value !== undefined);
      if (!rows.length) return "";
      return `
        <section class="metadata-section">
          <h2>${escapeHtml(sectionName)}</h2>
          <div class="metadata-table">
            ${rows
              .map(([key, value]) => `<div class="metadata-row"><strong>${escapeHtml(key)}</strong><span>${escapeHtml(value)}</span></div>`)
              .join("")}
          </div>
        </section>
      `;
    })
    .join("") || '<div class="metadata-empty">No metadata was extracted for this file.</div>';
};

const loadDocument = async (id) => {
  selectedDocumentId = id;
  currentSummary = null;
  contentSearchInput.value = "";
  contentSearchResults.innerHTML = "";
  chatMessages.innerHTML = "";
  renderDocuments();

  const response = await fetch(`${API_BASE}/${id}`);
  if (!response.ok) {
    setUploadStatus("Could not load that document.", "error");
    return;
  }

  currentDocument = await response.json();
  const doc = currentDocument.document;

  emptyState.classList.add("hidden");
  documentDetail.classList.remove("hidden");
  detailTitle.textContent = doc.original_filename;
  detailType.textContent = `${doc.file_type.toUpperCase()} document`;
  downloadLink.href = `${API_BASE}/${id}/download`;
  exportControl.classList.remove("hidden");
  updateExportLink();

  detailStats.innerHTML = `
    <div><strong>${doc.page_count || 0}</strong><span>Pages</span></div>
    <div><strong>${doc.word_count || 0}</strong><span>Words</span></div>
    <div><strong>${formatBytes(doc.file_size)}</strong><span>File size</span></div>
    <div><strong>${doc.ocr_used ? "Yes" : "No"}</strong><span>OCR used</span></div>
  `;

  textView.textContent = currentDocument.pages.map((page) => `Page ${page.page_number}\n${page.text || ""}`).join("\n\n");
  renderMetadata(currentDocument.metadata_sections || { "Extracted metadata": currentDocument.metadata || {} });
  setActiveTab("text");
};

const renderContentSearch = () => {
  const query = contentSearchInput.value.trim().toLowerCase();
  contentSearchResults.innerHTML = "";
  if (!query || !currentDocument) return;

  const matches = currentDocument.pages
    .map((page) => {
      const text = page.text || "";
      const index = text.toLowerCase().indexOf(query);
      if (index === -1) return null;
      const start = Math.max(0, index - 90);
      const end = Math.min(text.length, index + query.length + 160);
      return {
        page: page.page_number,
        snippet: text.slice(start, end).replace(/\s+/g, " ").trim(),
      };
    })
    .filter(Boolean);

  if (!matches.length) {
    contentSearchResults.innerHTML = '<div class="search-result">No matches in this document.</div>';
    return;
  }

  contentSearchResults.innerHTML = matches
    .map((match) => `
      <div class="search-result">
        <strong>Page ${match.page}</strong>
        <span>${escapeHtml(match.snippet)}</span>
      </div>
    `)
    .join("");
};

const loadSummary = async () => {
  if (!selectedDocumentId || currentSummary) return;
  summaryView.textContent = "Building summary...";

  try {
    const response = await fetch(`${API_BASE}/${selectedDocumentId}/summary`);
    if (!response.ok) throw new Error("Could not build summary.");
    currentSummary = await response.json();
    summaryView.innerHTML = `
      <section>
        <h2>Summary</h2>
        <p>${escapeHtml(currentSummary.summary)}</p>
      </section>
      <section>
        <h2>Key Points</h2>
        <ul>${(currentSummary.key_points || []).map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>
      </section>
    `;
  } catch (error) {
    summaryView.textContent = error.message;
  }
};

const addChatMessage = (message, role, sources = []) => {
  const item = document.createElement("div");
  item.className = `chat-message ${role}`;
  item.innerHTML = `
    <div>${escapeHtml(message)}</div>
    ${sources.length ? `<small>Source pages: ${sources.map(escapeHtml).join(", ")}</small>` : ""}
  `;
  chatMessages.appendChild(item);
  chatMessages.scrollTop = chatMessages.scrollHeight;
};

const askQuestion = async () => {
  const question = chatInput.value.trim();
  if (!question || !selectedDocumentId) return;

  addChatMessage(question, "user");
  chatInput.value = "";
  chatButton.disabled = true;

  try {
    const response = await fetch(`${API_BASE}/${selectedDocumentId}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Could not answer that question.");
    addChatMessage(data.answer, "assistant", data.sources || []);
  } catch (error) {
    addChatMessage(error.message, "assistant");
  } finally {
    chatButton.disabled = false;
  }
};

const exportDocument = async () => {
  if (!selectedDocumentId || !currentDocument) return;

  const selectedFormat = exportFormat.value;
  const stem = currentDocument.document.original_filename.replace(/\.[^.]+$/, "");
  exportButton.disabled = true;
  exportStatus.textContent = `Exporting ${selectedFormat.toUpperCase()}...`;
  exportStatus.className = "inline-status";

  try {
    const response = await fetch(`${API_BASE}/${selectedDocumentId}/export?format=${encodeURIComponent(selectedFormat)}`);
    if (!response.ok) {
      let message = "Export failed.";
      try {
        const error = await response.json();
        message = error.detail || message;
      } catch {
        message = await response.text() || message;
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    const fallback = `${stem}.${selectedFormat}`;
    const filename = filenameFromDisposition(response.headers.get("content-disposition"), fallback);
    downloadBlob(blob, filename);
    exportStatus.textContent = `Downloaded ${filename}`;
    exportStatus.className = "inline-status success";
  } catch (error) {
    exportStatus.textContent = error.message || "Export failed.";
    exportStatus.className = "inline-status error";
  } finally {
    exportButton.disabled = false;
  }
};

const uploadFiles = async () => {
  const files = Array.from(fileInput.files || []);
  if (!files.length) {
    setUploadStatus("Choose at least one file first.", "error");
    return;
  }

  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  uploadButton.disabled = true;
  setUploadStatus("Uploading and processing...");

  try {
    const response = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || "Upload failed.");

    const uploaded = data.uploaded || [];
    const processed = uploaded.filter((item) => item.status === "processed");
    const failed = uploaded.filter((item) => item.status !== "processed");
    const failures = failed.map((item) => `${item.filename}: ${item.error || item.status}`).join(" | ");
    const message = failures
      ? `${processed.length} of ${uploaded.length} file(s) processed. ${failures}`
      : `${processed.length} of ${uploaded.length} file(s) processed.`;

    setUploadStatus(message, failed.length ? "error" : "success");
    fileInput.value = "";
    updateSelectedFiles();
    await loadDocuments();
    if (processed[0]?.document?.id) await loadDocument(processed[0].document.id);
  } catch (error) {
    setUploadStatus(error.message || "Upload failed. Check the backend terminal.", "error");
  } finally {
    uploadButton.disabled = false;
  }
};

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("dragging");
});

dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragging"));

dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  dropZone.classList.remove("dragging");
  fileInput.files = event.dataTransfer.files;
  updateSelectedFiles();
});

fileInput.addEventListener("change", updateSelectedFiles);
uploadButton.addEventListener("click", uploadFiles);
refreshButton.addEventListener("click", loadDocuments);
searchInput.addEventListener("input", renderDocuments);
contentSearchInput.addEventListener("input", renderContentSearch);
exportFormat.addEventListener("change", updateExportLink);
exportButton.addEventListener("click", exportDocument);
chatButton.addEventListener("click", askQuestion);
chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") askQuestion();
});

deleteButton.addEventListener("click", async () => {
  if (!selectedDocumentId) return;
  await fetch(`${API_BASE}/${selectedDocumentId}`, { method: "DELETE" });
  selectedDocumentId = null;
  currentDocument = null;
  currentSummary = null;
  documentDetail.classList.add("hidden");
  emptyState.classList.remove("hidden");
  await loadDocuments();
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => setActiveTab(tab.dataset.tab));
});

loadDocuments();
