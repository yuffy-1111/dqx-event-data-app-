// ========== 進捗チェッカー ==========

(function (global) {

  // ===== ストレージキー =====
  const STORAGE_KEYS = Object.freeze({
    CHARS: 'dqx_chars_final10',
    CHECK_PREFIX: 'dqx_check_final10_',
    DISABLED: 'dqx_disabled_final10',
    HIDDEN: 'dqx_hidden_tasks_v1',
    LIM_CHECKS: 'dqx_limited_checks_v3',
    CUSTOM_EVENTS: 'dqx_custom_events_v1'
  });
  const STORAGE_KEY_CHARS        = STORAGE_KEYS.CHARS;
  const STORAGE_KEY_CHECK_PREFIX = STORAGE_KEYS.CHECK_PREFIX;
  const STORAGE_KEY_DISABLED     = STORAGE_KEYS.DISABLED;
  const STORAGE_KEY_HIDDEN       = STORAGE_KEYS.HIDDEN;
  const STORAGE_KEY_LIM_CHECKS   = STORAGE_KEYS.LIM_CHECKS;

  const EVENTS_URL  = 'https://raw.githubusercontent.com/yuffy-1111/dqx-event-data/main/checker.json';
  const RESET_HOUR  = 6; // JST 毎日6時リセット

  let cachedCheckerEvents = {
    key: null,
    events: [],
  };

  async function loadCheckerEvents(targetDate) {
    const key = targetDate.getTime();
    if (cachedCheckerEvents.key === key) {
      return cachedCheckerEvents.events;
    }

    let events = [];
    try {
      const res = await fetch(EVENTS_URL, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (validateEventData(data)) events = data.events;
      }
    } catch (e) {
      console.error('イベント取得失敗:', e);
    }

    cachedCheckerEvents.key = key;
    cachedCheckerEvents.events = events;
    return events;
  }

  // タスクキーの順序（表示順と一致させている。リリース前のため自由に並び替え可）
  const TASK_KEY_ORDER = [
    'daily1', 'daily2', 'daily3', 'daily4', 'daily5',
    'weekly1', 'weekly2', 'weekly3', 'weekly4', 'weekly5',
    'weekly6', 'weekly7', 'weekly8', 'weekly9', 'weekly10', 'weekly11', 'weekly12',
    'roster', 'lemon', 'tasogare',
    'jashin',
    'monthly1',
    'pani',
    'konmeiku',
    'mamono_alliance',
    'monthly2',
    'sekkai',
    'hanabira',
  ];

  // ===== タスク定義 =====
  const SECTIONS_TEMPLATE = [
    { type: 'section', label: '▼ 日課',     sectionId: 'daily-section',        taskKey: 'section_daily',      cycleTaskId: null },
    { name: '日替わり討伐',          taskId: 'daily',    key: 'daily1' },
    { name: '常闇の聖戦',             taskId: 'daily',    key: 'daily2' },
    { name: '聖守護者の闘戦記',       taskId: 'daily',    key: 'daily3' },
    { name: '深淵の咎人(ﾗｸﾘﾏ)',     taskId: 'daily',    key: 'daily4' },
    { name: '深淵の咎人(果実)',       taskId: 'daily',    key: 'daily5' },
    { type: 'section', label: '▼ 週課',     sectionId: 'weekly-section',        taskKey: 'section_weekly',     cycleTaskId: 'weekly' },
    { name: '試練の門',               taskId: 'weekly',   key: 'weekly1' },
    { name: '週替わり討伐',           taskId: 'weekly',   key: 'weekly2' },
    { name: '王家の迷宮',             taskId: 'weekly',   key: 'weekly3' },
    { name: 'ピラミッド',             taskId: 'weekly',   key: 'weekly4' },
    { name: '達人クエスト',           taskId: 'weekly',   key: 'weekly5' },
    { name: '万魔の塔',               taskId: 'weekly',   key: 'weekly6' },
    { name: 'ヴァリーブートキャンプ', taskId: 'weekly',   key: 'weekly7' },
    { name: 'エピソード依頼帳',       taskId: 'weekly',   key: 'weekly8' },
    { name: 'トレーニー育成帳',       taskId: 'weekly',   key: 'weekly9' },
    { name: 'アスタルジア探索',       taskId: 'weekly',   key: 'weekly10' },
    { name: '皇帝の創りしもの',       taskId: 'weekly',   key: 'weekly11' },
    { name: 'まもの博士(ソロ)',       taskId: 'weekly',   key: 'weekly12' },
    { type: 'section', label: '▼ 隔週',     sectionId: 'biweekly-section',      taskKey: 'section_biweekly',   cycleTaskId: 'roster' },
    { name: 'ロスターのお題',         taskId: 'roster',   key: 'roster' },
    { name: 'レモンスライムクイズ',   taskId: 'lemon',    key: 'lemon' },
    { name: '黄昏の奏戦記',           taskId: 'tasogare', key: 'tasogare' },
    { type: 'section', label: '▼ 隔週2',    sectionId: 'jashin-section',        taskKey: 'section_jashin',     cycleTaskId: 'jashin' },
    { name: '邪神の宮殿',             taskId: 'jashin',   key: 'jashin' },
    { type: 'section', label: '▼ 月1回',    sectionId: 'monthly-section',       taskKey: 'section_monthly',    cycleTaskId: 'monthly' },
    { name: '異界の闘技場',           taskId: 'monthly',  key: 'monthly1' },
    { type: 'section', label: '▼ 周期',     sectionId: 'period-section',        taskKey: 'section_period',     cycleTaskId: 'pani' },
    { name: '現世庫パニガルム',       taskId: 'pani',     key: 'pani' },
    { type: 'section', label: '▼ 期間限定', sectionId: 'limited-section',       taskKey: 'section_limited',    cycleTaskId: 'konmeiku' },
    { name: '昏冥庫パニガルム',       taskId: 'konmeiku', key: 'konmeiku' },
    { type: 'section', label: '▼ 期間限定2', sectionId: 'limited2-section',     taskKey: 'section_limited2',   cycleTaskId: 'mamono_alliance' },
    { name: 'まもの博士(同盟)',       taskId: 'mamono_alliance', key: 'mamono_alliance' },
    { type: 'section', label: '▼ 受け取り', sectionId: 'receive-1-section',     taskKey: 'section_receive_1',  cycleTaskId: 'monthly' },
    { name: '宝珠ポイント(福引券)',   taskId: 'monthly',  key: 'monthly2' },
    { type: 'section', label: '▼ 受け取り', sectionId: 'receive-10-section',    taskKey: 'section_receive_10', cycleTaskId: 'sekkai' },
    { name: '覚醒の秘石',             taskId: 'sekkai',   key: 'sekkai' },
    { type: 'section', label: '▼ 受け取り', sectionId: 'receive-15-section',    taskKey: 'section_receive_15', cycleTaskId: 'hanabira' },
    { name: '黄金の花びら',           taskId: 'hanabira', key: 'hanabira' },
  ];

  // ===== 共通ユーティリティ =====

  /**
   * ミニトースト通知（alert/prompt の代替）
   * launcher.js の dqxShowToast() が利用可能な場合はそちらに委譲し、
   * checker.js 単体でも動作するよう自前 DOM で完結するフォールバックを持つ。
   *
   * @param {string}  message  表示するテキスト
   * @param {'info'|'success'|'error'} [variant='info']
   * @param {number}  [duration=4000]  ms。0 を渡すと自動非表示しない
   */
  function showToast(message, variant, duration) {
    variant  = variant  || 'info';
    duration = (duration === undefined) ? 4000 : duration;

    // launcher.js の共通トーストが使える環境ではそちらを優先
    if (typeof window.dqxShowToast === 'function') {
      window.dqxShowToast(message, { variant: variant === 'error' ? 'info' : variant, duration: duration });
      return;
    }

    // ── フォールバック: checker.js 専用トースト ──
    const TOAST_ID = 'checker-mini-toast';
    const prev = document.getElementById(TOAST_ID);
    if (prev) prev.remove();

    const BG = { info: '#223a70', success: '#0a6e4f', error: '#b91c1c' };
    const ICON = { info: 'ℹ️', success: '✅', error: '⚠️' };

    const toast = document.createElement('div');
    toast.id = TOAST_ID;
    // textContent でメッセージを設定するためアイコンだけ innerHTML で組み立てる
    const icon = document.createElement('span');
    icon.textContent = ICON[variant] || ICON.info;
    icon.style.cssText = 'flex-shrink:0;font-size:16px;';

    const body = document.createElement('span');
    body.textContent = message;
    body.style.cssText = 'flex:1;font-size:13px;line-height:1.5;word-break:break-word;';

    const close = document.createElement('button');
    close.textContent = '✕';
    close.setAttribute('aria-label', '閉じる');
    close.style.cssText = [
      'background:rgba(255,255,255,0.2);border:none;color:#fff;',
      'border-radius:50%;width:20px;height:20px;flex-shrink:0;',
      'cursor:pointer;font-size:12px;line-height:1;padding:0;'
    ].join('');
    close.onclick = hide;

    toast.style.cssText = [
      'position:fixed;left:50%;bottom:24px;',
      'transform:translateX(-50%) translateY(120%);',
      'max-width:92vw;width:360px;',
      `background:${BG[variant] || BG.info};`,
      'color:#fff;border-radius:14px;padding:12px 14px;',
      'box-shadow:0 8px 24px rgba(0,0,0,0.3);z-index:10500;',
      'display:flex;align-items:flex-start;gap:10px;',
      'transition:transform 0.3s ease;pointer-events:none;'
    ].join('');

    toast.appendChild(icon);
    toast.appendChild(body);
    toast.appendChild(close);
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(-50%) translateY(0)';
      toast.style.pointerEvents = 'auto';
    });

    function hide() {
      toast.style.transform = 'translateX(-50%) translateY(120%)';
      setTimeout(() => { if (toast.parentNode) toast.remove(); }, 320);
    }
    if (duration > 0) setTimeout(hide, duration);
  }

  /**
   * 呪文コピー失敗時のインラインフォールバック表示
   * クリップボード API が使えない環境でも手動コピーできるよう
   * 呪文テキストをトースト下部のテキストエリアに展開する。
   *
   * @param {string} spell  コピーできなかった呪文文字列
   */
  function showCopyFallback(spell) {
    const FALLBACK_ID = 'checker-copy-fallback';
    const prev = document.getElementById(FALLBACK_ID);
    if (prev) prev.remove();

    const wrapper = document.createElement('div');
    wrapper.id = FALLBACK_ID;
    wrapper.style.cssText = [
      'position:fixed;left:50%;bottom:100px;',
      'transform:translateX(-50%);',
      'max-width:92vw;width:400px;',
      'background:#1e293b;color:#fff;border-radius:14px;',
      'padding:14px;box-shadow:0 8px 24px rgba(0,0,0,0.4);',
      'z-index:10501;font-size:13px;'
    ].join('');

    const label = document.createElement('p');
    label.textContent = 'コピーに失敗しました。以下を手動でコピーしてください：';
    label.style.cssText = 'margin:0 0 8px;';

    const ta = document.createElement('textarea');
    ta.value = spell;
    ta.readOnly = true;
    ta.style.cssText = [
      'width:100%;height:80px;font-size:11px;',
      'background:#0f172a;color:#e5e7eb;border:1px solid #475569;',
      'border-radius:8px;padding:6px;resize:none;'
    ].join('');

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '閉じる';
    closeBtn.style.cssText = [
      'margin-top:8px;width:100%;padding:6px;',
      'background:#374151;color:#fff;border:none;',
      'border-radius:8px;cursor:pointer;font-size:13px;'
    ].join('');
    closeBtn.onclick = () => wrapper.remove();

    wrapper.appendChild(label);
    wrapper.appendChild(ta);
    wrapper.appendChild(closeBtn);
    document.body.appendChild(wrapper);

    // テキストエリアを自動選択して即コピーしやすく
    setTimeout(() => ta.select(), 50);
  }

  /**
   * 呪文インポート用インラインダイアログ
   * prompt() の代替。既存の container 内ではなく body 直下に固定オーバーレイとして表示。
   *
   * @param {function(string):void} onConfirm  入力確定時のコールバック
   */
  function showImportPrompt(onConfirm) {
    const DIALOG_ID = 'checker-import-dialog';
    const prev = document.getElementById(DIALOG_ID);
    if (prev) prev.remove();

    const overlay = document.createElement('div');
    overlay.id = DIALOG_ID;
    overlay.style.cssText = [
      'position:fixed;inset:0;background:rgba(0,0,0,0.55);',
      'z-index:10600;display:flex;align-items:center;justify-content:center;padding:16px;'
    ].join('');

    const box = document.createElement('div');
    box.style.cssText = [
      'background:#1e293b;color:#fff;border-radius:16px;',
      'padding:20px;width:100%;max-width:420px;',
      'box-shadow:0 16px 40px rgba(0,0,0,0.5);font-size:14px;'
    ].join('');

    const title = document.createElement('p');
    title.textContent = 'コードを貼り付けてください（W2|で始まる文字列）※既存の全データが上書きされます';
    title.style.cssText = 'margin:0 0 12px;font-weight:bold;line-height:1.5;';

    const ta = document.createElement('textarea');
    ta.placeholder = 'W2|...';
    ta.style.cssText = [
      'width:100%;height:100px;font-size:12px;',
      'background:#0f172a;color:#e5e7eb;border:1px solid #475569;',
      'border-radius:8px;padding:8px;resize:none;'
    ].join('');

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:10px;margin-top:12px;';

    const okBtn = document.createElement('button');
    okBtn.textContent = '読み込む';
    okBtn.style.cssText = [
      'flex:1;padding:8px;background:#0066cc;color:#fff;',
      'border:none;border-radius:10px;cursor:pointer;font-size:14px;font-weight:bold;'
    ].join('');
    okBtn.onclick = () => {
      const val = ta.value.trim();
      overlay.remove();
      if (val) onConfirm(val);
    };

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'キャンセル';
    cancelBtn.style.cssText = [
      'flex:1;padding:8px;background:#374151;color:#fff;',
      'border:none;border-radius:10px;cursor:pointer;font-size:14px;'
    ].join('');
    cancelBtn.onclick = () => overlay.remove();

    // オーバーレイ背景クリックでキャンセル
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    btnRow.appendChild(okBtn);
    btnRow.appendChild(cancelBtn);
    box.appendChild(title);
    box.appendChild(ta);
    box.appendChild(btnRow);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    setTimeout(() => ta.focus(), 50);
  }

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

  /**
   * "週" のキーを返す。
   * 固定タスクの週課リセット（getLastResetDate('weekly', ...) の 2026/4/12 6:00 起点・
   * 168時間周期）と同じ基準を使うことで、期間限定イベント側の週次判定とズレないようにする。
   * 暦週（1/1起点）ではなく、実際のゲーム内週次リセット時刻そのものをキーにする。
   */
  function getWeekKey(date) {
    const lastReset = getLastResetDate('weekly', date);
    return `w_${lastReset.getTime()}`;
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
    // 黄金の花びらのみ「毎月15日 18:00更新」という特殊時刻のため、
    // 他タスク共通の6:00基準の実効日(getEffectiveDate)を経由せず、実時刻でそのまま判定する。
    if (taskId === 'hanabira') {
      const now = getJSTNow();
      const y2 = now.getFullYear();
      const mo2 = now.getMonth();
      let boundary = new Date(y2, mo2, 15, 18, 0, 0);
      if (now < boundary) boundary = new Date(y2, mo2 - 1, 15, 18, 0, 0);
      return boundary;
    }

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
      case 'mamono_alliance':
        // 毎月20日6:00〜26日5:59開催。更新日=20日固定
        return day >= 20
          ? new Date(year, month, 20, 6, 0, 0)
          : new Date(year, month - 1, 20, 6, 0, 0);
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
      case 'hanabira':
        next.setMonth(next.getMonth() + 1);
        break;
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
  /**
   * 対象日が各セクションの更新日（リセット当日）かどうかを判定し、
   * 該当するセクションのラベル一覧を返す（todayInfo カードでの案内表示用）
   * @param {Date} targetDate
   * @returns {string[]} 更新日に該当するセクションラベル（"▼ " は除去済み）
   */
  function getTodayUpdateLabels(targetDate) {
    const effective = getEffectiveDate(targetDate);
    const seenTaskIds = new Set();
    const labels = [];

    for (const item of SECTIONS_TEMPLATE) {
      if (item.type !== 'section' || !item.cycleTaskId) continue;
      if (seenTaskIds.has(item.cycleTaskId)) continue;
      seenTaskIds.add(item.cycleTaskId);

      let isResetDay;
      if (item.cycleTaskId === 'konmeiku') {
        // 昏冥庫は1日・15日の開催開始日のみを更新日とする
        const day = effective.getDate();
        isResetDay = (day === 1 || day === 15);
      } else {
        const last = getLastResetDate(item.cycleTaskId, effective);
        isResetDay = isSameEffectiveDay(last, effective);
      }
      if (isResetDay) labels.push(item.label.replace(/^▼\s*/, ''));
    }
    return labels;
  }

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

    if (taskId === 'mamono_alliance') {
      const day = effectiveNow.getDate();
      // 20〜25日（開催中）を含め、次に20日を迎えるのは
      // 「20日より前」なら今月20日、それ以外（開催中含む）は来月20日
      const nextStart = day < 20
        ? new Date(effectiveNow.getFullYear(), effectiveNow.getMonth(), 20, 6, 0, 0)
        : new Date(effectiveNow.getFullYear(), effectiveNow.getMonth() + 1, 20, 6, 0, 0);
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
   * 1日と15日を交互にカウントして4周期を算出する。
   *
   * [リファクタリング注記]
   * 旧実装は KONMEIKU_BASE_DATE から対象日まで1日/15日を1件ずつ数え上げる
   * ループ処理だったため、基準日から離れるほど反復回数が増え続ける上、
   * 他の周期計算（週課・パニガルム等）が採用している「経過時間からの閉形式計算」
   * と方式が異なっていた。年をまたぐケース自体で値がズレることはなかったが、
   * 実装方式の不統一はレビュー・保守コストの温床になるため、他と同じ閉形式の
   * 計算式に統一する。
   */
  function getKonmeikuCycleIndex(targetDate) {
    const target = getEffectiveDate(targetDate);
    // 基準日(KONMEIKU_BASE_DATE = 2026/4/1)からの経過月数（年またぎも正しく計算される）
    const monthsDiff = (target.getFullYear() - KONMEIKU_BASE_DATE.getFullYear()) * 12
      + (target.getMonth() - KONMEIKU_BASE_DATE.getMonth());
    // 対象月内で1日枠(0)か15日枠(1)か
    const occurrenceInMonth = target.getDate() >= 15 ? 1 : 0;
    // 基準日(2026/4/1)自体を1件目として数えた開催回数
    const count = monthsDiff * 2 + occurrenceInMonth + 1;
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
    if (!name) { showToast('キャラ名を入力してください', 'error'); return; }
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

  // ===== ハイブリッド方式のエクスポート/インポート =====
  // 完全なlocalStorageダンプ(JSON)は文字数が肥大化しやすいため、
  //   ・件数が多く固定順序を持つ「タスクのチェック/ロック」「タスク/セクションの非表示」→ ビット圧縮
  //   ・件数が少なく可変（イベントID・カスタムイベント本体）→ 小さいJSONのまま
  // のハイブリッドにする。書き出し日時(exportedAt)を1つだけ保持し、
  // インポート時はその日時を「チェックした時点」として書き戻すことで、
  // 個別に日時を持たせなくても既存のリセット判定ロジック（needsReset等）が
  // 正しく機能する（インポート後、現在時刻との差でリセット済みかどうかは自動判定される）。
  // ※ リリース前のため後方互換は考慮せず、既存コードは完全上書きする。

  const EXPORT_MARKER = 'W2';

  // タスク＋セクションの非表示フラグをビット圧縮する際の固定順序
  const HIDDEN_KEY_ORDER = TASK_KEY_ORDER.concat(
    SECTIONS_TEMPLATE.filter(item => item.type === 'section' && item.taskKey).map(item => item.taskKey)
  );

  /** UTF-8文字列をURL-safeなBase64に変換（絵文字・日本語対応、チャンク分割でスタック溢れを回避） */
  function utf8ToBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary).replace(/\//g, '-').replace(/\+/g, '_').replace(/=/g, '');
  }

  /** URL-safeなBase64をUTF-8文字列に変換 */
  function base64ToUtf8(b64) {
    let padded = b64.replace(/-/g, '/').replace(/_/g, '+');
    while (padded.length % 4 !== 0) padded += '=';
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  /** ビット文字列（"0"/"1"の羅列）をURL-safe Base64に変換 */
  function bitsToBase64(bits) {
    const bytes = [];
    for (let i = 0; i < bits.length; i += 8) {
      bytes.push(parseInt(bits.slice(i, i + 8).padEnd(8, '0'), 2));
    }
    return btoa(String.fromCharCode(...bytes)).replace(/\//g, '-').replace(/\+/g, '_').replace(/=/g, '');
  }

  /** URL-safe Base64をビット文字列に変換する。失敗時はnull */
  function base64ToBits(b64, expectedBits) {
    let padded = b64.replace(/-/g, '/').replace(/_/g, '+');
    while (padded.length % 4 !== 0) padded += '=';
    try {
      const decoded = atob(padded);
      let bits = '';
      for (let i = 0; i < decoded.length; i++) bits += decoded.charCodeAt(i).toString(2).padStart(8, '0');
      return bits.slice(0, expectedBits);
    } catch (e) {
      return null;
    }
  }

  /**
   * 現在アクティブな全イベント（JSON配信＋カスタム＋Xの日自動生成）を1回のfetchで集めて返す。
   * @param {Date} targetDate
   * @returns {Promise<object[]>}
   */
  async function collectActiveEvents(targetDate) {
    let jsonEvents = [];
    try {
      const res = await fetch(EVENTS_URL, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (validateEventData(data)) jsonEvents = data.events;
      }
    } catch (e) { /* ネットワークエラーは無視 */ }

    return jsonEvents
      .concat(loadCustomEvents())
      .concat(getRecurringEvents(targetDate))
      .filter(e => isEventActive(e, targetDate));
  }

  // ===== 書き出し =====

  async function exportSpell() {
    if (characters.length === 0) {
      showToast('キャラクターが登録されていません', 'error');
      return;
    }

    const now           = getJSTNow();
    const effectiveDate = getEffectiveDate(now);
    const taskItems     = SECTIONS_TEMPLATE.filter(item => !item.type);

    // --- タスクのチェック/ロック（キャラごとにビット圧縮） ---
    const charRecords = characters.map(char => {
      const checkBits = TASK_KEY_ORDER.map(tKey => {
        const item = taskItems.find(t => t.key === tKey);
        return item && loadCheck(tKey, char.id, effectiveDate, item.taskId) ? '1' : '0';
      }).join('');
      const lockBits = TASK_KEY_ORDER.map(tKey => isDisabled(tKey, char.id) ? '1' : '0').join('');
      return [char.name, char.color.replace('#', ''), bitsToBase64(checkBits), bitsToBase64(lockBits)].join('~');
    });

    // --- タスク/セクションの非表示（全体で1本、ビット圧縮） ---
    const hiddenBits = HIDDEN_KEY_ORDER.map(k => isHidden(k) ? '1' : '0').join('');
    const hiddenB64  = bitsToBase64(hiddenBits);

    // --- イベント関連（件数が少ないので小さいJSONのまま） ---
    const activeEvents = await collectActiveEvents(now);
    const customEvents = loadCustomEvents();

    const eventChecks = {};
    for (const ev of activeEvents) {
      const checkedIdx = characters
        .map((char, idx) => (isLimChecked(ev, char.id, now) ? idx : -1))
        .filter(idx => idx >= 0);
      if (checkedIdx.length) eventChecks[ev.id] = checkedIdx;
    }
    const eventHidden = activeEvents.map(ev => `event_${ev.id}`).filter(k => isHidden(k));

    const variablePart = { customEvents, eventChecks, eventHidden };
    const variableB64  = utf8ToBase64(JSON.stringify(variablePart));

    const spell = [
      EXPORT_MARKER,
      now.toISOString(),
      hiddenB64,
      charRecords.join(';'),
      variableB64,
    ].join('|');

    navigator.clipboard.writeText(spell)
      .then(() => showToast(`✓ 全データを書き出しました！（キャラ${characters.length}人・${spell.length}文字／読込側は完全上書きされます）`, 'success'))
      .catch(() => showCopyFallback(spell));
  }

  // ===== 読み込み（既存データを完全上書き） =====

  async function importSpell(spell) {
    spell = (spell || '').trim();
    if (!spell) { showToast('コードを入力してください', 'error'); return; }

    const parts = spell.split('|');
    if (parts.length !== 5 || parts[0] !== EXPORT_MARKER) {
      showToast(`不明な形式のコードです（${EXPORT_MARKER}| で始まる5つのフィールドが必要です）`, 'error');
      return;
    }
    const [, exportedAtStr, hiddenB64, charsBlock, variableB64] = parts;

    const exportedAt = new Date(exportedAtStr);
    if (isNaN(exportedAt.getTime())) { showToast('書き出し日時の解析に失敗しました', 'error'); return; }
    const exportedEffective = getEffectiveDate(exportedAt);

    const hiddenBits = base64ToBits(hiddenB64, HIDDEN_KEY_ORDER.length);
    if (!hiddenBits) { showToast('非表示設定データの解析に失敗しました', 'error'); return; }

    let variablePart;
    try {
      variablePart = JSON.parse(base64ToUtf8(variableB64));
    } catch (e) {
      showToast('イベントデータの解析に失敗しました', 'error');
      return;
    }

    const taskItems = SECTIONS_TEMPLATE.filter(item => !item.type);
    const newChars  = [];
    const records   = charsBlock ? charsBlock.split(';') : [];
    for (const rec of records) {
      const fields = rec.split('~');
      if (fields.length < 4) continue;
      const [name, colorHex, checkB64, lockB64] = fields;
      const checkBits = base64ToBits(checkB64, TASK_KEY_ORDER.length);
      const lockBits  = base64ToBits(lockB64, TASK_KEY_ORDER.length);
      if (!checkBits || !lockBits) continue;
      newChars.push({ name, colorHex, checkBits, lockBits });
    }
    if (newChars.length === 0) { showToast('有効なキャラクターデータがありませんでした', 'error'); return; }

    // 対象イベント（JSON配信＋カスタム＋Xの日）を書き出し時点の日付基準で再取得
    const activeEvents = await collectActiveEvents(exportedAt);
    const eventById = new Map(activeEvents.map(ev => [ev.id, ev]));

    // ---- ここから完全上書き：進捗チェッカーが管理するキーのみを対象に消去 ----
    // 以前は 'dqx_' 接頭辞の全キーを一括消去しており、ランチャー側の
    // ダークモード・カード並び順・表示ツール設定等まで意図せず巻き込んでいた。
    // ここではチェッカー自身が STORAGE_KEYS で管理しているキー（完全一致／接頭辞）
    // のみを対象にする。
    const CHECKER_KEY_PREFIXES = [
      STORAGE_KEYS.CHECK_PREFIX,  // 'dqx_check_final10_' + taskKey + '_' + charId
      STORAGE_KEYS.LIM_CHECKS,    // 'dqx_limited_checks_v3' + '_' + eventId + '_' + charId + '_' + periodKey
    ];
    const CHECKER_EXACT_KEYS = [
      STORAGE_KEYS.CHARS,
      STORAGE_KEYS.DISABLED,
      STORAGE_KEYS.HIDDEN,
      STORAGE_KEYS.CUSTOM_EVENTS,
    ];
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (!k) continue;
      const matchPrefix = CHECKER_KEY_PREFIXES.some(p => k.startsWith(p));
      const matchExact  = CHECKER_EXACT_KEYS.includes(k);
      if (matchPrefix || matchExact) localStorage.removeItem(k);
    }
    characters  = [];
    nextCharId  = 1;
    disabledMap = new Map();
    hiddenMap   = new Map();

    // 非表示設定を復元
    HIDDEN_KEY_ORDER.forEach((key, idx) => {
      if (hiddenBits[idx] === '1') hiddenMap.set(key, true);
    });
    saveHidden();

    // キャラクター・チェック・ロックを復元
    for (const nc of newChars) {
      const newId = nextCharId++;
      characters.push({ id: newId, name: nc.name, color: '#' + nc.colorHex });
      TASK_KEY_ORDER.forEach((tKey, idx) => {
        const item = taskItems.find(t => t.key === tKey);
        if (item && nc.checkBits[idx] === '1') saveCheck(tKey, newId, true, exportedEffective);
        if (nc.lockBits[idx] === '1') setDisabled(tKey, newId, true);
      });
    }
    saveCharacters();

    // カスタムイベントを復元
    if (Array.isArray(variablePart.customEvents)) saveCustomEvents(variablePart.customEvents);

    // イベントのチェック状態を復元（書き出し時点の日付を基準にperiodKeyを計算）
    if (variablePart.eventChecks && typeof variablePart.eventChecks === 'object') {
      for (const [eventId, charIdxArr] of Object.entries(variablePart.eventChecks)) {
        const ev = eventById.get(eventId);
        if (!ev || !Array.isArray(charIdxArr)) continue;
        for (const idx of charIdxArr) {
          const ch = characters[idx];
          if (ch) setLimChecked(ev, ch.id, true, exportedAt);
        }
      }
    }

    // イベント行の非表示設定を復元
    if (Array.isArray(variablePart.eventHidden)) {
      for (const key of variablePart.eventHidden) hiddenMap.set(key, true);
      saveHidden();
    }

    showToast(`✓ 全データを上書き読み込みしました！（キャラ${characters.length}人）`, 'success');
    renderAll();
  }

  function showImportDialog() {
    showImportPrompt(function(spell) { importSpell(spell); });
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
    return `${STORAGE_KEYS.LIM_CHECKS}_${eventId}_${charId}_${periodKey}`;
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

  // ===== 固定周期の自動生成イベント（Xの日）=====
  // 毎月10日は「当日限定」の受け取り行動が複数あるが、常設のSECTIONS_TEMPLATEに
  // 入れると常時チェックが表示されてしまう。JSON配信イベント・手入力イベントと同じ
  // 「▼ イベント」枠に、対象日のみ自動でマージ表示することで解決する。
  // idに年月を含めることで、月をまたぐと自動的に新しいチェック状態（未チェック）になる。

  /** "YYYY-MM-DDTHH:mm:ss" 形式（オフセットなし）に変換。parseToJSTでJSTとして解釈される */
  function fmtLocalISO(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  /**
   * 対象日が10日の場合のみ、Xの日の当日限定受け取りイベント3件を生成して返す。
   * 期間は例外なく当日6:00〜翌5:59（RESET_HOURと同一基準）。
   * @param {Date} targetDate
   * @returns {object[]}
   */
  function getRecurringEvents(targetDate) {
    const effective = getEffectiveDate(targetDate);
    if (effective.getDate() !== 10) return [];

    const y = effective.getFullYear();
    const m = effective.getMonth();
    const start = new Date(y, m, 10, RESET_HOUR, 0, 0);
    const end   = new Date(y, m, 11, RESET_HOUR - 1, 59, 59);
    const ym = `${y}${String(m + 1).padStart(2, '0')}`;

    const defs = [
      { key: 'fukunokami', name: '福の神受け取り' },
      { key: 'card',       name: 'ボスカード受け取り' },
      { key: 'ticket',     name: 'プレチケ受け取り' },
    ];

    return defs.map(d => ({
      id: `xday_${d.key}_${ym}`,
      name: d.name,
      startDateTime: fmtLocalISO(start),
      endDateTime: fmtLocalISO(end),
      resetType: 'once',
    }));
  }

  // ===== 期間限定イベント（ローカル手入力）=====
  // 管理人が配信するイベントJSON（EVENTS_URL）の更新が滞っている間の代替手段として、
  // ユーザー自身が端末内に期間限定イベントを登録できるようにする。
  // 保存キーは admin JSON 側のイベント（getLimCheckKey は event.id ベース）と衝突しないよう
  // id に必ず "custom_" プレフィックスを付与し、名前空間を分離する。

  let customEventSeq = 1;

  /** ローカル保存されたカスタムイベント一覧を返す */
  function loadCustomEvents() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CUSTOM_EVENTS);
      const list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return [];
      const nums = list
        .map(e => parseInt(String(e.id).replace('custom_', ''), 10))
        .filter(n => !isNaN(n));
      customEventSeq = (nums.length ? Math.max(...nums) : 0) + 1;
      return list;
    } catch (e) {
      return [];
    }
  }

  /** カスタムイベント一覧を保存する */
  function saveCustomEvents(list) {
    localStorage.setItem(STORAGE_KEYS.CUSTOM_EVENTS, JSON.stringify(list));
  }

  /**
   * カスタムイベントを追加する
   * @param {{name:string, startDateTime:string, endDateTime:string, resetType:string}} input
   * @returns {boolean} 成功したか
   */
  function addCustomEvent(input) {
    const name = (input.name || '').trim();
    if (!name) { showToast('イベント名を入力してください', 'error'); return false; }

    const start = parseToJST(input.startDateTime);
    const end   = parseToJST(input.endDateTime);
    if (!start || !end) { showToast('開始・終了日時を正しく入力してください', 'error'); return false; }
    if (start >= end)   { showToast('終了日時は開始日時より後にしてください', 'error'); return false; }

    const resetType = ['once', 'daily', 'weekly'].includes(input.resetType) ? input.resetType : 'once';

    const list = loadCustomEvents();
    list.push({
      id: `custom_${customEventSeq++}`,
      name,
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
      resetType,
    });
    saveCustomEvents(list);
    return true;
  }

  /** カスタムイベントを削除する（保存されているチェック状態も併せて破棄） */
  function deleteCustomEvent(eventId) {
    const list = loadCustomEvents().filter(e => e.id !== eventId);
    saveCustomEvents(list);
    // 当該イベントに紐づくチェック状態を掃除
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`${STORAGE_KEYS.LIM_CHECKS}_${eventId}_`)) localStorage.removeItem(k);
    }
  }

  const RESET_TYPE_LABEL = { once: '期間中1回', daily: '毎日', weekly: '毎週' };

  /** イベント管理画面（追加フォーム + 登録済み一覧）を表示する */
  function showCustomEventManager() {
    const DIALOG_ID = 'checker-event-manager-dialog';
    const prev = document.getElementById(DIALOG_ID);
    if (prev) prev.remove();

    const overlay = document.createElement('div');
    overlay.id = DIALOG_ID;
    overlay.style.cssText = [
      'position:fixed;inset:0;background:rgba(0,0,0,0.55);',
      'z-index:10600;display:flex;align-items:center;justify-content:center;padding:16px;'
    ].join('');
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

    const box = document.createElement('div');
    box.style.cssText = [
      'background:#1e293b;color:#fff;border-radius:16px;',
      'padding:20px;width:100%;max-width:420px;max-height:85vh;overflow-y:auto;',
      'box-shadow:0 16px 40px rgba(0,0,0,0.5);font-size:14px;'
    ].join('');

    const title = document.createElement('p');
    title.textContent = '🗓 期間限定イベント管理（手入力・端末内保存）';
    title.style.cssText = 'margin:0 0 4px;font-weight:bold;line-height:1.5;';
    box.appendChild(title);

    const desc = document.createElement('p');
    desc.textContent = '配信イベントデータとは別に、この端末だけで有効なイベントを追加できます。';
    desc.style.cssText = 'margin:0 0 12px;font-size:12px;opacity:0.75;line-height:1.4;';
    box.appendChild(desc);

    const inputStyle = [
      'width:100%;padding:8px;font-size:13px;box-sizing:border-box;',
      'background:#0f172a;color:#e5e7eb;border:1px solid #475569;',
      'border-radius:8px;'
    ].join('');

    // ----- 追加フォーム -----
    const form = document.createElement('div');
    form.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid #334155;';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'イベント名';
    nameInput.style.cssText = inputStyle;

    const startLabel = document.createElement('label');
    startLabel.style.cssText = 'font-size:11px;opacity:0.75;';
    startLabel.textContent = '開始日時';
    const startInput = document.createElement('input');
    startInput.type = 'datetime-local';
    startInput.style.cssText = inputStyle;

    const endLabel = document.createElement('label');
    endLabel.style.cssText = 'font-size:11px;opacity:0.75;';
    endLabel.textContent = '終了日時';
    const endInput = document.createElement('input');
    endInput.type = 'datetime-local';
    endInput.style.cssText = inputStyle;

    const resetSelect = document.createElement('select');
    resetSelect.style.cssText = inputStyle;
    for (const [value, label] of Object.entries(RESET_TYPE_LABEL)) {
      const opt = document.createElement('option');
      opt.value = value;
      opt.innerText = `チェック周期：${label}`;
      resetSelect.appendChild(opt);
    }

    const addBtn = document.createElement('button');
    addBtn.textContent = '＋ このイベントを追加';
    addBtn.style.cssText = [
      'padding:8px;background:#0066cc;color:#fff;',
      'border:none;border-radius:10px;cursor:pointer;font-size:13px;font-weight:bold;'
    ].join('');

    form.appendChild(nameInput);
    form.appendChild(startLabel);
    form.appendChild(startInput);
    form.appendChild(endLabel);
    form.appendChild(endInput);
    form.appendChild(resetSelect);
    form.appendChild(addBtn);
    box.appendChild(form);

    // ----- 登録済み一覧 -----
    const listTitle = document.createElement('p');
    listTitle.textContent = '登録済みイベント';
    listTitle.style.cssText = 'margin:0 0 8px;font-size:12px;font-weight:bold;opacity:0.85;';
    box.appendChild(listTitle);

    const listWrap = document.createElement('div');
    listWrap.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-bottom:14px;';
    box.appendChild(listWrap);

    function renderList() {
      listWrap.innerHTML = '';
      const list = loadCustomEvents();
      if (!list.length) {
        const empty = document.createElement('div');
        empty.style.cssText = 'font-size:12px;opacity:0.6;text-align:center;padding:10px;';
        empty.textContent = '登録済みのイベントはありません';
        listWrap.appendChild(empty);
        return;
      }
      for (const ev of list) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px;background:#0f172a;border-radius:10px;';

        const info = document.createElement('div');
        info.style.cssText = 'flex:1;font-size:12px;line-height:1.5;';

        const nameLine = document.createElement('div');
        nameLine.style.fontWeight = 'bold';
        nameLine.textContent = ev.name;
        info.appendChild(nameLine);

        const periodLine = document.createElement('div');
        periodLine.style.cssText = 'opacity:0.7;font-size:11px;';
        periodLine.textContent = `${getEventPeriodStr(ev)}（${RESET_TYPE_LABEL[ev.resetType] || ev.resetType}）`;
        info.appendChild(periodLine);

        const delBtn = document.createElement('button');
        delBtn.textContent = '削除';
        delBtn.style.cssText = 'background:#7f1d1d;color:#fecaca;border:none;padding:6px 12px;border-radius:16px;font-size:11px;cursor:pointer;';
        delBtn.addEventListener('click', () => {
          deleteCustomEvent(ev.id);
          renderList();
          renderAll();
        });

        row.appendChild(info);
        row.appendChild(delBtn);
        listWrap.appendChild(row);
      }
    }
    renderList();

    addBtn.addEventListener('click', () => {
      const ok = addCustomEvent({
        name: nameInput.value,
        startDateTime: startInput.value,
        endDateTime: endInput.value,
        resetType: resetSelect.value,
      });
      if (ok) {
        nameInput.value = '';
        startInput.value = '';
        endInput.value = '';
        renderList();
        renderAll();
        showToast('✓ イベントを追加しました', 'success');
      }
    });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '閉じる';
    closeBtn.style.cssText = [
      'width:100%;padding:8px;background:#374151;color:#fff;',
      'border:none;border-radius:10px;cursor:pointer;font-size:13px;'
    ].join('');
    closeBtn.onclick = () => overlay.remove();
    box.appendChild(closeBtn);

    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }



  async function renderDetailTable(targetDate) {
    const container = document.getElementById('detailTableContainer');
    if (!container) return;

    const today = targetDate;
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

    const allEvents = await loadCheckerEvents(targetDate);
    const events = allEvents.filter(e => isEventActive(e, today));

    if (events.length) {
      html += `<tr class="detail-section-row"><td colspan="2" style="${secStyle}">▼ イベント</td></tr>`;
      for (const event of events) {
        html += `<tr><td style="${rowStyle}">${escapeHtml(event.name)}</td>`
          + `<td style="${rowStyle}">${escapeHtml(getEventPeriodStr(event))}</td></tr>`;
      }
    }

    const customEvents = loadCustomEvents().filter(e => isEventActive(e, today));
    if (customEvents.length) {
      html += `<tr class="detail-section-row"><td colspan="2" style="${secStyle}">▼ 期間限定イベント（手入力）</td></tr>`;
      for (const event of customEvents) {
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
    const allEvents = await loadCheckerEvents(targetDate);
    const events = allEvents.filter(e => isEventActive(e, targetDate));

    const customEvents = loadCustomEvents().filter(e => isEventActive(e, targetDate));
    const recurringEvents = getRecurringEvents(targetDate).filter(e => isEventActive(e, targetDate));

    const dailyEvents = events.filter(e => e.resetType === 'daily');
    const otherEvents = events.filter(e => e.resetType !== 'daily').concat(recurringEvents);

    if (dailyEvents.length) buildEventSectionRows(dailyEvents, '▼ イベント（毎日）',       leftTbody, rightTbody, targetDate);
    if (otherEvents.length) buildEventSectionRows(otherEvents, '▼ イベント（期間中1回）', leftTbody, rightTbody, targetDate);
    if (customEvents.length) buildEventSectionRows(customEvents, '▼ 期間限定イベント（手入力）', leftTbody, rightTbody, targetDate);

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
      const updateLabels = getTodayUpdateLabels(targetDate);
      if (updateLabels.length) {
        const updateDiv = document.createElement('div');
        updateDiv.className = 'today-update-banner';
        updateDiv.innerText = `🎉 今日は${updateLabels.join('・')}の更新日です！`;
        todayInfo.appendChild(updateDiv);
      }
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
          // 昏冥庫パニガルム／まもの博士(同盟)が開催期間外の場合はチェック不可
          let isPeriodClosed = false;
          if (item.taskId === 'konmeiku') {
            const day = getEffectiveDate(targetDate).getDate();
            isPeriodClosed = !((day >= 1 && day <= 5) || (day >= 15 && day <= 20));
          } else if (item.taskId === 'mamono_alliance') {
            // 毎月20日6:00〜26日5:59（実効日基準で20〜25日）のみ開催、ボス等の移行はなし
            const day = getEffectiveDate(targetDate).getDate();
            isPeriodClosed = !(day >= 20 && day <= 25);
          }
          if (isPeriodClosed) {
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

    renderEventRows(leftTbody, rightTbody, targetDate)
      .then(() => renderDetailTable(targetDate))
      .finally(() => requestAnimationFrame(syncRowHeights));
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
.event-manage-btn { background: #0ea5e9 !important; color: white !important; }

/* 今日情報カード */
.today-card { background: #fefce8; border-left: 3px solid #f5a623; margin: 6px 12px; padding: 4px 10px; border-radius: 10px; display: flex; justify-content: space-between; font-size: 0.65rem; flex-wrap: wrap; }
.today-update-banner { width: 100%; margin-top: 4px; font-weight: 700; color: #b45309; }

/* 分割テーブルレイアウト */
#tableWrapper { display: flex; align-items: flex-start; width: 100%; overflow: hidden; }
#leftPanel    { flex-shrink: 0; overflow: hidden; border-right: 2px solid #94a8c2; background: inherit; position: relative; z-index: 5; }
#rightPanel   { flex: 1; overflow-x: auto; overflow-y: hidden; overscroll-behavior-x: contain; }
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
    <button id="importBtn"    class="import-btn">📥 読み込み(上書き)</button>
    <button id="eventManageBtn" class="event-manage-btn">🗓 イベント管理</button>
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
      document.getElementById('eventManageBtn').addEventListener('click', showCustomEventManager);

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
