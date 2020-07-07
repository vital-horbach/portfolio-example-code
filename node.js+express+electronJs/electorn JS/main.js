const {app, BrowserWindow} = require('electron');

let win;
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

function createWindow() {
    win = new BrowserWindow({
        width: 1200,
        height: 960,
        webPreferences: {
            nodeIntegration: true
        }
    });

    win.maximize();
    win.loadFile('./src/index.html');

    win.on('closed', () => {
        win = null;
    })
}

app.on('ready', createWindow);
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
});

app.on('active', () => {
    if (win === null) {
        createWindow()
    }
});
