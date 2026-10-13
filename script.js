(function () {
  document.querySelectorAll('a.page-scroll[href*="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (event) {
      var href = this.getAttribute('href');
      if (!href || href.charAt(0) !== '#') return;
      var target = document.querySelector(href);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  var toggle = document.querySelector('.nav-toggle');
  var navLinks = document.getElementById('nav-links');
  if (toggle && navLinks) {
    toggle.addEventListener('click', function () {
      var isOpen = navLinks.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navLinks.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  var ageVerificationStorageKey = 'gamingHubAgeVerified';
  var ageVerificationModal = document.getElementById('age-verification-modal');
  var ageVerificationForm = document.getElementById('age-verification-form');
  var ageVerificationInput = document.getElementById('age-verification-date');
  var ageVerificationIdType = document.getElementById('age-verification-id-type');
  var ageVerificationIdNumber = document.getElementById('age-verification-id-number');
  var ageVerificationIdScan = document.getElementById('age-verification-id-scan');
  var ageVerificationIdScanPreview = document.getElementById('age-verification-id-scan-preview');
  var ageVerificationIdScanPreviewUrl = '';
  var ageVerificationError = document.getElementById('age-verification-error');
  var exitAgeVerificationButton = document.getElementById('exit-age-verification');
  var redoAgeVerificationButton = document.getElementById('redo-age-verification');

  function setAgeGateState(isOpen) {
    if (!document.body) return;
    document.body.classList.toggle('age-gate-active', isOpen);
    if (ageVerificationModal) {
      ageVerificationModal.hidden = !isOpen;
    }
    if (isOpen && ageVerificationInput) {
      ageVerificationInput.focus();
    }
  }

  function getAgeVerificationRecord() {
    try {
      return JSON.parse(localStorage.getItem(ageVerificationStorageKey) || 'null');
    } catch (error) {
      return null;
    }
  }

  function hashValue(value) {
    var normalized = String(value || '').trim().toLowerCase();
    var hash = 0;
    for (var i = 0; i < normalized.length; i += 1) {
      hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
    }
    return hash.toString(16);
  }

  function getAgeFromDate(dateString) {
    if (!dateString) return -1;
    var birthDate = new Date(dateString + 'T00:00:00');
    if (Number.isNaN(birthDate.getTime())) return -1;
    var today = new Date();
    var age = today.getFullYear() - birthDate.getFullYear();
    var monthDifference = today.getMonth() - birthDate.getMonth();
    if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) {
      age -= 1;
    }
    return age;
  }

  function normalizeIdNumber(value) {
    return String(value || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  }

  function isValidGovernmentId(type, number) {
    if (!type || !number) {
      return false;
    }
    var normalized = normalizeIdNumber(number);
    return /^[A-Z0-9]{6,20}$/.test(normalized) && normalized.length >= 6;
  }

  function setAgeError(message) {
    if (ageVerificationError) {
      ageVerificationError.textContent = message;
    }
  }

  function clearAgeVerificationScan() {
    if (ageVerificationIdScan) {
      ageVerificationIdScan.value = '';
    }
    if (ageVerificationIdScanPreview) {
      ageVerificationIdScanPreview.hidden = true;
      ageVerificationIdScanPreview.removeAttribute('src');
    }
    if (ageVerificationIdScanPreviewUrl) {
      URL.revokeObjectURL(ageVerificationIdScanPreviewUrl);
      ageVerificationIdScanPreviewUrl = '';
    }
  }

  function saveAgeVerification(dateString, idType, idNumber) {
    var record = {
      dobHash: hashValue(dateString),
      idType: String(idType || '').trim(),
      idHash: hashValue(normalizeIdNumber(idNumber)),
      demoIdScanSelected: Boolean(ageVerificationIdScan && ageVerificationIdScan.files && ageVerificationIdScan.files.length),
      verifiedAt: Date.now(),
      expiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000)
    };
    localStorage.setItem(ageVerificationStorageKey, JSON.stringify(record));
  }

  function isAgeVerified() {
    var record = getAgeVerificationRecord();
    if (!record || !record.dobHash || !record.idHash || !record.demoIdScanSelected || !record.expiresAt) return false;
    return Number(record.expiresAt) > Date.now();
  }

  if (ageVerificationModal && ageVerificationForm) {
    if (!isAgeVerified()) {
      setAgeGateState(true);
    } else {
      setAgeGateState(false);
    }

    if (ageVerificationIdScan && ageVerificationIdScanPreview) {
      ageVerificationIdScan.addEventListener('change', function () {
        var scanFile = ageVerificationIdScan.files && ageVerificationIdScan.files[0];
        if (!scanFile) return;

        var supportedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (supportedImageTypes.indexOf(scanFile.type) === -1 || scanFile.size > 10 * 1024 * 1024) {
          clearAgeVerificationScan();
          setAgeError('Choose a JPEG, PNG, or WebP image smaller than 10 MB.');
          return;
        }

        if (ageVerificationIdScanPreviewUrl) {
          URL.revokeObjectURL(ageVerificationIdScanPreviewUrl);
        }
        ageVerificationIdScanPreviewUrl = URL.createObjectURL(scanFile);
        ageVerificationIdScanPreview.src = ageVerificationIdScanPreviewUrl;
        ageVerificationIdScanPreview.hidden = false;
        setAgeError('');
      });
    }

    ageVerificationForm.addEventListener('submit', function (event) {
      event.preventDefault();
      setAgeError('');

      var dateValue = ageVerificationInput ? ageVerificationInput.value : '';
      var idTypeValue = ageVerificationIdType ? ageVerificationIdType.value : '';
      var idNumberValue = ageVerificationIdNumber ? ageVerificationIdNumber.value : '';
      var age = getAgeFromDate(dateValue);

      if (!dateValue || age < 0) {
        setAgeError('Please enter a valid date of birth.');
        return;
      }

      if (idTypeValue && !isValidGovernmentId(idTypeValue, idNumberValue)) {
        setAgeError('Please enter a valid government-issued ID number if you provide one.');
        return;
      }

      if (!ageVerificationIdScan || !ageVerificationIdScan.files || !ageVerificationIdScan.files.length) {
        setAgeError('Select an ID image to continue with demo verification.');
        return;
      }

      if (age < 14) {
        setAgeError('Access denied. This website is for users aged 14 and over only.');
        clearAgeVerificationScan();
        if (ageVerificationInput) {
          ageVerificationInput.value = '';
        }
        if (ageVerificationIdNumber) {
          ageVerificationIdNumber.value = '';
        }
        if (ageVerificationIdType) {
          ageVerificationIdType.value = '';
        }
        if (exitAgeVerificationButton) {
          exitAgeVerificationButton.focus();
        }
        return;
      }

      saveAgeVerification(dateValue, idTypeValue, idNumberValue);
  clearAgeVerificationScan();
      setAgeGateState(false);
    });

    if (redoAgeVerificationButton) {
      redoAgeVerificationButton.addEventListener('click', function () {
        try {
          localStorage.removeItem(ageVerificationStorageKey);
        } catch (error) {
          setAgeError('Unable to reset verification in this browser.');
          return;
        }

        ageVerificationForm.reset();
        clearAgeVerificationScan();
        setAgeError('');
        setAgeGateState(true);
      });
    }

    if (exitAgeVerificationButton) {
      exitAgeVerificationButton.addEventListener('click', function () {
        try {
          window.location.href = 'about:blank';
        } catch (error) {
          window.close();
        }
      });
    }
  }

  var reviewForm = document.getElementById('review-form');
  var reviewList = document.getElementById('review-list');
  var reviewStatus = document.getElementById('review-status');
  var reviewStorageKey = 'gamingHubReviews';

  function getSavedReviews() {
    try {
      var reviews = JSON.parse(localStorage.getItem(reviewStorageKey) || '[]');
      if (!Array.isArray(reviews)) return [];
      return reviews.filter(function (review) {
        return review && typeof review.name === 'string' && typeof review.text === 'string' &&
          Number.isInteger(Number(review.rating)) && Number(review.rating) >= 1 && Number(review.rating) <= 5;
      }).slice(0, 30);
    } catch (error) {
      return [];
    }
  }

  function createReviewCard(review) {
    var column = document.createElement('div');
    column.className = 'col-4';

    var card = document.createElement('article');
    card.className = 'testimonial google-review';

    var header = document.createElement('div');
    header.className = 'review-header';

    var stars = document.createElement('div');
    stars.className = 'review-stars';
    stars.setAttribute('aria-label', Number(review.rating) + ' out of 5 stars');
    stars.textContent = '★'.repeat(Number(review.rating)) + '☆'.repeat(5 - Number(review.rating));

    var badge = document.createElement('span');
    badge.className = 'review-badge';
    badge.textContent = 'Verified';

    var content = document.createElement('div');
    content.className = 'testimonial-content';

    var text = document.createElement('p');
    text.className = 'review-copy';
    text.textContent = review.text;

    var meta = document.createElement('div');
    meta.className = 'review-meta-row';

    var name = document.createElement('span');
    name.className = 'review-author';
    name.textContent = review.name;

    var source = document.createElement('span');
    source.className = 'review-source';
    source.textContent = 'Google review';

    header.appendChild(stars);
    header.appendChild(badge);

    meta.appendChild(name);
    meta.appendChild(source);

    content.appendChild(text);
    content.appendChild(meta);
    card.appendChild(header);
    card.appendChild(content);
    column.appendChild(card);
    return column;
  }

  if (reviewForm && reviewList) {
    getSavedReviews().reverse().forEach(function (review) {
      reviewList.insertBefore(createReviewCard(review), reviewList.firstChild);
    });

    reviewForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var name = reviewForm.elements.namedItem('name').value.trim();
      var rating = Number(reviewForm.elements.namedItem('rating').value);
      var text = reviewForm.elements.namedItem('review').value.trim();
      if (!name || !text || rating < 1 || rating > 5) {
        if (reviewStatus) {
          reviewStatus.textContent = 'Enter your name, choose a rating, and write a review before posting.';
        }
        return;
      }
      var review = { name: name, rating: rating, text: text };
      var reviews = getSavedReviews();
      reviews.unshift(review);
      reviews = reviews.slice(0, 30);

      var saved = false;
      try {
        localStorage.setItem(reviewStorageKey, JSON.stringify(reviews));
        saved = true;
      } catch (error) {
        saved = false;
      }

      reviewList.insertBefore(createReviewCard(review), reviewList.firstChild);
      reviewForm.reset();
      if (reviewStatus) {
        reviewStatus.textContent = saved
          ? 'Thanks, your review has been added.'
          : 'Your review was added for this visit, but browser storage is unavailable.';
      }
    });
  }

  var gameModal = document.getElementById('game-modal');
  var gameShell = document.getElementById('game-shell');
  var gameTitle = document.getElementById('game-title');
  var closeGameButton = document.getElementById('close-game');
  var restartGameButton = document.getElementById('restart-game');
  var freeGameButtons = document.querySelectorAll('[data-game]');
  var activeGameInterval = null;
  var activeKeyHandler = null;
  var activeGameState = null;

  function clearActiveGame() {
    if (activeGameInterval) {
      clearInterval(activeGameInterval);
      activeGameInterval = null;
    }
    if (activeKeyHandler) {
      window.removeEventListener('keydown', activeKeyHandler);
      activeKeyHandler = null;
    }
    activeGameState = null;
    if (gameShell) {
      gameShell.innerHTML = '';
    }
  }

  function setGameModalState(isOpen) {
    if (!gameModal) {
      return;
    }

    if (!isOpen && document.activeElement && gameModal.contains(document.activeElement)) {
      document.activeElement.blur();
    }

    gameModal.classList.toggle('is-open', isOpen);
    gameModal.setAttribute('aria-hidden', String(!isOpen));

    if ('inert' in HTMLElement.prototype && typeof gameModal.toggleAttribute === 'function') {
      gameModal.toggleAttribute('inert', !isOpen);
    }

    if (isOpen && closeGameButton) {
      closeGameButton.focus();
    }
  }

  function showGameOver(finalScore, message) {
    if (!gameShell) return;
    clearInterval(activeGameInterval);
    activeGameInterval = null;
    gameShell.innerHTML = '<div class="game-over-box"><div><h4>Game over</h4><p>' + message + '<br>Final score: ' + finalScore + '</p></div></div>';
  }

  function getGameTitle(key) {
    var titles = {
      'pixel-patrol': 'Pixel Patrol',
      'neon-kart': 'Neon Kart',
      'orbital-puzzles': 'Orbital Puzzles',
      'skyline-showdown': 'Skyline Showdown',
      'redemption-run': 'Redemption Run'
    };
    return titles[key] || 'Game';
  }

  function renderPixelPatrol() {
    if (!gameShell) return;
    var state = { score: 0, lives: 3, enemies: [] };
    activeGameState = state;
    gameShell.innerHTML = '<div class="game-panel"><div class="game-stats"><span>Score: <strong id="pixel-score">0</strong></span><span>Lives: <strong id="pixel-lives">3</strong></span></div><div class="game-scene"><div id="pixel-arena" class="pixel-arena"></div></div><p class="game-message">Click the glowing targets before they reach the bottom.</p></div>';
    var arena = document.getElementById('pixel-arena');
    var scoreLabel = document.getElementById('pixel-score');
    var livesLabel = document.getElementById('pixel-lives');

    function updateStats() {
      scoreLabel.textContent = String(state.score);
      livesLabel.textContent = String(state.lives);
    }

    function spawnEnemy() {
      var enemy = document.createElement('button');
      enemy.type = 'button';
      enemy.className = 'enemy-target';
      enemy.style.left = Math.random() * 82 + '%';
      enemy.style.top = '-16px';
      enemy.setAttribute('aria-label', 'Target');
      enemy.addEventListener('click', function () {
        state.score += 1;
        enemy.remove();
        var index = state.enemies.indexOf(enemy);
        if (index !== -1) {
          state.enemies.splice(index, 1);
        }
        updateStats();
        spawnEnemy();
      });
      arena.appendChild(enemy);
      state.enemies.push(enemy);
    }

    function tick() {
      var remaining = [];
      state.enemies.forEach(function (enemy) {
        var currentTop = parseFloat(enemy.style.top || '0');
        var nextTop = currentTop + 8;
        enemy.style.top = nextTop + 'px';
        if (nextTop >= 270) {
          state.lives -= 1;
          enemy.remove();
          if (state.lives <= 0) {
            showGameOver(state.score, 'The signal was lost. Try another run.');
            return;
          }
          updateStats();
        } else {
          remaining.push(enemy);
        }
      });
      state.enemies = remaining;
      if (state.lives > 0 && state.enemies.length < 5) {
        spawnEnemy();
      }
    }

    spawnEnemy();
    updateStats();
    activeGameInterval = setInterval(tick, 180);
  }

  function renderNeonKart() {
    if (!gameShell) return;
    var state = { score: 0, lives: 3, lane: 1, obstacles: [], laneWidth: 33.333 };
    activeGameState = state;
    gameShell.innerHTML = '<div class="game-panel"><div class="game-stats"><span>Score: <strong id="kart-score">0</strong></span><span>Lives: <strong id="kart-lives">3</strong></span></div><div class="game-scene"><div id="kart-track" class="kart-track"></div></div><p class="game-message">Use left and right arrow keys to dodge the red obstacles.</p></div>';
    var track = document.getElementById('kart-track');
    var scoreLabel = document.getElementById('kart-score');
    var livesLabel = document.getElementById('kart-lives');

    var laneEls = [0, 1, 2].map(function () {
      var lane = document.createElement('div');
      lane.className = 'kart-lane';
      track.appendChild(lane);
      return lane;
    });

    var kart = document.createElement('div');
    kart.className = 'kart';
    track.appendChild(kart);

    function updateKart() {
      var laneLeft = (state.lane * 33.333) + 17.5;
      kart.style.left = laneLeft + '%';
      scoreLabel.textContent = String(state.score);
      livesLabel.textContent = String(state.lives);
    }

    function addObstacle() {
      var obstacle = document.createElement('div');
      obstacle.className = 'kart-obstacle';
      var lane = Math.floor(Math.random() * 3);
      obstacle.style.left = (lane * 33.333 + 18) + '%';
      obstacle.style.top = '-20px';
      obstacle.dataset.lane = String(lane);
      track.appendChild(obstacle);
      state.obstacles.push({ lane: lane, element: obstacle, top: -20 });
    }

    function tick() {
      var nextObstacles = [];
      state.obstacles.forEach(function (obstacle) {
        obstacle.top += 14;
        obstacle.element.style.top = obstacle.top + 'px';
        if (obstacle.top > 250) {
          obstacle.element.remove();
          if (obstacle.lane === state.lane) {
            state.lives -= 1;
            if (state.lives <= 0) {
              showGameOver(state.score, 'You clipped the traffic. Hit restart to try again.');
              return;
            }
            livesLabel.textContent = String(state.lives);
          }
        } else {
          nextObstacles.push(obstacle);
        }
      });
      state.obstacles = nextObstacles;
      state.score += 1;
      scoreLabel.textContent = String(state.score);
      if (Math.random() < 0.28) {
        addObstacle();
      }
      if (Math.random() < 0.5) {
        laneEls.forEach(function (laneEl) {
          laneEl.style.opacity = '0.6';
        });
      }
    }

    activeKeyHandler = function (event) {
      if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
        state.lane = Math.max(0, state.lane - 1);
      }
      if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
        state.lane = Math.min(2, state.lane + 1);
      }
      updateKart();
    };
    window.addEventListener('keydown', activeKeyHandler);
    updateKart();
    activeGameInterval = setInterval(tick, 160);
  }

  function renderOrbitalPuzzles() {
    if (!gameShell) return;
    var state = { sequence: [], userIndex: 0, activeFlash: null, score: 0 };
    activeGameState = state;
    gameShell.innerHTML = '<div class="game-panel"><div class="game-stats"><span>Score: <strong id="orbital-score">0</strong></span><span>Pattern length: <strong id="orbital-length">0</strong></span></div><div class="puzzle-grid" id="puzzle-grid"></div><p class="game-message">Watch the sequence, then repeat it by clicking the glowing nodes.</p></div>';
    var grid = document.getElementById('puzzle-grid');
    var scoreLabel = document.getElementById('orbital-score');
    var lengthLabel = document.getElementById('orbital-length');
    var buttons = [];

    for (var i = 0; i < 9; i += 1) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'sequence-orb';
      button.dataset.index = String(i);
      button.addEventListener('click', function () {
        if (!state.sequence.length) {
          return;
        }
        var selected = Number(this.dataset.index);
        if (selected !== state.sequence[state.userIndex]) {
          showGameOver(state.score, 'The orbit broke. Try the pattern again.');
          return;
        }
        this.classList.add('active');
        setTimeout(function () {
          button.classList.remove('active');
        }, 180);
        state.userIndex += 1;
        if (state.userIndex === state.sequence.length) {
          state.score += 1;
          scoreLabel.textContent = String(state.score);
          setTimeout(function () {
            state.userIndex = 0;
            addRound();
          }, 350);
        }
      });
      buttons.push(button);
      grid.appendChild(button);
    }

    function flashNode(index) {
      var node = buttons[index];
      node.classList.add('active');
      setTimeout(function () {
        node.classList.remove('active');
      }, 350);
    }

    function addRound() {
      var next = Math.floor(Math.random() * 9);
      state.sequence.push(next);
      lengthLabel.textContent = String(state.sequence.length);
      var stepIndex = 0;
      if (state.activeFlash) {
        clearInterval(state.activeFlash);
      }
      state.activeFlash = setInterval(function () {
        if (stepIndex >= state.sequence.length) {
          clearInterval(state.activeFlash);
          state.activeFlash = null;
          return;
        }
        flashNode(state.sequence[stepIndex]);
        stepIndex += 1;
      }, 500);
    }

    addRound();
    scoreLabel.textContent = '0';
    lengthLabel.textContent = '1';
  }

  function renderSkylineShowdown() {
    if (!gameShell) return;
    var state = { score: 0, lives: 3 };
    activeGameState = state;
    gameShell.innerHTML = '<div class="game-panel"><div class="game-stats"><span>Score: <strong id="skyline-score">0</strong></span><span>Lives: <strong id="skyline-lives">3</strong></span></div><div class="game-scene"><div id="skyline-scene" class="skyline-scene"></div></div><p class="game-message">Click the moving skyline target before it jumps to a new spot.</p></div>';
    var scene = document.getElementById('skyline-scene');
    var scoreLabel = document.getElementById('skyline-score');
    var livesLabel = document.getElementById('skyline-lives');

    var target = document.createElement('button');
    target.type = 'button';
    target.className = 'skyline-target';
    target.setAttribute('aria-label', 'Skyline target');
    target.addEventListener('click', function () {
      state.score += 1;
      scoreLabel.textContent = String(state.score);
      moveTarget();
    });
    scene.appendChild(target);

    function moveTarget() {
      var x = Math.random() * 72 + 6;
      target.style.left = x + '%';
      target.style.top = 'auto';
      target.style.bottom = '20px';
    }

    function tick() {
      state.lives -= 1;
      livesLabel.textContent = String(state.lives);
      if (state.lives <= 0) {
        showGameOver(state.score, 'The skyline slipped away. Try a fresh start.');
      } else {
        moveTarget();
      }
    }

    scoreLabel.textContent = '0';
    livesLabel.textContent = '3';
    moveTarget();
    activeGameInterval = setInterval(tick, 1800);
  }

  function renderRedemptionRun() {
    if (!gameShell) return;
    var state = {
      score: 0,
      health: 5,
      ammo: 10,
      playerX: 50,
      bullets: [],
      enemies: [],
      dust: [],
      cooldown: 0,
      lastSpawn: 0,
      reloadTimer: 0
    };
    activeGameState = state;
    gameShell.innerHTML = '<div class="game-panel"><div class="game-stats"><span>Score: <strong id="redemption-score">0</strong></span><span>Health: <strong id="redemption-health">5</strong></span><span>Ammo: <strong id="redemption-ammo">10</strong></span></div><div class="game-scene"><div id="redemption-scene" class="redemption-scene"></div></div><p class="game-message">Use A/D or the arrow keys to move. Press Space to shoot and hold off the bandits.</p></div>';

    var scene = document.getElementById('redemption-scene');
    var scoreLabel = document.getElementById('redemption-score');
    var healthLabel = document.getElementById('redemption-health');
    var ammoLabel = document.getElementById('redemption-ammo');

    var sun = document.createElement('div');
    sun.className = 'redemption-sun';
    scene.appendChild(sun);

    var horizon = document.createElement('div');
    horizon.className = 'redemption-horizon';
    scene.appendChild(horizon);

    var skyline = document.createElement('div');
    skyline.className = 'redemption-skyline';
    scene.appendChild(skyline);

    var player = document.createElement('div');
    player.className = 'redemption-player';
    scene.appendChild(player);

    function addCactus(x) {
      var cactus = document.createElement('div');
      cactus.className = 'redemption-cactus';
      cactus.style.left = x + '%';
      scene.appendChild(cactus);
      return cactus;
    }

    addCactus(12);
    addCactus(28);
    addCactus(72);
    addCactus(86);

    function makeDust(x, y) {
      var dust = document.createElement('div');
      dust.className = 'redemption-dust';
      dust.style.left = x + '%';
      dust.style.top = y + 'px';
      scene.appendChild(dust);
      state.dust.push({ element: dust, x: x, y: y, life: 28 });
    }

    function updateHud() {
      scoreLabel.textContent = String(state.score);
      healthLabel.textContent = String(state.health);
      ammoLabel.textContent = String(state.ammo);
      player.style.left = state.playerX + '%';
    }

    function spawnEnemy() {
      var enemy = document.createElement('div');
      enemy.className = 'redemption-enemy';
      var x = Math.random() * 82 + 8;
      enemy.style.left = x + '%';
      enemy.style.top = '-24px';
      scene.appendChild(enemy);
      state.enemies.push({ element: enemy, x: x, y: -24, speed: 2.1 + Math.random() * 2.2, hit: false });
    }

    function shoot() {
      if (state.ammo <= 0 || state.cooldown > 0) return;
      state.ammo -= 1;
      state.cooldown = 160;
      var bullet = document.createElement('div');
      bullet.className = 'redemption-bullet';
      var bulletX = state.playerX;
      bullet.style.left = bulletX + '%';
      bullet.style.bottom = '46px';
      scene.appendChild(bullet);
      state.bullets.push({ element: bullet, x: bulletX, y: 255, speed: 7.2 });
      updateHud();
    }

    function hitPlayer() {
      state.health -= 1;
      updateHud();
      if (state.health <= 0) {
        showGameOver(state.score, 'The outlaws overwhelmed the stagecoach. Saddle up and try again.');
      }
    }

    function tick() {
      if (!gameShell || !scene) return;
      state.cooldown = Math.max(0, state.cooldown - 16);
      state.lastSpawn += 16;
      state.reloadTimer = Math.max(0, state.reloadTimer - 16);

      if (state.reloadTimer === 0 && state.ammo === 0) {
        state.ammo = 10;
        state.reloadTimer = 800;
      }

      if (state.lastSpawn > 820) {
        state.lastSpawn = 0;
        spawnEnemy();
      }

      makeDust(state.playerX + (Math.random() * 8 - 4), 290 + Math.random() * 6);
      state.dust = state.dust.filter(function (dust) {
        dust.y += 1.1;
        dust.element.style.top = dust.y + 'px';
        dust.element.style.left = dust.x + '%';
        dust.life -= 1;
        if (dust.life <= 0) {
          dust.element.remove();
          return false;
        }
        return true;
      });

      var remainingBullets = [];
      state.bullets.forEach(function (bullet) {
        bullet.y -= bullet.speed;
        bullet.element.style.top = bullet.y + 'px';
        bullet.element.style.left = bullet.x + '%';
        if (bullet.y < -10) {
          bullet.element.remove();
          return;
        }
        remainingBullets.push(bullet);
      });
      state.bullets = remainingBullets;

      var remainingEnemies = [];
      state.enemies.forEach(function (enemy) {
        enemy.y += enemy.speed;
        enemy.element.style.top = enemy.y + 'px';
        enemy.element.style.left = enemy.x + '%';

        var playerHit = Math.abs(enemy.x - state.playerX) < 10 && enemy.y > 220;
        if (playerHit) {
          enemy.element.remove();
          hitPlayer();
          return;
        }

        var enemyDefeated = false;
        state.bullets.forEach(function (bullet) {
          if (enemyDefeated) return;
          if (Math.abs(enemy.x - bullet.x) < 8 && Math.abs(enemy.y - bullet.y) < 18) {
            bullet.element.remove();
            enemy.element.remove();
            state.score += 2;
            updateHud();
            enemyDefeated = true;
          }
        });

        if (!enemyDefeated) {
          remainingEnemies.push(enemy);
        }
      });
      state.enemies = remainingEnemies;

      if (state.enemies.length === 0 && Math.random() < 0.15) {
        spawnEnemy();
      }

      updateHud();
    }

    activeKeyHandler = function (event) {
      var key = event.key && event.key.toLowerCase ? event.key.toLowerCase() : '';
      if (key === 'arrowleft' || key === 'a') {
        state.playerX = Math.max(8, state.playerX - 4.9);
      }
      if (key === 'arrowright' || key === 'd') {
        state.playerX = Math.min(92, state.playerX + 4.9);
      }
      if (event.code === 'Space') {
        event.preventDefault();
        shoot();
      }
      updateHud();
    };
    window.addEventListener('keydown', activeKeyHandler);

    updateHud();
    spawnEnemy();
    activeGameInterval = setInterval(tick, 30);
  }

  function startGame(gameKey) {
    clearActiveGame();
    setGameModalState(true);
    if (gameTitle) {
      gameTitle.textContent = getGameTitle(gameKey);
    }

    switch (gameKey) {
      case 'pixel-patrol':
        renderPixelPatrol();
        break;
      case 'neon-kart':
        renderNeonKart();
        break;
      case 'orbital-puzzles':
        renderOrbitalPuzzles();
        break;
      case 'skyline-showdown':
        renderSkylineShowdown();
        break;
      case 'redemption-run':
        renderRedemptionRun();
        break;
      default:
        if (gameShell) {
          gameShell.innerHTML = '<div class="game-over-box"><div><h4>Coming soon</h4><p>This game is not available yet.</p></div></div>';
        }
    }
  }

  if (gameModal) {
    closeGameButton.addEventListener('click', function () {
      setGameModalState(false);
      clearActiveGame();
    });

    restartGameButton.addEventListener('click', function () {
      var currentGame = gameTitle && gameTitle.textContent ? gameTitle.textContent : '';
      var gameKeyMap = {
        'Pixel Patrol': 'pixel-patrol',
        'Neon Kart': 'neon-kart',
        'Orbital Puzzles': 'orbital-puzzles',
        'Skyline Showdown': 'skyline-showdown',
        'Redemption Run': 'redemption-run'
      };
      var gameKey = gameKeyMap[currentGame];
      if (!gameKey) {
        return;
      }
      startGame(gameKey);
    });

    gameModal.addEventListener('click', function (event) {
      if (event.target === gameModal) {
        setGameModalState(false);
        clearActiveGame();
      }
    });
  }

  freeGameButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      startGame(button.dataset.game);
    });
  });

  var cartBlock = document.getElementById('shopping-cart');
  if (cartBlock) {
    var cartList = document.getElementById('cart-items');
    var cartCount = document.getElementById('cart-count');
    var cartTotal = document.getElementById('cart-total');
    var clearCartButton = document.getElementById('clear-cart');
    var checkoutProductsButton = document.getElementById('checkout-products-button');
    var checkoutSubscriptionsButton = document.getElementById('checkout-subscriptions-button');
    var checkoutModal = document.getElementById('checkout-modal');
    var checkoutTitle = document.getElementById('checkout-title');
    var checkoutSummaryTitle = document.getElementById('checkout-summary-title');
    var paymentDemoNote = document.getElementById('payment-demo-note');
    var closeCheckoutButton = document.getElementById('close-checkout');
    var cancelCheckoutButton = document.getElementById('cancel-checkout');
    var checkoutForm = document.getElementById('checkout-form');
    var paymentMethodRadios = document.querySelectorAll('input[name="payment-method"]');
    var paymentCardFields = document.getElementById('payment-card-fields');
    var secureCheck = document.getElementById('secure-check');
    var placeOrderButton = document.getElementById('place-order-button');
    var checkoutSummaryItems = document.getElementById('checkout-summary-items');
    var checkoutTotal = document.getElementById('checkout-total');
    var checkoutSuccess = document.getElementById('checkout-success');
    var promoCodeInput = document.getElementById('promo-code');
    var applyPromoButton = document.getElementById('apply-promo');
    var promoMessage = document.getElementById('promo-message');
    var storageKey = 'gamingHubCart';
    var promoCode = '5833';
    var freeOrderPromoCode = '8547';
    var checkoutType = 'product';

    function getCart() {
      try {
        return JSON.parse(localStorage.getItem(storageKey) || '[]');
      } catch (error) {
        return [];
      }
    }

    function saveCart(cart) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(cart));
      } catch (error) {
        // Ignore storage errors in restricted environments.
      }
    }

    function formatCurrency(value) {
      var numeric = toBigInt(value);
      var sign = numeric < 0n ? '-' : '';
      var digits = sign ? numeric.toString().slice(1) : numeric.toString();
      digits = digits.padStart(3, '0');
      var wholeUnits = digits.slice(0, -2);
      var fractionalUnits = digits.slice(-2);

      var groups = [];
      while (wholeUnits.length > 3) {
        groups.unshift(wholeUnits.slice(-3));
        wholeUnits = wholeUnits.slice(0, -3);
      }
      groups.unshift(wholeUnits);

      return '£' + sign + groups.join(',') + '.' + fractionalUnits;
    }

    function toBigInt(value) {
      if (typeof value === 'bigint') {
        return value;
      }

      if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
          return 0n;
        }
        return BigInt(Math.trunc(value));
      }

      var cleanValue = String(value).replace(/[^0-9-]/g, '');
      if (!cleanValue || cleanValue === '-') {
        return 0n;
      }

      return BigInt(cleanValue);
    }

    function getItemPrice(item) {
      if (item.pricePence !== undefined) {
        return toBigInt(item.pricePence);
      }
      return toBigInt(item.price) * 100n;
    }

    function getItemType(item) {
      if (item.type === 'subscription' || item.type === 'product') {
        return item.type;
      }
      return String(item.name || '').toLowerCase().indexOf('subscription') !== -1
        ? 'subscription'
        : 'product';
    }

    function getCheckoutCart(cart) {
      return (cart || getCart()).filter(function (item) {
        return getItemType(item) === checkoutType;
      });
    }

    function getFreeSubscriptionTotal(cart) {
      var currentCart = cart || getCart();
      var freeAmount = 0n;

      if (!currentCart || !currentCart.length) {
        return freeAmount;
      }

      currentCart.forEach(function (item) {
        var name = String(item && item.name ? item.name : '').toLowerCase();
        if (name.indexOf('pro gaming hub subscription') !== -1) {
          freeAmount += getItemPrice(item) * BigInt(item.quantity || 1);
        }
      });

      return freeAmount;
    }

    function getPromoStatus() {
      if (!promoCodeInput) {
        return false;
      }

      var value = promoCodeInput.value.trim();
      return value === promoCode || value === freeOrderPromoCode;
    }

    function hasFreeOrderPromo() {
      return Boolean(promoCodeInput && promoCodeInput.value.trim() === freeOrderPromoCode);
    }

    function renderPromoMessage() {
      if (!promoMessage || !promoCodeInput) {
        return;
      }

      var value = promoCodeInput.value.trim();
      if (!value) {
        promoMessage.textContent = 'Enter a valid promo code';
        promoMessage.style.color = '#ffd166';
        return;
      }

      if (value === promoCode || value === freeOrderPromoCode) {
        promoMessage.textContent = 'Promo applied';
        promoMessage.style.color = '#2ecc71';
      } else {
        promoMessage.textContent = 'Invalid promo code';
        promoMessage.style.color = '#ff6b6b';
      }
    }

    function getTotalWithPromo(totalCost, cart) {
      var cost = toBigInt(totalCost);
      if (hasFreeOrderPromo()) {
        return 0n;
      }

      if (!getPromoStatus()) {
        return cost;
      }

      var subscriptionDiscount = getFreeSubscriptionTotal(cart);
      if (subscriptionDiscount > 0n) {
        return cost > subscriptionDiscount ? cost - subscriptionDiscount : 0n;
      }

      return cost;
    }

    function updateCheckoutSummary() {
      var cart = getCheckoutCart();
      var totalCost = 0n;

      if (!checkoutSummaryItems || !checkoutTotal) {
        return;
      }

      if (!cart.length) {
        checkoutSummaryItems.innerHTML = '<li><span>No ' + (checkoutType === 'subscription' ? 'subscriptions' : 'products') + ' selected</span><span>£0.00</span></li>';
        checkoutTotal.textContent = '£0.00';
        return;
      }

      checkoutSummaryItems.innerHTML = '';
      cart.forEach(function (item) {
        var lineTotal = getItemPrice(item) * BigInt(item.quantity);
        totalCost += lineTotal;
        var line = document.createElement('li');
        line.innerHTML = '<span>' + item.name + ' x' + item.quantity + '</span><span>' + formatCurrency(lineTotal) + '</span>';
        checkoutSummaryItems.appendChild(line);
      });

      checkoutTotal.textContent = formatCurrency(getTotalWithPromo(totalCost, cart));
    }

    function renderCart() {
      var cart = getCart();
      var totalItems = 0;
      var totalCost = 0n;

      if (!cartList || !cartCount || !cartTotal) {
        return;
      }

      if (!cart.length) {
        cartList.innerHTML = '<li>Your cart is empty.</li>';
        cartCount.textContent = '0 items';
        cartTotal.textContent = '£0.00';
        if (checkoutProductsButton) checkoutProductsButton.disabled = true;
        if (checkoutSubscriptionsButton) checkoutSubscriptionsButton.hidden = true;
        updateCheckoutSummary();
        return;
      }

      cartList.innerHTML = '';
      cart.forEach(function (item, index) {
        totalItems += item.quantity;
        var lineTotal = getItemPrice(item) * BigInt(item.quantity);
        totalCost += lineTotal;

        var listItem = document.createElement('li');
        var productInfo = document.createElement('span');
        var removeButton = document.createElement('button');

        productInfo.textContent = (getItemType(item) === 'subscription' ? 'Subscription: ' : 'Product: ') + item.name + ' x' + item.quantity + ' — ' + formatCurrency(lineTotal);
        removeButton.type = 'button';
        removeButton.className = 'remove-item';
        removeButton.textContent = 'Remove';
        removeButton.addEventListener('click', function () {
          var updatedCart = getCart();
          updatedCart.splice(index, 1);
          saveCart(updatedCart);
          renderCart();
        });

        listItem.appendChild(productInfo);
        listItem.appendChild(removeButton);
        cartList.appendChild(listItem);
      });

      cartCount.textContent = totalItems + (totalItems === 1 ? ' item' : ' items');
      cartTotal.textContent = formatCurrency(totalCost);
      if (checkoutProductsButton) {
        checkoutProductsButton.disabled = !cart.some(function (item) { return getItemType(item) === 'product'; });
      }
      if (checkoutSubscriptionsButton) {
        var hasSubscriptions = cart.some(function (item) { return getItemType(item) === 'subscription'; });
        checkoutSubscriptionsButton.hidden = !hasSubscriptions;
        checkoutSubscriptionsButton.disabled = !hasSubscriptions;
      }
      updateCheckoutSummary();
    }

    function openCheckout(type) {
      if (!checkoutModal) return;
      checkoutType = type;
      var isSubscription = checkoutType === 'subscription';
      if (checkoutTitle) checkoutTitle.textContent = isSubscription ? 'Subscription checkout' : 'Product checkout';
      if (checkoutSummaryTitle) checkoutSummaryTitle.textContent = isSubscription ? 'Subscription Summary' : 'Product Summary';
      if (paymentDemoNote) {
        paymentDemoNote.textContent = isSubscription
          ? 'Annual subscription demo. No recurring payment will be charged.'
          : 'Product checkout demo. No real payment will be charged.';
      }
      document.querySelectorAll('.subscription-shipping-field').forEach(function (field) {
        field.hidden = isSubscription;
        field.querySelectorAll('input, select').forEach(function (input) {
          input.required = !isSubscription;
        });
      });
      updatePaymentMethod();
      updateCheckoutSummary();
      checkoutModal.classList.add('open');
      checkoutModal.setAttribute('aria-hidden', 'false');
    }

    function closeCheckout() {
      if (!checkoutModal) return;
      checkoutModal.classList.remove('open');
      checkoutModal.setAttribute('aria-hidden', 'true');
      if (checkoutSuccess) {
        checkoutSuccess.classList.remove('visible');
      }
    }

    function updatePaymentMethod() {
      var selectedMethod = document.querySelector('input[name="payment-method"]:checked');
      var isInstantPay = selectedMethod && selectedMethod.value === 'instant';
      var isFreeOrder = hasFreeOrderPromo();
      var skipsCardDetails = Boolean(isInstantPay || isFreeOrder);

      paymentMethodRadios.forEach(function (radio) {
        var option = radio.closest('.payment-option');
        if (option) {
          option.classList.toggle('selected', radio.checked);
        }
      });

      if (paymentCardFields) {
        paymentCardFields.hidden = skipsCardDetails;
        paymentCardFields.querySelectorAll('input, select').forEach(function (field) {
          field.required = !skipsCardDetails;
        });
      }

      if (secureCheck) {
        secureCheck.hidden = skipsCardDetails;
        var secureConfirmation = secureCheck.querySelector('input');
        if (secureConfirmation) {
          secureConfirmation.required = !skipsCardDetails;
        }
      }

      if (placeOrderButton) {
        placeOrderButton.textContent = isFreeOrder
          ? 'Complete free order'
          : isInstantPay ? 'Pay instantly (demo)' : checkoutType === 'subscription' ? 'Start subscription (demo)' : 'Place order';
      }
    }

    paymentMethodRadios.forEach(function (radio) {
      radio.addEventListener('change', updatePaymentMethod);
    });

    document.querySelectorAll('.add-to-cart').forEach(function (button) {
      button.addEventListener('click', function () {
        var name = button.dataset.name;
          var itemType = button.dataset.itemType || 'product';
          var price = button.dataset.pricePence !== undefined
            ? toBigInt(button.dataset.pricePence)
            : toBigInt(button.dataset.price || '0') * 100n;
        var cart = getCart();
        var existingItem = cart.find(function (item) {
            return item.name === name && getItemType(item) === itemType;
        });

        if (existingItem) {
          existingItem.quantity += 1;
        } else {
            cart.push({ name: name, type: itemType, pricePence: String(price), quantity: 1 });
        }

        saveCart(cart);
        renderCart();
      });
    });

    if (checkoutProductsButton) {
      checkoutProductsButton.addEventListener('click', function () {
        if (!checkoutProductsButton.disabled) openCheckout('product');
      });
    }

    if (checkoutSubscriptionsButton) {
      checkoutSubscriptionsButton.addEventListener('click', function () {
        if (!checkoutSubscriptionsButton.disabled) openCheckout('subscription');
      });
    }

    if (closeCheckoutButton) {
      closeCheckoutButton.addEventListener('click', closeCheckout);
    }

    if (cancelCheckoutButton) {
      cancelCheckoutButton.addEventListener('click', closeCheckout);
    }

    if (checkoutModal) {
      checkoutModal.addEventListener('click', function (event) {
        if (event.target === checkoutModal) {
          closeCheckout();
        }
      });
    }

    function validateCardDetails() {
      var cardNumber = document.getElementById('card-number');
      var cardExpiry = document.getElementById('card-expiry');
      var cardCvv = document.getElementById('card-cvv');
      var cardPostcode = document.getElementById('card-postcode');
      var isValid = true;

      if (cardNumber) {
        var digits = cardNumber.value.replace(/\D/g, '');
        if (digits.length < 15 || digits.length > 19) {
          cardNumber.setCustomValidity('Enter a valid card number.');
          isValid = false;
        } else {
          cardNumber.setCustomValidity('');
        }
      }

      if (cardExpiry) {
        var expiry = cardExpiry.value.trim();
        var expiryMatch = /^(0[1-9]|1[0-2])\s*\/\s*(\d{2,4})$/;
        if (!expiryMatch.test(expiry)) {
          cardExpiry.setCustomValidity('Use MM / YY format.');
          isValid = false;
        } else {
          cardExpiry.setCustomValidity('');
        }
      }

      if (cardCvv) {
        var cvv = cardCvv.value.replace(/\D/g, '');
        if (cvv.length < 3 || cvv.length > 4) {
          cardCvv.setCustomValidity('Enter a valid CVV.');
          isValid = false;
        } else {
          cardCvv.setCustomValidity('');
        }
      }

      if (cardPostcode) {
        var postcode = cardPostcode.value.trim();
        if (!postcode) {
          cardPostcode.setCustomValidity('Billing postcode is required.');
          isValid = false;
        } else {
          cardPostcode.setCustomValidity('');
        }
      }

      return isValid;
    }

    if (checkoutForm) {
      checkoutForm.addEventListener('submit', function (event) {
        event.preventDefault();
        var selectedMethod = document.querySelector('input[name="payment-method"]:checked');
        var isInstantPay = selectedMethod && selectedMethod.value === 'instant';
        var isFreeOrder = hasFreeOrderPromo();

        if (!isInstantPay && !isFreeOrder && !validateCardDetails()) {
          checkoutForm.reportValidity();
          return;
        }

        if (checkoutSuccess) {
          checkoutSuccess.textContent = isFreeOrder
            ? 'Free demo checkout complete. No payment was charged.'
            : isInstantPay
              ? 'Demo instant payment complete. No real payment was charged.'
              : checkoutType === 'subscription'
                ? 'Demo subscription started. No recurring payment was charged.'
                : 'Demo product order complete. No real payment was charged.';
          checkoutSuccess.classList.add('visible');
        }
        saveCart(getCart().filter(function (item) {
          return getItemType(item) !== checkoutType;
        }));
        renderCart();
        checkoutForm.reset();
        updatePaymentMethod();
        setTimeout(function () {
          closeCheckout();
        }, 2000);
      });
    }

    if (clearCartButton) {
      clearCartButton.addEventListener('click', function () {
        saveCart([]);
        renderCart();
      });
    }

    if (promoCodeInput) {
      promoCodeInput.addEventListener('input', function () {
        renderPromoMessage();
        renderCart();
        updatePaymentMethod();
      });
    }

    if (applyPromoButton) {
      applyPromoButton.addEventListener('click', function () {
        renderPromoMessage();
        renderCart();
        updatePaymentMethod();
      });
    }

    updatePaymentMethod();
    renderCart();
    renderPromoMessage();
  }

  var planButtons = document.querySelectorAll('[data-start-plan]');
  var membershipCheckout = document.getElementById('membership-checkout');
  var membershipDialog = membershipCheckout && membershipCheckout.querySelector('.membership-dialog');
  var accountStep = document.getElementById('membership-account-step');
  var paymentStep = document.getElementById('membership-payment-step');
  var membershipComplete = document.getElementById('membership-complete');
  var accountStepForm = document.getElementById('membership-account-form');
  var paymentStepForm = document.getElementById('membership-payment-form');
  var membershipEmail = document.getElementById('membership-email');
  var membershipStatus = document.getElementById('membership-status');
  var membershipError = document.getElementById('membership-error');
  var selectedPlan = null;
  var previousPlanButton = null;

  function setMembershipStep(step) {
    if (!accountStep || !paymentStep || !membershipComplete) return;
    accountStep.hidden = step !== 'account';
    paymentStep.hidden = step !== 'payment';
    membershipComplete.hidden = step !== 'complete';
    document.querySelectorAll('[data-membership-step]').forEach(function (label) {
      if (step === 'complete') {
        label.removeAttribute('aria-current');
      } else if (label.dataset.membershipStep === step) {
        label.setAttribute('aria-current', 'step');
      } else {
        label.removeAttribute('aria-current');
      }
    });
  }

  function closeMembershipCheckout() {
    if (!membershipCheckout) return;
    membershipCheckout.hidden = true;
    document.body.classList.remove('membership-checkout-open');
    if (previousPlanButton) previousPlanButton.focus();
  }

  function openMembershipCheckout(button) {
    if (!membershipCheckout || !button) return;
    previousPlanButton = button;
    selectedPlan = {
      id: button.dataset.planId,
      name: button.dataset.planName,
      price: button.dataset.planPrice
    };

    document.querySelectorAll('[data-selected-plan-name]').forEach(function (element) {
      element.textContent = selectedPlan.name;
    });
    document.querySelectorAll('[data-selected-plan-price]').forEach(function (element) {
      element.textContent = selectedPlan.price;
    });
    accountStepForm.reset();
    paymentStepForm.reset();
    if (membershipStatus) membershipStatus.textContent = '';
    if (membershipError) {
      membershipError.hidden = true;
      membershipError.textContent = '';
    }
    setMembershipStep('account');
    membershipCheckout.hidden = false;
    document.body.classList.add('membership-checkout-open');
    membershipEmail.focus();
  }

  planButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      openMembershipCheckout(button);
    });
  });

  var checkoutParams = new URLSearchParams(window.location.search);
  var selectedPlanFromUrl = checkoutParams.get('plan');
  if (selectedPlanFromUrl) {
    var selectedPlanButton = Array.prototype.find.call(planButtons, function (button) {
      return button.dataset.planId === selectedPlanFromUrl;
    });
    if (selectedPlanButton) {
      openMembershipCheckout(selectedPlanButton);
      if (checkoutParams.get('checkout') === 'success') {
        setMembershipStep('complete');
        if (membershipStatus) {
          membershipStatus.textContent = selectedPlanButton.dataset.planName + ' membership is active in this demo.';
        }
        var cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete('plan');
        cleanUrl.searchParams.delete('checkout');
        cleanUrl.searchParams.delete('session_id');
        window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.hash);
      } else if (checkoutParams.get('checkout') === 'cancelled') {
        if (membershipError) {
          membershipError.hidden = false;
          membershipError.textContent = 'Checkout was canceled. No payment was processed.';
        }
        var canceledUrl = new URL(window.location.href);
        canceledUrl.searchParams.delete('plan');
        canceledUrl.searchParams.delete('checkout');
        window.history.replaceState({}, document.title, canceledUrl.pathname + canceledUrl.hash);
      }
    }
  }

  if (accountStepForm) {
    accountStepForm.addEventListener('submit', function (event) {
      event.preventDefault();
      setMembershipStep('payment');
      document.querySelector('[name="membership-payment-method"]').focus();
    });
  }

  var membershipBackButton = document.querySelector('[data-membership-back]');
  if (membershipBackButton) {
    membershipBackButton.addEventListener('click', function () {
      setMembershipStep('account');
      membershipEmail.focus();
    });
  }

  if (paymentStepForm) {
    var paymentMethodInputs = paymentStepForm.querySelectorAll('input[name="membership-payment-method"]');

    function updateSelectedPaymentMethod() {
      paymentMethodInputs.forEach(function (radio) {
        var label = radio.closest('label');
        if (label) {
          label.classList.toggle('selected', radio.checked);
        }
      });
    }

    paymentMethodInputs.forEach(function (radio) {
      radio.addEventListener('change', updateSelectedPaymentMethod);
    });

    updateSelectedPaymentMethod();

    paymentStepForm.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!selectedPlan || !membershipEmail) return;

      var selectedMethod = paymentStepForm.querySelector('input[name="membership-payment-method"]:checked');
      var selectedMethodName = selectedMethod ? selectedMethod.value : 'payment method';

      setMembershipStep('complete');
      if (membershipStatus) {
        membershipStatus.textContent = selectedPlan.name + ' membership is active in this demo using ' + selectedMethodName + '.';
      }
      if (membershipError) {
        membershipError.hidden = true;
        membershipError.textContent = '';
      }
    });
  }

  document.querySelectorAll('[data-close-membership]').forEach(function (button) {
    button.addEventListener('click', closeMembershipCheckout);
  });

  if (membershipCheckout) {
    membershipCheckout.addEventListener('click', function (event) {
      if (event.target === membershipCheckout) closeMembershipCheckout();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !membershipCheckout.hidden) closeMembershipCheckout();
    });
  }

  var accountTabs = document.querySelectorAll('.account-tab');
  var accountForms = document.querySelectorAll('.account-form');
  var accountStatus = document.getElementById('account-status');

  accountTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      var activePanelId = tab.getAttribute('aria-controls');

      accountTabs.forEach(function (accountTab) {
        accountTab.setAttribute('aria-selected', accountTab === tab ? 'true' : 'false');
      });

      accountForms.forEach(function (form) {
        form.hidden = form.id !== activePanelId;
      });

      if (accountStatus) {
        accountStatus.textContent = '';
      }
    });
  });

  accountForms.forEach(function (form) {
    if (form.classList.contains('auth-form')) {
      return;
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      form.reset();
      if (accountStatus) {
        accountStatus.textContent = 'Authentication is not connected yet. Contact the site owner for account access.';
      }
    });
  });

  document.querySelectorAll('.auth-password-toggle').forEach(function (button) {
    button.addEventListener('click', function () {
      var field = button.closest('.auth-password-input').querySelector('input');
      var showPassword = field.type === 'password';
      field.type = showPassword ? 'text' : 'password';
      button.textContent = showPassword ? 'Hide' : 'Show';
      button.setAttribute('aria-label', showPassword ? 'Hide password' : 'Show password');
      button.setAttribute('aria-pressed', showPassword ? 'true' : 'false');
      field.focus();
    });
  });

  var signupPassword = document.getElementById('signup-password');
  var confirmPassword = document.getElementById('signup-confirm-password');
  var passwordStrength = document.getElementById('password-strength');

  function updatePasswordFeedback() {
    if (signupPassword && passwordStrength) {
      var value = signupPassword.value;
      var score = 0;
      if (value.length >= 8) score += 1;
      if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
      if (/\d/.test(value)) score += 1;
      if (/[^A-Za-z0-9]/.test(value)) score += 1;

      var strength = value.length === 0 ? '' : score <= 1 ? 'weak' : score <= 2 ? 'fair' : 'strong';
      passwordStrength.dataset.strength = strength;
      passwordStrength.querySelector('.auth-strength-label').textContent = value.length === 0
        ? 'Password strength'
        : strength.charAt(0).toUpperCase() + strength.slice(1);
    }

    if (signupPassword && confirmPassword) {
      confirmPassword.setCustomValidity(confirmPassword.value && confirmPassword.value !== signupPassword.value
        ? 'Passwords do not match.'
        : '');
    }
  }

  if (signupPassword && confirmPassword) {
    signupPassword.addEventListener('input', updatePasswordFeedback);
    confirmPassword.addEventListener('input', updatePasswordFeedback);
  }

  var contactForm = document.querySelector('#contact form');
  if (contactForm) {
    var success = document.getElementById('success');
    var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (success) {
      success.setAttribute('role', 'status');
      success.setAttribute('aria-live', 'polite');
    }

    function setFieldError(field, message) {
      var group = field.closest('.form-group');
      var error = group ? group.querySelector('.field-error') : null;

      if (error) {
        error.textContent = message;
      }

      field.setAttribute('aria-invalid', message ? 'true' : 'false');
    }

    function clearStatus() {
      if (success) {
        success.textContent = '';
      }
    }

    contactForm.addEventListener('submit', function (event) {
      event.preventDefault();
      var nameField = contactForm.elements.name;
      var emailField = contactForm.elements.email;
      var messageField = contactForm.elements.message;
      var isValid = true;

      clearStatus();

      if (nameField) {
        var nameValue = nameField.value.trim();
        if (!nameValue) {
          setFieldError(nameField, 'Please enter your name.');
          isValid = false;
        } else {
          setFieldError(nameField, '');
        }
      }

      if (emailField) {
        var emailValue = emailField.value.trim();
        if (!emailValue) {
          setFieldError(emailField, 'Please enter your email address.');
          isValid = false;
        } else if (!emailPattern.test(emailValue)) {
          setFieldError(emailField, 'Please enter a valid email address.');
          isValid = false;
        } else {
          setFieldError(emailField, '');
        }
      }

      if (messageField) {
        var messageValue = messageField.value.trim();
        if (!messageValue) {
          setFieldError(messageField, 'Please enter a message.');
          isValid = false;
        } else {
          setFieldError(messageField, '');
        }
      }

      if (!isValid) {
        return;
      }

      contactForm.reset();
      contactForm.querySelectorAll('[aria-invalid="true"]').forEach(function (field) {
        field.setAttribute('aria-invalid', 'false');
      });

      var nameValue = contactForm.elements.name ? contactForm.elements.name.value.trim() : '';
      var emailValue = contactForm.elements.email ? contactForm.elements.email.value.trim() : '';
      var messageValue = contactForm.elements.message ? contactForm.elements.message.value.trim() : '';
      var mailtoLink = 'mailto:info@company.com?subject=' + encodeURIComponent('New message from ' + nameValue) + '&body=' + encodeURIComponent('Name: ' + nameValue + '\nEmail: ' + emailValue + '\n\nMessage:\n' + messageValue);

      window.location.href = mailtoLink;

      if (success) {
        success.textContent = 'Your email app should open with your message ready to send.';
      }
    });

    contactForm.querySelectorAll('.field').forEach(function (field) {
      field.addEventListener('input', function () {
        setFieldError(field, '');
      });
    });
  }
})();
   





























































  //primitive data type

  let name = "proggressay";

  















