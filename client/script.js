let API_BASE = ""
let currentFiles = []
let filesToUpload = []
let html5QrcodeScanner
let serverOnline = false  

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B"
  else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
  else if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  else return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB"
}

function showSpinner() {
  const spinner = document.getElementById("spinner")
  if (spinner) {
    spinner.style.display = "block"
  }
}

function hideSpinner() {
  const spinner = document.getElementById("spinner")
  if (spinner) {
    spinner.style.display = "none"
  }
}

function showToast(message, type = "info") {
  const toast = document.createElement("div")
  toast.className = `toast ${type}`
  toast.textContent = message
  document.body.appendChild(toast)
  setTimeout(() => {
    toast.remove()
  }, 3000)
}

function authenticate() {
  const ip = document.getElementById("serverIP").value.trim();
  const session_code = document.getElementById("serverPass").value.trim();
  
  if (!ip || !session_code) {
    showToast("Ingresa la IP y la contraseña", "error");
    return;
  }

  localStorage.setItem("winflydroidCreds", JSON.stringify({ ip, session_code }));

  API_BASE = `https://${ip}:3100`;
  
  document.getElementById("loginSection").style.display = "none";
  document.getElementById("mainInterface").style.display = "flex";
  
  checkServerStatus();
  setupFileUpload();
  
  setInterval(checkServerStatus, 50000);
  refreshFiles();
  setInterval(refreshFiles, 5000);
  
  showToast("Sesión iniciada");
}

async function monitoredFetch(url, options) {
  let errorMsg = "";
  const originalConsoleError = console.error;
  console.error = function(...args) {
    errorMsg += args.join(" ") + " ";
    originalConsoleError.apply(console, args);
  };
  try {
    const response = await fetch(url, options);
    return { response, errorMsg };
  } catch (error) {
    console.error(error.toString());
    return { error, errorMsg };
  } finally {
    console.error = originalConsoleError;
  }
}

async function sendReady(sessionCode) {
  console.log("sendReady called with sessionCode:", sessionCode);
  const formData = new FormData();
  formData.append("session_code", sessionCode);
  
  try {
    const response = await fetch(`${API_BASE}/imready`, {
      method: "POST",
      body: formData,
    });
    
    console.log("Response from /imready:", response);
    const result = await response.json();
    console.log("Response JSON:", result);
    
    if (response.ok) {
      showToast("Móvil listo: " + result.message);
      authenticate();
    } else {
      showToast("Error: " + result.detail, "error");
      localStorage.removeItem("winflydroidCreds");
      document.getElementById("loginSection").style.display = "block";
      document.getElementById("mainInterface").style.display = "none";
      startQRScanner();
    }
  } catch (error) {
    console.error("Error al notificar /imready:", error);
    if (
      error && 
      error.toString() && 
      (error.toString().includes("refused") || error.toString().includes("Failed to fetch"))
    ) {
      showToast("Error al conectarse con el servidor, intenta nuevamente", "error");
      localStorage.removeItem("winflydroidCreds");
      document.getElementById("loginSection").style.display = "block";
      document.getElementById("mainInterface").style.display = "none";
      startQRScanner();
      return;
    }
    
    try {
      const img = new Image();
      let certificateError = false;
      let connectionError = true;
      
      img.onload = function() {
        connectionError = false;
      };
      
      img.onerror = function() {
        certificateError = true;
        connectionError = false;
      };
      
      img.src = `${API_BASE}/favicon.ico?t=${new Date().getTime()}`;
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (!connectionError && certificateError) {
        mostrarModalCertificado();
      } else {
        showToast("Error al conectarse con el servidor, intenta nuevamente", "error");
        localStorage.removeItem("winflydroidCreds");
        document.getElementById("loginSection").style.display = "block";
        document.getElementById("mainInterface").style.display = "none";
        startQRScanner();
      }
    } catch (e) {
      showToast("Error al conectarse con el servidor, intenta nuevamente", "error");
      localStorage.removeItem("winflydroidCreds");
      document.getElementById("loginSection").style.display = "block";
      document.getElementById("mainInterface").style.display = "none";
      startQRScanner();
    }
  }
}


function mostrarModalCertificado() {
  Swal.fire({
    icon: 'warning',
    title: 'Problema de certificado',
    background: 'linear-gradient(135deg, #2f3951, #55687a)',
    html: `
      <div style="font-family: 'Roboto', sans-serif; color: #f0f0f0;">
        <p>Se ha detectado un problema al conectar con WinFlyDroid Server.</p>
        <p>Para continuar, sigue estos pasos y acepta manualmente el certificado:</p>
        <ol style="text-align: left; margin: 1rem 0; padding-left: 1.2rem;">
          <li>Presiona en el botón "Entendido, aceptar certificado".\n</li>
          <li>Cuando aparezca el aviso de seguridad, haz clic en "Opciones avanzadas".\n</li>
          <li>Selecciona "Continuar de todos modos".\n</li>
          <li>Finalmente, haz clic en "Regresar a WinFlyDroid".\n</li>
          <li>Listo ya podras conectarte con normalidad.".\n</li>
        </ol>
        <!-- Aquí se muestran los botones antes de la sección de demostración -->
        <div style="margin-bottom: 1rem;">
          <button id="swal-confirm" class="swal2-confirm swal2-styled">Entendido, ir para aceptar el certificado</button>
          <button id="swal-cancel" class="swal2-cancel swal2-styled">Cancelar</button>
        </div>
        <p>¿No sabes cómo hacerlo? \n</p>
        <p>Aquí tienes una demostración gráfica de cómo manejar el error:</p>
        <img src="assets/accept_certificate.gif" alt="Tutorial de certificado" style="width:100%; max-width:400px; margin-top: 1rem; border-radius: 8px;">
      </div>
    `,
    showConfirmButton: false,
    showCancelButton: false,
    allowOutsideClick: false,
    didRender: () => {
      document.getElementById('swal-confirm').addEventListener('click', () => {
        window.location.href = `${API_BASE}/accepted`;
      });
      document.getElementById('swal-cancel').addEventListener('click', () => {
        Swal.close();
      });
    }
  });
}

function processQRData(qrData) {
  console.log("QR data procesado:", qrData)
  const parts = qrData.split(",")
  let pass = ""
  if (parts.length === 2) {
    const ip = parts[0].trim()
    pass = parts[1].trim()
    document.getElementById("serverIP").value = ip
    document.getElementById("serverPass").value = pass
    API_BASE = `https://${ip}:3100`
    showToast("Datos del QR recibidos")
  } else {
    pass = qrData.trim()
    document.getElementById("serverPass").value = pass
    showToast("Código de contraseña recibido")
  }
  stopQRScanner()
  sendReady(pass)
}

async function checkServerStatus() {
  try {
    const response = await fetch(`${API_BASE}/status`);
    if (!response.ok) throw new Error("Servidor no responde correctamente");
    const data = await response.json();
    serverOnline = true;
    document.getElementById("status").textContent = `🟢 En línea - ${data.message}`;
  } catch (error) {
    serverOnline = false;
    localStorage.removeItem("winflydroidCreds");
    document.getElementById("loginSection").style.display = "block";
    document.getElementById("mainInterface").style.display = "none";
    document.getElementById("status").textContent = "🔴 Servidor fuera de línea";
    showToast("El servidor se ha desconectado. Sesión cerrada.", "error");
    startQRScanner();
  }
}

async function refreshFiles() {
  const pass = document.getElementById("serverPass").value
  try {
    const response = await fetch(`${API_BASE}/list-files?session_code=${pass}`)
    const data = await response.json()
    currentFiles = data.files
    renderFiles()
  } catch {
    showToast("Error al cargar archivos", "error")
  }
}

function renderFiles() {
  const container = document.getElementById("filesContainer")
  container.innerHTML = currentFiles
    .map(
      (file) => `
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
  `,
    )
    .join("")
}

function downloadFileWithProgress(filename, sessionCode) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.responseType = "blob";
    xhr.open("GET", `${API_BASE}/download?session_code=${sessionCode}&filename=${filename}`);

    xhr.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        updateDownloadProgress(filename, percentComplete);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        updateDownloadProgress(filename, 100);
        const blob = xhr.response;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        resolve();
      } else {
        reject(new Error(`HTTP error: ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.addEventListener("abort", () => reject(new Error("Download aborted")));
    xhr.send();
  });
}

function updateDownloadProgress(filename, percentComplete) {
  let progressElement = document.getElementById("downloadProgressIndicator");
  if (!progressElement) {
    progressElement = document.createElement("div");
    progressElement.id = "downloadProgressIndicator";
    progressElement.className = "upload-progress";
    document.getElementById("mainInterface").appendChild(progressElement);
  }
  
  progressElement.innerHTML = `
    <div class="progress-info">
      <span>${filename}</span>
      <span>${percentComplete}%</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" style="width: ${percentComplete}%"></div>
    </div>
  `;
  progressElement.style.display = "block";

  if (percentComplete === 100) {
    setTimeout(() => {
      progressElement.style.display = "none";
    }, 2000);
  }
}

async function downloadFile(filename) {
  const pass = document.getElementById("serverPass").value;
  try {
    await downloadFileWithProgress(filename, pass);
    showToast(`Descargando ${filename}`);
  } catch (error) {
    showToast("Error al descargar archivo", "error");
  }
}

async function deleteFile(filename) {
  if (!confirm(`¿Eliminar ${filename}?`)) return
  const pass = document.getElementById("serverPass").value
  try {
    await fetch(`${API_BASE}/delete?session_code=${pass}&filename=${filename}`, { method: "DELETE" })
    refreshFiles()
    showToast("Archivo eliminado")
  } catch {
    showToast("Error al eliminar archivo", "error")
  }
}

function setupFileUpload() {
  const dropZone = document.getElementById("dropZone")
  const fileInput = document.getElementById("fileInput")
  dropZone.addEventListener("click", () => fileInput.click())
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault()
    dropZone.classList.add("dragover")
  })
  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover")
  })
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault()
    dropZone.classList.remove("dragover")
    addFilesToQueue(e.dataTransfer.files)
  })
  fileInput.addEventListener("change", () => {
    addFilesToQueue(fileInput.files)
    fileInput.value = ""
  })
}

function addFilesToQueue(fileList) {
  for (const file of fileList) {
    filesToUpload.push(file)
  }
  updateUploadQueueUI()
}

function updateUploadQueueUI() {
  const queue = document.getElementById("uploadQueue")
  const list = document.getElementById("queueList")
  if (filesToUpload.length > 0) {
    queue.style.display = "block"
    list.innerHTML = filesToUpload
      .map(
        (file, idx) => `
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
    `,
      )
      .join("")
  } else {
    queue.style.display = "none"
    list.innerHTML = ""
  }
}

function removeFile(index) {
  filesToUpload.splice(index, 1)
  updateUploadQueueUI()
}

async function uploadFiles() {
  if (filesToUpload.length === 0) {
    showToast("No hay archivos para subir", "error")
    return
  }

  const pass = document.getElementById("serverPass").value
  showSpinner()
  document.getElementById("status").textContent = `⏳ Subiendo ${filesToUpload.length} archivos...`

  try {
    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i]
      document.getElementById("status").textContent =
        `⏳ Subiendo archivo ${i + 1}/${filesToUpload.length}: ${file.name}`
      await uploadFileWithProgress(file, pass, i + 1, filesToUpload.length)
    }

    filesToUpload = []
    updateUploadQueueUI()
    refreshFiles()
    showToast("Todos los archivos subidos exitosamente")
    checkServerStatus()
  } catch (error) {
    console.error("Error de subida:", error)
    showToast("Error al subir archivos", "error")
    checkServerStatus()
  }
  hideSpinner()
}

function uploadFileWithProgress(file, sessionCode, current, total) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const formData = new FormData()

    formData.append("file", file)
    formData.append("session_code", sessionCode)

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percentComplete = Math.round((event.loaded / event.total) * 100)
        updateUploadProgress(current, total, file.name, percentComplete)
      }
    })

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`Error HTTP: ${xhr.status}`))
      }
    })

    xhr.addEventListener("error", () => reject(new Error("Error de red")))
    xhr.addEventListener("abort", () => reject(new Error("Subida abortada")))
    xhr.open("POST", `${API_BASE}/upload`)
    xhr.send(formData)
  })
}

function updateUploadProgress(current, total, filename, percentComplete) {
  let progressElement = document.getElementById("uploadProgressIndicator")
  if (!progressElement) {
    progressElement = document.createElement("div")
    progressElement.id = "uploadProgressIndicator"
    progressElement.className = "upload-progress"
    document.getElementById("mainInterface").appendChild(progressElement)
  }

  progressElement.innerHTML = `
    <div class="progress-info">
      <span>Archivo ${current}/${total}</span>
      <span>${percentComplete}%</span>
    </div>
    <div class="progress-info">
      <span>${filename}</span>
    </div>
    <div class="progress-bar">
      <div class="progress-fill" style="width: ${percentComplete}%"></div>
    </div>
  `
  progressElement.style.display = "block"

  if (percentComplete === 100) {
    showToast(`Archivo ${current}/${total} subido: ${filename}`)
    if (current === total) {
      setTimeout(() => {
        progressElement.style.display = "none"
      }, 2000)
    }
  }
}

async function uploadFileIndividual(index) {
  const file = filesToUpload[index]
  const pass = document.getElementById("serverPass").value
  showSpinner()
  document.getElementById("status").textContent = `⏳ Subiendo archivo: ${file.name}`

  try {
    await uploadFileWithProgress(file, pass, 1, 1)
    filesToUpload.splice(index, 1)
    updateUploadQueueUI()
    refreshFiles()
    showToast(`Archivo ${file.name} subido exitosamente`)
    checkServerStatus()
  } catch (error) {
    console.error("Error de subida:", error)
    showToast("Error al subir el archivo", "error")
    checkServerStatus()
  }
  hideSpinner()
}

async function shutdown() {
  if (!confirm("¿Seguro que deseas apagar el servidor?")) return
  const pass = document.getElementById("serverPass").value
  try {
    await fetch(`${API_BASE}/shutdown`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `session_code=${pass}`,
    })
    showToast("Servidor se apagará en 1 segundo")
  } catch {
    showToast("Error al apagar servidor", "error")
  }
}

function startQRScanner() {
  document.getElementById("qrScannerContainer").style.display = "block"
  html5QrcodeScanner = new Html5Qrcode("qr-reader")
  const config = { fps: 10, qrbox: 250 }
  html5QrcodeScanner
    .start(
      { facingMode: "environment" },
      config,
      (qrCodeMessage) => { processQRData(qrCodeMessage) },
      (errorMessage) => { console.warn("QR scanning error:", errorMessage) },
    )
    .catch((err) => {
      console.error("Unable to start scanning:", err)
      showToast("Error al iniciar escáner", "error")
    })
}

function stopQRScanner() {
  if (html5QrcodeScanner) {
    html5QrcodeScanner
      .stop()
      .then(() => {
        html5QrcodeScanner.clear()
        document.getElementById("qrScannerContainer").style.display = "none"
      })
      .catch((err) => {
        console.error("Error stopping QR scanner:", err)
      })
  } else {
    document.getElementById("qrScannerContainer").style.display = "none"
  }
}

function manualLogin() {
  const ip = document.getElementById("serverIP").value.trim()
  const pass = document.getElementById("serverPass").value.trim()
  if (!ip || !pass) {
    showToast("Ingresa la IP y la contraseña", "error")
    return
  }
  API_BASE = `https://${ip}:3100`
  sendReady(pass)
}

function showProgressBar() {
  const progressBar = document.querySelector('.upload-progress');
  if (progressBar) progressBar.style.display = 'none';
}

function hideProgressBar() {
  const progressBar = document.querySelector('.upload-progress');
  if (progressBar) progressBar.style.display = 'none';
}

document.addEventListener("DOMContentLoaded", () => {
  const stored = localStorage.getItem("winflydroidCreds");
  if (stored) {
    const { ip, session_code } = JSON.parse(stored);
    document.getElementById("serverIP").value = ip;
    document.getElementById("serverPass").value = session_code;
    sendReady(session_code);
  }
  
  hideSpinner();
  setTimeout(() => {
    const spinner = document.getElementById("spinner");
    if (spinner && spinner.style.display === "block") {
      hideSpinner();
    }
  }, 1000);
});

function solicitarPermisoNotificacion() {
  if ("Notification" in window) {
      Notification.requestPermission().then((permiso) => {
          if (permiso === "granted") {
              mostrarNotificacion("Instala WinFlyDroid", "Haz clic aquí para instalar la app.");
          }
      });
  }
}

function mostrarNotificacion(titulo, mensaje) {
  if (Notification.permission === "granted") {
      new Notification(titulo, {
          body: mensaje,
          icon: "assets/icon.png", 
      });
  }
}
document.getElementById("notify-button").addEventListener("click", () => {
  solicitarPermisoNotificacion();
});