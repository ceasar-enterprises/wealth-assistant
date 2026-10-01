/*
 * Preload — the only bridge between the tile UI and Electron. Exposes a narrow,
 * typed surface: fetch dashboard, approve/reject inline, flip collapsed state,
 * set the last dashboard snapshot for resume.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wealth', {
  dashboard: () => ipcRenderer.invoke('dashboard'),
  approve: (moveId, escalationConfirmed) =>
    ipcRenderer.invoke('approve', { moveId, escalationConfirmed }),
  reject: (moveId) => ipcRenderer.invoke('reject', moveId),
  setCollapsed: (value) => ipcRenderer.invoke('set-collapsed', value),
  onRefresh: (cb) => {
    const listener = () => cb();
    ipcRenderer.on('manual-refresh', listener);
    return () => ipcRenderer.removeListener('manual-refresh', listener);
  },
});