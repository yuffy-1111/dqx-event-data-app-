// ==========コンテンツチェッカー==========

(function (global) {

  // ===== ストレージキー =====
  const STORAGE_KEY_CHARS         = 'dqx_chars_final10';
  const STORAGE_KEY_CHECK_PREFIX  = 'dqx_check_final10_';
  const STORAGE_KEY_DISABLED      = 'dqx_disabled_final10';
  const STORAGE_KEY_HIDDEN        = 'dqx_hidden_tasks_v1';
  const STORAGE_KEY_LIM_CHECKS    = 'dqx_limited_checks_v3';

  const EVENTS_URL  = 'https://raw.githubusercontent.com/yuffy-1111/dqx-event-data/main/checker.json';
  const RESET_HOUR  = 6; // JST 毎日6時リセット

  // ===== 呪文フォーマット定数 =====
  // Y = 現行形式（名前全文字 + カラー + チェックBase64 + ロックBase64）
  // X = 旧ブログ版（フィールド構成は同じ、23項目として読み込む）
  const SPELL_MARKER_CURRENT = 'Y';
  const SPELL_MARKER_LEGACY  = 'X';
  const SPELL_FIELD_SEP      = '|';
  const SPELL_RECORD_SEP     = ';';

  // タスクキーの順序（ビット列のインデックス順、23項目）
  const TASK_KEY_ORDER = [
    'daily1', 'daily2', 'daily3', 'daily4',
    'weekly1', 'weekly2', 'weekly3', 'weekly4', 'weekly5',
    'weekly6', 'weekly7', 'weekly8', 'weekly9', 'weekly10',
    'roster', 'tasogare', 'lemon',
    'jashin',
    'monthly1',
    'pani',
    'konmeiku',
    'sekkai',
    'monthly2',
  ];

  // ===== タスク定義 =====
  const SECTIONS_TEMPLATE = [
    { type: 'section', label: '▼ 日課',     sectionId: 'daily-section',        taskKey: 'section_daily',      cycleTaskId: null },
    { name: '日替わり討伐',          taskId: 'daily',    key: 'daily1' },
    { name: '深淵の咎人(ﾗｸﾘﾏ)',     taskId: 'daily',    key: 'daily2' },
    { name: '深淵の咎人(果実)',       taskId: 'daily',    key: 'daily3' },
    { name: '聖守護者の闘戦記',       taskId: 'daily',    key: 'daily4' },
    { type: 'section', label: '▼ 週課',     sectionId: 'weekly-section',        taskKey: 'section_weekly',     cycleTaskId: 'weekly' },
    { name: '週替わり討伐',           taskId: 'weekly',   key: 'weekly1' },
    { name: 'エピソード依頼帳',       taskId: 'weekly',   key: 'weekly2' },
    { name: 'トレーニー育成帳',       taskId: 'weekly',   key: 'weekly3' },
    { name: '達人クエスト',           taskId: 'weekly',   key: 'weekly4' },
    { name: '王家の迷宮',             taskId: 'weekly',   key: 'weekly5' },
    { name: 'ピラミッド',             taskId: 'weekly',   key: 'weekly6' },
    { name: '万魔の塔',               taskId: 'weekly',   key: 'weekly7' },
    { name: 'アスタルジア探索',       taskId: 'weekly',   key: 'weekly8' },
    { name: '皇帝の創りしもの',       taskId: 'weekly',   key: 'weekly9' },
    { name: 'ヴァリーブートキャンプ', taskId: 'weekly',   key: 'weekly10' },
    { type: 'section', label: '▼ 隔週',     sectionId: 'biweekly-section',      taskKey: 'section_biweekly',   cycleTaskId: 'roster' },
    { name: 'ロスターのお題',         taskId: 'roster',   key: 'roster' },
    { name: '黄昏の奏戦記',           taskId: 'tasogare', key: 'tasogare' },
    { name: 'レモンスライムクイズ',   taskId: 'lemon',    key: 'lemon' },
    { type: 'section', label: '▼ 隔週2',    sectionId: 'jashin-section',        taskKey: 'section_jashin',     cycleTaskId: 'jashin' },
    { name: '邪神の宮殿',             taskId: 'jashin',   key: 'jashin' },
    { type: 'section', label: '▼ 月1回',    sectionId: 'monthly-section',       taskKey: 'section_monthly',    cycleTaskId: 'monthly' },
    { name: '異界の闘技場',           taskId: 'monthly',  key: 'monthly1' },
    { type: 'section', label: '▼ 周期',     sectionId: 'period-section',        taskKey: 'section_period',     cycleTaskId: 'pani' },
    { name: '現世庫パニガルム',       taskId: 'pani',     key: 'pani' },
    { type: 'section', label: '▼ 期間限定', sectionId: 'limited-section',       taskKey: 'section_limited',    cycleTaskId: 'konmeiku' },
    { name: '昏冥庫パニガルム',       taskId: 'konmeiku', key: 'konmeiku' },
    { type: 'section', label: '▼ 受け取り', sectionId: 'receive-10-section',    taskKey: 'section_receive_10', cycleTaskId: 'sekkai' },
    { name: '覚醒の秘石',             taskId: 'sekkai',   key: 'sekkai' },
    { type: 'section', label: '▼ 受け取り', sectionId: 'receive-1-section',     taskKey: 'section_receive_1',  cycleTaskId: 'monthly' },
    { name: '宝珠ポイント(福引券)',   taskId: 'monthly',  key: 'monthly2' },
  ];

  // ===== 共通ユーティリティ =====

  /** HTMLエスケープ */
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /** HEX文字列を [r, g, b] に変換 */
  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }

  /**
   * HEXカラーを指定アルファで背景色とブレンドしてHEXで返す
   * @param {string} hex    - 前景色 (#rrggbb)
   * @param {number} alpha  - 不透明度 (0〜1)
   * @param {number[]} bgRgb - 背景色 [r, g, b]
   */
  function blendColor(hex, alpha, bgRgb) {
    const [fr, fg, fb] = hexToRgb(hex);
    const [br, bg, bb] = bgRgb;
    const r = Math.round(fr * alpha + br * (1 - alpha));
    const g = Math.round(fg * alpha + bg * (1 - alpha));
    const b = Math.round(fb * alpha + bb * (1 - alpha));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }

  /** ダークモード判定 */
  function isDarkMode() {
    return document.body.classList.contains('dark-mode');
  }

  /** キャラクターカラムの背景色を現在のモードに合わせて返す */
  function getColColor(hex) {
    return isDarkMode()
      ? blendColor(hex, 0.25, [17, 24, 39])
      : blendColor(hex, 0.30, [255, 255, 255]);
  }

  /** 現在のJST時刻を返す */
  function getJSTNow() {
    const now = new Date();
    const jstOffsetMin = -540; // JST = UTC+9
    return new Date(now.getTime() + (now.getTimezoneOffset() - jstOffsetMin) * 60000);
  }

  /**
   * 日付をリセット時刻（6時）を基準とした「実効日」に変換して返す
   */
  function getEffectiveDate(date) {
    const d = new Date(date);
    if (d.getHours() < RESET_HOUR) d.setDate(d.getDate() - 1);
    d.setHours(RESET_HOUR, 0, 0, 0);
    return d;
  }

  /** 実効日から "YYYY-M-D" 形式のキーを返す */
  function getDateKey(date) {
    const d = getEffectiveDate(date);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  /** 実効日から "YYYY_週番号" 形式のキーを返す */
  function getWeekKey(date) {
    const d = getEffectiveDate(date);
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const weekNum = Math.floor((d - jan1) / (7 * 86400000));
    return `${d.getFullYear()}_${weekNum}`;
  }

  /** "YYYY-M-D" 形式のキーを Date に戻す */
  function parseDateKey(key) {
    const [y, m, day] = key.split('-').map(Number);
    return new Date(y, m - 1, day, RESET_HOUR, 0, 0);
  }

  /** 2つの日付が同じ実効日かどうか */
  function isSameEffectiveDay(a, b) {
    const da = getEffectiveDate(a);
    const db = getEffectiveDate(b);
    return da.getFullYear() === db.getFullYear()
      && da.getMonth()      === db.getMonth()
      && da.getDate()       === db.getDate();
  }

  /** 2つの日付が同じ実効週かどうか */
  function isSameEffectiveWeek(a, b) {
    return getWeekKey(a) === getWeekKey(b);
  }

  /**
   * 日時文字列をJSTのDateとして解析する
   * タイムゾーン指定がない場合は+09:00として扱う
   */
  function parseToJST(str) {
    if (!str) return null;
    let d;
    if (str.includes('T')) {
      d = (!str.includes('+') && !str.includes('Z'))
        ? new Date(str + '+09:00')
        : new Date(str);
    } else {
      d = new Date(str + 'T00:00:00+09:00');
    }
    return isNaN(d.getTime()) ? null : d;
  }

  // ===== 周期計算 =====

  /**
   * タスクIDと対象日から、直近のリセット（開始）日時を返す
   * @param {string} taskId
   * @param {Date}   targetDate
   * @returns {Date}
   */
  function getLastResetDate(taskId, targetDate) {
    const target = getEffectiveDate(targetDate);
    const year   = target.getFullYear();
    const month  = target.getMonth();
    const day    = target.getDate();

    switch (taskId) {
      case 'weekly': {
        // 2026/4/12 6:00 を基点に168時間周期
        const base  = new Date(2026, 3, 12, 6, 0, 0);
        const hours = (target - base) / (1000 * 60 * 60);
        return new Date(base.getTime() + Math.floor(hours / 168) * 168 * 60 * 60 * 1000);
      }
      case 'pani': {
        // 2026/4/12 6:00 を基点に72時間周期
        const base  = new Date(2026, 3, 12, 6, 0, 0);
        const hours = (target - base) / (1000 * 60 * 60);
        return new Date(base.getTime() + Math.floor(hours / 72) * 72 * 60 * 60 * 1000);
      }
      case 'roster':
      case 'tasogare':
      case 'lemon':
        // 毎月1日・15日リセット
        return day >= 15
          ? new Date(year, month, 15, 6, 0, 0)
          : new Date(year, month, 1, 6, 0, 0);
      case 'jashin': {
        // 毎月10日・25日リセット
        if (day >= 25) return new Date(year, month, 25, 6, 0, 0);
        if (day >= 10) return new Date(year, month, 10, 6, 0, 0);
        const prevMonthEnd = new Date(year, month, 0); // 前月末
        return new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 25, 6, 0, 0);
      }
      case 'monthly':
        return new Date(year, month, 1, 6, 0, 0);
      case 'sekkai': {
        // 毎月10日リセット
        if (day >= 10) return new Date(year, month, 10, 6, 0, 0);
        const prevMonthEnd = new Date(year, month, 0);
        return new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 10, 6, 0, 0);
      }
      case 'daily':
      default:
        return target;
    }
  }

  /**
   * タスクIDと対象日から、次回リセット日時を返す
   * @param {string} taskId
   * @param {Date}   targetDate
   * @returns {Date}
   */
  function getNextResetDate(taskId, targetDate) {
    const last = getLastResetDate(taskId, targetDate);
    const next = new Date(last);
    switch (taskId) {
      case 'weekly':
        next.setTime(last.getTime() + 168 * 60 * 60 * 1000);
        break;
      case 'pani':
        next.setTime(last.getTime() + 72 * 60 * 60 * 1000);
        break;
      case 'roster':
      case 'tasogare':
      case 'lemon':
        if (last.getDate() === 1) next.setDate(15);
        else { next.setDate(1); next.setMonth(next.getMonth() + 1); }
        break;
      case 'jashin':
        if (last.getDate() === 10) next.setDate(25);
        else if (last.getDate() === 25) { next.setDate(10); next.setMonth(next.getMonth() + 1); }
        break;
      case 'monthly':
      case 'sekkai':
        next.setMonth(next.getMonth() + 1);
        break;
    }
    return next;
  }

  /**
   * セクションヘッダーに表示する「次回〇〇（あとN日）」テキストを返す
   * @param {string|null} taskId
   * @param {Date}        targetDate
   * @returns {string}
   */
  function getSectionNextText(taskId, targetDate) {
    if (!taskId) return '';

    const effectiveNow = getEffectiveDate(targetDate);

    /** "M/D" 形式に変換 */
    const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;

    /** 次回日までの残日数を計算してテキストを組み立てる */
    const buildText = (nextDate) => {
      const diffDays = Math.ceil((nextDate - effectiveNow) / (1000 * 60 * 60 * 24));
      return diffDays <= 0
        ? `【次回 ${fmt(nextDate)}】`
        : `【次回 ${fmt(nextDate)}（あと${diffDays}日）】`;
    };

    if (taskId === 'pani') {
      const nextDate = new Date(getLastResetDate('pani', effectiveNow).getTime() + 72 * 60 * 60 * 1000);
      return buildText(nextDate);
    }

    if (taskId === 'konmeiku') {
      const day = effectiveNow.getDate();
      const nextStart = day < 15
        ? new Date(effectiveNow.getFullYear(), effectiveNow.getMonth(), 15, 6, 0, 0)
        : new Date(effectiveNow.getFullYear(), effectiveNow.getMonth() + 1, 1, 6, 0, 0);
      return buildText(nextStart);
    }

    return buildText(getNextResetDate(taskId, effectiveNow));
  }

  // ===== パニガルム詳細 =====

  const PANI_BOSSES = [
    'ﾌｫﾙﾀﾞｲﾅ', 'ﾀﾞｲﾀﾞﾙﾓｽ', 'ﾊﾟﾆｶﾞｷｬｯﾁｬｰ', 'ﾌﾙﾎﾟﾃｨ',
    'ﾌﾟﾙﾀﾇｽ', 'ｴﾙｷﾞｵｽ', 'ｱﾙﾏﾅ', 'ｼﾞｹﾞﾝﾘｭｳ',
  ];
  const PANI_BASE_DATE = new Date(2026, 3, 12, 6, 0, 0); // 72時間周期の基点

  /**
   * 現世庫パニガルムの現在のボス名と期間を返す
   * @param {Date} targetDate
   * @returns {{ name: string, detail: string }}
   */
  function getPaniDetail(targetDate) {
    const target   = getEffectiveDate(targetDate);
    const hours    = (target - PANI_BASE_DATE) / (1000 * 60 * 60);
    const cycleNum = hours >= 0 ? Math.floor(hours / 72) : -1;
    const bossIdx  = ((cycleNum % 8) + 8) % 8;
    const startDate = new Date(PANI_BASE_DATE.getTime() + cycleNum * 72 * 60 * 60 * 1000);
    const endDate   = new Date(startDate.getTime() + 72 * 60 * 60 * 1000);
    const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
    return {
      name:   '現世庫パニガルム',
      detail: `${PANI_BOSSES[bossIdx]} ${fmt(startDate)}〜${fmt(endDate)}`,
    };
  }

  const KONMEIKU_BOSSES   = ['ﾊﾟﾆｽﾗｲﾑ', 'ｼﾞｪﾛﾄﾞｰﾗ', 'ﾌｫﾙｶﾞﾉｽ', 'ﾏｳﾌﾗｰﾄ'];
  const KONMEIKU_BASE_DATE = new Date(2026, 3, 1, 6, 0, 0); // 開催回数カウントの基点

  /**
   * 昏冥庫パニガルムの現在のサイクルインデックスを返す
   * 1日と15日を交互にカウントして4周期を算出
   */
  function getKonmeikuCycleIndex(targetDate) {
    const target  = getEffectiveDate(targetDate);
    let count     = 0;
    let current   = new Date(KONMEIKU_BASE_DATE);
    while (current <= target) {
      const day = current.getDate();
      if (day === 1 || day === 15) count++;
      current = day === 1
        ? new Date(current.getFullYear(), current.getMonth(), 15, 6, 0, 0)
        : new Date(current.getFullYear(), current.getMonth() + 1, 1, 6, 0, 0);
    }
    return ((count - 1) % 4 + 4) % 4;
  }

  /**
   * 昏冥庫パニガルムのボス名と期間（or 次回日程）を返す
   * 開催期間: 毎月1〜5日、15〜20日
   * @param {Date} targetDate
   * @returns {{ name: string, detail: string }}
   */
  function getKonmeikuDetail(targetDate) {
    const target = getEffectiveDate(targetDate);
    const day    = target.getDate();
    const year   = target.getFullYear();
    const month  = target.getMonth();
    const fmt    = (d) => `${d.getMonth() + 1}/${d.getDate()}`;

    const isOpen = (day >= 1 && day <= 5) || (day >= 15 && day <= 20);
    if (isOpen) {
      const bossIdx = getKonmeikuCycleIndex(target);
      const period  = day <= 5
        ? `${fmt(new Date(year, month, 1))}〜${fmt(new Date(year, month, 5))}`
        : `${fmt(new Date(year, month, 15))}〜${fmt(new Date(year, month, 20))}`;
      return { name: '昏冥庫パニガルム', detail: `${KONMEIKU_BOSSES[bossIdx]} ${period}` };
    }

    // 次回日程
    const [nextStart, nextEnd] = day < 15
      ? [new Date(year, month, 15), new Date(year, month, 20)]
      : [new Date(year, month + 1, 1), new Date(year, month + 1, 5)];
    return { name: '昏冥庫パニガルム', detail: `未開催（次回 ${fmt(nextStart)}〜${fmt(nextEnd)}）` };
  }

  // ===== キャラクター管理 =====
  let characters   = [];
  let nextCharId   = 1;
  let disabledMap  = new Map(); // key: "taskKey_charId" → true
  let hiddenMap    = new Map(); // key: taskKey → true
  let isEditMode   = false;
  let darkModeObserver = null;

  function loadCharacters() {
    const saved = localStorage.getItem(STORAGE_KEY_CHARS);
    if (!saved) return;
    try {
      characters = JSON.parse(saved);
      if (characters.length) {
        nextCharId = Math.max(...characters.map(c => c.id), 0) + 1;
      }
    } catch (e) {
      characters = [];
    }
  }

  function saveCharacters() {
    localStorage.setItem(STORAGE_KEY_CHARS, JSON.stringify(characters));
  }

  function loadDisabled() {
    const saved = localStorage.getItem(STORAGE_KEY_DISABLED);
    if (!saved) return;
    try { disabledMap = new Map(Object.entries(JSON.parse(saved))); } catch (e) { disabledMap = new Map(); }
  }

  function saveDisabled() {
    localStorage.setItem(STORAGE_KEY_DISABLED, JSON.stringify(Object.fromEntries(disabledMap)));
  }

  /** taskKey + charId のペアが無効化（ロック）されているか */
  function isDisabled(taskKey, charId) {
    return disabledMap.has(`${taskKey}_${charId}`);
  }

  function setDisabled(taskKey, charId, disabled) {
    const key = `${taskKey}_${charId}`;
    if (disabled) disabledMap.set(key, true);
    else disabledMap.delete(key);
    saveDisabled();
  }

  function toggleDisabled(taskKey, charId) {
    setDisabled(taskKey, charId, !isDisabled(taskKey, charId));
    renderAll();
  }

  function loadHidden() {
    const saved = localStorage.getItem(STORAGE_KEY_HIDDEN);
    if (!saved) return;
    try { hiddenMap = new Map(Object.entries(JSON.parse(saved))); } catch (e) { hiddenMap = new Map(); }
  }

  function saveHidden() {
    localStorage.setItem(STORAGE_KEY_HIDDEN, JSON.stringify(Object.fromEntries(hiddenMap)));
  }

  /** taskKey が非表示か */
  function isHidden(taskKey) {
    return hiddenMap.has(taskKey);
  }

  function setHidden(taskKey, hidden) {
    if (hidden) hiddenMap.set(taskKey, true);
    else hiddenMap.delete(taskKey);
    saveHidden();
    renderAll();
  }

  function toggleHidden(taskKey) {
    setHidden(taskKey, !isHidden(taskKey));
  }

  function addCharacter() {
    const nameInput  = document.getElementById('newCharName');
    const colorInput = document.getElementById('newCharColor');
    const name = nameInput.value.trim();
    if (!name) { alert('キャラ名を入力してください'); return; }
    characters.push({ id: nextCharId++, name, color: colorInput.value });
    saveCharacters();
    nameInput.value = '';
    renderAll();
  }

  function deleteCharacter(charId) {
    // そのキャラのロック状態を全て解除してから削除
    for (const item of SECTIONS_TEMPLATE) {
      if (!item.type) setDisabled(item.key, charId, false);
    }
    characters = characters.filter(c => c.id !== charId);
    saveCharacters();
    renderAll();
  }

  function editCharacterName(charId, newName) {
    const char = characters.find(c => c.id === charId);
    if (char && newName.trim()) {
      char.name = newName.trim();
      saveCharacters();
      renderAll();
    }
  }

  function changeCharacterColor(charId, newColor) {
    const char = characters.find(c => c.id === charId);
    if (char) {
      char.color = newColor;
      saveCharacters();
      renderAll();
    }
  }

  // ===== チェックボックス =====

  /**
   * 最後にチェックした日時が現在のリセット基準より古ければ true を返す
   * （konmeiku は開催中は常に false = リセットしない）
   */
  function needsReset(lastCheckedDate, todayDate, taskId) {
    if (taskId === 'konmeiku') {
      const day    = getEffectiveDate(todayDate).getDate();
      const isOpen = (day >= 1 && day <= 5) || (day >= 15 && day <= 20);
      return !isOpen; // 開催中はリセットしない
    }
    return lastCheckedDate < getLastResetDate(taskId, todayDate);
  }

  function saveCheck(taskKey, charId, checked, todayDate) {
    const storageKey = STORAGE_KEY_CHECK_PREFIX + taskKey + '_' + charId;
    localStorage.setItem(storageKey, JSON.stringify({
      checked,
      lastDate: getDateKey(todayDate),
    }));
  }

  /**
   * チェック状態を読み込む。リセット期間を過ぎている場合は自動的にリセットして false を返す
   */
  function loadCheck(taskKey, charId, todayDate, taskId) {
    const storageKey = STORAGE_KEY_CHECK_PREFIX + taskKey + '_' + charId;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return false;
    try {
      const data = JSON.parse(raw);
      if (!data.checked) return false;
      const lastDate = parseDateKey(data.lastDate);
      if (needsReset(lastDate, todayDate, taskId)) {
        saveCheck(taskKey, charId, false, todayDate);
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  // ===== ビット列 ↔ Base64 =====

  /** ビット文字列（"0"/"1" の羅列）を URL-safe Base64 に変換 */
  function bitsToBase64(bits) {
    const bytes = [];
    for (let i = 0; i < bits.length; i += 8) {
      bytes.push(parseInt(bits.slice(i, i + 8).padEnd(8, '0'), 2));
    }
    return btoa(String.fromCharCode(...bytes))
      .replace(/\//g, '-').replace(/\+/g, '_').replace(/=/g, '');
  }

  /**
   * URL-safe Base64 をビット文字列に変換する
   * @param {string} b64           - URL-safe Base64 文字列
   * @param {number} expectedBits  - 取り出すビット数
   * @returns {string|null} ビット文字列、失敗時は null
   */
  function base64ToBits(b64, expectedBits) {
    let padded = b64.replace(/-/g, '/').replace(/_/g, '+');
    while (padded.length % 4 !== 0) padded += '=';
    try {
      const decoded = atob(padded);
      let bits = '';
      for (let i = 0; i < decoded.length; i++) {
        bits += decoded.charCodeAt(i).toString(2).padStart(8, '0');
      }
      return bits.slice(0, expectedBits);
    } catch (e) {
      return null;
    }
  }

  // ===== 呪文の書き出し（現行形式 Y）=====

  function exportSpell() {
    if (characters.length === 0) {
      alert('キャラクターが登録されていません');
      return;
    }

    const effectiveDate = getEffectiveDate(getJSTNow());
    const taskItems     = SECTIONS_TEMPLATE.filter(item => !item.type);

    const records = characters.map(char => {
      // チェックビット列（TASK_KEY_ORDER 順）
      const checkBits = TASK_KEY_ORDER.map(tKey => {
        const item = taskItems.find(t => t.key === tKey);
        return item && loadCheck(tKey, char.id, effectiveDate, item.taskId) ? '1' : '0';
      }).join('');

      // ロック（無効化）ビット列
      const lockBits = TASK_KEY_ORDER.map(tKey =>
        isDisabled(tKey, char.id) ? '1' : '0'
      ).join('');

      return [
        SPELL_MARKER_CURRENT,
        char.name,
        char.color.replace('#', ''),
        bitsToBase64(checkBits),
        bitsToBase64(lockBits),
      ].join(SPELL_FIELD_SEP);
    });

    const spell = records.join(SPELL_RECORD_SEP);
    navigator.clipboard.writeText(spell)
      .then(() => alert(`✓ 呪文をコピーしました！\n${spell.length}文字`))
      .catch(() => prompt('コピーに失敗しました。手動でコピーしてください:', spell));
  }

  // ===== 呪文の読み込み（Y/X 両対応）=====

  function importSpell(spell) {
    spell = (spell || '').trim();
    if (!spell) { alert('呪文を入力してください'); return; }

    const marker = spell.charAt(0);
    if (marker !== SPELL_MARKER_CURRENT && marker !== SPELL_MARKER_LEGACY) {
      alert('不明な形式の呪文です（Y または X で始まる必要があります）');
      return;
    }

    const effectiveDate   = getEffectiveDate(getJSTNow());
    const taskItems       = SECTIONS_TEMPLATE.filter(item => !item.type);
    const records         = spell.split(SPELL_RECORD_SEP);
    const expectedPrefix  = marker + SPELL_FIELD_SEP;
    let addedCount        = 0;

    for (let recIdx = 0; recIdx < records.length; recIdx++) {
      const rec = records[recIdx].trim();
      if (!rec) continue;

      if (!rec.startsWith(expectedPrefix)) {
        console.warn(`レコード ${recIdx + 1} をスキップ（${expectedPrefix} で始まらない）`);
        continue;
      }

      // マーカーと区切りを除去して各フィールドに分割
      const parts = rec.slice(2).split(SPELL_FIELD_SEP);
      if (parts.length < 4) {
        alert(`レコード ${recIdx + 1} のフィールド数が不足しています`);
        continue;
      }

      const [charName, colorHex, checkB64, lockB64] = parts;
      const checkBits = base64ToBits(checkB64, TASK_KEY_ORDER.length);
      if (!checkBits) { alert(`レコード ${recIdx + 1} のチェックデータ解析に失敗`); continue; }

      const lockBits = base64ToBits(lockB64, TASK_KEY_ORDER.length);
      if (!lockBits)  { alert(`レコード ${recIdx + 1} のロックデータ解析に失敗`);  continue; }

      const newId = nextCharId++;
      characters.push({ id: newId, name: charName, color: '#' + colorHex });

      TASK_KEY_ORDER.forEach((tKey, idx) => {
        const item = taskItems.find(t => t.key === tKey);
        if (item && checkBits[idx] === '1') saveCheck(tKey, newId, true, effectiveDate);
        if (lockBits[idx] === '1')          setDisabled(tKey, newId, true);
      });
      addedCount++;
    }

    if (addedCount === 0) { alert('有効なデータがありませんでした'); return; }
    saveCharacters();
    alert(`✓ ${addedCount}人分のデータを読み込みました！`);
    renderAll();
  }

  function showImportDialog() {
    const spell = prompt('呪文を貼り付けてください\n（X または Y で始まる文字列）');
    if (spell) importSpell(spell);
  }

  // ===== イベント =====

  /** イベントが現在アクティブかどうかを判定 */
  function isEventActive(event, now) {
    const start = parseToJST(event.startDateTime || event.startDate);
    const end   = parseToJST(event.endDateTime   || event.endDate);
    if (!start || !end) return false;
    return now >= start && now <= end;
  }

  /** イベントの期間を "M/D〜M/D HH:mm" 形式で返す */
  function getEventPeriodStr(event) {
    const start = parseToJST(event.startDateTime || event.startDate);
    const end   = parseToJST(event.endDateTime   || event.endDate);
    if (!start || !end) return '期間不明';
    const fmtDateTime = (d) => {
      const h = d.getHours(), m = d.getMinutes();
      const base = `${d.getMonth() + 1}/${d.getDate()}`;
      return (h === 0 && m === 0) ? base : `${base} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };
    return `${fmtDateTime(start)}〜${fmtDateTime(end)}`;
  }

  /** 期間限定イベントのチェック保存キーを生成 */
  function getLimCheckKey(eventId, charId, periodKey) {
    return `${STORAGE_KEY_LIM_CHECKS}_${eventId}_${charId}_${periodKey}`;
  }

  /** 期間限定イベントのチェック状態を返す */
  function isLimChecked(event, charId, today) {
    if (!isEventActive(event, today)) return false;
    let periodKey;
    if      (event.resetType === 'weekly') periodKey = getWeekKey(today);
    else if (event.resetType === 'daily')  periodKey = getDateKey(today);
    else                                   periodKey = `once_${event.id}`;

    const key = getLimCheckKey(event.id, charId, periodKey);
    if (localStorage.getItem(key) !== '1') return false;

    const lastStr = localStorage.getItem(getLimCheckKey(event.id, charId, 'last_date'));
    if (lastStr) {
      const last = new Date(lastStr);
      if (event.resetType === 'daily'  && !isSameEffectiveDay(last, today))  { localStorage.removeItem(key); return false; }
      if (event.resetType === 'weekly' && !isSameEffectiveWeek(last, today)) { localStorage.removeItem(key); return false; }
    }
    return true;
  }

  /** 期間限定イベントのチェック状態を保存する */
  function setLimChecked(event, charId, checked, today) {
    if (!isEventActive(event, today) && checked) return;
    let periodKey;
    if      (event.resetType === 'weekly') periodKey = getWeekKey(today);
    else if (event.resetType === 'daily')  periodKey = getDateKey(today);
    else                                   periodKey = `once_${event.id}`;

    const key = getLimCheckKey(event.id, charId, periodKey);
    localStorage.setItem(key, checked ? '1' : '0');
    if (checked) {
      localStorage.setItem(getLimCheckKey(event.id, charId, 'last_date'), today.toISOString());
    }
  }

  /** イベントデータのバリデーション */
  function validateEventData(data) {
    if (!data || typeof data !== 'object') return false;
    if (!Array.isArray(data.events)) return false;
    // id に使用禁止文字が含まれていないか確認（localStorage キー名の安全性を確保）
    // 禁止: 空白・制御文字・パス区切り(/ \)・クォート(' ")
    const UNSAFE_ID = /[\s\x00-\x1f\x7f/\\'"]/;
    return data.events.every(e =>
      typeof e.id === 'string' && e.id.length > 0 && !UNSAFE_ID.test(e.id) &&
      typeof e.name === 'string'
    );
  }

  // ===== 詳細テーブル（パニガルム・イベント一覧） =====

  async function renderDetailTable() {
    const container = document.getElementById('detailTableContainer');
    if (!container) return;

    const today = getJSTNow();
    const rowStyle  = 'padding:5px 8px;border-bottom:1px solid #e2edf2;';
    const secStyle  = 'padding:6px 8px;background:#e9edf2;font-weight:bold;text-align:left;';

    let html = '<div style="margin-top:20px;overflow-x:auto;">'
      + '<table class="detail-table" style="width:100%;border-collapse:collapse;font-size:0.7rem;">'
      + '<thead><tr style="background:#e6edf4;">'
      + '<th style="padding:6px;text-align:left;">名称</th>'
      + '<th style="padding:6px;text-align:left;">詳細</th>'
      + '</tr></thead><tbody>'
      + `<tr class="detail-section-row"><td colspan="2" style="${secStyle}">▼ パニガルム</td></tr>`;

    for (const fn of [getPaniDetail, getKonmeikuDetail]) {
      const { name, detail } = fn(today);
      html += `<tr><td style="${rowStyle}">${escapeHtml(name)}</td><td style="${rowStyle}">${escapeHtml(detail)}</td></tr>`;
    }

    let events = [];
    try {
      const res = await fetch(EVENTS_URL, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (validateEventData(data)) {
          events = data.events.filter(e => isEventActive(e, today));
        }
      }
    } catch (e) { /* ネットワークエラーは無視 */ }

    if (events.length) {
      html += `<tr class="detail-section-row"><td colspan="2" style="${secStyle}">▼ イベント</td></tr>`;
      for (const event of events) {
        html += `<tr><td style="${rowStyle}">${escapeHtml(event.name)}</td>`
          + `<td style="${rowStyle}">${escapeHtml(getEventPeriodStr(event))}</td></tr>`;
      }
    }

    html += '</tbody></table></div>';
    container.innerHTML = html;
  }

  // ===== 編集モード切替 =====

  function toggleEditMode() {
    isEditMode = !isEditMode;
    const editBtn = document.getElementById('editModeBtn');
    editBtn.textContent = isEditMode ? '🔒 編集モード終了' : '✏️ 編集モード';
    editBtn.classList.toggle('edit-mode-active', isEditMode);
    renderAll();
  }

  // ===== 左右テーブルの行高さ同期 =====

  function syncRowHeights() {
    const leftRows  = document.querySelectorAll('#leftTable tbody tr, #leftTable thead tr');
    const rightRows = document.querySelectorAll('#rightTable tbody tr, #rightTable thead tr');
    if (leftRows.length !== rightRows.length) return;
    // 一旦リセットしてから計測
    leftRows.forEach(r  => (r.style.height = ''));
    rightRows.forEach(r => (r.style.height = ''));
    for (let i = 0; i < leftRows.length; i++) {
      const h = Math.max(
        leftRows[i].getBoundingClientRect().height,
        rightRows[i].getBoundingClientRect().height,
      );
      leftRows[i].style.height  = h + 'px';
      rightRows[i].style.height = h + 'px';
    }
  }

  // ===== イベント行の構築（左右テーブル分離） =====

  /**
   * イベントセクションの行を leftTbody / rightTbody に追加する
   * @param {object[]} eventList   - 追加するイベントの配列
   * @param {string}   sectionLabel - セクションヘッダーのラベル
   * @param {Element}  leftTbody
   * @param {Element}  rightTbody
   * @param {Date}     targetDate
   */
  function buildEventSectionRows(eventList, sectionLabel, leftTbody, rightTbody, targetDate) {
    // 左セクション行
    const lSecRow = document.createElement('tr');
    lSecRow.className = 'section-row';
    const lSecTd = document.createElement('td');
    lSecTd.innerHTML = `<div style="display:flex;align-items:baseline;">${sectionLabel}</div>`;
    lSecRow.appendChild(lSecTd);
    leftTbody.appendChild(lSecRow);

    // 右セクション行
    const rSecRow = document.createElement('tr');
    rSecRow.className = 'section-row';
    const rSecTd = document.createElement('td');
    rSecTd.colSpan = Math.max(characters.length, 1);
    rSecTd.style.padding = '4px 8px';
    rSecRow.appendChild(rSecTd);
    rightTbody.appendChild(rSecRow);

    for (const event of eventList) {
      const eventHiddenKey = `event_${event.id}`;
      const isHiddenRow    = isHidden(eventHiddenKey);
      if (!isEditMode && isHiddenRow) continue;

      // 左行（タスク名）
      const lRow = document.createElement('tr');
      if (isHiddenRow && isEditMode) lRow.style.opacity = '0.5';
      const lTd  = document.createElement('td');
      lTd.className = 'task-name';
      if (isEditMode) {
        lTd.appendChild(createHideToggleBtn(isHiddenRow, () => toggleHidden(eventHiddenKey)));
      }
      const nameSpan = document.createElement('span');
      nameSpan.innerText = event.name;
      lTd.appendChild(nameSpan);
      lRow.appendChild(lTd);
      leftTbody.appendChild(lRow);

      // 右行（チェックボックス or 編集ボタン）
      const rRow = document.createElement('tr');
      if (isHiddenRow && isEditMode) rRow.style.opacity = '0.5';
      for (const char of characters) {
        const td       = document.createElement('td');
        td.style.backgroundColor = getColColor(char.color);
        const disabled = isDisabled(eventHiddenKey, char.id);

        if (isEditMode) {
          td.appendChild(createEditLockBtn(disabled, () => toggleDisabled(eventHiddenKey, char.id)));
        } else if (!isHiddenRow) {
          td.appendChild(createCheckbox(
            isLimChecked(event, char.id, targetDate),
            disabled,
            (checked) => setLimChecked(event, char.id, checked, targetDate),
          ));
        }
        rRow.appendChild(td);
      }
      rightTbody.appendChild(rRow);
    }
  }

  async function renderEventRows(leftTbody, rightTbody, targetDate) {
    let events = [];
    try {
      const res = await fetch(EVENTS_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!validateEventData(data)) return;
      events = data.events.filter(e => isEventActive(e, targetDate));
    } catch (e) {
      console.error('イベント取得失敗:', e);
      return;
    }
    if (!events.length) return;

    const dailyEvents = events.filter(e => e.resetType === 'daily');
    const otherEvents = events.filter(e => e.resetType !== 'daily');

    if (dailyEvents.length) buildEventSectionRows(dailyEvents, '▼ イベント（毎日）',       leftTbody, rightTbody, targetDate);
    if (otherEvents.length) buildEventSectionRows(otherEvents, '▼ イベント（期間中1回）', leftTbody, rightTbody, targetDate);

    requestAnimationFrame(syncRowHeights);
  }

  // ===== 共通 DOM 部品 =====

  /**
   * 表示/非表示トグルボタンを生成する（編集モード用）
   * @param {boolean}  isHiddenNow - 現在非表示状態か
   * @param {Function} onClick
   * @returns {HTMLButtonElement}
   */
  function createHideToggleBtn(isHiddenNow, onClick) {
    const btn = document.createElement('button');
    btn.innerText = isHiddenNow ? '✓' : '✗';
    btn.className = 'hide-toggle-btn ' + (isHiddenNow ? 'hide-toggle-active' : 'hide-toggle-inactive');
    btn.onclick = onClick;
    return btn;
  }

  /**
   * ロック切替ボタンを生成する（編集モード用）
   * @param {boolean}  isLocked
   * @param {Function} onClick
   * @returns {HTMLDivElement}
   */
  function createEditLockBtn(isLocked, onClick) {
    const btn = document.createElement('div');
    btn.className = 'edit-button ' + (isLocked ? 'edit-button-disabled' : 'edit-button-enabled');
    btn.innerText = isLocked ? '🔒' : '🔓';
    btn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); onClick(); };
    return btn;
  }

  /**
   * チェックボックスを生成する
   * @param {boolean}       checked
   * @param {boolean}       disabled
   * @param {Function}      onChange - (checked: boolean) => void
   * @returns {HTMLInputElement}
   */
  function createCheckbox(checked, disabled, onChange) {
    const cb  = document.createElement('input');
    cb.type   = 'checkbox';
    if (disabled) {
      cb.disabled = true;
      cb.classList.add('disabled-checkbox');
    } else {
      cb.checked = checked;
      cb.addEventListener('change', (e) => onChange(e.target.checked));
    }
    return cb;
  }

  // ===== メイン描画 =====

  function renderAll() {
    const targetDate    = getJSTNow();
    const effectiveDate = getEffectiveDate(targetDate);

    // 日付表示
    const todayInfo = document.getElementById('todayInfo');
    if (todayInfo) {
      todayInfo.innerHTML =
        `<div>📆 ${targetDate.getMonth() + 1}/${targetDate.getDate()}</div>`
        + `<div>✅ 各6時リセット</div>`;
    }

    // キャラクターヘッダー行
    const rightHeaderRow = document.getElementById('rightHeaderRow');
    if (rightHeaderRow) {
      rightHeaderRow.innerHTML = '';
      for (const char of characters) {
        const th = document.createElement('th');
        th.className = 'char-header';
        th.style.backgroundColor = getColColor(char.color);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'char-header-content';

        const nameSpan = document.createElement('span');
        nameSpan.className       = 'char-name';
        nameSpan.innerText       = char.name;
        nameSpan.contentEditable = 'true';
        nameSpan.addEventListener('blur', ((id) => (e) => editCharacterName(id, e.target.innerText))(char.id));

        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'char-controls';

        const colorInput  = document.createElement('input');
        colorInput.type   = 'color';
        colorInput.value  = char.color;
        colorInput.className = 'char-color-input';
        colorInput.addEventListener('change', ((id) => (e) => changeCharacterColor(id, e.target.value))(char.id));

        const delBtn = document.createElement('button');
        delBtn.innerText  = '✕';
        delBtn.className  = 'char-delete';
        delBtn.addEventListener('click', ((id) => () => deleteCharacter(id))(char.id));

        controlsDiv.appendChild(colorInput);
        controlsDiv.appendChild(delBtn);
        contentDiv.appendChild(nameSpan);
        contentDiv.appendChild(controlsDiv);
        th.appendChild(contentDiv);
        rightHeaderRow.appendChild(th);
      }
    }

    const leftTbody  = document.getElementById('leftBody');
    const rightTbody = document.getElementById('rightBody');
    if (!leftTbody || !rightTbody) return;
    leftTbody.innerHTML  = '';
    rightTbody.innerHTML = '';

    for (const item of SECTIONS_TEMPLATE) {
      if (item.type === 'section') {
        const isHiddenRow = isHidden(item.taskKey);
        if (!isEditMode && isHiddenRow) continue;

        // 左セクション行
        const lRow = document.createElement('tr');
        lRow.className = 'section-row';
        if (isHiddenRow && isEditMode) lRow.style.opacity = '0.5';
        const lTd = document.createElement('td');
        lTd.style.padding = '4px 8px';

        const container = document.createElement('div');
        container.style.cssText = 'display:flex;align-items:baseline;gap:6px;';
        if (isEditMode && item.taskKey) {
          container.appendChild(createHideToggleBtn(isHiddenRow, () => toggleHidden(item.taskKey)));
        }
        const labelSpan = document.createElement('span');
        labelSpan.innerText = item.label;
        container.appendChild(labelSpan);
        lTd.appendChild(container);
        lRow.appendChild(lTd);
        leftTbody.appendChild(lRow);

        // 右セクション行（次回日テキスト）
        const rRow = document.createElement('tr');
        rRow.className = 'section-row';
        if (isHiddenRow && isEditMode) rRow.style.opacity = '0.5';
        const rTd = document.createElement('td');
        rTd.colSpan    = Math.max(characters.length, 1);
        rTd.style.cssText = 'text-align:center;padding:4px 8px;';
        const nextText = getSectionNextText(item.cycleTaskId, targetDate);
        if (nextText) {
          const nextSpan = document.createElement('span');
          nextSpan.innerText       = nextText;
          nextSpan.style.cssText   = 'font-size:0.65rem;opacity:0.85;';
          rTd.appendChild(nextSpan);
        }
        rRow.appendChild(rTd);
        rightTbody.appendChild(rRow);
        continue;
      }

      // タスク行
      const isHiddenRow = isHidden(item.key);
      if (!isEditMode && isHiddenRow) continue;

      // 左行（タスク名）
      const lRow = document.createElement('tr');
      if (isHiddenRow && isEditMode) lRow.style.opacity = '0.5';
      const lTd = document.createElement('td');
      lTd.className = 'task-name';
      if (isEditMode) {
        lTd.appendChild(createHideToggleBtn(isHiddenRow, () => toggleHidden(item.key)));
      }
      const nameSpan = document.createElement('span');
      nameSpan.innerText = item.name;
      lTd.appendChild(nameSpan);
      lRow.appendChild(lTd);
      leftTbody.appendChild(lRow);

      // 右行（チェックボックス or 編集ボタン）
      const rRow = document.createElement('tr');
      if (isHiddenRow && isEditMode) rRow.style.opacity = '0.5';

      for (const char of characters) {
        const td = document.createElement('td');
        td.style.backgroundColor = getColColor(char.color);
        const disabled = isDisabled(item.key, char.id);

        if (isEditMode) {
          td.classList.add('edit-mode-cell');
          td.appendChild(createEditLockBtn(disabled, () => toggleDisabled(item.key, char.id)));
        } else if (!isHiddenRow) {
          // 昏冥庫パニガルムが開催期間外の場合はチェック不可
          let isKonmeikuClosed = false;
          if (item.taskId === 'konmeiku') {
            const day = getEffectiveDate(targetDate).getDate();
            isKonmeikuClosed = !((day >= 1 && day <= 5) || (day >= 15 && day <= 20));
          }
          if (isKonmeikuClosed) {
            const cb = document.createElement('input');
            cb.type    = 'checkbox';
            cb.disabled = true;
            cb.checked  = false;
            cb.classList.add('disabled-checkbox');
            td.appendChild(cb);
          } else {
            td.appendChild(createCheckbox(
              loadCheck(item.key, char.id, effectiveDate, item.taskId),
              disabled,
              (checked) => saveCheck(item.key, char.id, checked, effectiveDate),
            ));
          }
        }
        rRow.appendChild(td);
      }
      rightTbody.appendChild(rRow);
    }

    renderEventRows(leftTbody, rightTbody, targetDate).then(() => {
      requestAnimationFrame(syncRowHeights);
    });

    requestAnimationFrame(syncRowHeights);
    renderDetailTable();
  }

  // ===== スタイル =====
  const TOOL_STYLE = `
<style>
* { box-sizing: border-box; }
body { font-family: 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; background: #eef2f7; margin: 0; padding: 8px; color: #1e2f3f; }
.container { max-width: 100%; margin: 0 auto; background: white; border-radius: 14px; box-shadow: 0 1px 6px rgba(0,0,0,0.05); padding: 6px 0 20px; }

/* ツールバー */
.toolbar { display: flex; gap: 6px; padding: 6px 10px; flex-wrap: wrap; align-items: center; border-bottom: 1px solid #e2edf2; }
.toolbar input[type="text"]  { padding: 5px 8px; font-size: 0.7rem; border: 1px solid #ccc; border-radius: 20px; width: 90px; }
.toolbar input[type="color"] { width: 32px; height: 30px; border-radius: 20px; cursor: pointer; padding: 1px 2px; border: 1px solid #ccc; }
.toolbar button { background: #eef2ff; border: none; padding: 5px 12px; border-radius: 30px; font-size: 0.7rem; font-weight: 500; cursor: pointer; }
.add-btn    { background: #0066cc !important; color: white !important; }
.edit-btn   { background: #f59e0b !important; color: white !important; }
.edit-mode-active { background: #10b981 !important; color: white !important; }
.export-btn { background: #10b981 !important; color: white !important; }
.import-btn { background: #8b5cf6 !important; color: white !important; }

/* 今日情報カード */
.today-card { background: #fefce8; border-left: 3px solid #f5a623; margin: 6px 12px; padding: 4px 10px; border-radius: 10px; display: flex; justify-content: space-between; font-size: 0.65rem; flex-wrap: wrap; }

/* 分割テーブルレイアウト */
#tableWrapper { display: flex; align-items: flex-start; width: 100%; overflow: hidden; }
#leftPanel    { flex-shrink: 0; overflow: hidden; border-right: 2px solid #94a8c2; background: inherit; position: relative; z-index: 5; }
#rightPanel   { flex: 1; overflow-x: auto; overflow-y: hidden; }
#leftTable, #rightTable { border-collapse: collapse; font-size: 0.7rem; }
#leftTable  { width: 100%; }
#rightTable { width: max-content; min-width: 100%; }

/* セル共通 */
th, td { border-bottom: 1px solid #e2edf2; padding: 5px 3px; text-align: center; vertical-align: middle; white-space: nowrap; }
th { background: #e6edf4; font-weight: 600; font-size: 0.7rem; }
#leftTable thead th { background: #e6edf4; text-align: left; padding-left: 8px; }
#leftTable tbody td { background: #fafcff; text-align: left; }

/* セクション行 */
.section-row { background: #b8c7da !important; border-top: 2px solid #94a8c2; border-bottom: 2px solid #94a8c2; }
.section-row td { color: #1e3a5f !important; font-weight: bold; letter-spacing: 0.5px; }
#leftTable .section-row td  { background: #b8c7da !important; }
#rightTable .section-row td { background: #b8c7da !important; }
.detail-section-row td { background: #e9edf2; font-weight: bold; }

/* タスク名 */
.task-name { font-weight: 600; text-align: left !important; padding-left: 6px !important; white-space: nowrap; font-size: 0.7rem; }

/* キャラクターヘッダー */
.char-header         { min-width: 70px; }
.char-header-content { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.char-name           { display: inline-block; padding: 2px 4px; border-radius: 16px; cursor: pointer; font-weight: 600; font-size: 0.75rem; white-space: nowrap; }
.char-controls       { display: flex; gap: 4px; justify-content: center; align-items: center; }
.char-color-input    { width: 18px; height: 18px; border: 1px solid #ccc; border-radius: 50%; cursor: pointer; }
.char-delete         { background: none; border: none; font-size: 0.75rem; cursor: pointer; color: #a00; font-weight: bold; padding: 0 2px; }

/* チェックボックス */
input[type="checkbox"]               { width: 16px; height: 16px; cursor: pointer; accent-color: #2c7da0; margin: 0; }
input[type="checkbox"].disabled-checkbox { opacity: 0.4; cursor: not-allowed; pointer-events: none; }

/* 編集モード */
.edit-mode-cell      { background-color: #fff3e0 !important; }
.edit-button         { width: 28px; height: 28px; margin: 0 auto; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 14px; }
.edit-button-enabled { background-color: #e2e8f0; border: 1px solid #cbd5e1; }
.edit-button-disabled{ background-color: #f59e0b; border: 1px solid #d97706; color: white; }

/* 表示/非表示トグルボタン（編集モード）*/
.hide-toggle-btn      { width: 28px; height: 28px; border-radius: 8px; cursor: pointer; font-size: 14px; border: 1px solid #cbd5e1; color: white; margin-right: 4px; }
.hide-toggle-active   { background-color: #10b981; }
.hide-toggle-inactive { background-color: #ef4444; }

/* 詳細テーブル */
.detail-table th, .detail-table td { text-align: left; padding: 6px 8px; }

/* レスポンシブ */
@media (max-width: 768px) {
  body { padding: 12px 0 0 0 !important; }
  .container { padding: 6px 0 100px !important; }
  .char-name { font-size: 0.65rem; }
  .toolbar input[type="text"]  { width: 70px; }
  .toolbar input[type="color"] { width: 26px; height: 26px; }
  .toolbar button { padding: 5px 8px; font-size: 0.65rem; }
  .edit-button, .hide-toggle-btn { width: 24px; height: 24px; font-size: 12px; }
}

/* ダークモード */
body.dark-mode { background: #0f172a; color: #e5e7eb; }
body.dark-mode .container { background: #111827; }
body.dark-mode .toolbar { border-bottom-color: #2a3441; }
body.dark-mode .toolbar input[type="text"]  { background: #374151; border-color: #4b5563; color: #e5e7eb; }
body.dark-mode .toolbar input[type="color"] { background: #374151; border-color: #4b5563; }
body.dark-mode .toolbar button { background: #374151; color: #e5e7eb; }
body.dark-mode .add-btn    { background: #3399ff !important; }
body.dark-mode .edit-btn   { background: #f59e0b !important; }
body.dark-mode .edit-mode-active { background: #10b981 !important; }
body.dark-mode .export-btn { background: #059669 !important; }
body.dark-mode .import-btn { background: #7c3aed !important; }
body.dark-mode .today-card { background: #1f2937; border-left-color: #f59e0b; color: #e5e7eb; }
body.dark-mode th { background: #1f2937; color: #fff; border-bottom-color: #374151; }
body.dark-mode td { color: #fff; border-bottom-color: #2a3441; }
body.dark-mode #leftTable thead th { background: #1f2937; }
body.dark-mode #leftTable tbody td { background: #111827; }
body.dark-mode #leftPanel { border-right-color: #475569; }
body.dark-mode .section-row { background: #334155 !important; border-top-color: #475569; border-bottom-color: #475569; }
body.dark-mode .section-row td { color: #ffffff !important; }
body.dark-mode #leftTable .section-row td  { background: #334155 !important; }
body.dark-mode #rightTable .section-row td { background: #334155 !important; }
body.dark-mode .detail-section-row td { background: #334155; }
body.dark-mode .detail-table td { background-color: #111827 !important; color: #e5e7eb !important; border-bottom-color: #374151 !important; }
body.dark-mode .detail-table th { background-color: #1f2937 !important; color: #e5e7eb !important; }
body.dark-mode .char-name   { color: #fff; }
body.dark-mode .char-delete { color: #f88; }
body.dark-mode .char-controls { color: #e5e7eb; }
body.dark-mode .char-color-input { border-color: #4b5563; }
body.dark-mode .edit-mode-cell { background-color: #2a2a2a !important; }
body.dark-mode .edit-button-enabled  { background-color: #374151; border-color: #4b5563; color: #fff; }
body.dark-mode .edit-button-disabled { background-color: #f59e0b; border-color: #d97706; }
body.dark-mode .hide-toggle-active   { background-color: #059669; }
body.dark-mode .hide-toggle-inactive { background-color: #dc2626; }
body.dark-mode #tableWrapper { background: #111827; }
body.dark-mode #rightPanel   { background: #111827; }
</style>
`;

  // ===== 外部公開 API =====
  global.Checker = {
    render: function (containerSelector) {
      const container = document.querySelector(containerSelector);
      if (!container) return;

      container.innerHTML = TOOL_STYLE + `
<div class="container">
  <div id="toolbar" class="toolbar">
    <input id="newCharName"  type="text"  placeholder="キャラ名" />
    <input id="newCharColor" type="color" value="#d4eaf3" />
    <button id="addCharBtn"   class="add-btn">＋ 追加</button>
    <button id="editModeBtn"  class="edit-btn">✏️ 編集モード</button>
    <button id="exportBtn"    class="export-btn">📋 書き出し</button>
    <button id="importBtn"    class="import-btn">📥 読み込み</button>
  </div>
  <div id="todayInfo" class="today-card"></div>
  <div id="tableWrapper">
    <div id="leftPanel">
      <table id="leftTable">
        <thead><tr><th>項目</th></tr></thead>
        <tbody id="leftBody"></tbody>
      </table>
    </div>
    <div id="rightPanel">
      <table id="rightTable">
        <thead><tr id="rightHeaderRow"></tr></thead>
        <tbody id="rightBody"></tbody>
      </table>
    </div>
  </div>
  <div id="detailTableContainer"></div>
</div>
`;

      loadCharacters();
      loadDisabled();
      loadHidden();

      document.getElementById('addCharBtn').addEventListener('click', addCharacter);
      document.getElementById('editModeBtn').addEventListener('click', toggleEditMode);
      document.getElementById('exportBtn').addEventListener('click', exportSpell);
      document.getElementById('importBtn').addEventListener('click', showImportDialog);

      window.addEventListener('resize', syncRowHeights);

      renderAll();

      // ダークモード切替を検知して再描画（カラムカラーの再計算のため）
      if (darkModeObserver) darkModeObserver.disconnect();
      darkModeObserver = new MutationObserver(() => renderAll());
      darkModeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    },
    destroy: function() {
        if (darkModeObserver) {
            darkModeObserver.disconnect();
            darkModeObserver = null;
        }
        window.removeEventListener('resize', syncRowHeights);
    }
  };
})(window);