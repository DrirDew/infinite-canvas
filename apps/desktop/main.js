import { app, BrowserWindow } from "electron";

const createWindow = () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });

  window.loadURL("http://localhost:3000");
  window.once("ready-to-show", () => window.show());
};

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => BrowserWindow.getAllWindows().length || createWindow());
});

app.on("window-all-closed", () => process.platform === "darwin" || app.quit());
