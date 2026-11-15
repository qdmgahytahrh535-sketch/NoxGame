const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');

let mapWidth = 400;
let mapHeight = 250;
let tileSize = 50;

let cameraX = (mapWidth * tileSize) / 2 - window.innerWidth / 2;
let cameraY = (mapHeight * tileSize) / 2 - window.innerHeight / 2;
let zoom = 0.8;

let centerX = mapWidth / 2;
let centerY = mapHeight / 2;
let maxDistSq = (centerX * centerX) + (centerY * centerY);

let mountainBlocks = [];
let bushBlocks = [];
let lakes = [];
let selectedBlock = null;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// تولید عوارض زمین
function generateWorld() {
    let totalBlocks = mapWidth * mapHeight;
    let occupiedSet = new Set();

    let targetMountainCount = Math.floor(totalBlocks * 0.02);
    while (mountainBlocks.length < targetMountainCount) {
        let rx = Math.floor(Math.random() * mapWidth);
        let ry = Math.floor(Math.random() * mapHeight);
        let lvl = getElevationLevel(rx, ry);
        if (lvl !== 6) {
            let key = `${rx},${ry}`;
            if (!occupiedSet.has(key)) {
                occupiedSet.add(key);
                mountainBlocks.push({ x: rx, y: ry });
            }
        }
    }

    let targetBushCount = Math.floor(totalBlocks * 0.02);
    while (bushBlocks.length < targetBushCount) {
        let rx = Math.floor(Math.random() * mapWidth);
        let ry = Math.floor(Math.random() * mapHeight);
        let lvl = getElevationLevel(rx, ry);
        if (lvl < 6) {
            let key = `${rx},${ry}`;
            if (!occupiedSet.has(key)) {
                occupiedSet.add(key);
                bushBlocks.push({ x: rx, y: ry });
            }
        }
    }

    let targetLakeCount = Math.floor(totalBlocks * 0.003);
    let shapeTypes = ['cat', 'fox_tail', 'simple_fish', 'blob'];
    while (lakes.length < targetLakeCount) {
        let lx = Math.floor(Math.random() * (mapWidth - 15)) + 5;
        let ly = Math.floor(Math.random() * (mapHeight - 15)) + 5;
        let lvl = getElevationLevel(lx, ly);
        if (lvl < 6) {
            lakes.push({
                x: lx * tileSize,
                y: ly * tileSize,
                type: shapeTypes[Math.floor(Math.random() * shapeTypes.length)],
                scale: 0.8 + Math.random() * 0.5
            });
        }
    }
}

function getElevationLevel(x, y) {
    let dx = x - centerX;
    let dy = y - centerY;
    let ratioSq = Math.min(((dx * dx) + (dy * dy)) / maxDistSq, 1);
    if (ratioSq <= 0.005) return 6;
    if (ratioSq <= 0.164) return 5;
    if (ratioSq <= 0.331) return 4;
    if (ratioSq <= 0.520) return 3;
    if (ratioSq <= 0.731) return 2;
    return 1;
}

// رسم قلعه مرکزی
function drawPalace() {
    let px = 200 * tileSize;
    let py = 125 * tileSize;
    let pWidth = tileSize * 2.5;
    let pHeight = tileSize * 2.5;
    let cx = px + tileSize * 1.25;
    let cy = py + tileSize * 1.25;

    ctx.fillStyle = 'rgba(26, 33, 25, 0.7)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + pHeight / 2 + 10, pWidth * 0.7, 25, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#353e39';
    ctx.fillRect(px, py, pWidth, pHeight);
    ctx.strokeStyle = '#1a2119';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, pWidth, pHeight);

    // برج‌ها
    let tw = 35, th = 50;
    let corners = [
        { x: px - 10, y: py - 10 },
        { x: px + pWidth - tw + 10, y: py - 10 },
        { x: px - 10, y: py + pHeight - th + 10 },
        { x: px + pWidth - tw + 10, y: py + pHeight - th + 10 }
    ];

    corners.forEach(c => {
        ctx.fillStyle = '#2c3530';
        ctx.fillRect(c.x, c.y, tw, th);
        ctx.strokeRect(c.x, c.y, tw, th);

        ctx.fillStyle = '#0e301f';
        ctx.beginPath();
        ctx.moveTo(c.x - 5, c.y);
        ctx.lineTo(c.x + tw / 2, c.y - 25);
        ctx.lineTo(c.x + tw + 5, c.y);
        ctx.closePath();
        ctx.fill();
    });
}

function drawMountain(m) {
    let x = m.x * tileSize;
    let y = m.y * tileSize;
    let cx = x + tileSize / 2;
    let cy = y + tileSize / 2;

    ctx.fillStyle = '#d4c2a0';
    ctx.beginPath();
    ctx.moveTo(x, y + tileSize * 0.8);
    ctx.lineTo(cx, y + tileSize * 0.1);
    ctx.lineTo(x + tileSize, y + tileSize * 0.8);
    ctx.closePath();
    ctx.fill();
}

function drawBush(b) {
    let x = b.x * tileSize + tileSize / 2;
    let y = b.y * tileSize + tileSize / 2;
    ctx.fillStyle = '#425e3d';
    ctx.beginPath();
    ctx.arc(x, y, tileSize * 0.3, 0, Math.PI * 2);
    ctx.fill();
}

function drawLake(l) {
    ctx.fillStyle = '#dceaf0';
    ctx.beginPath();
    ctx.arc(l.x, l.y, tileSize * 0.8 * l.scale, 0, Math.PI * 2);
    ctx.fill();
}

// رسم اصلی فریم
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-cameraX, -cameraY);

    let outerColor = { r: 230, g: 213, b: 184 };
    let innerColor = { r: 92, g: 82, b: 64 };

    // رسم گرادینت زمین
    let step = 2; // بهینه‌سازی سرعت
    for (let gx = 0; gx < mapWidth; gx += step) {
        for (let gy = 0; gy < mapHeight; gy += step) {
            let dx = gx - centerX;
            let dy = gy - centerY;
            let distSq = (dx * dx) + (dy * dy);
            let factor = Math.min(distSq / maxDistSq, 1);

            let r = Math.floor(innerColor.r * (1 - factor) + outerColor.r * factor);
            let g = Math.floor(innerColor.g * (1 - factor) + outerColor.g * factor);
            let b = Math.floor(innerColor.b * (1 - factor) + outerColor.b * factor);

            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(gx * tileSize, gy * tileSize, tileSize * step, tileSize * step);
        }
    }

    lakes.forEach(drawLake);
    bushBlocks.forEach(drawBush);
    mountainBlocks.forEach(drawMountain);
    drawPalace();

    if (selectedBlock) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillRect(selectedBlock.x * tileSize, selectedBlock.y * tileSize, tileSize, tileSize);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(selectedBlock.x * tileSize, selectedBlock.y * tileSize, tileSize, tileSize);
    }

    ctx.restore();
    requestAnimationFrame(render);
}

// مدیریت لمس و جابجایی (Pan & Zoom)
let isDragging = false;
let startX = 0, startY = 0;

canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        isDragging = true;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }
}, { passive: true });

canvas.addEventListener('touchmove', (e) => {
    if (isDragging && e.touches.length === 1) {
        let dx = e.touches[0].clientX - startX;
        let dy = e.touches[0].clientY - startY;
        cameraX -= dx / zoom;
        cameraY -= dy / zoom;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }
}, { passive: true });

canvas.addEventListener('touchend', () => {
    isDragging = false;
});

// کنترل‌های مودال جستجو
const modal = document.getElementById('coord-modal');
const searchBtn = document.getElementById('search-btn');
const cancelBtn = document.getElementById('btn-cancel');
const submitBtn = document.getElementById('btn-submit');
const inputX = document.getElementById('input-x');
const inputY = document.getElementById('input-y');
const coordDisplay = document.getElementById('coord-display');

searchBtn.addEventListener('click', () => {
    inputX.value = '';
    inputY.value = '';
    searchBtn.classList.add('modal-hidden');
    modal.classList.remove('modal-hidden');
});

cancelBtn.addEventListener('click', () => {
    modal.classList.add('modal-hidden');
    searchBtn.classList.remove('modal-hidden');
});

submitBtn.addEventListener('click', () => {
    let tx = parseInt(inputX.value);
    let ty = parseInt(inputY.value);
    if (!isNaN(tx) && !isNaN(ty) && tx >= 0 && tx < mapWidth && ty >= 0 && ty < mapHeight) {
        selectedBlock = { x: tx, y: ty };
        cameraX = (tx * tileSize) - (window.innerWidth / 2 / zoom);
        cameraY = (ty * tileSize) - (window.innerHeight / 2 / zoom);
        
        let lvl = getElevationLevel(tx, ty);
        coordDisplay.innerHTML = `X: ${tx} | Y: ${ty} <br><span style="color: #d4c2a0; font-weight: bold;">سطح ${lvl}</span>`;
        coordDisplay.classList.remove('modal-hidden');

        modal.classList.add('modal-hidden');
        searchBtn.classList.remove('modal-hidden');
    }
});

generateWorld();
render();
