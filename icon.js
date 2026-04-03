export function updateIcon(enabled) {
    const size = 16;
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext("2d");

    // Rounded square background
    const r = 3;
    ctx.fillStyle = enabled ? "#1db954" : "#888888";
    ctx.beginPath();
    ctx.moveTo(r, 0);
    ctx.lineTo(size - r, 0);
    ctx.arcTo(size, 0, size, r, r);
    ctx.lineTo(size, size - r);
    ctx.arcTo(size, size, size - r, size, r);
    ctx.lineTo(r, size);
    ctx.arcTo(0, size, 0, size - r, r);
    ctx.lineTo(0, r);
    ctx.arcTo(0, 0, r, 0, r);
    ctx.closePath();
    ctx.fill();

    // "H" letter
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("H", size / 2, size / 2 + 0.5);

    const imageData = ctx.getImageData(0, 0, size, size);
    chrome.action.setIcon({ imageData });
}
