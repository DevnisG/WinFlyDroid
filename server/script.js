let API_BASE = '';
let currentFiles = [];
let filesToUpload = [];
let credIP = '';
let credPass = '';

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  else if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  else return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
}

function showSpinner() {
  let progressElement = document.getElementById("uploadProgressIndicator");
  if (!progressElement) {
    progressElement = document.createElement("div");
    progressElement.id = "uploadProgressIndicator";
    progressElement.className = "upload-progress";
    const header = document.querySelector(".app-header-files");
    if (header) {
      header.style.position = "relative";
      header.appendChild(progressElement);
      progressElement.style.position = "absolute";
      progressElement.style.top = "0";
      progressElement.style.right = "0";
      progressElement.style.width = "300px"; 
      progressElement.style.margin = "0"; 
    } else {
      document.getElementById("mainInterface").appendChild(progressElement);
    }
  }
  progressElement.style.display = "block";
  progressElement.innerHTML = `
    <div class="progress-info">
      <span>Subiendo...</span>
      <span>0%</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" style="width: 0%"></div>
    </div>
  `;
}

function hideSpinner() {
  const progressElement = document.getElementById("uploadProgressIndicator");
  if (progressElement) {
    progressElement.style.display = "none";
  }
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => { toast.remove(); }, 3000);
}

async function getCredentials() {
  try {
    console.log("Solicitando credenciales...");
    const creds = await window.electronAPI.readCredsFile();
    console.log("Credenciales obtenidas:", creds);
    
    if (!creds || !creds.ip || !creds.session_code) {
      throw new Error("Datos inválidos en las credenciales.");
    }

    credIP = creds.ip;
    credPass = creds.session_code;
    API_BASE = `https://${credIP}:3100`;
    
    updateCredentialsDisplay();
    generateQRCodeCredentials();
    pollMobileReady();
    
    return { ip: credIP, session_code: credPass };
  } catch (error) {
    console.error("Error al leer credenciales:", error);
    alert("Error al leer las credenciales. Revisa la consola para más detalles.");
    return null;
  }
}

function updateCredentialsDisplay() {
  const ipElement = document.getElementById('serverIPDisplay');
  const passElement = document.getElementById('serverPassDisplay');
  
  if (ipElement) ipElement.textContent = credIP;
  if (passElement) passElement.textContent = credPass;
}

function generateQRCodeCredentials() {
  if (!credIP || !credPass) {
    showToast('Credenciales no cargadas', 'error');
    return;
  }
  
  const qrData = `${credIP},${credPass}`;
  const container = document.querySelector('.qr-inner-container');
  
  if (!container) {
    console.error('Contenedor QR interno no encontrado');
    return;
  }
  
  container.innerHTML = '';
  
  new QRCode(container, {
    text: qrData,
    width: 220,
    height: 220,
    colorDark: "#2F3951",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
  
  addLogoToQR(container);
}

function addLogoToQR(container) {
  setTimeout(() => {
    try {
      const logoContainer = createLogoContainer();
      const logoImg = createLogoImage();
      
      logoContainer.appendChild(logoImg);
      container.style.position = 'relative';
      container.appendChild(logoContainer);
    } catch (e) {
      console.error('Error al añadir logo al QR:', e);
    }
  }, 100);
}

function createLogoContainer() {
  const logoContainer = document.createElement('div');
  Object.assign(logoContainer.style, {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    background: 'white',
    borderRadius: '50%',
    padding: '5px',
    width: '50px',
    height: '50px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
  });
  return logoContainer;
}

function createLogoImage() {
  const logoImg = document.createElement('img');
  logoImg.src = 'assets/logo.webp';
  Object.assign(logoImg.style, {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    objectFit: 'contain'
  });
  logoImg.alt = 'Logo';
  return logoImg;
}

function pollMobileReady() {
  const intervalId = setInterval(async () => {
    try {
      const response = await fetch(API_BASE + "/areuready");
      const data = await response.json();
      if (data.ready) {
        clearInterval(intervalId);
        authenticate();
      }
    } catch (e) {
      console.error(e);
    }
  }, 3000);
}

function authenticate() {
  if (!credIP || !credPass) {
    showToast('Credenciales no cargadas', 'error');
    return;
  }
  API_BASE = `https://${credIP}:3100`;
  document.getElementById('loginSection').style.display = 'none';
  document.getElementById('mainInterface').style.display = 'flex';
  initializeMainInterface();
}

function initializeMainInterface() {
  checkServerStatus();
  setupFileUpload();
  setInterval(checkServerStatus, 50000);
  refreshFiles();
  setInterval(refreshFiles, 10000);
  showToast('Sesión iniciada');
}

async function checkServerStatus() {
  try {
    const response = await fetch(`${API_BASE}/status`);
    const data = await response.json();
    document.getElementById('status').textContent = `🟢 En línea - ${data.message}`;
  } catch {
    document.getElementById('status').textContent = '🔴 Servidor fuera de línea';
  }
}

async function refreshFiles() {
  try {
    const response = await fetch(`${API_BASE}/list-files?session_code=${credPass}`);
    const data = await response.json();
    currentFiles = data.files;
    renderFiles();
  } catch {
    showToast('Error al cargar archivos', 'error');
  }
}

function renderFiles() {
  const container = document.getElementById('filesContainer');
  container.innerHTML = currentFiles.map(file => `
    <div class="file-item">
      <div class="file-header">
        <span class="file-name">${file.name}</span>
      </div>
      <div class="file-details">
        <span><i class="bi bi-file-earmark"></i> Tipo: ${file.type}</span>
        <span><i class="bi bi-hdd"></i> ${formatFileSize(file.size)}</span>
        <span><i class="bi bi-calendar"></i> Modificado: ${file.modified}</span>
      </div>
      <div class="file-actions">
        <button class="button button-primary" onclick="downloadFile('${file.name}')">
          <i class="bi bi-download"></i>
        </button>
        <button class="button button-danger" onclick="deleteFile('${file.name}')">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    </div>
  `).join('');
}

async function downloadFile(filename) {
  try {
    const response = await fetch(`${API_BASE}/download?session_code=${credPass}&filename=${filename}`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`Descargando ${filename}`);
  } catch {
    showToast('Error al descargar archivo', 'error');
  }
}

async function deleteFile(filename) {
  if (!confirm(`¿Eliminar ${filename}?`)) return;
  try {
    await fetch(`${API_BASE}/delete?session_code=${credPass}&filename=${filename}`, { method: 'DELETE' });
    refreshFiles();
    showToast('Archivo eliminado');
  } catch {
    showToast('Error al eliminar archivo', 'error');
  }
}

function setupFileUpload() {
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', handleDragOver);
  dropZone.addEventListener('dragleave', handleDragLeave);
  dropZone.addEventListener('drop', handleDrop);
  fileInput.addEventListener('change', handleFileInputChange);
}

function handleDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove('dragover');
}

function handleDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('dragover');
  addFilesToQueue(e.dataTransfer.files);
}

function handleFileInputChange(e) {
  addFilesToQueue(e.target.files);
  e.target.value = '';
}

function addFilesToQueue(fileList) {
  for (let file of fileList) {
    filesToUpload.push(file);
  }
  updateUploadQueueUI();
}

function updateUploadQueueUI() {
  const queue = document.getElementById('uploadQueue');
  const list = document.getElementById('queueList');
  if (filesToUpload.length > 0) {
    queue.style.display = 'block';
    list.innerHTML = filesToUpload.map((file, idx) => `
      <li style="display: flex; flex-direction: column; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
        <span style="font-weight: bold;">${file.name}</span>
        <div style="display: flex; justify-content: center; gap: 10px; margin-top: 10px;">
          <button class="button button-primary small-button" onclick="uploadFileIndividual(${idx})">
            <i class="bi bi-cloud-upload"></i>
          </button>
          <button class="button button-danger small-button" onclick="removeFile(${idx})">
            <i class="bi bi-x"></i>
          </button>
        </div>
      </li>
    `).join('');
  } else {
    queue.style.display = 'none';
    list.innerHTML = '';
  }
}

function removeFile(index) {
  filesToUpload.splice(index, 1);
  updateUploadQueueUI();
}

async function uploadFileIndividual(index) {
  const file = filesToUpload[index];
  showSpinner();
  try {
    await uploadFileWithProgress(file, credPass);
    filesToUpload.splice(index, 1);
    updateUploadQueueUI();
    refreshFiles();
    showToast(`Archivo ${file.name} subido exitosamente`);
  } catch (error) {
    console.error(error);
    showToast('Error al subir el archivo', 'error');
  }
  hideSpinner();
}

async function uploadFiles() {
  if (filesToUpload.length === 0) {
    showToast('No hay archivos para subir', 'error');
    return;
  }
  showSpinner();
  try {
    const uploads = filesToUpload.map(file => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('session_code', credPass);
      return fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
    });
    await Promise.all(uploads);
    filesToUpload = [];
    updateUploadQueueUI();
    refreshFiles();
    showToast('Archivos subidos exitosamente');
  } catch {
    showToast('Error al subir archivos', 'error');
  }
  hideSpinner();
}

function uploadFileWithProgress(file, sessionCode, current, total) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();

    formData.append("file", file);
    formData.append("session_code", sessionCode);

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        updateUploadProgress(current, total, file.name, percentComplete);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Error HTTP: ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Error de red")));
    xhr.addEventListener("abort", () => reject(new Error("Subida abortada")));
    xhr.open("POST", `${API_BASE}/upload`);
    xhr.send(formData);
  });
}

function updateUploadProgress(current, total, filename, percentComplete) {
  let progressElement = document.getElementById("uploadProgressIndicator");
  if (!progressElement) {
    showSpinner();
    progressElement = document.getElementById("uploadProgressIndicator");
  }
  
  progressElement.innerHTML = `
    <div class="progress-info">
      <span>Archivo ${current}/${total}: ${filename}</span>
      <span>${percentComplete}%</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" style="width: ${percentComplete}%"></div>
    </div>
  `;
}

async function shutdown() {
  if (!confirm('¿Seguro que deseas apagar el servidor?')) return;
  try {
    await fetch(`${API_BASE}/shutdown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `session_code=${credPass}`
    });
    showToast('Servidor se apagará en 1 segundo');
  } catch {
    showToast('Error al apagar servidor', 'error');
  }
}

function openFilesFolder() {
  window.electronAPI.openFolder()
    .then(() => {
      showToast('Carpeta abierta correctamente');
    })
    .catch(err => {
      console.error('Error al abrir la carpeta:', err);
      showToast('Error al abrir la carpeta', 'error');
    });
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log("Página cargada, obteniendo credenciales...");
  await getCredentials();
});

window.addEventListener("beforeunload", () => {
    if (credPass && API_BASE) {
      const shutdownURL = `${API_BASE}/shutdown`;
      const data = new URLSearchParams();
      data.append("session_code", credPass);
      const blobData = new Blob([data.toString()], { type: 'application/x-www-form-urlencoded' });
      navigator.sendBeacon(shutdownURL, blobData);
    }
  });