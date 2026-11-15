const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    parent: 'game-container',
    backgroundColor: '#e6d5b8',
    fps: {
        target: 60,
        forceSetTimeOut: false
    },
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

let mapWidth = 400;  
let mapHeight = 250; 
let tileSize = 50;   
let graphics;
let selectedBlock = null;
let mountainBlocks = []; 
let bushBlocks = [];     
let lakes = [];          

let centerX, centerY, maxDistSq;
let currentActiveLevel = null;
let levelMessageTimer = null;

function preload() {
    // بارگذاری‌های اولیه موتور بازی
}

function create() {
    let scene = this;
    let cam = this.cameras.main;
    cam.setBounds(0, 0, mapWidth * tileSize, mapHeight * tileSize);

    let totalBlocks = mapWidth * mapHeight;
    let occupiedSet = new Set();

    centerX = mapWidth / 2;
    centerY = mapHeight / 2;
    maxDistSq = (centerX * centerX) + (centerY * centerY);

    // توزیع کوه‌ها (بدون هیچ کوهی در سطح ۶)
    let targetMountainCount = Math.floor(totalBlocks * 0.02);
    let quotas = {
        1: Math.floor(targetMountainCount * 0.50),
        2: Math.floor(targetMountainCount * 0.25),
        3: Math.floor(targetMountainCount * 0.13),
        4: Math.floor(targetMountainCount * 0.08),
        5: targetMountainCount - (Math.floor(targetMountainCount * 0.50) + Math.floor(targetMountainCount * 0.25) + Math.floor(targetMountainCount * 0.13) + Math.floor(targetMountainCount * 0.08))
    };

    let generatedCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let safetyCounter = 0;

    while (mountainBlocks.length < targetMountainCount && safetyCounter < 100000) {
        safetyCounter++;
        let rx = Math.floor(Math.random() * mapWidth);
        let ry = Math.floor(Math.random() * mapHeight);
        let lvl = getElevationLevel(rx, ry);

        if (lvl === 6) continue;

        if (generatedCounts[lvl] < quotas[lvl]) {
            let key = `${rx},${ry}`;
            if (!occupiedSet.has(key)) {
                occupiedSet.add(key);
                mountainBlocks.push({ x: rx, y: ry, level: lvl });
                generatedCounts[lvl]++;
            }
        }
    }

    // تولید بوته‌ها (فقط سطوح ۱ تا ۵)
    let targetBushCount = Math.floor(totalBlocks * 0.02);
    while (bushBlocks.length < targetBushCount) {
        let rx = Math.floor(Math.random() * mapWidth);
        let ry = Math.floor(Math.random() * mapHeight);
        let lvl = getElevationLevel(rx, ry);

        if (lvl < 6) {
            let key = `${rx},${ry}`;
            if (!occupiedSet.has(key)) {
                occupiedSet.add(key);
                bushBlocks.push({ x: rx, y: ry, level: lvl });
            }
        }
    }

    // تولید دریاچه‌ها (فقط سطوح ۱ تا ۵)
    let targetLakeCount = Math.floor(totalBlocks * 0.003);
    let shapeTypes = ['cat', 'fox_tail', 'simple_fish', 'blob'];

    while (lakes.length < targetLakeCount) {
        let lx = Math.floor(Math.random() * (mapWidth - 15)) + 5;
        let ly = Math.floor(Math.random() * (mapHeight - 15)) + 5;
        let lvl = getElevationLevel(lx, ly);

        if (lvl < 6) {
            let type = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];
            lakes.push({
                x: lx * tileSize,
                y: ly * tileSize,
                type: type,
                scale: 0.8 + Math.random() * 0.5,
                level: lvl
            });
        }
    }

    mountainBlocks.sort((a, b) => a.y - b.y);
    bushBlocks.sort((a, b) => a.y - b.y);
    lakes.sort((a, b) => a.y - b.y);

    graphics = this.add.graphics();
    drawTerrain(this);

    // مدیریت حرکت، زوم دو انگشتی و لمس
    let canvasElement = this.sys.game.canvas;
    let isDragging = false;
    let hasMoved = false;
    let touchStartX = 0;
    let touchStartY = 0;
    let startX = 0;
    let startY = 0;
    let pinchStartDist = null;
    let startZoom = 1;

    canvasElement.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            isDragging = false;
            hasMoved = true;
            pinchStartDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            startZoom = cam.zoom;
        } else if (e.touches.length === 1) {
            isDragging = true;
            hasMoved = false;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            startX = touchStartX;
            startY = touchStartY;
            pinchStartDist = null;
        }
    }, { passive: true });

    canvasElement.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && pinchStartDist !== null) {
            hasMoved = true;
            let currentDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            if (pinchStartDist > 0) {
                let factor = currentDist / pinchStartDist;
                let newZoom = startZoom * factor;
                newZoom = Phaser.Math.Clamp(newZoom, 0.6, 3.0);
                cam.setZoom(newZoom);
            }
        } else if (isDragging && e.touches.length === 1) {
            let currentX = e.touches[0].clientX;
            let currentY = e.touches[0].clientY;
            let dx = currentX - startX;
            let dy = currentY - startY;

            if (Math.hypot(currentX - touchStartX, currentY - touchStartY) > 8) {
                hasMoved = true;
            }

            if (hasMoved) {
                cam.scrollX -= dx / cam.zoom;
                cam.scrollY -= dy / cam.zoom;
            }

            startX = currentX;
            startY = currentY;
        }
    }, { passive: true });

    canvasElement.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            pinchStartDist = null;
        }
        if (e.touches.length === 0) {
            if (isDragging && !hasMoved) {
                handleMapTap(scene, touchStartX, touchStartY);
            }
            isDragging = false;
        } else if (e.touches.length === 1) {
            isDragging = true;
            hasMoved = true;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }
    }, { passive: true });

    this.input.on('pointerup', (pointer) => {
        if (!pointer.wasTouch && pointer.getDistance() < 8) {
            handleMapTap(scene, pointer.x, pointer.y);
        }
    });

    const modal = document.getElementById('coord-modal');
    const searchBtn = document.getElementById('search-btn');
    const cancelBtn = document.getElementById('btn-cancel');
    const submitBtn = document.getElementById('btn-submit');
    const inputX = document.getElementById('input-x');
    const inputY = document.getElementById('input-y');
    
    const modalLabel = document.getElementById('modal-label');
    const labelX = document.getElementById('label-x');
    const labelY = document.getElementById('label-y');

    searchBtn.addEventListener('click', () => {
        inputX.value = '';
        inputY.value = '';
        resetModalColors();
        searchBtn.classList.add('modal-hidden');
        modal.classList.remove('modal-hidden');
    });

    cancelBtn.addEventListener('click', () => {
        modal.classList.add('modal-hidden');
        searchBtn.classList.remove('modal-hidden');
    });

    function validateInputs() {
        let valX = parseInt(inputX.value);
        let valY = parseInt(inputY.value);

        let isXValid = !isNaN(valX) && valX >= 0 && valX < mapWidth;
        let isYValid = !isNaN(valY) && valY >= 0 && valY < mapHeight;

        if ((inputX.value !== '' && !isXValid) || (inputY.value !== '' && !isYValid)) {
            modalLabel.style.color = '#ff4d4d';
            labelX.style.color = '#ff4d4d';
            labelY.style.color = '#ff4d4d';
            return false;
        } else {
            resetModalColors();
            return isXValid && isYValid;
        }
    }

    function resetModalColors() {
        modalLabel.style.color = '#fefae0';
        labelX.style.color = '#fefae0';
        labelY.style.color = '#fefae0';
    }

    inputX.addEventListener('input', validateInputs);
    inputY.addEventListener('input', validateInputs);

    submitBtn.addEventListener('click', () => {
        let targetX = parseInt(inputX.value);
        let targetY = parseInt(inputY.value);

        if (!isNaN(targetX) && !isNaN(targetY) && targetX >= 0 && targetX < mapWidth && targetY >= 0 && targetY < mapHeight) {
            modal.classList.add('modal-hidden');
            searchBtn.classList.remove('modal-hidden');
            jumpToCoordinates(this, targetX, targetY);
        } else {
            modalLabel.style.color = '#ff4d4d';
            labelX.style.color = '#ff4d4d';
            labelY.style.color = '#ff4d4d';
        }
    });
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

function handleMapTap(scene, clientX, clientY) {
    let canvas = scene.sys.game.canvas;
    let rect = canvas.getBoundingClientRect();

    let canvasX = (clientX - rect.left) * (canvas.width / rect.width);
    let canvasY = (clientY - rect.top) * (canvas.height / rect.height);

    let worldPoint = scene.cameras.main.getWorldPoint(canvasX, canvasY);
    let blockX = Math.floor(worldPoint.x / tileSize);
    let blockY = Math.floor(worldPoint.y / tileSize);

    if (blockX >= 0 && blockX < mapWidth && blockY >= 0 && blockY < mapHeight) {
        selectBlock(scene, blockX, blockY);
    }
}

function selectBlock(scene, x, y) {
    selectedBlock = { x: x, y: y };
    drawTerrain(scene);

    let level = getElevationLevel(x, y);

    const coordDisplay = document.getElementById('coord-display');
    coordDisplay.innerHTML = `X: ${x} | Y: ${y} <br><span style="color: #d4c2a0; font-weight: bold;">سطح ${level}</span>`;
    coordDisplay.classList.remove('modal-hidden');
}

// تابع رسم قصر سه‌بعدی دارک‌فانتزی در مرکز نقشه (X: 200, Y: 125)
function drawDarkFantasyPalace(graphics) {
    let palaceCenterX = 200 * tileSize + tileSize / 2;
    let palaceCenterY = 125 * tileSize + tileSize / 2;

    let pWidth = tileSize * 2.5;   
    let pHeight = tileSize * 2.5;  
    let px = palaceCenterX - pWidth / 2;
    let py = palaceCenterY - pHeight / 2;

    // ۱. سایه حجمی زیر قلعه
    graphics.fillStyle(0x1a2119, 0.7);
    graphics.fillEllipse(palaceCenterX, py + pHeight + 12, pWidth * 1.3, 35);

    // ۲. دیوارهای اصلی سنگی قلعه
    graphics.fillStyle(0x353e39, 1);
    graphics.fillRect(px, py, pWidth, pHeight);

    // دیواره‌های سه‌بعدی عمقی قلعه
    graphics.fillStyle(0x242c27, 1);
    graphics.beginPath();
    graphics.moveTo(px + pWidth, py);
    graphics.lineTo(px + pWidth, py + pHeight);
    graphics.lineTo(px + pWidth + 20, py + pHeight - 20);
    graphics.lineTo(px + pWidth + 20, py - 20);
    graphics.closePath();
    graphics.fillPath();

    graphics.fillStyle(0x45504a, 1);
    graphics.beginPath();
    graphics.moveTo(px, py + pHeight);
    graphics.lineTo(px + pWidth, py + pHeight);
    graphics.lineTo(px + pWidth + 20, py + pHeight - 20);
    graphics.lineTo(px + 20, py + pHeight - 20);
    graphics.closePath();
    graphics.fillPath();

    graphics.lineStyle(2, 0x1a2119, 0.8);
    graphics.strokeRect(px, py, pWidth, pHeight);

    // ۳. برج‌های سبز‌رنگ و گنبدهای نوک‌تیز دارک‌فانتزی
    let towerWidth = 35;
    let towerHeight = 50;

    let corners = [
        { x: px - 10, y: py - 10 },
        { x: px + pWidth - towerWidth + 10, y: py - 10 },
        { x: px - 10, y: py + pHeight - towerHeight + 10 },
        { x: px + pWidth - towerWidth + 10, y: py + pHeight - towerHeight + 10 }
    ];

    corners.forEach(c => {
        graphics.fillStyle(0x2c3530, 1);
        graphics.fillRect(c.x, c.y, towerWidth, towerHeight);
        graphics.lineStyle(1.5, 0x1a2119, 1);
        graphics.strokeRect(c.x, c.y, towerWidth, towerHeight);

        // سقف سبز هرمی برج
        graphics.fillStyle(0x0e301f, 1);
        graphics.beginPath();
        graphics.moveTo(c.x - 5, c.y);
        graphics.lineTo(c.x + towerWidth / 2, c.y - 25);
        graphics.lineTo(c.x + towerWidth + 5, c.y);
        graphics.closePath();
        graphics.fillPath();

        // نگین نورانی روی برج
        graphics.fillStyle(0x27ae60, 1);
        graphics.fillCircle(c.x + towerWidth / 2, c.y - 25, 3.5);
    });

    // ۴. ورودی و دروازه طاقی جادویی درخشان
    let stairWidth = 50;
    let stairStartX = palaceCenterX - stairWidth / 2;
    let stairStartY = py + pHeight;

    for (let i = 0; i < 5; i++) {
        graphics.fillStyle(0x242c27, 1);
        graphics.fillRect(stairStartX - (i * 4), stairStartY + (i * 5), stairWidth + (i * 8), 5);
        graphics.lineStyle(1, 0x45504a, 0.7);
        graphics.strokeRect(stairStartX - (i * 4), stairStartY + (i * 5), stairWidth + (i * 8), 5);
    }

    graphics.fillStyle(0x0e301f, 1);
    graphics.fillRect(palaceCenterX - 18, py + pHeight - 32, 36, 32);
    graphics.fillStyle(0x2ecc71, 0.9);
    graphics.fillCircle(palaceCenterX, py + pHeight - 18, 11);
    graphics.lineStyle(2, 0x091e13, 1);
    graphics.strokeRect(palaceCenterX - 18, py + pHeight - 32, 36, 32);

    // ۵. برج مرکزی قصر با پرچم سبز و تاج سلطنتی
    let centralWidth = 55;
    let centralHeight = 65;
    let ctpX = palaceCenterX - centralWidth / 2;
    let ctpY = py - 25;

    graphics.fillStyle(0x2c3530, 1);
    graphics.fillRect(ctpX, ctpY, centralWidth, centralHeight);
    graphics.lineStyle(2, 0x1a2119, 1);
    graphics.strokeRect(ctpX, ctpY, centralWidth, centralHeight);

    // پرچم سبز‌رنگ اصلی
    graphics.fillStyle(0x0e301f, 1);
    graphics.beginPath();
    graphics.moveTo(palaceCenterX, ctpY + 12);
    graphics.lineTo(palaceCenterX + 32, ctpY + 25);
    graphics.lineTo(palaceCenterX, ctpY + 38);
    graphics.closePath();
    graphics.fillPath();
    graphics.lineStyle(1.5, 0x2ecc71, 0.9);
    graphics.strokePath();

    // گنبد بالای برج مرکزی
    graphics.fillStyle(0x0e301f, 1);
    graphics.beginPath();
    graphics.moveTo(ctpX - 8, ctpY);
    graphics.lineTo(palaceCenterX, ctpY - 35);
    graphics.lineTo(ctpX + centralWidth + 8, ctpY);
    graphics.closePath();
    graphics.fillPath();

    graphics.fillStyle(0x2ecc71, 1);
    graphics.fillCircle(palaceCenterX, ctpY - 35, 6);
    graphics.fillStyle(0x1a2119, 1);
    graphics.fillRect(palaceCenterX - 2, ctpY - 48, 4, 13);
}

function drawNaturalCurvedMountain(graphics, m) {
    let x = m.x * tileSize;
    let y = m.y * tileSize;
    let cx = x + tileSize / 2;
    let cy = y + tileSize / 2;

    graphics.fillStyle(0xc8b493, 0.6);
    graphics.fillEllipse(cx, cy + tileSize * 0.25, tileSize * 1.2, tileSize * 0.7);

    graphics.fillStyle(0xd4c2a0, 1);
    graphics.beginPath();
    graphics.moveTo(x - tileSize * 0.1, y + tileSize * 0.8);
    graphics.lineTo(x + tileSize * 0.2, y + tileSize * 0.3);
    graphics.lineTo(cx - tileSize * 0.15, y + tileSize * 0.08);
    graphics.lineTo(cx + tileSize * 0.15, y + tileSize * 0.08);
    graphics.lineTo(x + tileSize * 0.8, y + tileSize * 0.3);
    graphics.lineTo(x + tileSize * 1.1, y + tileSize * 0.8);
    graphics.lineTo(cx, y + tileSize * 1.05);
    graphics.closePath();
    graphics.fillPath();

    graphics.fillStyle(0xbcab88, 0.75);
    graphics.beginPath();
    graphics.moveTo(cx, y + tileSize * 0.08);
    graphics.lineTo(x + tileSize * 0.8, y + tileSize * 0.3);
    graphics.lineTo(x + tileSize * 1.1, y + tileSize * 0.8);
    graphics.lineTo(cx, y + tileSize * 1.05);
    graphics.closePath();
    graphics.fillPath();

    graphics.lineStyle(2, 0xa89673, 0.7);
    graphics.beginPath();
    graphics.moveTo(cx - tileSize * 0.1, y + tileSize * 0.15);
    graphics.lineTo(x + tileSize * 0.15, y + tileSize * 0.5);
    graphics.lineTo(x + tileSize * 0.05, y + tileSize * 0.85);
    graphics.strokePath();

    graphics.beginPath();
    graphics.moveTo(cx + tileSize * 0.08, y + tileSize * 0.15);
    graphics.lineTo(x + tileSize * 0.65, y + tileSize * 0.55);
    graphics.lineTo(x + tileSize * 0.85, y + tileSize * 0.85);
    graphics.strokePath();
}

function drawBush(graphics, b) {
    let x = b.x * tileSize;
    let y = b.y * tileSize;
    let cx = x + tileSize / 2;
    let cy = y + tileSize * 0.6;

    graphics.fillStyle(0xc8b493, 0.5);
    graphics.fillEllipse(cx, cy + tileSize * 0.15, tileSize * 0.6, tileSize * 0.3);

    let leafTips = [
        { dx: 0, dy: -tileSize * 0.55 },
        { dx: -tileSize * 0.25, dy: -tileSize * 0.4 },
        { dx: tileSize * 0.25, dy: -tileSize * 0.4 },
        { dx: -tileSize * 0.4, dy: -tileSize * 0.2 },
        { dx: tileSize * 0.4, dy: -tileSize * 0.2 }
    ];

    let baseColor = 0x425e3d;
    let tipColor = 0x688f5c;

    for (let i = 0; i < leafTips.length; i++) {
        let tipX = cx + leafTips[i].dx;
        let tipY = cy + leafTips[i].dy;

        graphics.fillStyle(baseColor, 1);
        graphics.beginPath();
        graphics.moveTo(cx - tileSize * 0.05, cy);
        graphics.lineTo(cx + tileSize * 0.05, cy);
        graphics.lineTo(tipX, tipY);
        graphics.closePath();
        graphics.fillPath();

        graphics.fillStyle(tipColor, 0.7);
        graphics.beginPath();
        graphics.moveTo(cx, cy);
        graphics.lineTo(cx + tileSize * 0.03, cy - tileSize * 0.1);
        graphics.lineTo(tipX, tipY);
        graphics.closePath();
        graphics.fillPath();
    }
}

function drawLake(graphics, lake) {
    let x = lake.x;
    let y = lake.y;
    let s = lake.scale;

    let drawLayers = (drawFn) => {
        graphics.fillStyle(0xdceaf0, 0.3);
        drawFn(s * 1.15);
        graphics.fillStyle(0xdceaf0, 0.7);
        drawFn(s * 1.0);
        graphics.fillStyle(0xdceaf0, 1.0);
        drawFn(s * 0.85);
    };

    if (lake.type === 'cat') {
        drawLayers((scale) => {
            graphics.fillCircle(x, y + 20 * scale, 35 * scale);
            graphics.fillCircle(x, y - 15 * scale, 25 * scale);
            graphics.fillTriangle(x - 25 * scale, y - 30 * scale, x - 10 * scale, y - 35 * scale, x - 5 * scale, y - 15 * scale);
            graphics.fillTriangle(x + 25 * scale, y - 30 * scale, x + 10 * scale, y - 35 * scale, x + 5 * scale, y - 15 * scale);
        });
    } else if (lake.type === 'fox_tail') {
        drawLayers((scale) => {
            graphics.fillEllipse(x, y, 65 * scale, 25 * scale);
            graphics.fillEllipse(x - 20 * scale, y - 10 * scale, 40 * scale, 22 * scale);
            graphics.fillEllipse(x + 20 * scale, y + 10 * scale, 35 * scale, 20 * scale);
        });
    } else if (lake.type === 'simple_fish') {
        drawLayers((scale) => {
            graphics.fillEllipse(x, y, 60 * scale, 32 * scale);
        });
    } else {
        drawLayers((scale) => {
            graphics.fillCircle(x - 15 * scale, y, 30 * scale);
            graphics.fillCircle(x + 15 * scale, y - 10 * scale, 25 * scale);
            graphics.fillCircle(x + 10 * scale, y + 15 * scale, 28 * scale);
        });
    }
}

function drawTerrain(scene) {
    graphics.clear();
    
    let outerColor = { r: 0xe6, g: 0xd5, b: 0xb8 };
    let innerColor = { r: 0x5c, g: 0x52, b: 0x40 };

    for (let gx = 0; gx < mapWidth; gx++) {
        for (let gy = 0; gy < mapHeight; gy++) {
            let worldX = gx * tileSize;
            let worldY = gy * tileSize;

            let dx = gx - centerX;
            let dy = gy - centerY;
            let distSq = (dx * dx) + (dy * dy);
 
