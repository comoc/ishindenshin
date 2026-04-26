// =====================================================================
// 意思伝達アプリ — スイッチ入力（走査入力）特化版
// =====================================================================

// ---------- 濁音・半濁音マップ -------------------------------------------------
const DAKUTEN_MAP = {
  'あ': ['あ', 'ぁ'],
  'い': ['い', 'ぃ'],
  'う': ['う', 'ぅ', 'ヴ'],
  'え': ['え', 'ぇ'],
  'お': ['お', 'ぉ'],
  'か': ['か', 'が'], 'き': ['き', 'ぎ'], 'く': ['く', 'ぐ'], 'け': ['け', 'げ'], 'こ': ['こ', 'ご'],
  'さ': ['さ', 'ざ'], 'し': ['し', 'じ'], 'す': ['す', 'ず'], 'せ': ['せ', 'ぜ'], 'そ': ['そ', 'ぞ'],
  'た': ['た', 'だ'], 'ち': ['ち', 'ぢ'],
  'つ': ['つ', 'づ', 'っ'],
  'て': ['て', 'で'], 'と': ['と', 'ど'],
  'は': ['は', 'ば', 'ぱ'], 'ひ': ['ひ', 'び', 'ぴ'], 'ふ': ['ふ', 'ぶ', 'ぷ'],
  'へ': ['へ', 'べ', 'ぺ'], 'ほ': ['ほ', 'ぼ', 'ぽ'],
  'や': ['や', 'ゃ'], 'ゆ': ['ゆ', 'ゅ'], 'よ': ['よ', 'ょ'],
  'わ': ['わ', 'ゎ'],
};

// 「ぁ」ボタン用：捨て仮名（小書き）の双方向対応表
const SMALL_KANA = (() => {
  const pairs = [
    ['あ','ぁ'], ['い','ぃ'], ['う','ぅ'], ['え','ぇ'], ['お','ぉ'],
    ['や','ゃ'], ['ゆ','ゅ'], ['よ','ょ'],
    ['つ','っ'],
    ['わ','ゎ'],
    ['か','ヵ'], ['け','ヶ'],
  ];
  const m = new Map();
  for (const [big, small] of pairs) { m.set(big, small); m.set(small, big); }
  return m;
})();

// 「゛」ボタン用：濁点／半濁点のサイクル定義（押すたびに次の候補へ）
const DAKUTEN_CYCLES = {
  'か': ['か','が'], 'き': ['き','ぎ'], 'く': ['く','ぐ'], 'け': ['け','げ'], 'こ': ['こ','ご'],
  'さ': ['さ','ざ'], 'し': ['し','じ'], 'す': ['す','ず'], 'せ': ['せ','ぜ'], 'そ': ['そ','ぞ'],
  'た': ['た','だ'], 'ち': ['ち','ぢ'], 'つ': ['つ','づ'], 'て': ['て','で'], 'と': ['と','ど'],
  'は': ['は','ば','ぱ'], 'ひ': ['ひ','び','ぴ'], 'ふ': ['ふ','ぶ','ぷ'],
  'へ': ['へ','べ','ぺ'], 'ほ': ['ほ','ぼ','ぽ'],
  'う': ['う','ヴ'],
};

// ---------- 絵文字（130種以上） ------------------------------------------------
const EMOJIS = [
  '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩',
  '😘','😗','☺️','😚','😋','😛','😜','🤪','😝','🤗','🤭','🤔','🤨','😐','😑','😶',
  '😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🥵','🥶',
  '😵','🤯','🤠','🥳','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺',
  '😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤',
  '😡','😠','🤬','😈','💀','👻','💩','🤡','👍','👎','👏','🙏','💪','🤝','👋','✌️',
  '👌','✋','👊','❤️','🧡','💛','💚','💙','💜','🖤','💔','💕','💖','💯','✨','⭐',
  '🌟','🔥','💧','☀️','🌙','☁️','🌧','❄️','🌸','🌹','🌻','🍎','🍊','🍰','🍙','🍣',
  '🍜','☕','🍵','🚗','🏠','🏥','💊','📱','💻','📺','🎵','📚','✉️','✅','❌','❓',
];

// ---------- アプリ状態 ----------------------------------------------------------
const state = {
  scanInterval: 1000,        // 走査間隔(ms)
  panelKey: 'main',
  scanMode: 'row',           // 'row' | 'col' | 'dakuten'
  rowIndex: 0,
  colIndex: 0,
  rowDir: 1,                 // 走査進行方向
  colDir: 1,
  rowCycles: 0,              // 行走査の周回数（2周で列走査へ自動復帰）
  scanTimer: null,
  composedText: '',
  // 濁音切替用
  dakutenList: null,
  dakutenIdx: 0,
  dakutenTimer: null,
  // モーダル選択用
  modal: null,               // { options:[{label,action}], index, dir, timer }
};

// ---------- DOM ヘルパ ----------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const $panel = () => $('#panel-host');
const $composed = () => $('#composed');

function showToast(msg, ms = 1800) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), ms);
}

// ---------- パネル定義 ----------------------------------------------------------
// 各パネルは grid:[[cell,...],...] を持つ。空セルは {empty:true}。
// cell: { label, sub?, kind?, action }
// kind: 'char' | 'func' | 'icon'

function buildHiraganaPanel() {
  const ch = (c) => ({ label: c, kind: 'char', action: () => inputHiragana(c) });
  const em = (e) => ({ label: e, kind: 'char', action: () => appendText(e) });
  const empty = { empty: true };
  const fn = (label, action) => ({ label, kind: 'func', action });

  // 5 段（あ/い/う/え/お）× 13 列。伝統的な 50 音表に倣い、右端から
  // あ・か・さ・た・な・は・ま・や・ら・わ ／ 記号 ／ 絵文字 ／ 機能 の順に並べる。
  const grid = [
    // あ段
    [fn('スペース', () => appendText('　')), em('🙋'), ch('ー'), ch('わ'), ch('ら'), ch('や'),
     ch('ま'), ch('は'), ch('な'), ch('た'), ch('さ'), ch('か'), ch('あ')],
    // い段
    [fn('一文字消去', () => deleteOne()), em('🙅'), ch('、'), ch('を'), ch('り'), empty,
     ch('み'), ch('ひ'), ch('に'), ch('ち'), ch('し'), ch('き'), ch('い')],
    // う段
    [fn('読み上げ', () => speakComposed()), em('😊'), ch('。'), ch('ん'), ch('る'), ch('ゆ'),
     ch('む'), ch('ふ'), ch('ぬ'), ch('つ'), ch('す'), ch('く'), ch('う')],
    // え段
    [empty, em('😢'), ch('？'),
     { label: 'ぁ', kind: 'char', action: () => applySmallToLast() },
     ch('れ'), empty,
     ch('め'), ch('へ'), ch('ね'), ch('て'), ch('せ'), ch('け'), ch('え')],
    // お段
    [fn('全消去', () => clearText()), em('😒'), ch('！'),
     { label: '゛', kind: 'char', action: () => applyDakutenToLast() },
     ch('ろ'), ch('よ'),
     ch('も'), ch('ほ'), ch('の'), ch('と'), ch('そ'), ch('こ'), ch('お')],
  ];

  return {
    title: '文字入力（ひらがな）',
    columns: 13,
    grid,
    // 右端の あ行 から走査開始し、左方向へ進む
    startCol: 12,
    startColDir: -1,
  };
}

function buildEmojiPanel() {
  const cols = 10;
  const cells = EMOJIS.map((e) => ({ label: e, kind: 'char', action: () => appendText(e) }));
  const grid = [];
  for (let i = 0; i < cells.length; i += cols) grid.push(cells.slice(i, i + cols));
  // 末尾の不足を空セルで埋める
  const last = grid[grid.length - 1];
  while (last.length < cols) last.push({ empty: true });
  // 機能行
  grid.push([
    { label: '一文字消去', kind: 'func', action: () => deleteOne() },
    { label: '読上げ',    kind: 'func', action: () => speakComposed() },
    { empty: true }, { empty: true }, { empty: true },
    { empty: true }, { empty: true }, { empty: true },
    { empty: true },
    { label: '戻る',     kind: 'func', action: () => setPanel('main') },
  ]);
  return { title: '絵文字入力', columns: cols, grid };
}

function buildAppliancePanel() {
  const fn = (label, msg) => ({
    label, kind: 'func', action: () => showToast(msg + '（シミュレーション）'),
  });
  return {
    title: '家電操作',
    columns: 4,
    grid: [
      [fn('📺 TV ON','テレビをONにしました'),  fn('📺 TV OFF','テレビをOFFにしました'),
       fn('🔊 音量+','音量を上げました'),        fn('🔉 音量−','音量を下げました')],
      [fn('❄️ エアコン ON','エアコンをONにしました'), fn('❄️ エアコン OFF','エアコンをOFFにしました'),
       fn('🌡 温度+','設定温度を上げました'),       fn('🌡 温度−','設定温度を下げました')],
      [fn('💡 照明 ON','照明をONにしました'),       fn('💡 照明 OFF','照明をOFFにしました'),
       fn('☀️ 明るく','明るくしました'),            fn('🌙 暗く','暗くしました')],
      [fn('🛏 ベッド↑','ベッドを上げました'),      fn('🛏 ベッド↓','ベッドを下げました'),
       fn('🔔 ナース呼出','ナースコールを送信しました'),
       { label: '戻る', kind: 'func', action: () => setPanel('main') }],
    ],
  };
}

function buildSettingsPanel() {
  return {
    title: '設定（介護者向け）',
    columns: 3,
    grid: [
      [
        { label: '速度を遅く', sub: '走査間隔を長く', kind: 'func', action: () => adjustSpeed(+200) },
        { label: '速度を速く', sub: '走査間隔を短く', kind: 'func', action: () => adjustSpeed(-200) },
        { label: '速度を初期化', sub: '1.0 秒に戻す', kind: 'func', action: () => setSpeed(1000) },
      ],
      [
        { label: 'ヘルプ', sub: '操作の説明', kind: 'func', action: () => showHelp() },
        { label: '戻る', kind: 'func', action: () => setPanel('main') },
      ],
    ],
  };
}

function buildEmailPanel() {
  return {
    title: 'メール送信',
    columns: 2,
    grid: [
      [
        { label: '✉️ 作成中の文章を送信',
          sub: 'メールソフトを開きます',
          kind: 'func',
          action: () => sendMail() },
        { label: '🐦 SNS投稿（X）',
          sub: '本文を共有ダイアログで',
          kind: 'func',
          action: () => shareSNS() },
      ],
      [
        { label: '読上げ', kind: 'func', action: () => speakComposed() },
        { label: '戻る',   kind: 'func', action: () => setPanel('main') },
      ],
    ],
  };
}

function buildMainPanel() {
  const item = (label, sub, action) => ({ label, sub, kind: 'icon', action });
  return {
    title: 'メインメニュー',
    columns: 3,
    grid: [
      [
        item('あ', '文字入力',   () => setPanel('hiragana')),
        item('😀', '絵文字',     () => setPanel('emoji')),
        item('🔊', '読上げ',     () => speakComposed()),
      ],
      [
        item('✉️', 'メール／SNS', () => setPanel('email')),
        item('📺', '家電操作',   () => setPanel('appliance')),
        item('🖨', '印刷',       () => doPrint()),
      ],
      [
        item('⚙️', '設定',       () => setPanel('settings')),
        item('🗑', '全消去',     () => clearText()),
        item('⏻', '電源',       () => confirmExit()),
      ],
    ],
  };
}

const PANEL_BUILDERS = {
  main:      buildMainPanel,
  hiragana:  buildHiraganaPanel,
  emoji:     buildEmojiPanel,
  appliance: buildAppliancePanel,
  settings:  buildSettingsPanel,
  email:     buildEmailPanel,
};

// ---------- レンダリング --------------------------------------------------------
let currentPanel = null;

function setPanel(key) {
  cancelDakuten();
  state.panelKey = key;
  state.scanMode = 'col';     // 列スキャン（縦帯の横移動）から開始
  state.rowIndex = 0;
  state.rowDir = 1;
  state.rowCycles = 0;
  currentPanel = PANEL_BUILDERS[key]();
  // パネルが指定していれば初期列・走査方向を採用
  state.colIndex = currentPanel.startCol ?? 0;
  state.colDir = currentPanel.startColDir ?? 1;
  renderPanel();
  if (!colHasSelectable(state.colIndex)) advanceCol();
}

function renderPanel() {
  const host = $panel();
  host.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.style.gridTemplateColumns = `repeat(${currentPanel.columns}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${currentPanel.grid.length}, 1fr)`;

  currentPanel.grid.forEach((row, r) => {
    row.forEach((cell, c) => {
      const el = document.createElement('div');
      el.className = 'tile';
      if (cell.empty) {
        el.classList.add('empty');
      } else {
        if (cell.kind === 'func') el.classList.add('func');
        if (cell.kind === 'icon') el.classList.add('icon');
        const lab = document.createElement('div');
        lab.textContent = cell.label;
        el.appendChild(lab);
        if (cell.sub) {
          const s = document.createElement('div');
          s.className = 'sub';
          s.textContent = cell.sub;
          el.appendChild(s);
        }
        // 介護者がマウス／タップでも操作できるように。走査と非同期に発火するので、
        // 走査位置を押されたセルに同期してハイライトのズレを防ぐ。
        el.addEventListener('click', () => {
          if (typeof cell.action !== 'function') return;
          cancelDakuten();
          state.rowIndex = r;
          state.colIndex = c;
          state.rowCycles = 0;
          flashTap(el);
          cell.action();
          // アクションでパネル切替や濁音モードに入っていなければ列モードに戻す
          if (state.scanMode !== 'dakuten') {
            state.scanMode = 'col';
            applyHighlight();
          }
          restartScan();
        });
      }
      el.dataset.row = r;
      el.dataset.col = c;
      grid.appendChild(el);
    });
  });

  host.appendChild(grid);
  applyHighlight();
}

function tilesOfCol(c) {
  return Array.from($panel().querySelectorAll(`.tile[data-col="${c}"]`));
}

// 既にハイライト中でもタップ時に必ず押下アニメーションを再生させる。
// CSS の同一クラス再付与ではアニメーションが再起動しないので、
// クラスを外して強制リフロー → 付け直しでサイクルを切る。
function flashTap(el) {
  el.classList.remove('tap-flash');
  void el.offsetWidth;
  el.classList.add('tap-flash');
  setTimeout(() => el.classList.remove('tap-flash'), 260);
}

function tileAt(r, c) {
  return $panel().querySelector(`.tile[data-row="${r}"][data-col="${c}"]`);
}

function clearHighlights() {
  clearFadeTimer();
  $panel().querySelectorAll('.tile').forEach((el) => {
    el.classList.remove('row-highlight', 'col-highlight', 'dakuten-highlight', 'fading');
  });
}

function applyHighlight() {
  clearHighlights();
  if (state.scanMode === 'col') {
    // 列スキャン：選択中の列の全セルを縦帯としてハイライト
    tilesOfCol(state.colIndex).forEach((el) => {
      if (!el.classList.contains('empty')) el.classList.add('row-highlight');
    });
  } else if (state.scanMode === 'row') {
    // 行スキャン：選択中の列内で 1 セルだけハイライト
    const sel = tileAt(state.rowIndex, state.colIndex);
    if (sel) sel.classList.add('col-highlight');
  }
  scheduleFade();
}

// 次の走査までの最後 500ms でハイライト色をフェードし、移動を予告する。
const FADE_DURATION = 500;
let fadeTimer = null;

function scheduleFade() {
  clearFadeTimer();
  if (state.scanInterval <= FADE_DURATION) return;
  fadeTimer = setTimeout(() => {
    $panel().querySelectorAll('.row-highlight, .col-highlight').forEach((el) => {
      el.classList.add('fading');
    });
  }, state.scanInterval - FADE_DURATION);
}

function clearFadeTimer() {
  if (fadeTimer) {
    clearTimeout(fadeTimer);
    fadeTimer = null;
  }
}

// ---------- 走査ロジック --------------------------------------------------------
function startScan() {
  stopScan();
  state.scanTimer = setInterval(tick, state.scanInterval);
}

function stopScan() {
  if (state.scanTimer) {
    clearInterval(state.scanTimer);
    state.scanTimer = null;
  }
  clearFadeTimer();
}

function restartScan() {
  startScan();
}

function tick() {
  if (state.modal) {
    advanceModal();
    return;
  }
  if (state.scanMode === 'col') advanceCol();
  else if (state.scanMode === 'row') advanceRow();
}

// 列走査：横方向（縦帯が左右に動く）。empty 列はスキップ。端で逆側へラップ（一方向）。
function advanceCol() {
  const total = currentPanel.columns;
  for (let i = 0; i < total; i++) {
    let next = state.colIndex + state.colDir;
    if (next < 0) next = total - 1;
    else if (next >= total) next = 0;
    state.colIndex = next;
    if (colHasSelectable(next)) break;
  }
  applyHighlight();
}

function colHasSelectable(c) {
  return currentPanel.grid.some((row) => row[c] && !row[c].empty);
}

// 行走査：縦方向（選択列内のセルが上下に動く）。empty はスキップ。端で逆側へラップ（一方向）。
// 2 周しても入力がなければ列走査へ自動復帰する。
function advanceRow() {
  const total = currentPanel.grid.length;
  const c = state.colIndex;
  for (let i = 0; i < total; i++) {
    let next = state.rowIndex + state.rowDir;
    if (next < 0)            { next = total - 1; state.rowCycles++; }
    else if (next >= total)  { next = 0;         state.rowCycles++; }
    state.rowIndex = next;
    const cell = currentPanel.grid[next][c];
    if (cell && !cell.empty) break;
  }
  if (state.rowCycles >= 2) {
    state.scanMode = 'col';
    state.rowCycles = 0;
    applyHighlight();
    return;
  }
  applyHighlight();
}

function firstSelectableRowInCol(c) {
  for (let r = 0; r < currentPanel.grid.length; r++) {
    const cell = currentPanel.grid[r][c];
    if (cell && !cell.empty) return r;
  }
  return 0;
}

// ---------- スイッチ入力 --------------------------------------------------------
function onSwitch() {
  // 濁音切替ウィンドウ中
  if (state.scanMode === 'dakuten') {
    cycleDakuten();
    return;
  }

  if (state.modal) {
    selectModal();
    return;
  }

  // 列スキャン中 → 列を確定して行スキャンへ
  if (state.scanMode === 'col') {
    if (!colHasSelectable(state.colIndex)) return;
    state.scanMode = 'row';
    state.rowIndex = firstSelectableRowInCol(state.colIndex);
    state.rowDir = 1;
    state.rowCycles = 0;       // 周回カウンタをリセット
    applyHighlight();
    return;
  }

  // 行スキャン中 → セル確定（アクション実行）
  if (state.scanMode === 'row') {
    const cell = currentPanel.grid[state.rowIndex][state.colIndex];
    if (cell && !cell.empty && typeof cell.action === 'function') {
      cell.action();
    }
    // パネルがそのままなら列走査に戻す（パネル切替時は setPanel が既に処理）
    if (state.scanMode === 'row') {
      state.scanMode = 'col';
      applyHighlight();
    }
  }
}

// ---------- 文字入力 ------------------------------------------------------------
function inputHiragana(ch) {
  appendText(ch);
  const candidates = DAKUTEN_MAP[ch];
  if (candidates && candidates.length > 1) {
    enterDakutenWindow(candidates);
  }
}

// 「ぁ」ボタン：直前の文字に小書き仮名があれば差し替え。なければそのまま入力。
function applySmallToLast() {
  const arr = Array.from(state.composedText);
  if (arr.length === 0) { appendText('ぁ'); return; }
  const last = arr[arr.length - 1];
  const variant = SMALL_KANA.get(last);
  if (variant) {
    arr[arr.length - 1] = variant;
    state.composedText = arr.join('');
    $composed().value = state.composedText;
  } else {
    appendText('ぁ');
  }
}

// 「゛」ボタン：直前の文字を濁音／半濁音サイクルで次の候補に。なければそのまま入力。
function applyDakutenToLast() {
  const arr = Array.from(state.composedText);
  if (arr.length === 0) { appendText('゛'); return; }
  const last = arr[arr.length - 1];
  for (const cycle of Object.values(DAKUTEN_CYCLES)) {
    const idx = cycle.indexOf(last);
    if (idx >= 0) {
      arr[arr.length - 1] = cycle[(idx + 1) % cycle.length];
      state.composedText = arr.join('');
      $composed().value = state.composedText;
      return;
    }
  }
  appendText('゛');
}

function appendText(s) {
  state.composedText += s;
  $composed().value = state.composedText;
  $composed().scrollTop = $composed().scrollHeight;
}

function deleteOne() {
  // サロゲートペア（絵文字）対応
  if (!state.composedText) return;
  const arr = Array.from(state.composedText);
  arr.pop();
  state.composedText = arr.join('');
  $composed().value = state.composedText;
}

function clearText() {
  state.composedText = '';
  $composed().value = '';
  showToast('文章を消去しました');
}

// ---------- 濁音・半濁音切替ウィンドウ -------------------------------------------
function enterDakutenWindow(candidates) {
  state.scanMode = 'dakuten';
  state.dakutenList = candidates;
  state.dakutenIdx = 0;
  highlightDakutenCell();
  // 1.5 秒経過するか他の操作で確定
  clearTimeout(state.dakutenTimer);
  state.dakutenTimer = setTimeout(() => {
    finalizeDakuten();
  }, 1500);
}

function highlightDakutenCell() {
  clearHighlights();
  const sel = tileAt(state.rowIndex, state.colIndex);
  if (sel) sel.classList.add('dakuten-highlight');
}

function cycleDakuten() {
  // 既に末尾に入っている文字を次の候補に置換
  state.dakutenIdx = (state.dakutenIdx + 1) % state.dakutenList.length;
  const newCh = state.dakutenList[state.dakutenIdx];
  const arr = Array.from(state.composedText);
  arr[arr.length - 1] = newCh;
  state.composedText = arr.join('');
  $composed().value = state.composedText;
  // タイマー延長
  clearTimeout(state.dakutenTimer);
  state.dakutenTimer = setTimeout(finalizeDakuten, 1500);
  highlightDakutenCell();
}

function finalizeDakuten() {
  cancelDakuten();
}

function cancelDakuten() {
  clearTimeout(state.dakutenTimer);
  state.dakutenTimer = null;
  state.dakutenList = null;
  state.dakutenIdx = 0;
  if (state.scanMode === 'dakuten') {
    state.scanMode = 'col';   // 確定後はトップレベル走査（列スキャン）に戻す
    applyHighlight();
  }
}

// ---------- 機能アクション ------------------------------------------------------
function speakComposed() {
  const text = state.composedText.trim();
  if (!text) {
    showToast('読上げる文章がありません');
    return;
  }
  if (!('speechSynthesis' in window)) {
    showToast('このブラウザは音声合成に未対応です');
    return;
  }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP';
  u.rate = 1.0;
  speechSynthesis.speak(u);
  showToast('読み上げています');
}

function doPrint() {
  if (!state.composedText.trim()) {
    showToast('印刷する文章がありません');
    return;
  }
  showToast('印刷ダイアログを開きます');
  setTimeout(() => window.print(), 300);
}

function sendMail() {
  const body = state.composedText;
  const subject = '意思伝達アプリからのメッセージ';
  const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = url;
  showToast('メールソフトを開きました');
}

function shareSNS() {
  const text = state.composedText;
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener');
  showToast('共有ダイアログを開きました');
}

function adjustSpeed(deltaMs) {
  setSpeed(state.scanInterval + deltaMs);
}

const SPEED_COOKIE = 'scanInterval';

function readCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

function writeCookie(name, value) {
  // 1 年間保持（path=/ で全パス共有、SameSite=Lax で外部遷移時も付与）
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=31536000; path=/; SameSite=Lax`;
}

function loadSavedSpeed(fallback) {
  const raw = readCookie(SPEED_COOKIE);
  const n = raw == null ? NaN : parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function setSpeed(ms) {
  // ±200ms で操作するため、200ms グリッドにスナップ。1.0秒など節目の値を必ず踏める。
  const snapped = Math.round(ms / 200) * 200;
  state.scanInterval = Math.max(200, Math.min(3000, snapped));
  $('#speed-label').textContent = (state.scanInterval / 1000).toFixed(1) + '秒';
  writeCookie(SPEED_COOKIE, state.scanInterval);
  restartScan();
  showToast(`走査速度: ${(state.scanInterval / 1000).toFixed(1)}秒`);
}

// ---------- モーダル（電源オフ確認・ヘルプ） -------------------------------------
function openModal({ title, body, options }) {
  const overlay = $('#overlay');
  overlay.innerHTML = '';
  const modal = document.createElement('div');
  modal.className = 'modal';

  const h = document.createElement('h2');
  h.textContent = title;
  modal.appendChild(h);

  if (typeof body === 'string') {
    const p = document.createElement('p');
    p.textContent = body;
    modal.appendChild(p);
  } else if (body instanceof Node) {
    modal.appendChild(body);
  }

  if (options && options.length) {
    const opts = document.createElement('div');
    opts.className = 'options';
    options.forEach((op, i) => {
      const o = document.createElement('div');
      o.className = 'option';
      o.textContent = op.label;
      o.dataset.index = i;
      o.addEventListener('click', () => {
        op.action();
        closeModal();
      });
      opts.appendChild(o);
    });
    modal.appendChild(opts);
  }

  overlay.appendChild(modal);
  overlay.classList.remove('hidden');

  if (options && options.length) {
    state.modal = { options, index: 0, dir: 1 };
    highlightModal();
  }
}

function closeModal() {
  $('#overlay').classList.add('hidden');
  $('#overlay').innerHTML = '';
  state.modal = null;
}

function highlightModal() {
  const opts = $('#overlay').querySelectorAll('.option');
  opts.forEach((el, i) => el.classList.toggle('row-highlight', i === state.modal.index));
}

function advanceModal() {
  const m = state.modal;
  if (!m || !m.options.length) return;
  if (m.options.length === 1) { m.index = 0; highlightModal(); return; }
  let next = m.index + m.dir;
  if (next < 0) next = m.options.length - 1;
  else if (next >= m.options.length) next = 0;
  m.index = next;
  highlightModal();
}

function selectModal() {
  const m = state.modal;
  if (!m) return;
  const op = m.options[m.index];
  closeModal();
  op.action();
}

function confirmExit() {
  openModal({
    title: 'アプリを終了しますか？',
    body: '作成中の文章は保存されません。',
    options: [
      { label: 'はい', action: () => doExit() },
      { label: 'いいえ', action: () => {} },
    ],
  });
}

function doExit() {
  // ブラウザ仕様により window.close() は自身が開いたタブのみ動作。
  // フォールバックとして「終了画面」を表示。
  stopScan();
  const overlay = $('#overlay');
  overlay.innerHTML = `
    <div class="modal">
      <h2>アプリを終了しました</h2>
      <p>このタブを閉じてください。<br>再開するにはページを再読み込みしてください。</p>
    </div>`;
  overlay.classList.remove('hidden');
  try { window.close(); } catch (_) {}
}

function showHelp() {
  const body = document.createElement('div');
  body.className = 'help-content';
  body.innerHTML = `
    <h3>基本操作</h3>
    <ul>
      <li><strong>スイッチ：</strong>Space / Enter、または DualSense（○✕△□）／ Xbox（A B X Y）コントローラーのフェイスボタン</li>
      <li>えんじ色の縦帯が横方向に移動 → スイッチで列を選択</li>
      <li>続いて選択列内のセルが縦方向に移動 → スイッチで文字や機能を選択</li>
      <li>端まで来ると反対側にループします（常に同じ方向に進みます）</li>
      <li>列内を 2 周しても入力されなければ自動的に列走査へ戻ります</li>
    </ul>
    <h3>濁音・半濁音の入力</h3>
    <ul>
      <li>「か」を選ぶ → すぐにスイッチを押すと「が」に切り替わります</li>
      <li>例：は → ば → ぱ → は …</li>
      <li>1.5 秒間操作がないと確定します</li>
    </ul>
    <h3>介護者向けショートカット</h3>
    <ul>
      <li><kbd>←</kbd>／<kbd>→</kbd>：走査速度を遅く／速く</li>
      <li><kbd>H</kbd>：このヘルプを表示</li>
    </ul>
  `;
  openModal({ title: 'ヘルプ', body, options: [{ label: '閉じる', action: () => {} }] });
}

// ---------- 入力デバイス接続状態（トップバー右の表示） --------------------------
function setKeyboardStatus(connected) {
  const el = $('#kbd-status');
  if (!el) return;
  el.classList.toggle('connected', connected);
  el.title = connected ? 'キーボード（接続済）' : 'キーボード（未検出）';
}

function setGamepadStatus(connected, name) {
  const el = $('#pad-status');
  if (!el) return;
  el.classList.toggle('connected', connected);
  el.title = connected
    ? `ゲームパッド（${name || '接続済'}）`
    : 'ゲームパッド（未接続）';
}

// ---------- キーボード入力 ------------------------------------------------------
let switchHeld = false;
window.addEventListener('keydown', (e) => {
  // 何らかのキー入力があった時点でキーボード接続を確定
  setKeyboardStatus(true);
  // ページ全体のスクロールやデフォルト動作を抑止
  const handled = [' ', 'Enter', 'ArrowLeft', 'ArrowRight', 'h', 'H'];
  if (handled.includes(e.key)) e.preventDefault();

  if (e.key === ' ' || e.key === 'Enter') {
    if (switchHeld) return;       // オートリピート抑止
    switchHeld = true;
    onSwitch();
    return;
  }
  if (e.key === 'ArrowLeft')  { adjustSpeed(+200); return; }
  if (e.key === 'ArrowRight') { adjustSpeed(-200); return; }
  if (e.key === 'h' || e.key === 'H') { showHelp(); return; }
});
window.addEventListener('keyup', (e) => {
  if (e.key === ' ' || e.key === 'Enter') switchHeld = false;
});

// ---------- ゲームパッド入力 ----------------------------------------------------
// DualSense の ○✕△□ ／ Xbox の A B X Y はいずれも標準マッピングで index 0–3。
// Gamepad API はイベントが無いため毎フレーム状態をポーリングし、押し下げエッジで onSwitch を呼ぶ。
const FACE_BUTTON_INDEXES = [0, 1, 2, 3];
let gamepadHeld = false;
let gamepadPollHandle = null;
let gamepadPollPrimed = false;

function anyFaceButtonPressed() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  for (const pad of pads) {
    if (!pad) continue;
    for (const idx of FACE_BUTTON_INDEXES) {
      if (pad.buttons[idx] && pad.buttons[idx].pressed) return true;
    }
  }
  return false;
}

function pollGamepads() {
  const pressed = anyFaceButtonPressed();
  if (!gamepadPollPrimed) {
    // 接続直後は決定ボタンを押した状態で来るケースが多いので、
    // 初回フレームは状態だけ取り込んで onSwitch は発火しない。
    gamepadHeld = pressed;
    gamepadPollPrimed = true;
  } else if (pressed && !gamepadHeld) {
    gamepadHeld = true;
    onSwitch();
  } else if (!pressed && gamepadHeld) {
    gamepadHeld = false;
  }
  gamepadPollHandle = requestAnimationFrame(pollGamepads);
}

function startGamepadPolling() {
  if (gamepadPollHandle != null) return;
  gamepadPollPrimed = false;
  gamepadPollHandle = requestAnimationFrame(pollGamepads);
}

function stopGamepadPolling() {
  if (gamepadPollHandle != null) {
    cancelAnimationFrame(gamepadPollHandle);
    gamepadPollHandle = null;
  }
  gamepadHeld = false;
  gamepadPollPrimed = false;
}

window.addEventListener('gamepadconnected', (e) => {
  const name = (e.gamepad && e.gamepad.id) ? e.gamepad.id.split('(')[0].trim() : 'コントローラー';
  showToast(`${name} を接続しました（○✕△□ / A B X Y がスイッチ）`, 2400);
  setGamepadStatus(true, name);
  startGamepadPolling();
});

window.addEventListener('gamepaddisconnected', () => {
  const remaining = (navigator.getGamepads ? navigator.getGamepads() : []).filter(Boolean);
  if (remaining.length === 0) {
    stopGamepadPolling();
    setGamepadStatus(false);
  } else {
    const first = remaining[0];
    const name = first.id ? first.id.split('(')[0].trim() : null;
    setGamepadStatus(true, name);
  }
});

// ---------- インストール促進スナックバー（PWA, Temporary UI パターン） ---------
// web.dev "Promote installation > Temporary UI" のスナックバー形式に倣い、
// 画面下部に 7 秒だけ表示して引っ込める。出現〜表示維持〜退出は CSS アニメーションが
// 担うので setTimeout の発火に依存しない（モバイル端末でのタイマー遅延対策）。
// × で明示的に閉じられた場合のみ 14 日抑制クッキーを書く（自動消去では書かない）。
const INSTALL_DISMISS_COOKIE = 'installDismissedAt';
const INSTALL_DISMISS_DAYS = 14;

let deferredInstallPrompt = null;
let installSnackbarShown = false;

function isPWAStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true; // iOS Safari
}

function isIOSSafari() {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua)
             || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIOS) return false;
  // iOS の Chrome / Firefox / Edge には「ホーム画面に追加」が無い
  return !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

function isInstallDismissedRecently() {
  const raw = readCookie(INSTALL_DISMISS_COOKIE);
  const ts = raw == null ? NaN : parseInt(raw, 10);
  if (!Number.isFinite(ts)) return false;
  return (Date.now() - ts) < INSTALL_DISMISS_DAYS * 86400000;
}

function maybeShowInstallSnackbar() {
  if (installSnackbarShown) return;
  if (isPWAStandalone() || isInstallDismissedRecently()) return;
  if (deferredInstallPrompt) {
    showInstallSnackbar({ ios: false });
  } else if (isIOSSafari()) {
    showInstallSnackbar({ ios: true });
  }
}

function showInstallSnackbar({ ios }) {
  const el = $('#install-snackbar');
  if (!el) return;
  installSnackbarShown = true;
  $('#install-snackbar-title').textContent = ios ? 'ホーム画面に追加' : 'アプリをインストール';
  $('#install-snackbar-text').textContent = ios
    ? 'Safari の「共有」→「ホーム画面に追加」で追加できます'
    : 'ホーム画面に追加するとオフラインでも使えます';
  $('#btn-install').classList.toggle('hidden', ios);
  el.classList.add('shown');
}

function hideInstallSnackbar() {
  const el = $('#install-snackbar');
  if (el) el.classList.remove('shown');
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  if (isPWAStandalone() || isInstallDismissedRecently()) return;
  deferredInstallPrompt = e;
  maybeShowInstallSnackbar();
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  hideInstallSnackbar();
  showToast('アプリをインストールしました');
});

async function triggerInstall() {
  if (!deferredInstallPrompt) return;
  hideInstallSnackbar();
  deferredInstallPrompt.prompt();
  try {
    const { outcome } = await deferredInstallPrompt.userChoice;
    if (outcome === 'dismissed') {
      writeCookie(INSTALL_DISMISS_COOKIE, String(Date.now()));
    }
  } finally {
    // prompt() は同じイベントで一度しか呼べない
    deferredInstallPrompt = null;
  }
}

function dismissInstallSnackbar() {
  hideInstallSnackbar();
  writeCookie(INSTALL_DISMISS_COOKIE, String(Date.now()));
}

// ---------- 起動 ---------------------------------------------------------------
function init() {
  setSpeed(loadSavedSpeed(1000));
  setPanel('hiragana');
  startScan();
  $('#btn-slower').addEventListener('click', () => adjustSpeed(+200));
  $('#btn-faster').addEventListener('click', () => adjustSpeed(-200));
  $('#btn-install').addEventListener('click', triggerInstall);
  $('#btn-install-dismiss').addEventListener('click', dismissInstallSnackbar);
  maybeShowInstallSnackbar();
  showToast('スイッチ：Space / Enter、または ○✕△□ / A B X Y で操作', 3000);
}
document.addEventListener('DOMContentLoaded', init);
