// Game configuration
const CONFIG = {
    difficulties: {
        easy: {
            alienSpeed: 0.8,
            spawnRate: 2500,
            scoreMultiplier: 1,
            projectileSpeed: 8,
            healthLoss: 5,
            missedAlienPenalty: 3
        },
        normal: {
            alienSpeed: 1.2,
            spawnRate: 2000,
            scoreMultiplier: 1.5,
            projectileSpeed: 10,
            healthLoss: 10,
            missedAlienPenalty: 5
        },
        hard: {
            alienSpeed: 1.8,
            spawnRate: 1500,
            scoreMultiplier: 2,
            projectileSpeed: 12,
            healthLoss: 15,
            missedAlienPenalty: 8
        }
    },
    projectileSpeed: 10,
    shipSpeed: 6
};

let gameState = {
    score: 0,
    health: 100,
    level: 1,
    difficulty: 'normal',
    isPaused: false,
    isGameOver: false,
    lastShot: 0,
    shootingCooldown: 250, // Time between shots in milliseconds
    aliens: [],
    projectiles: [],
    powerUps: [],
    activePowerUps: {},
    powerUpSpawned: false,
    spawnInterval: null
};

const gameArea = document.getElementById('game-area');
const ship = document.getElementById('spaceship');
let shipPosition = {
    x: gameArea.offsetWidth / 2 - 20,
    y: gameArea.offsetHeight - 80
};

// Initialize game
function initGame(difficulty) {
    // Clear existing aliens and projectiles
    gameState.aliens.forEach(alien => alien.element.remove());
    gameState.projectiles.forEach(projectile => projectile.element.remove());
    
    gameState.difficulty = difficulty;
    gameState.score = 0;
    gameState.health = 100;
    gameState.level = 1;
    gameState.isPaused = false;
    gameState.isGameOver = false;
    gameState.aliens = [];
    gameState.projectiles = [];
    gameState.powerUps = [];
    gameState.activePowerUps = {};
    gameState.powerUpSpawned = false;

    // Update UI
    updateScore(0);
    updateHealth(100);
    updateLevel(1);

    // Hide screens
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    
    // Position ship
    shipPosition = {
        x: gameArea.offsetWidth / 2 - 20,
        y: gameArea.offsetHeight - 80
    };
    ship.style.left = shipPosition.x + 'px';
    ship.style.bottom = '20px';

    // Start game loop and alien spawning
    gameLoop();
    startAlienSpawning();
}

// Shooting mechanism
function shoot() {
    const now = Date.now();
    if (now - gameState.lastShot < gameState.shootingCooldown) return;
    
    gameState.lastShot = now;
    const projectile = createProjectile(shipPosition.x, shipPosition.y);
    gameState.projectiles.push({
        element: projectile,
        x: shipPosition.x,
        y: shipPosition.y,
        speed: CONFIG.projectileSpeed
    });
}

// Move projectiles
function moveProjectiles() {
    gameState.projectiles.forEach((projectile, index) => {
        projectile.y -= projectile.speed;
        projectile.element.style.top = projectile.y + 'px';
        
        // Remove projectiles that are off screen
        if (projectile.y < 0) {
            projectile.element.remove();
            gameState.projectiles.splice(index, 1);
        }
    });
}

// Move aliens
function moveAliens() {
    for (let i = gameState.aliens.length - 1; i >= 0; i--) {
        const alien = gameState.aliens[i];
        alien.position.y += alien.speed;
        
        // Add slight horizontal movement
        if (Math.random() < 0.02) { // 2% chance to change direction
            alien.element.classList.remove('moving-left', 'moving-right');
            alien.element.classList.add(Math.random() < 0.5 ? 'moving-left' : 'moving-right');
        }
        
        // Update alien position
        alien.element.style.top = alien.position.y + 'px';
        
        // Remove aliens that are off screen
        if (alien.position.y > gameArea.offsetHeight) {
            alien.element.remove();
            gameState.aliens.splice(i, 1);
            updateHealth(gameState.health - CONFIG.difficulties[gameState.difficulty].missedAlienPenalty);
        }
    }
}

// Ship movement
function moveShip(direction) {
    const speed = CONFIG.shipSpeed * (gameState.activePowerUps.speedBoost ? 1.5 : 1);
    
    // Remove previous movement classes
    ship.classList.remove('moving-left', 'moving-right');
    
    if (direction === 'left') {
        shipPosition.x = Math.max(0, shipPosition.x - speed);
        ship.classList.add('moving-left');
    } else if (direction === 'right') {
        shipPosition.x = Math.min(gameArea.offsetWidth - 50, shipPosition.x + speed);
        ship.classList.add('moving-right');
    }
    
    ship.style.left = shipPosition.x + 'px';
}

// Track pressed keys
const keys = {
    ArrowLeft: false,
    ArrowRight: false
};

// Event listeners for controls
document.addEventListener('keydown', (e) => {
    if (gameState.isGameOver) return;
    
    switch(e.key) {
        case 'ArrowLeft':
            keys.ArrowLeft = true;
            break;
        case 'ArrowRight':
            keys.ArrowRight = true;
            break;
        case ' ':
            shoot();
            e.preventDefault(); // Prevent page scrolling
            break;
        case 'p':
        case 'P':
            togglePause();
            break;
    }
});

document.addEventListener('keyup', (e) => {
    switch(e.key) {
        case 'ArrowLeft':
            keys.ArrowLeft = false;
            break;
        case 'ArrowRight':
            keys.ArrowRight = false;
            break;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        ship.classList.remove('moving-left', 'moving-right');
    }
});

// Game loop
function gameLoop() {
    if (!gameState.isPaused && !gameState.isGameOver) {
        // Handle continuous movement
        if (keys.ArrowLeft) moveShip('left');
        if (keys.ArrowRight) moveShip('right');
        
        moveProjectiles();
        moveAliens();
        checkCollisions();
        checkPowerUpCollisions();
        checkLaserCollisions();
        
        // Update laser position if active
        if (gameState.activePowerUps.laser) {
            gameState.activePowerUps.laser.element.style.left = (shipPosition.x + 23) + 'px';
        }
    }
    requestAnimationFrame(gameLoop);
}

function createAlien() {
    const alien = document.createElement('div');
    alien.className = 'alien';
    
    // Create alien ship components
    const beam = document.createElement('div');
    beam.className = 'alien-beam';
    
    const engineLeft = document.createElement('div');
    engineLeft.className = 'alien-engine-left';
    
    const engineRight = document.createElement('div');
    engineRight.className = 'alien-engine-right';
    
    const light1 = document.createElement('div');
    light1.className = 'alien-light-1';
    
    const light2 = document.createElement('div');
    light2.className = 'alien-light-2';
    
    const light3 = document.createElement('div');
    light3.className = 'alien-light-3';
    
    // Append components to alien ship
    alien.appendChild(beam);
    alien.appendChild(engineLeft);
    alien.appendChild(engineRight);
    alien.appendChild(light1);
    alien.appendChild(light2);
    alien.appendChild(light3);
    
    // Set initial position
    alien.style.left = Math.random() * (gameArea.offsetWidth - 60) + 'px';
    alien.style.top = '-50px';
    
    gameArea.appendChild(alien);
    gameState.aliens.push({
        element: alien,
        position: {
            x: parseFloat(alien.style.left),
            y: parseFloat(alien.style.top)
        },
        speed: CONFIG.difficulties[gameState.difficulty].alienSpeed * (Math.random() * 0.4 + 0.8) // Random speed variation
    });
}

function createProjectile(x, y) {
    const projectile = document.createElement('div');
    projectile.className = 'projectile';
    projectile.style.left = (x + 18) + 'px';  // Center the projectile
    projectile.style.top = y + 'px';
    gameArea.appendChild(projectile);
    return projectile;
}

function startAlienSpawning() {
    // Clear any existing spawn interval
    if (gameState.spawnInterval) {
        clearInterval(gameState.spawnInterval);
    }
    
    const spawnRate = CONFIG.difficulties[gameState.difficulty].spawnRate;
    gameState.spawnInterval = setInterval(() => {
        if (!gameState.isPaused && !gameState.isGameOver) {
            createAlien();
        }
    }, spawnRate);
}

function checkCollisions() {
    const projectiles = gameState.projectiles;
    const aliens = gameState.aliens;
    const shipRect = ship.getBoundingClientRect();
    
    // Check projectile-alien collisions
    projectiles.forEach((projectile, index) => {
        const projectileRect = projectile.element.getBoundingClientRect();
        
        aliens.forEach((alien, alienIndex) => {
            const alienRect = alien.element.getBoundingClientRect();
            
            if (isColliding(projectileRect, alienRect)) {
                // Create explosion effect
                const explosion = document.createElement('div');
                explosion.className = 'explosion';
                explosion.style.left = alienRect.left + 'px';
                explosion.style.top = alienRect.top + 'px';
                gameArea.appendChild(explosion);
                setTimeout(() => explosion.remove(), 500);
                
                alien.element.remove();
                projectile.element.remove();
                gameState.aliens.splice(alienIndex, 1);
                gameState.projectiles.splice(index, 1);
                
                const baseScore = 10 * CONFIG.difficulties[gameState.difficulty].scoreMultiplier;
                updateScore(gameState.score + baseScore);
            }
        });
    });
    
    // Check ship-alien collisions
    aliens.forEach((alien, index) => {
        const alienRect = alien.element.getBoundingClientRect();
        if (isColliding(shipRect, alienRect)) {
            alien.element.remove();
            gameState.aliens.splice(index, 1);
            updateHealth(gameState.health - CONFIG.difficulties[gameState.difficulty].healthLoss);
        }
    });
}

function isColliding(rect1, rect2) {
    return !(rect1.right < rect2.left || 
             rect1.left > rect2.right || 
             rect1.bottom < rect2.top || 
             rect1.top > rect2.bottom);
}

function updateScore(newScore) {
    gameState.score = newScore;
    document.getElementById('score').textContent = newScore;
    
    // Spawn power-up at score 100
    if (newScore >= 100 && !gameState.powerUpSpawned) {
        spawnPowerUp();
        gameState.powerUpSpawned = true;
    }
}

function spawnPowerUp() {
    const powerUp = document.createElement('div');
    powerUp.className = 'power-up';
    
    // Random position at top of screen
    powerUp.style.left = Math.random() * (gameArea.offsetWidth - 30) + 'px';
    powerUp.style.top = '50px';
    
    gameArea.appendChild(powerUp);
    gameState.powerUps.push({
        element: powerUp,
        position: {
            x: parseFloat(powerUp.style.left),
            y: parseFloat(powerUp.style.top)
        },
        type: 'laser'
    });
}

function activateLaser() {
    const laser = document.createElement('div');
    laser.className = 'laser-beam';
    laser.style.left = (shipPosition.x + 23) + 'px';  // Center on ship
    laser.style.top = '0';
    
    gameArea.appendChild(laser);
    gameState.activePowerUps.laser = {
        element: laser,
        duration: 10000  // 10 seconds
    };
    
    // Remove laser after duration
    setTimeout(() => {
        if (gameState.activePowerUps.laser) {
            gameState.activePowerUps.laser.element.remove();
            delete gameState.activePowerUps.laser;
        }
    }, 10000);
}

function checkPowerUpCollisions() {
    const projectiles = gameState.projectiles;
    const powerUps = gameState.powerUps;
    
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        const projectileRect = projectile.element.getBoundingClientRect();
        
        for (let j = powerUps.length - 1; j >= 0; j--) {
            const powerUp = powerUps[j];
            const powerUpRect = powerUp.element.getBoundingClientRect();
            
            if (isColliding(projectileRect, powerUpRect)) {
                // Remove power-up and projectile
                powerUp.element.remove();
                projectile.element.remove();
                powerUps.splice(j, 1);
                projectiles.splice(i, 1);
                
                // Activate laser
                activateLaser();
                break;
            }
        }
    }
}

function checkLaserCollisions() {
    if (!gameState.activePowerUps.laser) return;
    
    const laser = gameState.activePowerUps.laser.element;
    const laserRect = laser.getBoundingClientRect();
    const middleY = gameArea.offsetHeight / 2;
    
    for (let i = gameState.aliens.length - 1; i >= 0; i--) {
        const alien = gameState.aliens[i];
        const alienRect = alien.element.getBoundingClientRect();
        
        // Check if alien has reached middle of screen
        if (alienRect.top + alienRect.height / 2 >= middleY) {
            // Check if alien is in line with laser
            if (alienRect.left < laserRect.right && alienRect.right > laserRect.left) {
                // Remove alien
                alien.element.remove();
                gameState.aliens.splice(i, 1);
                
                // Update score
                updateScore(gameState.score + 10);
            }
        }
    }
}

function updateHealth(newHealth) {
    gameState.health = newHealth;
    document.getElementById('health').textContent = newHealth;
    
    if (newHealth <= 0) {
        gameOver();
    }
}

function updateLevel(newLevel) {
    gameState.level = newLevel;
    document.getElementById('level').textContent = newLevel;
}

function gameOver() {
    gameState.isGameOver = true;
    document.getElementById('game-over-screen').classList.remove('hidden');
    document.getElementById('final-score').textContent = Math.floor(gameState.score);
}

function togglePause() {
    gameState.isPaused = !gameState.isPaused;
    document.getElementById('pause-screen').classList.toggle('hidden', !gameState.isPaused);
}

// Initialize difficulty buttons
document.querySelectorAll('.difficulty-btn').forEach(button => {
    button.addEventListener('click', () => {
        if (button.id === 'restart-btn') {
            document.getElementById('game-over-screen').classList.add('hidden');
            initGame(gameState.difficulty);
        } else {
            const difficulty = button.getAttribute('data-difficulty');
            initGame(difficulty);
        }
    });
});

gameLoop();
