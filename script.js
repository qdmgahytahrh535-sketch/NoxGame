const car = document.getElementById('car');
const startBtn = document.getElementById('startBtn');
const statusText = document.getElementById('status');

const centerX = 300;
const centerY = 225;
const radiusX = 197;
const radiusY = 122;

let currentAngle = 0;

function setCarPosition(angle) {
    const x = centerX + radiusX * Math.cos(angle) - 13;
    const y = centerY + radiusY * Math.sin(angle) - 7;
    
    const dx = -radiusX * Math.sin(angle);
    const dy = radiusY * Math.cos(angle);
    const rotation = Math.atan2(dy, dx) * (180 / Math.PI);

    car.style.left = `${x}px`;
    car.style.top = `${y}px`;
    car.style.transform = `rotate(${rotation}deg)`;
}

setCarPosition(0);

startBtn.addEventListener('click', () => {
    startBtn.disabled = true;
    statusText.textContent = 'وضعیت: مسابقه در جریان... (۱۰ دور)';

    const totalRotations = 10;
    const totalAngle = totalRotations * 2 * Math.PI;
    const duration = 60000;
    const startTime = performance.now();

    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        currentAngle = progress * totalAngle;
        setCarPosition(currentAngle);

        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            setCarPosition(0);
            statusText.textContent = 'وضعیت: مسابقه به پایان رسید!';
            startBtn.disabled = false;
        }
    }

    requestAnimationFrame(animate);
});
