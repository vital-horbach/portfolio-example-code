const service = require('./service/main');

// Prevent context menu on right click - it's used for panning
document.addEventListener("contextmenu", function (e) {
    e.preventDefault()
}, false);

// Start everything
document.onreadystatechange = () => {
    if (document.readyState === "complete") {
        service.listenCanvas();
        service.listenCanvasMouse();
        service.listenImageLoad();
        service.listenKeyboard();
    }
};