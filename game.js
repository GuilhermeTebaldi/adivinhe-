// game.js
const UI = {
    guessInput: document.getElementById('guessInput'),
    guessBtn: document.getElementById('guessBtn'),
    hintBtn: document.getElementById('hintBtn'),
    newRoundBtn: document.getElementById('newRoundBtn'),
    clearScoreBtn: document.getElementById('clearScoreBtn'),
    skipBtn: document.getElementById('skipBtn'),
    hintsList: document.getElementById('hintsList'),
    hintsUsed: document.getElementById('hintsUsed'),
    roundScore: document.getElementById('roundScore'),
    totalScore: document.getElementById('totalScore'),
    result: document.getElementById('result'),
    status: document.getElementById('status'),
    imageWrap: document.getElementById('imageWrap'),
    objectImg: document.getElementById('objectImg'),
    dataInfo: document.getElementById('dataInfo')
  };
  
  let objetos = [];
  let current = null;
  let lastObjetoName = null;
  let hintsShown = 0;
  let roundFinished = true;
  let totalScore = 0;
  let lastEarnedPoints = 0;
  
  /* ===== Persistência ===== */
  const STORAGE_KEY = 'adivinhe_totalScore';
  const STATE_KEY   = 'adivinhe_state_v1';
  // baralho anti-repetição
  const DECK_KEY    = 'adivinhe_deck_v1';
  
  /* ===== Deck util ===== */
  let deck = []; // array de nomes (objeto.objeto)
  
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function buildFreshDeck() {
    deck = objetos.map(o => o.objeto);
    shuffle(deck);
    // evita repetir imediatamente o último da rodada anterior quando recomeça o baralho
    if (lastObjetoName && deck.length > 1 && deck[0] === lastObjetoName) {
      const x = deck.shift();
      deck.splice(Math.floor(Math.random() * (deck.length + 1)), 0, x);
    }
    persistDeck();
  }
  function persistDeck() {
    try { localStorage.setItem(DECK_KEY, JSON.stringify(deck)); } catch (_) {}
  }
  function loadDeckAfterData() {
    let saved = null;
    try {
      const raw = localStorage.getItem(DECK_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch (_) { saved = null; }
  
    if (Array.isArray(saved)) {
      // filtra nomes que ainda existem no JSON atual
      const validNames = new Set(objetos.map(o => o.objeto));
      deck = saved.filter(name => validNames.has(name));
    } else {
      deck = [];
    }
    if (!deck.length) buildFreshDeck();
  }
  function drawFromDeck() {
    // se vazio, reconstrói baralho completo
    if (!deck.length) buildFreshDeck();
    // tira o próximo nome que não seja igual ao último mostrado
    while (deck.length) {
      const name = deck.shift();
      const obj = objetos.find(o => o.objeto === name);
      if (obj && name !== lastObjetoName) {
        persistDeck();
        return obj;
      }
      // se caiu no mesmo do anterior e ainda há mais opções, empurra para o fim
      if (obj) deck.push(name);
      // proteção: se só restar ele mesmo, aceita
      if (deck.length === 1 && deck[0] === lastObjetoName) {
        const fallbackName = deck.shift();
        persistDeck();
        return objetos.find(o => o.objeto === fallbackName) || null;
      }
    }
    // segurança
    buildFreshDeck();
    const name = deck.shift();
    persistDeck();
    return objetos.find(o => o.objeto === name) || null;
  }
  
  /* ===== Pontos ===== */
  function persistTotalScore() {
    try { localStorage.setItem(STORAGE_KEY, String(totalScore)); } catch (_) {}
  }
  function loadTotalScore() {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v !== null) totalScore = Number(v) || 0;
    } catch (_) { totalScore = 0; }
    UI.totalScore.textContent = String(totalScore);
  }
  function clearTotalScore() {
    totalScore = 0;
    persistTotalScore();
    UI.totalScore.textContent = '0';
    updateSkipButton();
  }
  
  /* ===== Estado da rodada ===== */
  function persistState() {
    const payload = {
      currentName: current ? current.objeto : null,
      hintsShown,
      roundFinished,
      lastObjetoName,
      lastEarnedPoints,
      totalScore
    };
    try { localStorage.setItem(STATE_KEY, JSON.stringify(payload)); } catch (_) {}
  }
  function loadStateAfterData() {
    let saved = null;
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch (_) { saved = null; }
  
    if (!saved) { updateSkipButton(); return; }
  
    if (typeof saved.lastEarnedPoints === 'number') lastEarnedPoints = saved.lastEarnedPoints;
    if (typeof saved.totalScore === 'number') {
      totalScore = saved.totalScore;
      UI.totalScore.textContent = String(totalScore);
    }
    lastObjetoName = saved.lastObjetoName || null;
  
    if (saved.currentName && saved.roundFinished === false) {
      const found = objetos.find(o => o.objeto === saved.currentName);
      if (found) {
        current = found;
        roundFinished = false;
        hintsShown = Math.max(0, Math.min(3, Number(saved.hintsShown || 0)));
  
        UI.hintsList.innerHTML = '';
        UI.hintsUsed.textContent = String(hintsShown);
        UI.roundScore.textContent = '0';
        UI.result.textContent = '';
        UI.result.classList.remove('success', 'error');
        UI.status.textContent = 'Jogo restaurado. Continue tentando ou peça dicas.';
  
        UI.imageWrap.classList.add('hidden');
        UI.imageWrap.classList.remove('reveal');
        UI.objectImg.src = '';
  
        UI.guessInput.disabled = false;
        UI.guessBtn.disabled = false;
        UI.hintBtn.disabled = hintsShown >= 3;
        UI.newRoundBtn.disabled = true;
        UI.guessInput.focus();
  
        for (let i = 1; i <= hintsShown; i++) {
          let hintText = '';
          if (i === 1) hintText = `Cor: ${current.cor || 'não especificada'}`;
          else if (i === 2) hintText = `Comestível: ${current.comestivel || 'não especificado'}`;
          else if (i === 3) hintText = `Local: ${current.local || 'não especificado'}`;
          const li = document.createElement('li');
          li.textContent = hintText;
          UI.hintsList.appendChild(li);
        }
  
        updateSkipButton();
        return;
      }
    }
  
    roundFinished = true;
    UI.newRoundBtn.disabled = false;
    updateSkipButton();
  }
  
  /* ===== Normalização e fuzzy ===== */
  function normalize(s) {
    if (!s) return '';
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  }
  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost
        );
      }
    }
    return dp[m][n];
  }
  function isMatchOne(guess, target) {
    const g = normalize(guess);
    const t = normalize(target);
    if (!g || !t) return false;
    if (g === t) return true;
    const tTokens = t.split(/\s+/);
    for (const tok of tTokens) {
      if (tok && (g === tok || levenshtein(g, tok) <= 1)) return true;
    }
    const len = Math.max(g.length, t.length);
    const dist = levenshtein(g, t);
    const threshold = len <= 5 ? 1 : 2;
    return dist <= threshold;
  }
  function getAllTargets(obj) {
    const names = [obj.objeto].concat(Array.isArray(obj.aliases) ? obj.aliases : []);
    const seen = new Set();
    const out = [];
    for (const n of names) {
      const norm = normalize(n);
      if (norm && !seen.has(norm)) { seen.add(norm); out.push(n); }
    }
    return out;
  }
  function isMatchAny(guess, obj) {
    const targets = getAllTargets(obj);
    for (const t of targets) if (isMatchOne(guess, t)) return true;
    return false;
  }
  
  /* ===== Pontuação ===== */
  function computeRoundScore() {
    if (hintsShown === 0) return 10;
    if (hintsShown === 1) return 5;
    return 1;
  }
  
  /* ===== WebAudio SFX ===== */
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  function tone(freq = 440, dur = 0.15, type = 'sine', gain = 0.03, when = 0) {
    ensureAudio();
    const t0 = audioCtx.currentTime + when;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type; osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g).connect(audioCtx.destination);
    osc.start(t0);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.stop(t0 + dur + 0.01);
  }
  function playSfx(type) {
    ensureAudio();
    if (type === 'ok') {
      tone(523.25, 0.09, 'triangle', 0.04, 0);
      tone(659.25, 0.09, 'triangle', 0.035, 0.06);
      tone(783.99, 0.14, 'triangle', 0.03, 0.12);
      for (let i = 0; i < 4; i++) tone(1200 + Math.random()*600, 0.05, 'sine', 0.02, 0.18 + i*0.02);
    } else if (type === 'err') {
      tone(180, 0.2, 'sawtooth', 0.04, 0);
      tone(140, 0.2, 'sawtooth', 0.035, 0.02);
    }
  }
  
  /* ===== Efeitos ===== */
  function spawnSparkles(container) {
    const rect = container.getBoundingClientRect();
    const count = 12;
    for (let i = 0; i < count; i++) {
      const s = document.createElement('span');
      s.className = 'sparkle';
      const x = Math.random() * (rect.width - 16) + 8;
      const y = Math.random() * (rect.height - 16) + 8;
      const dx = (Math.random() * 80 - 40) + 'px';
      const dy = (Math.random() * -60 - 10) + 'px';
      s.style.left = x + 'px';
      s.style.top = y + 'px';
      s.style.setProperty('--dx', dx);
      s.style.setProperty('--dy', dy);
      container.appendChild(s);
      setTimeout(() => s.remove(), 1000);
    }
  }
  
  /* ===== Fluxo ===== */
  function startNewRound() {
    current = drawFromDeck();
    if (!current) {
      UI.dataInfo.textContent = 'Erro: nenhum objeto disponível em objetos.json';
      return;
    }
    hintsShown = 0;
    roundFinished = false;
    UI.hintsList.innerHTML = '';
    UI.hintsUsed.textContent = '0';
    UI.roundScore.textContent = '0';
    UI.result.textContent = '';
    UI.result.classList.remove('success', 'error');
    UI.status.textContent = 'Tente adivinhar o objeto. Pode chutar livremente.';
  
    UI.imageWrap.classList.add('hidden');
    UI.imageWrap.classList.remove('reveal');
    UI.objectImg.src = '';
  
    UI.guessInput.disabled = false;
    UI.guessBtn.disabled = false;
    UI.hintBtn.disabled = false;
    UI.newRoundBtn.disabled = true;
    UI.guessInput.value = '';
    UI.guessInput.focus();
  
    persistState();
    updateSkipButton();
  }
  
  function endRound(success) {
    roundFinished = true;
    UI.guessInput.disabled = true;
    UI.guessBtn.disabled = true;
    UI.hintBtn.disabled = true;
    UI.newRoundBtn.disabled = false;
  
    if (!current) { persistState(); updateSkipButton(); return; }
  
    if (success) {
      const pts = computeRoundScore();
      UI.roundScore.textContent = String(pts);
      totalScore += pts;
      persistTotalScore();
      UI.totalScore.textContent = String(totalScore);
      lastEarnedPoints = pts;
      UI.result.textContent = `Acertou: ${current.objeto}`;
      UI.result.classList.remove('error');
      UI.result.classList.add('success');
      playSfx('ok');
    } else {
      UI.result.textContent = `Errou. O objeto era: ${current.objeto}`;
      UI.result.classList.remove('success');
      UI.result.classList.add('error');
      playSfx('err');
    }
  
    if (current.imagem) {
      UI.objectImg.src = current.imagem;
      UI.imageWrap.classList.remove('hidden');
      requestAnimationFrame(() => {
        UI.imageWrap.classList.add('reveal');
        spawnSparkles(UI.imageWrap);
      });
    }
  
    lastObjetoName = current.objeto;
    current = null;
  
    persistState();
    updateSkipButton();
  }
  
  function showNextHint() {
    if (!current || hintsShown >= 3) return;
    hintsShown++;
    UI.hintsUsed.textContent = String(hintsShown);
    let hintText = '';
    if (hintsShown === 1) hintText = `Cor: ${current.cor || 'não especificada'}`;
    else if (hintsShown === 2) hintText = `Comestível: ${current.comestivel || 'não especificado'}`;
    else if (hintsShown === 3) hintText = `Local: ${current.local || 'não especificado'}`;
    const li = document.createElement('li');
    li.textContent = hintText;
    UI.hintsList.appendChild(li);
    if (hintsShown >= 3) UI.hintBtn.disabled = true;
  
    persistState();
  }
  
  function handleGuess() {
    if (roundFinished || !current) return;
    const guess = UI.guessInput.value.trim();
    if (!guess) return;
    if (isMatchAny(guess, current)) {
      endRound(true);
    } else {
      UI.status.textContent = 'Errado. Tente novamente ou peça uma dica.';
      playSfx('err');
      UI.guessInput.value = '';
      UI.guessInput.focus();
      persistState();
    }
  }
  
  /* ===== Pular com custo ===== */
  function updateSkipButton() {
    const cost = lastEarnedPoints > 0 ? lastEarnedPoints : 0;
    if (UI.skipBtn) {
      UI.skipBtn.textContent = cost > 0 ? `Pular (-${cost})` : 'Pular';
      const can = !roundFinished && lastEarnedPoints > 0 && totalScore >= lastEarnedPoints;
      UI.skipBtn.disabled = !can;
    }
  }
  function handleSkip() {
    if (roundFinished || !current) return;
    if (lastEarnedPoints <= 0) {
      UI.status.textContent = 'Você ainda não tem vitórias para usar como custo do pulo.';
      updateSkipButton();
      return;
    }
    if (totalScore < lastEarnedPoints) {
      UI.status.textContent = `Pontos insuficientes para pular. Necessário: ${lastEarnedPoints}.`;
      updateSkipButton();
      return;
    }
    totalScore -= lastEarnedPoints;
    persistTotalScore();
    UI.totalScore.textContent = String(totalScore);
    UI.status.textContent = `Você pulou esta rodada. -${lastEarnedPoints} pontos.`;
    playSfx('err');
  
    roundFinished = true;
    UI.guessInput.disabled = true;
    UI.guessBtn.disabled = true;
    UI.hintBtn.disabled = true;
    UI.newRoundBtn.disabled = false;
  
    persistState();
    startNewRound();
  }
  
  /* ===== Dados ===== */
  async function loadData() {
    try {
      const res = await fetch('./data/objetos.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('falha ao carregar objetos.json');
      objetos = await res.json();
      if (!Array.isArray(objetos)) objetos = [];
  
      objetos = objetos.map(o => {
        if (!o || typeof o !== 'object') return null;
        const cpy = { ...o };
        if (!Array.isArray(cpy.aliases)) cpy.aliases = [];
        cpy.aliases = cpy.aliases.filter(a => typeof a === 'string' && a.trim().length > 0);
        return cpy;
      }).filter(Boolean);
  
      const totalAliases = objetos.reduce((acc, o) => acc + (o.aliases?.length || 0), 0);
      UI.dataInfo.textContent = `Dados carregados: ${objetos.length} objetos, ${totalAliases} aliases.`;
  
      // carrega deck e estado
      loadDeckAfterData();
      loadStateAfterData();
  
      // se não havia rodada em andamento, começa uma
      if (roundFinished && !current) {
        startNewRound();
      }
    } catch (err) {
      UI.dataInfo.textContent = 'Não foi possível carregar objetos.json. Verifique o arquivo.';
      console.error(err);
    }
  }
  
  /* ===== Eventos ===== */
  UI.guessBtn.addEventListener('click', handleGuess);
  UI.guessInput.addEventListener('keydown', (e) => {
    if (!audioCtx && (e.key === 'Enter' || e.key === ' ')) ensureAudio();
    if (e.key === 'Enter') handleGuess();
  });
  UI.hintBtn.addEventListener('click', () => { ensureAudio(); showNextHint(); });
  UI.newRoundBtn.addEventListener('click', () => { ensureAudio(); startNewRound(); });
  UI.clearScoreBtn.addEventListener('click', () => {
    ensureAudio();
    if (confirm('Zerar pontuação total?')) clearTotalScore();
  });
  if (UI.skipBtn) UI.skipBtn.addEventListener('click', () => { ensureAudio(); handleSkip(); });
  
  /* ===== Init ===== */
  loadTotalScore();
  loadData();
  