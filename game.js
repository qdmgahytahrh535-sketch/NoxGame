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

let game;

// بررسی اینکه کتابخانه فایزر حتما بارگذاری شده باشد
window.addEventListener('load', () => {
    if (typeof Phaser !== 'undefined') {
        game = new Phaser.Game(config);
    } else {
        console.error("Phaser library failed to load!");
        document.body.innerHTML += "<div style='color:red; padding:20px; font-size:20px;'>خطا: کتابخانه فایزر بارگذاری نشد! اینترنت یا فیلترشکن را بررسی کنید.</div>";
    }
});
