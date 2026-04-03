export function updateIcon(enabled) {
    const size = 16;
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext("2d");

    // Outer circle
    ctx.fillStyle = enabled ? "#1db954" : "#888888";
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Speaker body (white)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(3, 6, 3, 4);
    ctx.beginPath();
    ctx.moveTo(6, 6);
    ctx.lineTo(10, 3);
    ctx.lineTo(10, 13);
    ctx.lineTo(6, 10);
    ctx.closePath();
    ctx.fill();

    // Mute cross when disabled
    if (!enabled) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(11, 5);
        ctx.lineTo(15, 9);
        ctx.moveTo(15, 5);
        ctx.lineTo(11, 9);
        ctx.stroke();
    }

    const imageData = ctx.getImageData(0, 0, size, size);
    chrome.action.setIcon({ imageData });
}
