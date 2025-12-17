const { app, BrowserWindow, session, ipcMain, desktopCapturer, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const url = require('url');

let win;
let splash;

const imageToDataUrl = (image) => {
  if (!image || image.isEmpty()) {
    return null;
  }

  try {
    return image.toDataURL();
  } catch (error) {
    console.error('[Electron main] Failed to convert nativeImage to data URL', error);
    return null;
  }
};

function registerDesktopCapturerHandler() {
  ipcMain.handle('desktop-capturer-get-sources', async (_event, options = {}) => {
    const {
      types = ['screen', 'window'],
      thumbnailSize = { width: 480, height: 270 },
      fetchWindowIcons = true,
    } = options ?? {};

    try {
      const sources = await desktopCapturer.getSources({
        types,
        thumbnailSize,
        fetchWindowIcons,
      });

      return sources.map((source) => ({
        id: source.id,
        name: source.name,
        type: source.id.startsWith('screen:') ? 'screen' : 'window',
        displayId: source.display_id ?? null,
        thumbnail: imageToDataUrl(source.thumbnail),
        appIcon: imageToDataUrl(source.appIcon),
      }));
    } catch (error) {
      console.error('[Electron main] Failed to fetch screen sources', error);
      throw error;
    }
  });
}

function createSplashWindow() {
  splash = new BrowserWindow({
    width: 500,
    height: 400,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    icon: path.join(__dirname, 'public/logo/logo-icon.svg'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  splash.loadFile(path.join(__dirname, 'splash.html'));
  splash.setResizable(false);

  // Для дебага (раскомментируй если нужно)
  // splash.webContents.openDevTools();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'public/logo/logo-icon.svg'),
    show: false, // Не показываем сразу, покажем после загрузки
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    autoHideMenuBar: true, // Hide the menu bar
  });

  // Обработка внешних ссылок (target="_blank")
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Обработка навигации внутри окна
  win.webContents.on('will-navigate', (event, navigationUrl) => {
    // Разрешаем навигацию только по локальным путям или dev-server
    const isDev = process.argv.includes('--dev');
    const isLocal = isDev
      ? navigationUrl.startsWith('http://localhost:4200')
      : navigationUrl.startsWith('file://');

    if (!isLocal && (navigationUrl.startsWith('http:') || navigationUrl.startsWith('https:'))) {
      event.preventDefault();
      shell.openExternal(navigationUrl);
    }
  });

  // Check if we are in development mode
  const isDev = process.argv.includes('--dev');

  if (isDev) {
    win.loadURL('http://localhost:4200');
    win.webContents.openDevTools();
  } else {
    // Path to the Angular build output
    win.loadFile(path.join(__dirname, 'dist/frontend/browser/index.html'));
  }

  // Показываем основное окно когда оно готово
  win.once('ready-to-show', () => {
    setTimeout(() => {
      if (splash && !splash.isDestroyed()) {
        splash.close();
      }
      win.show();
    }, 500);
  });

  win.on('closed', () => {
    win = null;
  });

  // Check for updates
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }
}

// Настройка перехвата запросов для работы Cookies и CORS в Electron
function setupSessionInterceptors() {
  const filter = {
    urls: ['http://localhost:3000/*'] // URL вашего API
  };

  // 1. Подмена Origin для обхода CORS на бэкенде (backend ожидает localhost:4200 или пусто)
  // Это нужно, так как файл с диска (file://) отправляет Origin: file://
  session.defaultSession.webRequest.onBeforeSendHeaders(filter, (details, callback) => {
    details.requestHeaders['Origin'] = 'http://localhost:4200';
    // Добавляем секретный заголовок для защиты от CSRF
    details.requestHeaders['X-App-Source'] = 'twine-client';
    callback({ requestHeaders: details.requestHeaders });
  });

  // 2. Исправление Cookies (SameSite)
  // Electron считает file:// и localhost разными сайтами, поэтому SameSite=Lax куки не отправляются.
  // Мы принудительно меняем их на SameSite=None; Secure
  session.defaultSession.webRequest.onHeadersReceived(filter, (details, callback) => {
    if (details.responseHeaders) {
      // Копируем заголовки, чтобы можно было изменять
      const newHeaders = { ...details.responseHeaders };

      // Обработка Set-Cookie
      // Заголовки могут приходить в разном регистре (Set-Cookie или set-cookie)
      const setCookieKey = Object.keys(newHeaders).find(k => k.toLowerCase() === 'set-cookie');

      if (setCookieKey) {
        newHeaders[setCookieKey] = newHeaders[setCookieKey].map(cookie => {
          // Удаляем существующие атрибуты SameSite, чтобы не дублировать
          let newCookie = cookie.replace(/; SameSite=Lax/gi, '');
          newCookie = newCookie.replace(/; SameSite=Strict/gi, '');
          newCookie = newCookie.replace(/; SameSite=None/gi, '');
          newCookie = newCookie.replace(/; Secure/gi, ''); // Удаляем Secure чтобы добавить его гарантированно
          
          // Добавляем нужные для Cross-Origin (Electron File -> Localhost)
          // Localhost считается Secure контекстом, поэтому Secure флаг допустим даже на http
          return newCookie + '; SameSite=None; Secure';
        });
      }
      
      callback({ responseHeaders: newHeaders });
    } else {
      callback({ responseHeaders: details.responseHeaders });
    }
  });
}

app.on('ready', () => {
  registerDesktopCapturerHandler();
  setupSessionInterceptors();
  createSplashWindow();

  // Создаем основное окно после небольшой задержки
  setTimeout(() => {
    createWindow();
  }, 1000);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (win === null) {
    createWindow();
  }
});

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...');
  if (splash && !splash.isDestroyed()) {
    splash.webContents.send('checking-for-update');
  }
});

autoUpdater.on('update-available', (info) => {
  console.log('Update available.');
  if (splash && !splash.isDestroyed()) {
    splash.webContents.send('update-available', info);
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('Update not available.');
  if (splash && !splash.isDestroyed()) {
    splash.webContents.send('update-not-available', info);
  }
});

autoUpdater.on('error', (err) => {
  console.log('Error in auto-updater. ' + err);
  if (splash && !splash.isDestroyed()) {
    // Не показываем ошибку пользователю, просто продолжаем загрузку
    // как будто обновлений нет
    splash.webContents.send('update-not-available');
  }
});

autoUpdater.on('download-progress', (progressObj) => {
  let log_message = 'Download speed: ' + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + '/' + progressObj.total + ')';
  console.log(log_message);

  if (splash && !splash.isDestroyed()) {
    splash.webContents.send('download-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('Update downloaded');
  if (splash && !splash.isDestroyed()) {
    splash.webContents.send('update-downloaded', info);
  }

  // Устанавливаем обновление после небольшой задержки
  setTimeout(() => {
    autoUpdater.quitAndInstall();
  }, 2000);
});
