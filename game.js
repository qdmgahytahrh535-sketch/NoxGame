const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');
canvas.style.touchAction = 'none';

let mapWidth = 400;
let mapHeight = 250;
let tileSize = 50;

let zoom = 0.8;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 2;
let dpr = 1;
let cameraX = 0;
let cameraY = 0;
let needsRender = true;

let centerX = mapWidth / 2;
let centerY = mapHeight / 2;
let maxDistSq = (centerX * centerX) + (centerY * centerY);

let mountainBlocks = [];
let bushBlocks = [];
let lakes = [];
let selectedBlock = null;

function requestRender() {
    needsRender = true;
}

// محدود کردن دوربین به داخل نقشه
function clampCamera() {
    let viewW = window.innerWidth / zoom;
    let viewH = window.innerHeight / zoom;
    let mapPxW = mapWidth * tileSize;
    let mapPxH = mapHeight * tileSize;
    cameraX = viewW >= mapPxW ? (mapPxW - viewW) / 2 : Math.min(Math.max(cameraX, 0), mapPxW - viewW);
    cameraY = viewH >= mapPxH ? (mapPxH - viewH) / 2 : Math.min(Math.max(cameraY, 0), mapPxH - viewH);
}

function centerOn(wx, wy) {
    cameraX = wx - window.innerWidth / 2 / zoom;
    cameraY = wy - window.innerHeight / 2 / zoom;
    clampCamera();
    requestRender();
}

function clampZoom(z) {
    return Math.min(Math.max(z, MIN_ZOOM), MAX_ZOOM);
}

function zoomAt(sx, sy, newZoom) {
    let wx = cameraX + sx / zoom;
    let wy = cameraY + sy / zoom;
    zoom = clampZoom(newZoom);
    cameraX = wx - sx / zoom;
    cameraY = wy - sy / zoom;
    clampCamera();
    requestRender();
}

function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    clampCamera();
    requestRender();
}
window.addEventListener('resize', resizeCanvas);

// ---- دریاچه‌ها: شکل طبیعی و بدون هم‌پوشانی ----
function lakeRad(l, theta) {
    let r = 1;
    for (let i = 0; i < l.harm.length; i++) {
        let h = l.harm[i];
        r += h.a * Math.sin(h.k * theta + h.p);
    }
    return r;
}

// آیا نقطه (در مختصات دنیا) داخل دریاچه است؟ (pad = فاصله ایمنی)
function insideLake(l, wx, wy, pad) {
    let dx = wx - l.x;
    let dy = wy - l.y;
    let lx = (dx * l.cosR + dy * l.sinR) / l.aspect;
    let ly = -dx * l.sinR + dy * l.cosR;
    let d = Math.hypot(lx, ly);
    let theta = Math.atan2(ly, lx);
    return d <= l.R * lakeRad(l, theta) + pad;
}

function buildLakePath(l) {
    let n = 48;
    let pts = [];
    for (let i = 0; i < n; i++) {
        let a = (i / n) * Math.PI * 2;
        let r = l.R * lakeRad(l, a);
        let px = Math.cos(a) * r * l.aspect;
        let py = Math.sin(a) * r;
        pts.push({
            x: l.x + px * l.cosR - py * l.sinR,
            y: l.y + px * l.sinR + py * l.cosR
        });
    }
    let path = new Path2D();
    let mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
    let m0 = mid(pts[n - 1], pts[0]);
    path.moveTo(m0.x, m0.y);
    for (let i = 0; i < n; i++) {
        let m = mid(pts[i], pts[(i + 1) % n]);
        path.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
    }
    path.closePath();
    return path;
}

function createLakeCandidate() {
    let tx = 3 + Math.floor(Math.random() * (mapWidth - 6));
    let ty = 3 + Math.floor(Math.random() * (mapHeight - 6));
    let rot = Math.random() * Math.PI;
    let l = {
        x: (tx + 0.5) * tileSize,
        y: (ty + 0.5) * tileSize,
        R: tileSize * (1.0 + Math.random() * 1.6),
        aspect: 1 + Math.random() * 0.8,
        rot: rot,
        cosR: Math.cos(rot),
        sinR: Math.sin(rot),
        harm: [
            { k: 2, a: 0.10 + Math.random() * 0.15, p: Math.random() * Math.PI * 2 },
            { k: 3, a: 0.06 + Math.random() * 0.12, p: Math.random() * Math.PI * 2 },
            { k: 4, a: 0.04 + Math.random() * 0.06, p: Math.random() * Math.PI * 2 },
            { k: 5, a: 0.02 + Math.random() * 0.05, p: Math.random() * Math.PI * 2 }
        ]
    };
    l.ext = l.R * l.aspect * 1.6 + 5;
    return l;
}

// مربع‌هایی که دریاچه (به‌همراه فاصله ایمنی) اشغال می‌کند؛ اگر جای نامناسبی باشد null
function lakeTileKeys(l) {
    let pad = tileSize * 0.4;
    let ext = l.ext + pad;
    let tx0 = Math.floor((l.x - ext) / tileSize);
    let tx1 = Math.floor((l.x + ext) / tileSize);
    let ty0 = Math.floor((l.y - ext) / tileSize);
    let ty1 = Math.floor((l.y + ext) / tileSize);
    let keys = [];
    for (let tx = tx0; tx <= tx1; tx++) {
        for (let ty = ty0; ty <= ty1; ty++) {
            let blocked = false;
            for (let i = 0; i <= 2 && !blocked; i++) {
                for (let j = 0; j <= 2 && !blocked; j++) {
                    let px = (tx + i / 2) * tileSize;
                    let py = (ty + j / 2) * tileSize;
                    if (insideLake(l, px, py, pad)) blocked = true;
                }
            }
            if (!blocked) continue;
            if (tx < 1 || ty < 1 || tx > mapWidth - 2 || ty > mapHeight - 2) return null;
            if (getElevationLevel(tx, ty) >= 6) return null;
            keys.push(`${tx},${ty}`);
        }
    }
    return keys.length ? keys : null;
}

// تولید عوارض زمین
function generateWorld() {
    let totalBlocks = mapWidth * mapHeight;
    let occupiedSet = new Set();

    // اول دریاچه‌ها (تا کوه و بوته هیچ‌وقت روی آب نیفتند)
    let targetLakeCount = Math.floor(totalBlocks * 0.003);
    let attempts = 0;
    while (lakes.length < targetLakeCount && attempts < 40000) {
        attempts++;
        let l = createLakeCandidate();
        let keys = lakeTileKeys(l);
        if (!keys) continue;
        if (keys.some(k => occupiedSet.has(k))) continue;
        keys.forEach(k => occupiedSet.add(k));
        l.path = buildLakePath(l);
        lakes.push(l);
    }

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

// زمین گرادینتی: فقط یک بار روی یک کَنوس کوچک ساخته می‌شود
const TERRAIN_STEP = 2;
const terrainCanvas = document.createElement('canvas');

function buildTerrain() {
    let tw = Math.ceil(mapWidth / TERRAIN_STEP);
    let th = Math.ceil(mapHeight / TERRAIN_STEP);
    terrainCanvas.width = tw;
    terrainCanvas.height = th;
    let tctx = terrainCanvas.getContext('2d');
    let img = tctx.createImageData(tw, th);

    let outerColor = { r: 230, g: 213, b: 184 };
    let innerColor = { r: 92, g: 82, b: 64 };

    for (let i = 0; i < tw; i++) {
        for (let j = 0; j < th; j++) {
            let dx = i * TERRAIN_STEP - centerX;
            let dy = j * TERRAIN_STEP - centerY;
            let factor = Math.min(((dx * dx) + (dy * dy)) / maxDistSq, 1);
            let idx = (j * tw + i) * 4;
            img.data[idx] = Math.floor(innerColor.r * (1 - factor) + outerColor.r * factor);
            img.data[idx + 1] = Math.floor(innerColor.g * (1 - factor) + outerColor.g * factor);
            img.data[idx + 2] = Math.floor(innerColor.b * (1 - factor) + outerColor.b * factor);
            img.data[idx + 3] = 255;
        }
    }
    tctx.putImageData(img, 0, 0);
}

function drawTerrain(viewW, viewH) {
    let bs = tileSize * TERRAIN_STEP;
    let sx0 = Math.max(0, Math.floor(cameraX / bs));
    let sy0 = Math.max(0, Math.floor(cameraY / bs));
    let sx1 = Math.min(terrainCanvas.width, Math.ceil((cameraX + viewW) / bs));
    let sy1 = Math.min(terrainCanvas.height, Math.ceil((cameraY + viewH) / bs));
    if (sx1 <= sx0 || sy1 <= sy0) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
        terrainCanvas,
        sx0, sy0, sx1 - sx0, sy1 - sy0,
        sx0 * bs, sy0 * bs, (sx1 - sx0) * bs, (sy1 - sy0) * bs
    );
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
    // آب کم‌عمق: نیمه‌شفاف تا زمین زیرش کمی دیده شود
    ctx.fillStyle = 'rgba(168, 208, 226, 0.6)';
    ctx.fill(l.path);

    // وسط عمیق‌تر
    ctx.save();
    ctx.translate(l.x, l.y);
    ctx.scale(0.6, 0.6);
    ctx.translate(-l.x, -l.y);
    ctx.fillStyle = 'rgba(110, 165, 195, 0.28)';
    ctx.fill(l.path);
    ctx.restore();

    // خط ساحل
    ctx.strokeStyle = 'rgba(236, 246, 250, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke(l.path);
}

// رسم اصلی فریم (فقط اشیای داخل دید رسم می‌شوند)
function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.scale(dpr * zoom, dpr * zoom);
    ctx.translate(-cameraX, -cameraY);

    let viewW = window.innerWidth / zoom;
    let viewH = window.innerHeight / zoom;

    drawTerrain(viewW, viewH);

    let margin = tileSize * 3;
    let x0 = cameraX - margin;
    let y0 = cameraY - margin;
    let x1 = cameraX + viewW + margin;
    let y1 = cameraY + viewH + margin;

    for (let i = 0; i < lakes.length; i++) {
        let l = lakes[i];
        if (l.x + l.ext >= x0 && l.x - l.ext <= x1 && l.y + l.ext >= y0 && l.y - l.ext <= y1) drawLake(l);
    }
    for (let i = 0; i < bushBlocks.length; i++) {
        let b = bushBlocks[i];
        let bx = b.x * tileSize, by = b.y * tileSize;
        if (bx >= x0 && bx <= x1 && by >= y0 && by <= y1) drawBush(b);
    }
    for (let i = 0; i < mountainBlocks.length; i++) {
        let m = mountainBlocks[i];
        let mx = m.x * tileSize, my = m.y * tileSize;
        if (mx >= x0 && mx <= x1 && my >= y0 && my <= y1) drawMountain(m);
    }

    drawPalace();

    if (selectedBlock) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fillRect(selectedBlock.x * tileSize, selectedBlock.y * tileSize, tileSize, tileSize);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(selectedBlock.x * tileSize, selectedBlock.y * tileSize, tileSize, tileSize);
    }
}

function loop() {
    if (needsRender) {
        needsRender = false;
        draw();
    }
    requestAnimationFrame(loop);
}

// کادر مختصات و انتخاب مربع
const coordDisplay = document.getElementById('coord-display');

function selectBlock(tx, ty) {
    selectedBlock = { x: tx, y: ty };
    let lvl = getElevationLevel(tx, ty);
    coordDisplay.innerHTML = `X: ${tx} | Y: ${ty} <br><span style="color: #d4c2a0; font-weight: bold;">سطح ${lvl}</span>`;
    coordDisplay.classList.remove('modal-hidden');
    requestRender();
}

function clearSelection() {
    selectedBlock = null;
    coordDisplay.classList.add('modal-hidden');
    requestRender();
}

function handleTap(sx, sy) {
    let tx = Math.floor((cameraX + sx / zoom) / tileSize);
    let ty = Math.floor((cameraY + sy / zoom) / tileSize);
    if (tx < 0 || tx >= mapWidth || ty < 0 || ty >= mapHeight) return;
    if (selectedBlock && selectedBlock.x === tx && selectedBlock.y === ty) {
        clearSelection();
    } else {
        selectBlock(tx, ty);
    }
}

// لمس و ماوس: جابجایی، زوم دو انگشتی، تپ برای انتخاب
const pointers = new Map();
let tapMoved = false;
let tapStart = { x: 0, y: 0 };
let lastPinchDist = 1;
let lastMid = { x: 0, y: 0 };

function pinchInfo() {
    let pts = Array.from(pointers.values());
    let a = pts[0], b = pts[1];
    return {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
    };
}

canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
        tapMoved = false;
        tapStart = { x: e.clientX, y: e.clientY };
    } else if (pointers.size === 2) {
        tapMoved = true;
        let p = pinchInfo();
        lastPinchDist = p.dist;
        lastMid = p.mid;
    }
});

canvas.addEventListener('pointermove', (e) => {
    let prev = pointers.get(e.pointerId);
    if (!prev) return;
    let cur = { x: e.clientX, y: e.clientY };
    pointers.set(e.pointerId, cur);

    if (pointers.size === 1) {
        if (!tapMoved && Math.hypot(cur.x - tapStart.x, cur.y - tapStart.y) > 8) tapMoved = true;
        if (tapMoved) {
            cameraX -= (cur.x - prev.x) / zoom;
            cameraY -= (cur.y - prev.y) / zoom;
        }
    } else if (pointers.size === 2) {
        let p = pinchInfo();
        let wx = cameraX + lastMid.x / zoom;
        let wy = cameraY + lastMid.y / zoom;
        zoom = clampZoom(zoom * (p.dist / lastPinchDist));
        cameraX = wx - p.mid.x / zoom;
        cameraY = wy - p.mid.y / zoom;
        lastPinchDist = p.dist;
        lastMid = p.mid;
    } else {
        return;
    }
    clampCamera();
    requestRender();
});

function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    let wasSingle = pointers.size === 1;
    pointers.delete(e.pointerId);
    if (wasSingle && !tapMoved && e.type === 'pointerup') {
        handleTap(e.clientX, e.clientY);
    }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

// زوم با چرخ ماوس (کامپیوتر)
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    zoomAt(e.clientX, e.clientY, zoom * Math.exp(-e.deltaY * 0.001));
}, { passive: false });

// کنترل‌های مودال جستجو
const modal = document.getElementById('coord-modal');
const searchBtn = document.getElementById('search-btn');
const cancelBtn = document.getElementById('btn-cancel');
const submitBtn = document.getElementById('btn-submit');
const inputX = document.getElementById('input-x');
const inputY = document.getElementById('input-y');

// پیام خطا زیر فیلدها
const errorEl = document.createElement('div');
errorEl.style.cssText = 'color:#e07a5f;font-size:13px;text-align:center;min-height:16px;margin-top:8px;';
document.querySelector('.modal-buttons').before(errorEl);

// تبدیل ارقام فارسی و عربی به انگلیسی
function normalizeDigits(str) {
    return str
        .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0))
        .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
        .trim();
}

function parseCoord(value) {
    let s = normalizeDigits(value);
    return /^\d+$/.test(s) ? parseInt(s, 10) : NaN;
}

searchBtn.addEventListener('click', () => {
    inputX.value = '';
    inputY.value = '';
    errorEl.textContent = '';
    searchBtn.classList.add('modal-hidden');
    modal.classList.remove('modal-hidden');
});

cancelBtn.addEventListener('click', () => {
    modal.classList.add('modal-hidden');
    searchBtn.classList.remove('modal-hidden');
});

submitBtn.addEventListener('click', () => {
    let tx = parseCoord(inputX.value);
    let ty = parseCoord(inputY.value);
    if (isNaN(tx) || isNaN(ty) || tx >= mapWidth || ty >= mapHeight) {
        errorEl.textContent = `مختصات نامعتبر است. X بین 0 تا ${mapWidth - 1} و Y بین 0 تا ${mapHeight - 1}`;
        return;
    }
    errorEl.textContent = '';
    selectBlock(tx, ty);
    centerOn((tx + 0.5) * tileSize, (ty + 0.5) * tileSize);

    modal.classList.add('modal-hidden');
    searchBtn.classList.remove('modal-hidden');
});

// شروع
buildTerrain();
generateWorld();
resizeCanvas();
centerOn(centerX * tileSize, centerY * tileSize);
loop();
