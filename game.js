(() => {
  const GRID_SIZE = 20;
  const CELL_SIZE = 20;
  const TICK_MS = 140;
  const VOLUME_BOOST = 2;
  const SLURP_BOOST = 4;

  const board = document.getElementById("board");
  const scoreEl = document.getElementById("score");
  const statusEl = document.getElementById("status");
  const startBtn = document.getElementById("start");
  const pauseBtn = document.getElementById("pause");
  const restartBtn = document.getElementById("restart");
  const overlayEl = document.getElementById("overlay");
  const meowEl = document.getElementById("meow");
  const slurpEl = document.getElementById("slurp");
  let slurpCtx = null;
  let slurpBuffer = null;
  let slurpGain = null;
  let meowGain = null;
  let meowSource = null;

  const ctx = board.getContext("2d");

  const DIRECTIONS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  const keyToDir = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    w: "up",
    s: "down",
    a: "left",
    d: "right",
  };

  const state = {
    snake: [],
    direction: "right",
    pendingDirection: "right",
    food: { x: 0, y: 0 },
    score: 0,
    running: false,
    paused: false,
    gameOver: false,
    needsDirection: true,
    timer: null,
  };

  function makeInitialSnake() {
    const mid = Math.floor(GRID_SIZE / 2);
    return [
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
      { x: mid - 3, y: mid },
    ];
  }

  function resetGame() {
    state.snake = makeInitialSnake();
    state.direction = null;
    state.pendingDirection = null;
    state.score = 0;
    state.running = false;
    state.paused = false;
    state.gameOver = false;
    state.needsDirection = true;
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    restartBtn.disabled = true;
    hideOverlay();
    spawnFood();
    updateUI("Ready");
    render();
  }

  function startGame() {
    if (state.running) return;
    if (state.gameOver) {
      resetGame();
    }
    if (state.needsDirection) {
      updateUI("Press a direction");
      startBtn.disabled = true;
      pauseBtn.disabled = true;
      restartBtn.disabled = false;
      return;
    }
    state.running = true;
    state.paused = false;
    updateUI("Running");
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    restartBtn.disabled = false;
    tickLoop();
  }

  function pauseGame() {
    if (!state.running) return;
    state.paused = !state.paused;
    updateUI(state.paused ? "Paused" : "Running");
  }

  function endGame() {
    state.running = false;
    state.paused = false;
    state.gameOver = true;
    state.needsDirection = true;
    updateUI("Game Over");
    startBtn.disabled = true;
    pauseBtn.disabled = true;
    restartBtn.disabled = false;
    showOverlay();
    playMeow();
  }

  function updateUI(status) {
    scoreEl.textContent = String(state.score);
    statusEl.textContent = status;
  }

  function tickLoop() {
    clearTimeout(state.timer);
    if (!state.running) return;
    state.timer = setTimeout(() => {
      if (!state.paused) {
        stepGame();
        render();
      }
      tickLoop();
    }, TICK_MS);
  }

  function stepGame() {
    commitDirection();

    const head = state.snake[0];
    const move = DIRECTIONS[state.direction];
    const next = { x: head.x + move.x, y: head.y + move.y };

    if (isCollision(next)) {
      endGame();
      return;
    }

    state.snake.unshift(next);

    if (next.x === state.food.x && next.y === state.food.y) {
      state.score += 1;
      playSlurp();
      spawnFood();
    } else {
      state.snake.pop();
    }
  }

  function commitDirection() {
    if (!state.pendingDirection) return;
    const next = state.pendingDirection;
    if (isOpposite(next, state.direction)) return;
    state.direction = next;
  }

  function isOpposite(dir, current) {
    return (
      (dir === "up" && current === "down") ||
      (dir === "down" && current === "up") ||
      (dir === "left" && current === "right") ||
      (dir === "right" && current === "left")
    );
  }

  function isCollision(pos) {
    if (pos.x < 0 || pos.y < 0 || pos.x >= GRID_SIZE || pos.y >= GRID_SIZE) {
      return true;
    }
    return state.snake.some((segment) => segment.x === pos.x && segment.y === pos.y);
  }

  function spawnFood(rng = Math.random) {
    const occupied = new Set(state.snake.map((s) => `${s.x},${s.y}`));
    const open = [];
    for (let y = 0; y < GRID_SIZE; y += 1) {
      for (let x = 0; x < GRID_SIZE; x += 1) {
        if (!occupied.has(`${x},${y}`)) {
          open.push({ x, y });
        }
      }
    }
    if (open.length === 0) {
      endGame();
      return;
    }
    const index = Math.floor(rng() * open.length);
    state.food = open[index];
  }

  function render() {
    ctx.clearRect(0, 0, board.width, board.height);

    ctx.strokeStyle = "#ded8cf";
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i += 1) {
      const offset = i * CELL_SIZE;
      ctx.beginPath();
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset, board.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, offset);
      ctx.lineTo(board.width, offset);
      ctx.stroke();
    }

    state.snake.forEach((segment, index) => {
      ctx.fillStyle = index === 0 ? "#1f3226" : "#2f4b3a";
      ctx.fillRect(
        segment.x * CELL_SIZE + 1,
        segment.y * CELL_SIZE + 1,
        CELL_SIZE - 2,
        CELL_SIZE - 2
      );
    });

    ctx.fillStyle = "#b53a2e";
    ctx.beginPath();
    ctx.arc(
      state.food.x * CELL_SIZE + CELL_SIZE / 2,
      state.food.y * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE / 2 - 3,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  function handleDirection(dir) {
    if (state.gameOver) {
      resetGame();
    }
    if (state.needsDirection) {
      state.direction = dir;
      state.pendingDirection = dir;
      state.needsDirection = false;
      startGame();
      return;
    }
    if (!state.running) {
      startGame();
    }
    state.pendingDirection = dir;
  }

  function showOverlay() {
    if (!overlayEl) return;
    overlayEl.classList.add("is-visible");
    overlayEl.setAttribute("aria-hidden", "false");
  }

  function hideOverlay() {
    if (!overlayEl) return;
    overlayEl.classList.remove("is-visible");
    overlayEl.setAttribute("aria-hidden", "true");
  }

  function playMeow() {
    if (!meowEl) return;
    meowEl.currentTime = 0;
    if (slurpCtx && meowGain) {
      meowGain.gain.value = VOLUME_BOOST;
      if (slurpCtx.state === "suspended") {
        slurpCtx.resume().catch(() => {});
      }
    } else {
      meowEl.volume = Math.min(1, VOLUME_BOOST);
    }
    const playPromise = meowEl.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  }

  function playSlurp() {
    if (slurpBuffer && slurpCtx) {
      if (slurpCtx.state === "suspended") {
        slurpCtx.resume().catch(() => {});
      }
      const source = slurpCtx.createBufferSource();
      source.buffer = slurpBuffer;
      if (slurpGain) {
        slurpGain.gain.value = SLURP_BOOST;
        source.connect(slurpGain);
      } else {
        const gain = slurpCtx.createGain();
        gain.gain.value = SLURP_BOOST;
        source.connect(gain).connect(slurpCtx.destination);
      }
      source.start(0);
      return;
    }
    if (!slurpEl) return;
    slurpEl.volume = Math.min(1, SLURP_BOOST);
    slurpEl.currentTime = 0;
    const playPromise = slurpEl.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  }

  document.addEventListener("keydown", (event) => {
    const key = event.key;
    if (key === " " || key === "p" || key === "P") {
      pauseGame();
      return;
    }
    if (key === "r" || key === "R") {
      resetGame();
      startGame();
      return;
    }
    const dir = keyToDir[key];
    if (dir) {
      event.preventDefault();
      handleDirection(dir);
    }
  });

  startBtn.addEventListener("click", () => startGame());
  pauseBtn.addEventListener("click", () => pauseGame());
  restartBtn.addEventListener("click", () => {
    resetGame();
  });

  if (overlayEl) {
    overlayEl.addEventListener("click", () => {
      resetGame();
    });
  }

  document.querySelectorAll("[data-dir]").forEach((button) => {
    button.addEventListener("click", () => {
      handleDirection(button.dataset.dir);
    });
  });

  document.querySelectorAll("[data-action='pause']").forEach((button) => {
    button.addEventListener("click", () => pauseGame());
  });

  if (slurpEl) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      slurpCtx = new AudioCtx();
      slurpGain = slurpCtx.createGain();
      slurpGain.gain.value = SLURP_BOOST;
      slurpGain.connect(slurpCtx.destination);
      if (meowEl) {
        meowSource = slurpCtx.createMediaElementSource(meowEl);
        meowGain = slurpCtx.createGain();
        meowGain.gain.value = VOLUME_BOOST;
        meowSource.connect(meowGain).connect(slurpCtx.destination);
      }
      fetch("slurp.mp3")
        .then((res) => res.arrayBuffer())
        .then((buf) => slurpCtx.decodeAudioData(buf))
        .then((decoded) => {
          slurpBuffer = decoded;
        })
        .catch(() => {});
    }
  }

  resetGame();
})();
