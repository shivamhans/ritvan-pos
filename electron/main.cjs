const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const crypto = require('node:crypto');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const { createRequire } = require('node:module');
const { autoUpdater } = require('electron-updater');

let mainWindow = null;
let apiServer = null;
let shutdownApi = null;
let idleTimer = null;
let lastSafeToUpdate = false;
let preferences = { autoInstallWhenIdle: false };
let updaterState = {
  supported: false, status: 'idle', currentVersion: app.getVersion(),
  availableVersion: null, percent: 0,
  message: 'Updates are checked securely through GitHub Releases.',
  error: null, autoInstallWhenIdle: false,
};
const UPDATE_IDLE_MS = 10 * 60 * 1000;

function publishState(patch = {}) {
  updaterState = { ...updaterState, ...patch, currentVersion: app.getVersion(), autoInstallWhenIdle: preferences.autoInstallWhenIdle };
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('ritvan-updater:state', updaterState);
  }
}
function preferencesPath() { return path.join(app.getPath('userData'), 'update-preferences.json'); }
async function loadPreferences() {
  try {
    const parsed = JSON.parse(await fs.readFile(preferencesPath(), 'utf8'));
    preferences.autoInstallWhenIdle = parsed.autoInstallWhenIdle === true;
  } catch { preferences.autoInstallWhenIdle = false; }
  updaterState.autoInstallWhenIdle = preferences.autoInstallWhenIdle;
}
async function savePreferences() {
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  const file = preferencesPath(), temp = file + '.tmp';
  await fs.writeFile(temp, JSON.stringify(preferences, null, 2), { mode: 0o600 });
  await fs.rename(temp, file);
}
async function ensureEnvironment() {
  const userData = app.getPath('userData');
  await fs.mkdir(userData, { recursive: true });
  const envPath = path.join(userData, '.env');
  try { await fs.access(envPath); }
  catch {
    let example = await fs.readFile(path.join(app.getAppPath(), 'server', '.env.example'), 'utf8');
    example = example.replace(/^HOST=.*$/m, 'HOST=0.0.0.0')
      .replace(/^LAN_ACCESS=.*$/m, 'LAN_ACCESS=true')
      .replace(/^JWT_SECRET=.*$/m, 'JWT_SECRET=' + crypto.randomBytes(48).toString('hex'));
    await fs.writeFile(envPath, example, { mode: 0o600 });
    const choice = await dialog.showMessageBox({
      type: 'info', title: 'Finish Ritvan POS setup',
      message: 'Ritvan POS needs your local MySQL connection settings.',
      detail: 'A private configuration file has been created. Open the configuration folder and set DB_USER, DB_PASSWORD and DB_NAME if needed. Updates never replace this file.',
      buttons: ['Open configuration folder', 'Continue'], defaultId: 0, cancelId: 1,
    });
    if (choice.response === 0) await shell.openPath(userData);
  }
  process.env.RITVAN_ENV_PATH = envPath;
  process.env.NODE_ENV = 'production';
  const serverRequire = createRequire(path.join(app.getAppPath(), 'server', 'package.json'));
  serverRequire('dotenv').config({ path: envPath, override: false });
  process.env.HOST = '0.0.0.0';
  process.env.LAN_ACCESS = 'true';
  process.env.CLIENT_ORIGIN = 'null';
  process.env.RITVAN_SCHEMA_PATH = path.join(app.getAppPath(), 'database', 'schema.sql');
  process.env.RITVAN_DESKTOP = 'true';
  process.env.RITVAN_ENV_PATH = envPath;
  process.env.RITVAN_BACKUP_DIR = path.join(userData, 'database-backups');
}
async function runDatabaseMigrations() {
  const file = path.join(app.getAppPath(), 'server', 'src', 'migrations', 'runner.js');
  const runner = await import(pathToFileURL(file).href);
  await runner.runPendingMigrations();
}
async function startApi() {
  const file = path.join(app.getAppPath(), 'server', 'src', 'index.js');
  const serverModule = await import(pathToFileURL(file).href);
  apiServer = serverModule.server;
  shutdownApi = serverModule.shutdown;
  const url = 'http://127.0.0.1:' + Number(process.env.PORT || 4001) + '/api/health';
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try { const response = await fetch(url); if (response.ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('The local Ritvan API did not start at ' + url);
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1024, minHeight: 680,
    backgroundColor: '#0b0711', show: false, autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
    },
  });
  mainWindow.once('ready-to-show', () => mainWindow && mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.loadFile(path.join(app.getAppPath(), 'client', 'dist', 'index.html'));
}
function clearIdleInstallTimer() { if (idleTimer) clearTimeout(idleTimer); idleTimer = null; }
function scheduleIdleInstall() {
  clearIdleInstallTimer();
  if (!preferences.autoInstallWhenIdle || updaterState.status !== 'downloaded' || !lastSafeToUpdate) return;
  idleTimer = setTimeout(() => {
    if (preferences.autoInstallWhenIdle && updaterState.status === 'downloaded' && lastSafeToUpdate) {
      publishState({ status: 'installing', message: 'Installing the downloaded update after an idle period…' });
      autoUpdater.quitAndInstall(false, true);
    }
  }, UPDATE_IDLE_MS);
}
function setupUpdater() {
  updaterState.supported = app.isPackaged;
  if (!app.isPackaged) {
    publishState({ status: 'idle', message: 'Automatic updates are available in the installed desktop build.' });
    return;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = preferences.autoInstallWhenIdle;
  autoUpdater.allowDowngrade = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.on('checking-for-update', () => publishState({ status: 'checking', error: null, message: 'Checking GitHub Releases for a newer version…' }));
  autoUpdater.on('update-available', info => publishState({ status: 'downloading', availableVersion: info.version, percent: 0, error: null, message: 'A new version is available. Downloading it securely…' }));
  autoUpdater.on('update-not-available', info => publishState({ status: 'up-to-date', availableVersion: info?.version || null, percent: 100, error: null, message: 'Ritvan POS is up to date.' }));
  autoUpdater.on('download-progress', progress => publishState({ status: 'downloading', percent: Math.max(0, Math.min(100, Math.round(progress.percent || 0))), message: 'Downloading update… ' + Math.round(progress.percent || 0) + '%' }));
  autoUpdater.on('update-downloaded', info => {
    publishState({ status: 'downloaded', availableVersion: info.version, percent: 100, error: null, message: 'Update downloaded and verified. Install now or let it install after the workspace is idle.' });
    scheduleIdleInstall();
  });
  autoUpdater.on('error', error => {
    clearIdleInstallTimer();
    publishState({ status: 'error', error: String(error?.message || error).slice(0, 500), message: 'Update check failed. Ritvan POS will continue using the installed version.' });
  });
  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 8000);
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 6 * 60 * 60 * 1000);
}
function getLanAddresses() {
  const port = Number(process.env.PORT || 4001);
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if ((entry.family === 'IPv4' || entry.family === 4) && !entry.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(entry.address)) addresses.push({ ip: entry.address, url: 'http://' + entry.address + ':' + port });
    }
  }
  return { port, addresses };
}
ipcMain.handle('ritvan-network:get-info', () => getLanAddresses());
ipcMain.handle('ritvan-updater:get-state', () => ({ ...updaterState, supported: app.isPackaged, currentVersion: app.getVersion(), autoInstallWhenIdle: preferences.autoInstallWhenIdle }));
ipcMain.handle('ritvan-updater:check', async () => {
  if (!app.isPackaged) return { ...updaterState, supported: false };
  try { await autoUpdater.checkForUpdates(); }
  catch (error) { publishState({ status: 'error', error: String(error?.message || error).slice(0, 500), message: 'Could not check for updates.' }); }
  return { ...updaterState };
});
ipcMain.handle('ritvan-updater:install', async () => {
  if (!app.isPackaged || updaterState.status !== 'downloaded') return false;
  clearIdleInstallTimer();
  publishState({ status: 'installing', message: 'Closing Ritvan POS to install the update…' });
  setTimeout(() => autoUpdater.quitAndInstall(false, true), 250);
  return true;
});
ipcMain.handle('ritvan-updater:set-auto-install', async (_event, enabled) => {
  preferences.autoInstallWhenIdle = enabled === true;
  await savePreferences();
  autoUpdater.autoInstallOnAppQuit = preferences.autoInstallWhenIdle;
  if (preferences.autoInstallWhenIdle) scheduleIdleInstall(); else clearIdleInstallTimer();
  publishState({ autoInstallWhenIdle: preferences.autoInstallWhenIdle });
  return { autoInstallWhenIdle: preferences.autoInstallWhenIdle };
});
ipcMain.handle('ritvan-updater:report-activity', (_event, payload) => {
  lastSafeToUpdate = payload?.safeToUpdate === true;
  if (lastSafeToUpdate) scheduleIdleInstall(); else clearIdleInstallTimer();
  return true;
});

app.whenReady().then(async () => {
  try {
    await loadPreferences();
    await ensureEnvironment();
    await runDatabaseMigrations();
    await startApi();
    setupUpdater();
    createWindow();
  } catch (error) {
    dialog.showErrorBox('Ritvan POS could not start safely', String(error?.stack || error).slice(0, 3500) + '\n\nYour database has not been intentionally reset. Check MySQL configuration and database-backup tools, then try again.');
    app.quit();
  }
});
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0 && app.isReady()) createWindow(); });
app.on('before-quit', () => {
  clearIdleInstallTimer();
  try { if (shutdownApi) shutdownApi(); else if (apiServer) apiServer.close(); } catch {}
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
