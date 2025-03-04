const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { exec } = require('child_process');
const QRCode = require('qrcode');

let apiProcess;

const certPath = path.join(__dirname, 'certs', 'cert.crt');
const keyPath = path.join(__dirname, 'certs', 'cert.key');

if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
  console.error('No se encontraron los certificados SSL en la ruta especificada.');
  app.quit();
  return;
}

const basePath = app.isPackaged ? path.dirname(process.execPath) : __dirname;

function startAPI() {
  let apiExePath;

  if (app.isPackaged) {
    apiExePath = path.join(process.resourcesPath, '..', 'api.exe');
  } else {
    apiExePath = path.join(__dirname, 'api.exe');
  }

  if (!fs.existsSync(apiExePath)) {
    console.log('api.exe no encontrado, asegurate de que este en la ubicacion correcta.');
    return;
  }

  apiProcess = exec(apiExePath, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error al iniciar api.exe: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`stderr: ${stderr}`);
      return;
    }
    console.log(`stdout: ${stdout}`);
  });
}

function pollAPIStatus(url, interval = 1000, maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempt = 0;
    const check = () => {
      attempt++;
      const urlObj = new URL(url);
      const options = urlObj.protocol === "https:" 
        ? { agent: new https.Agent({ rejectUnauthorized: false }) } 
        : {};
      const getMethod = urlObj.protocol === "https:" ? https.get : http.get;
      getMethod(url, options, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          if (attempt >= maxAttempts) {
            reject(new Error('La API no respondió con status 200 tras varios intentos.'));
          } else {
            setTimeout(check, interval);
          }
        }
      }).on('error', (err) => {
        if (attempt >= maxAttempts) {
          reject(new Error('Error al conectarse a la API: ' + err.message));
        } else {
          setTimeout(check, interval);
        }
      });
    };
    check();
  });
}

function generateQRCode() {
  const credsPath = path.join(basePath, 'temp_creds.json');
  console.log('Generando QR leyendo credenciales desde:', credsPath);
  fs.readFile(credsPath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error leyendo el archivo de credenciales:', err);
      return;
    }
    try {
      const jsonData = JSON.parse(data);
      const qrData = `ip: ${jsonData.ip}, session_code: ${jsonData.session_code}`;
      QRCode.toDataURL(qrData, (err, url) => {
        if (err) {
          console.error('Error generando QR:', err);
          return;
        }
      });
    } catch (e) {
      console.error('Error parseando el archivo de credenciales:', e);
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    x: 0,
    y: 0,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
    },
    autoHideMenuBar: true,
    backgroundColor: "#000",
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    show: false,
  });

  win.maximize();
  win.loadFile('server.html');
  win.once('ready-to-show', () => {
    win.show();
  });
}

ipcMain.handle('read-creds-file', async () => {
  const filePath = path.join(basePath, 'temp_creds.json');

  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const data = await fs.promises.readFile(filePath, 'utf8');
      const jsonData = JSON.parse(data);
      return { ip: jsonData.ip, session_code: jsonData.session_code };
    } catch (error) {
      console.error(`Error en intento ${attempt}:`, error);
      if (attempt === maxAttempts) {
        throw new Error('Error al leer el archivo después de 5 intentos');
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
});

ipcMain.handle('open-folder', async () => {
  const computedApiExePath = app.isPackaged 
    ? path.join(process.resourcesPath, '..', 'api.exe')
    : path.join(__dirname, 'api.exe');
  const folderPath = path.join(path.dirname(computedApiExePath), 'f_folder');
  const result = await shell.openPath(folderPath);
  if (result) {
    console.error('Error al abrir la carpeta:', result);
    throw new Error(result);
  }
  return true;
});

try {
  const credsPath = path.join(basePath, 'temp_creds.json');
  const fileExists = fs.existsSync(credsPath);
  if (fileExists) {
    const fileContent = fs.readFileSync(credsPath, 'utf8');
  }
} catch (error) {
  console.error('Error al verificar el archivo:', error);
}

app.commandLine.appendSwitch('ignore-certificate-errors');

app.whenReady().then(async () => {
  console.log("Aplicacion iniciada, arrancando API...");
  startAPI(); 

  try {
    await pollAPIStatus("https://localhost:3100/status");
    console.log("API operativa en /status");
    generateQRCode();
    createWindow();
  } catch (error) {
    console.error("Error al comunicarse con la API:", error);
    app.quit();
  }

  https.createServer({
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath),
  }, (req, res) => {
    res.writeHead(200);
    res.end('W_F_D Online');
  }).listen(3100, () => {
  });
});
