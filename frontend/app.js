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
const metadataView = document.querySelector("#metadataView");
const downloadLink = document.querySelector("#downloadLink");
const deleteButton = document.querySelector("#deleteButton");

let documents = [];
let selectedDocumentId = null;

const formatBytes = (bytes) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const updateSelectedFiles = () => {
  const files = Array.from(fileInput.files || []);
  selectedFiles.textContent = files.length
    ? files.map((file) => `${file.name} (${formatBytes(file.size)})`).join(", ")
    : "";
};

const setStats = () => {
  document.querySelector("#totalDocs").textContent = documents.length;
  document.querySelector("#totalPages").textContent = documents.reduce((sum, doc) => sum + doc.page_count, 0);
  document.querySelector("#totalWords").textContent = documents.reduce((sum, doc) => sum + doc.word_count, 0);
  document.querySelector("#ocrDocs").textContent = documents.filter((doc) => doc.ocr_used).length;
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
    item.innerHTML = `
      <span class="document-name">${doc.original_filename}</span>
      <span class="document-meta">${doc.file_type.toUpperCase()} · ${doc.page_count} pages · ${formatBytes(doc.file_size)}</span>
      <span class="status-pill ${doc.status === "failed" ? "failed" : ""}">${doc.status}</span>
    `;
    item.addEventListener("click", () => loadDocument(doc.id));
    documentList.appendChild(item);
  });
};

const loadDocuments = async () => {
  const response = await fetch(API_BASE);
  const data = await response.json();
  documents = data.documents || [];
  setStats();
  renderDocuments();
};

const loadDocument = async (id) => {
  selectedDocumentId = id;
  renderDocuments();

  const response = await fetch(`${API_BASE}/${id}`);
  const data = await response.json();
  const doc = data.document;

  emptyState.classList.add("hidden");
  documentDetail.classList.remove("hidden");
  detailTitle.textContent = doc.original_filename;
  detailType.textContent = `${doc.file_type.toUpperCase()} document`;
  downloadLink.href = `${API_BASE}/${id}/download`;

  detailStats.innerHTML = `
    <div><strong>${doc.page_count}</strong><span>Pages</span></div>
    <div><strong>${doc.word_count}</strong><span>Words</span></div>
    <div><strong>${formatBytes(doc.file_size)}</strong><span>File size</span></div>
    <div><strong>${doc.ocr_used ? "Yes" : "No"}</strong><span>OCR used</span></div>
  `;

  textView.textContent = data.pages.map((page) => `Page ${page.page_number}\n${page.text || ""}`).join("\n\n");
  metadataView.innerHTML = Object.entries(data.metadata)
    .map(([key, value]) => `<div class="metadata-row"><strong>${key}</strong><span>${value || ""}</span></div>`)
    .join("");
};

const uploadFiles = async () => {
  const files = Array.from(fileInput.files || []);
  if (!files.length) {
    uploadStatus.textContent = "Choose at least one file first.";
    return;
  }

  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  uploadButton.disabled = true;
  uploadStatus.textContent = "Uploading and processing...";

  try {
    const response = await fetch(`${API_BASE}/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    const processed = data.uploaded.filter((item) => item.status === "processed").length;
    uploadStatus.textContent = `${processed} of ${data.uploaded.length} file(s) processed.`;
    fileInput.value = "";
    updateSelectedFiles();
    await loadDocuments();
  } catch (error) {
    uploadStatus.textContent = "Upload failed. Check the backend terminal.";
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

deleteButton.addEventListener("click", async () => {
  if (!selectedDocumentId) return;
  await fetch(`${API_BASE}/${selectedDocumentId}`, { method: "DELETE" });
  selectedDocumentId = null;
  documentDetail.classList.add("hidden");
  emptyState.classList.remove("hidden");
  await loadDocuments();
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
    tab.classList.add("active");
    const showText = tab.dataset.tab === "text";
    textView.classList.toggle("hidden", !showText);
    metadataView.classList.toggle("hidden", showText);
  });
});

loadDocuments();

