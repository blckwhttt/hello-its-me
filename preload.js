const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
  getScreenSources: async (options = {}) => {
    const {
      types = ['screen', 'window'],
      thumbnailSize = { width: 480, height: 270 },
      fetchWindowIcons = true,
    } = options ?? {};

    try {
      return await ipcRenderer.invoke('desktop-capturer-get-sources', {
        types,
        thumbnailSize,
        fetchWindowIcons,
      });
    } catch (error) {
      console.error('[Electron preload] Failed to fetch screen sources', error);
      throw error;
    }
  },
});

// Примечание: для splash screen мы используем прямой ipcRenderer в splash.html
// так как это отдельное окно которое не требует такой же изоляции как основное приложение
