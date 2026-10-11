// ========== DQXTools ランチャー ==========
const APP_VERSION = '1.1.8s';
window.LAUNCHER_VERSION = APP_VERSION;

// ランチャー読み込み完了を通知（index.html 側が受信してバージョン確認を行う）
window.dispatchEvent(new Event('launcher-ready'));

// ========== JST 日付キー（6時リセット） ==========
function dqxGetJSTDateKey() {
    const now = new Date();
    const jst = new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60000);
    if (jst.getHours() < 6) jst.setDate(jst.getDate() - 1);
    return `${jst.getFullYear()}-${jst.getMonth() + 1}-${jst.getDate()}`;
}

// このタブ・セッションを開いた（または最後にチェックした）時点のJST日付キー。
// PWAをスタンドアロンで開きっぱなしにしたまま6時を跨いだ場合、
// 起動時1回きりのチェックだけでは日課リセットや各種スナップショットが
// 更新されないままになる。ツール遷移のたびに軽量に再評価し、
// 日付が変わっていたらキャッシュクリア込みで強制的に再読み込みする。
const STORAGE_KEYS = Object.freeze({
    APP_VERSION: 'dqx_app_version',
    SIDEBAR_VISIBLE: 'dqx_sidebar_visible',
    DARK_MODE: 'darkMode',
    CARD_ORDER: 'dqx_card_order',
    VISIBLE_TOOLS: 'dqx_visible_tools',
    TEST_TOKEN: 'dqx_test_token',
    SESSION_DATE_KEY: 'dqx_session_date_key',
    RELOAD_COUNT: 'dqx_reload_count',
    MANIFEST_VERSION: 'dqx_manifest_version',
    KNOWN_TOOL_IDS: 'dqx_known_tool_ids',
    DEV_MODE: 'dqx_dev_mode',
    BG_TOOL_SNAPS: 'dqx_bg_tool_snaps',
    BG_CHECKER_SNAP: 'dqx_bg_checker_snap',
    BG_CHECKER_ACTIVE_IDS: 'dqx_bg_checker_active_ids',
    BG_FIXED_RESET_NOTIFIED_DATE: 'dqx_bg_fixed_reset_notified_date',
    BG_CHECK_DATE: 'dqx_bg_check_date',
    BG_BADGES: 'dqx_bg_badges',
    EXP_SESSION: 'dqx_expm_session',
    EXP_ACTIVE: 'dqx_expm_active',
    LAP_NOTIFY: 'dqx_lap_notify'
});
const SESSION_DATE_KEY = STORAGE_KEYS.SESSION_DATE_KEY;
(function initSessionDateKey() {
    if (!sessionStorage.getItem(SESSION_DATE_KEY)) {
        sessionStorage.setItem(SESSION_DATE_KEY, dqxGetJSTDateKey());
    }
})();

function dqxCheckDateRollover() {
    const nowKey  = dqxGetJSTDateKey();
    const seenKey = sessionStorage.getItem(SESSION_DATE_KEY);
    if (seenKey && seenKey !== nowKey) {
        window.dqxShowToast?.(
            '日付が変わりました（6時リセット）。最新の状態にするため再読み込みします。',
            { duration: 2500 }
        );
        sessionStorage.setItem(SESSION_DATE_KEY, nowKey);
        setTimeout(() => {
            if (typeof window.clearDqxCachesAndReload === 'function') {
                window.clearDqxCachesAndReload();
            } else {
                location.reload();
            }
        }, 2600);
        return true;
    }
    sessionStorage.setItem(SESSION_DATE_KEY, nowKey);
    return false;
}

// ========== HTMLエスケープ ==========
// tools-manifest.json / release-notes.json 由来の文字列を innerHTML に差し込む箇所で使用。
// 現状は自リポジトリ管理の同一オリジンJSONのみが対象だが、
// checker.js 側（innerText徹底）と防御水準を揃えるため一貫してエスケープする。
function dqxEscapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}
// tool.name / tool.desc は改行目的で意図的に <br> を含む値がある
// （例: "傭兵ログトラッカー<br>旧ver"）。単純に dqxEscapeHtml すると
// <br> まで文字列として表示されてしまうため、<br> だけは残しつつ
// それ以外はエスケープする。
function dqxEscapeHtmlKeepBr(str) {
    return String(str ?? '')
        .split(/<br\s*\/?>/i)
        .map(dqxEscapeHtml)
        .join('<br>');
}

function dqxAppendEscapedTextWithBr(container, value) {
    const parts = String(value ?? '').split(/<br\s*\/?\>/i);
    parts.forEach((part, index) => {
        if (index > 0) {
            container.appendChild(document.createElement('br'));
        }
        container.appendChild(document.createTextNode(part));
    });
}

// ========== ローディング画像（起動時スプラッシュ／ツール切り替え時 共通） ==========
const DQX_LOADING_IMAGES = [
    './images/dqx_loading.jpg',
    './images/dqx_loading2.jpg',
    './images/dqx_loading3.jpg',
    './images/dqx_loading4.jpg',
    './images/dqx_loading5.jpg',
];
function dqxRandomLoadingImage() {
    return DQX_LOADING_IMAGES[Math.floor(Math.random() * DQX_LOADING_IMAGES.length)];
}

// ========== バックグラウンドコンテンツチェック ==========
// SW キャッシュ経由でツール JS を取得し前回スナップショットと差分比較。
// オンライン・オフライン問わず動作（SW がキャッシュを持っている限り fetch 成功）。
window.DQX_CARD_BADGES = {};
window.DQX_BG_CHECK_PROMISE = (function() {

    const TOOL_FILES = [
        { id: 'Checker',  url: './tools/checker.js'          },
        { id: 'exp-m',    url: './tools/expmercenary.js'     },
        { id: 'versions', url: './tools/version_selector.js' },
        { id: 'help',     url: './tools/help.js'             },
        { id: 'settings', url: './tools/settings.js'         },
        { id: 'install',  url: './tools/install.js'          },
    ];

    const CHECKER_EVENTS_URL = 'https://raw.githubusercontent.com/yuffy-1111/dqx-event-data/main/checker.json';
    const KEY_TOOL_SNAP    = 'dqx_bg_tool_snaps';
    const KEY_CHECKER_SNAP = 'dqx_bg_checker_snap';
    const KEY_CHECKER_ACTIVE_IDS = 'dqx_bg_checker_active_ids';
    const KEY_FIXED_RESET_NOTIFIED_DATE = 'dqx_bg_fixed_reset_notified_date';

    // ========== 固定周期タスクのリセット境界チェック ==========
    // checker.js 内の getLastResetDate と同じロジックをここに複製する。
    // checker.js はチェッカーツールを開いたときにしか読み込まれないため、
    // 起動時のバックグラウンドバッジチェックからは直接呼び出せない。
    // 週課・パニガルム・ロスター・たそがれ・レモン・邪神・月課・石灰の
    // いずれかが「今日」リセット境界を迎えている場合、日課以外の更新として
    // オレンジバッジ対象にする（checker.json 側のイベント変化とは別枠）。
    const RESET_HOUR = 6;
    const FIXED_NONDAILY_TASKS = ['weekly', 'pani', 'roster', 'tasogare', 'lemon', 'jashin', 'monthly', 'sekkai'];

    function dqxGetEffectiveDate(date) {
        const d = new Date(date);
        if (d.getHours() < RESET_HOUR) d.setDate(d.getDate() - 1);
        d.setHours(RESET_HOUR, 0, 0, 0);
        return d;
    }

    function dqxGetLastFixedResetDate(taskId, targetDate) {
        const target = dqxGetEffectiveDate(targetDate);
        const year   = target.getFullYear();
        const month  = target.getMonth();
        const day    = target.getDate();

        switch (taskId) {
            case 'weekly': {
                const base  = new Date(2026, 3, 12, 6, 0, 0);
                const hours = (target - base) / (1000 * 60 * 60);
                return new Date(base.getTime() + Math.floor(hours / 168) * 168 * 60 * 60 * 1000);
            }
            case 'pani': {
                const base  = new Date(2026, 3, 12, 6, 0, 0);
                const hours = (target - base) / (1000 * 60 * 60);
                return new Date(base.getTime() + Math.floor(hours / 72) * 72 * 60 * 60 * 1000);
            }
            case 'roster':
            case 'tasogare':
            case 'lemon':
                return day >= 15
                    ? new Date(year, month, 15, 6, 0, 0)
                    : new Date(year, month, 1, 6, 0, 0);
            case 'jashin': {
                if (day >= 25) return new Date(year, month, 25, 6, 0, 0);
                if (day >= 10) return new Date(year, month, 10, 6, 0, 0);
                const prevMonthEnd = new Date(year, month, 0);
                return new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 25, 6, 0, 0);
            }
            case 'monthly':
                return new Date(year, month, 1, 6, 0, 0);
            case 'sekkai': {
                if (day >= 10) return new Date(year, month, 10, 6, 0, 0);
                const prevMonthEnd = new Date(year, month, 0);
                return new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), 10, 6, 0, 0);
            }
            default:
                return target;
        }
    }

    /** 固定周期タスクのいずれかが「今日」リセット境界を迎えているか */
    function dqxHasFixedTaskResetToday(now) {
        const todayEffective = dqxGetEffectiveDate(now).getTime();
        return FIXED_NONDAILY_TASKS.some(
            (id) => dqxGetLastFixedResetDate(id, now).getTime() === todayEffective
        );
    }
    const KEY_CHECK_DATE   = 'dqx_bg_check_date';
    const KEY_BADGES       = 'dqx_bg_badges';

    function quickHash(text) {
        const tail = text.slice(-256);
        return text.length + ':' + tail;
    }

    function loadToolSnaps() {
        try { return JSON.parse(localStorage.getItem(KEY_TOOL_SNAP) || '{}'); }
        catch(e) { return {}; }
    }
    function saveToolSnaps(snaps) {
        try { localStorage.setItem(KEY_TOOL_SNAP, JSON.stringify(snaps)); } catch(e) {}
    }

    async function runChecks() {
        if (window.DQXTools && window.DQXTools.currentTool !== null) {
            return window.DQX_CARD_BADGES;
        }
        // 以前は「1日1回」に制限していたが、起動時スプラッシュを毎回表示する
        // 仕様に合わせ、こちらも毎回の起動時にチェックするよう変更。
        // （同日中に内容が更新された場合でもバッジに反映されるようにするため）
        const today = dqxGetJSTDateKey();

        const prevSnaps  = loadToolSnaps();
        const newSnaps   = {};
        const badges     = {};
        const isFirstRun = Object.keys(prevSnaps).length === 0;

        await Promise.all(TOOL_FILES.map(async ({ id, url }) => {
            try {
                const res = await fetch(url, { cache: 'default' });
                if (!res.ok) return;
                const text = await res.text();
                const hash = quickHash(text);
                newSnaps[id] = hash;
                if (!isFirstRun && prevSnaps[id] && prevSnaps[id] !== hash) {
                    if (id !== 'install') badges[id] = 'yellow';
                }
            } catch(e) {}
        }));

        // ③ 固定周期タスク（週課・パニガルム・ロスター・たそがれ・レモン・邪神・
        // 月課・石灰）のいずれかが「今日」リセット境界を迎えているか。
        // これは checker.json のフェッチとは無関係にローカルな日付計算のみで
        // 判定できるため、オフラインでも機能する。「6時基準で毎日初回に」
        // 判定し、同じ日に既に通知済みなら再度は立てない。
        const now      = new Date();
        const todayKey = dqxGetJSTDateKey();
        const fixedResetToday    = dqxHasFixedTaskResetToday(now);
        const prevFixedNotifyKey = localStorage.getItem(KEY_FIXED_RESET_NOTIFIED_DATE);
        const fixedResetIsNew    = fixedResetToday && prevFixedNotifyKey !== todayKey;
        if (fixedResetToday) {
            try { localStorage.setItem(KEY_FIXED_RESET_NOTIFIED_DATE, todayKey); } catch(e) {}
        }

        try {
            const res = await fetch(CHECKER_EVENTS_URL, { cache: 'no-store' });
            if (res.ok) {
                const data     = await res.json();
                const snapshot = JSON.stringify(data);
                const prevSnap = localStorage.getItem(KEY_CHECKER_SNAP);

                // ① checker.json のファイル内容そのものの変更（管理者が追加・編集した場合）
                let contentChanged = false;
                if (!isFirstRun && prevSnap && prevSnap !== snapshot) {
                    try {
                        const prev = JSON.parse(prevSnap);
                        const sig = (evts) => (evts || [])
                            .filter(e => e.resetType !== 'daily')
                            .map(e => e.id + '|' + e.endDateTime)
                            .sort().join(',');
                        contentChanged = sig(prev.events) !== sig(data.events);
                    } catch(e) { contentChanged = true; }
                }

                // ② 「今アクティブな日課以外イベント」の集合が前回チェック時から
                // 変化したか。checker.json 自体が変わらなくても、
                // startDateTime/endDateTime を迎えて日々アクティブなイベントの
                // 顔ぶれは変わるため、①だけでは「当日になっても通知が出ない」
                // イベントが発生していた。こちらも別途検知する。
                const activeIds = (data.events || [])
                    .filter(e => e.resetType !== 'daily')
                    .filter(e => {
                        const start = new Date(e.startDateTime || e.startDate);
                        const end   = new Date(e.endDateTime   || e.endDate);
                        return !isNaN(start) && !isNaN(end) && now >= start && now <= end;
                    })
                    .map(e => e.id)
                    .sort()
                    .join(',');
                const prevActiveIds    = localStorage.getItem(KEY_CHECKER_ACTIVE_IDS);
                const activeSetChanged = (prevActiveIds !== null) && (prevActiveIds !== activeIds);

                if (!isFirstRun && (contentChanged || activeSetChanged || fixedResetIsNew)) {
                    // ファイル更新検知(yellow)はイベント情報更新(checker-nondaily/green)より優先する
                    if (badges['Checker'] !== 'yellow') badges['Checker'] = 'checker-nondaily';
                }

                try {
                    localStorage.setItem(KEY_CHECKER_SNAP, snapshot);
                    localStorage.setItem(KEY_CHECKER_ACTIVE_IDS, activeIds);
                } catch(e) {}
            } else if (!isFirstRun && fixedResetIsNew) {
                // checker.json 取得に失敗しても、固定周期タスクのリセットは
                // ローカル計算のみで判定できるためバッジは立てる
                // （ファイル更新検知(yellow)はここでも優先する）
                if (badges['Checker'] !== 'yellow') badges['Checker'] = 'checker-nondaily';
            }
        } catch(e) {
            if (!isFirstRun && fixedResetIsNew) {
                if (badges['Checker'] !== 'yellow') badges['Checker'] = 'checker-nondaily';
            }
        }

        // 前回チェック時点で立っていたバッジのうち、まだ開かれていない（クリアされていない）
        // ものは維持する。今回の差分で新たに検出したバッジと合成する。
        try {
            const prevBadges = JSON.parse(localStorage.getItem(KEY_BADGES) || '{}');
            Object.assign(window.DQX_CARD_BADGES, prevBadges);
        } catch(e) {}
        Object.assign(window.DQX_CARD_BADGES, badges);

        saveToolSnaps(newSnaps);
        try { localStorage.setItem(KEY_CHECK_DATE, today); } catch(e) {}
        try { localStorage.setItem(KEY_BADGES, JSON.stringify(window.DQX_CARD_BADGES)); } catch(e) {}
        return window.DQX_CARD_BADGES;
    }

    // PWAをバックグラウンドから復帰した際などに、フルリロードなしで
    // 再実行できるよう公開する（index.html の visibilitychange ハンドラから使用）
    window.dqxRunBackgroundChecks = runChecks;

    return runChecks();
})();

// ========== ローディング画面（起動時スプラッシュ） ==========
// 毎回のアプリ起動時（通常起動・バージョン不一致や6時跨ぎによる強制リロード後の
// 再起動を含む）に必ず表示する。画像はプリキャッシュ済みなので待ち時間は発生しない。
(function() {
    const img = dqxRandomLoadingImage();

    const overlay = document.createElement('div');
    overlay.id    = 'dqx-loading-overlay';
    overlay.style.cssText = [
        'position:fixed;inset:0;z-index:99999;',
        'display:flex;flex-direction:column;align-items:center;justify-content:center;',
        'background:#000;transition:opacity 0.6s ease;',
    ].join('');

    const imgEl = document.createElement('img');
    imgEl.src   = img;
    imgEl.style.cssText = 'max-width:100%;max-height:80vh;object-fit:contain;border-radius:8px;';
    imgEl.alt   = '';

    const label = document.createElement('div');
    label.textContent   = 'Now Loading\u2026';
    label.style.cssText = 'color:#aaa;font-size:13px;margin-top:16px;letter-spacing:.1em;';

    overlay.appendChild(imgEl);
    overlay.appendChild(label);

    if (document.body) {
        document.body.appendChild(overlay);
    } else {
        document.addEventListener('DOMContentLoaded', () => document.body.appendChild(overlay));
    }

    function closeOverlay() {
        if (!overlay.parentNode) return;
        overlay.style.opacity = '0';
        setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 650);
    }

    // バックグラウンドチェック完了 OR 最低2秒のどちらか遅い方で閉じる
    const minWait = new Promise(r => setTimeout(r, 2000));
    Promise.all([window.DQX_BG_CHECK_PROMISE.catch(() => {}), minWait])
        .then(closeOverlay);

    window.dqxCloseLoadingOverlay = closeOverlay;
})();


// ========== リリースノート ==========
// release-notes.json から非同期で読み込む
window.DQX_RELEASE_NOTES = [];
window.DQX_RELEASE_NOTES_PROMISE = fetch('./release-notes.json?v=' + Date.now(), { cache: 'no-store' })
    .then((r) => r.ok ? r.json() : null)
    .then((data) => {
        if (data && Array.isArray(data.releases)) {
            window.DQX_RELEASE_NOTES = data.releases;
        }
        return window.DQX_RELEASE_NOTES;
    })
    .catch(() => window.DQX_RELEASE_NOTES);

// ========== renderFn ホワイトリスト ==========
// tool.renderFn に指定できるグローバルアクセスパターンを制限する。
// manifest が改ざんされても window.eval 等の危険なプロパティを呼べないようにする。
const ALLOWED_RENDER_PREFIXES = [
    'Checker.', 'Expmercenary.', 'VersionSelector.',
    'Help.', 'Settings.', 'Install.', 'Kaji.'
];
function isAllowedRenderFn(renderFn) {
    return ALLOWED_RENDER_PREFIXES.some((prefix) => renderFn.startsWith(prefix));
}

function checkVersionUpdate() {
    const storedVersion = localStorage.getItem(STORAGE_KEYS.APP_VERSION);
    if (storedVersion && storedVersion !== APP_VERSION) {
        setTimeout(() => {
            if (typeof window.dqxShowToast === 'function') {
                window.dqxShowToast(
                    `アップデートされました！ ${storedVersion} → ${APP_VERSION}`,
                    { variant: 'success', duration: 6000 }
                );
            }
        }, 500);
    }
    localStorage.setItem(STORAGE_KEYS.APP_VERSION, APP_VERSION);
}

const DQXTools = {
    tools: {},
    currentTool: null,
    container: null,
    darkMode: false,
    boundResizeHandler: null,
    sortableInstance: null,
    sidebarVisible: true,

    register: function(toolId, toolConfig) {
        this.tools[toolId] = toolConfig;
    },

    isMobile: function() {
        return window.innerWidth <= 768;
    },

    init: function(containerId) {
        checkVersionUpdate();
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('コンテナが見つかりません:', containerId);
            return;
        }

        const saved = localStorage.getItem(STORAGE_KEYS.SIDEBAR_VISIBLE);
        this.sidebarVisible = saved !== null ? saved !== 'false' : true;
        document.body.classList.toggle('sidebar-hidden', !this.sidebarVisible);

        this.cleanupStorage();

        this.darkMode = localStorage.getItem(STORAGE_KEYS.DARK_MODE) === 'dark';
        this.applyDarkMode();
        this.showLauncher();

        this.boundResizeHandler = () => {
            if (this.currentTool === null) {
                this.showLauncher();
            } else {
                this.renderToolMenu();
            }
        };
        window.addEventListener('resize', this.boundResizeHandler);
    },

    cleanupStorage: function() {
        const allowedLocal = [
            'dqx_app_version',
            'dqx_card_order',
            'dqx_visible_tools',
            'dqx_dev_mode',
            'darkMode',
            'dqx_craft_last',
            'dqx_chars_final10',
            'dqx_disabled_final10',
            'dqx_hidden_tasks_v1',
            'dqx_limited_checks_v3',
            'dqx_lap_notify',
            'dqx_shopping_cart',
            'dqx_material_prices',
            'dqx_sidebar_visible',
            'dqx_known_tool_ids',
            'dqx_manifest_version',
            // バックグラウンドチェック関連
            'dqx_bg_tool_snaps',
            'dqx_bg_checker_snap',
            'dqx_bg_checker_active_ids',
            'dqx_bg_fixed_reset_notified_date',
            'dqx_bg_check_date',
            'dqx_bg_badges',
            // 傭兵ログトラッカー：クラッシュ復旧用セッション保存
            'dqx_expm_session',
            'dqx_expm_active',
        ];
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (!key) continue;
            const allowed = allowedLocal.includes(key)
                || key.startsWith('dqx_check_final10_')
                || key.startsWith('dqx_limited_checks_v3_')
                || key.startsWith('dqx_guide_seen_');
            if (!allowed) {
                try {
                    localStorage.removeItem(key);
                } catch (e) {
                    console.warn('[Storage Cleanup] localStorage の削除に失敗:', key, e);
                }
            }
        }

        const allowedSession = ['dqx_reload_count', 'dqx_test_token', 'dqx_session_date_key'];
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
            const key = sessionStorage.key(i);
            if (!key) continue;
            if (!allowedSession.includes(key)) {
                try {
                    sessionStorage.removeItem(key);
                } catch (e) {
                    console.warn('[Storage Cleanup] sessionStorage の削除に失敗:', key, e);
                }
            }
        }
    },

    applyDarkMode: function() {
        document.body.classList.toggle('dark-mode', this.darkMode);
        const btn = document.getElementById('global-dark-toggle');
        if (btn) btn.textContent = this.darkMode ? '☀️' : '🌙';
    },

    toggleDarkMode: function() {
        this.darkMode = !this.darkMode;
        localStorage.setItem(STORAGE_KEYS.DARK_MODE, this.darkMode ? 'dark' : 'light');
        this.applyDarkMode();
        if (this.currentTool === null) {
            this.showLauncher();
        } else {
            this.renderToolMenu();
        }
    },

    toggleSidebar: function() {
        this.sidebarVisible = !this.sidebarVisible;
        localStorage.setItem(STORAGE_KEYS.SIDEBAR_VISIBLE, String(this.sidebarVisible));
        document.body.classList.toggle('sidebar-hidden', !this.sidebarVisible);
        if (this.currentTool !== null) this.renderToolMenu();
        this.updateContainerPadding();
    },

    // show=クエリパラメータ／dqx_visible_tools（カード編集での表示設定）／
    // defaultHidden（検証中ツールの初期非表示）を考慮して、渡された
    // [id, tool] エントリ配列をユーザーの現在の表示設定でフィルタする。
    // ホーム画面（showLauncher）とツール切り替えバー（renderToolMenu）の
    // 両方で表示対象が食い違わないよう、判定ロジックをここに一本化する。
    filterByUserVisibility: function(entries) {
        try {
            const params    = new URLSearchParams(window.location.search);
            const showParam = params.get('show');
            if (showParam) {
                const wanted = showParam.split(',').map((s) => s.trim()).filter(Boolean);
                return entries.filter(([id]) => wanted.includes(id));
            }
            const stored = localStorage.getItem(STORAGE_KEYS.VISIBLE_TOOLS);
            if (stored) {
                try {
                    const wanted = JSON.parse(stored);
                    if (Array.isArray(wanted) && wanted.length > 0) {
                        return entries.filter(([id]) => wanted.includes(id));
                    }
                } catch (e) {
                    console.warn('Invalid dqx_visible_tools in localStorage', e);
                }
                return entries;
            }
            // 表示設定が未保存（初回起動・カード編集で一度も触っていない）の場合は
            // defaultHidden なツール（検証中の鍛冶シミュレーター等）をデフォルトの
            // 表示対象から除外する。
            return entries.filter(([, tool]) => !tool.defaultHidden);
        } catch (e) {
            console.warn('Invalid show param', e);
            return entries;
        }
    },

    showLauncher: function() {
        const savedOrder = localStorage.getItem(STORAGE_KEYS.CARD_ORDER);
        const order      = savedOrder ? JSON.parse(savedOrder) : null;

        const hasValidToken = () => {
            const token = sessionStorage.getItem(STORAGE_KEYS.TEST_TOKEN);
            return token && token.length >= 40;
        };

        // hideInMenu かつ testToolConfig を持たないツール（例：アプリの使い方）は
        // ホーム画面のカード一覧から除外する
        let toolEntries = Object.entries(this.tools).filter(([, tool]) => {
            return !(tool.hideInMenu && !tool.testToolConfig);
        });
        toolEntries = this.filterByUserVisibility(toolEntries);

        if (order) {
            toolEntries.sort((a, b) => {
                const aIdx = order.indexOf(a[0]);
                const bIdx = order.indexOf(b[0]);
                if (aIdx === -1 && bIdx === -1) return 0;
                if (aIdx === -1) return 1;
                if (bIdx === -1) return -1;
                return aIdx - bIdx;
            });
        }

        const isValidToken = hasValidToken();
        const cardElements = toolEntries.map(([id, tool]) => {
            const isDisabled = tool.requiresToken && !isValidToken;
            const card = document.createElement('div');
            card.className = `tool-card ${isDisabled ? 'tool-card-disabled' : ''}`;
            card.dataset.toolId = id;
            card.dataset.requiresToken = String(tool.requiresToken || false);

            const badge = window.DQX_CARD_BADGES && window.DQX_CARD_BADGES[id];
            if (badge === 'checker-nondaily') {
                const badgeEl = document.createElement('span');
                badgeEl.className = 'card-badge card-badge-green';
                badgeEl.title = 'イベント情報に更新あり（日課以外）';
                badgeEl.textContent = '●';
                card.appendChild(badgeEl);
            } else if (badge) {
                const badgeEl = document.createElement('span');
                badgeEl.className = 'card-badge card-badge-yellow';
                badgeEl.title = 'ツールが更新されました';
                badgeEl.textContent = '●';
                card.appendChild(badgeEl);
            }

            const icon = document.createElement('div');
            icon.className = 'tool-card-icon';
            dqxAppendEscapedTextWithBr(icon, tool.icon || '🔧');
            card.appendChild(icon);

            const name = document.createElement('div');
            name.className = 'tool-card-name';
            dqxAppendEscapedTextWithBr(name, tool.name);
            card.appendChild(name);

            const desc = document.createElement('div');
            desc.className = 'tool-card-desc';
            dqxAppendEscapedTextWithBr(desc, tool.desc || '');
            card.appendChild(desc);

            return card;
        });

        const homeContainer = document.createElement('div');
        homeContainer.className = 'home-container';

        const homeHeader = document.createElement('div');
        homeHeader.className = 'home-header';

        const homeTitle = document.createElement('h1');
        homeTitle.className = 'home-title';
        homeTitle.textContent = 'yuffy tools';
        homeHeader.appendChild(homeTitle);

        const headerActions = document.createElement('div');
        headerActions.className = 'home-header-actions';

        const manageBtn = document.createElement('button');
        manageBtn.id = 'open-manage-link';
        manageBtn.className = 'manage-btn';
        manageBtn.type = 'button';
        manageBtn.textContent = 'カード編集';
        headerActions.appendChild(manageBtn);

        const darkToggle = document.createElement('button');
        darkToggle.id = 'global-dark-toggle';
        darkToggle.className = 'dark-toggle-btn';
        darkToggle.type = 'button';
        darkToggle.textContent = this.darkMode ? '☀️' : '🌙';
        headerActions.appendChild(darkToggle);

        const netStatus = document.createElement('div');
        netStatus.id = 'dqx-net-status';
        netStatus.className = 'dqx-net-dot dqx-net-checking';
        netStatus.setAttribute('aria-label', 'バージョン状態');
        netStatus.textContent = '⏳';
        headerActions.appendChild(netStatus);

        const netPopover = document.createElement('div');
        netPopover.id = 'dqx-net-popover';
        headerActions.appendChild(netPopover);

        homeHeader.appendChild(headerActions);

        const homeGrid = document.createElement('div');
        homeGrid.className = 'home-grid';
        cardElements.forEach((card) => homeGrid.appendChild(card));

        const homeFooter = document.createElement('div');
        homeFooter.className = 'home-footer';

        const footerRow = document.createElement('div');
        footerRow.className = 'footer-row';

        const footerLeft = document.createElement('div');
        footerLeft.className = 'footer-row-left';

        const installLink = document.createElement('a');
        installLink.href = '#';
        installLink.id = 'footer-install-link';
        installLink.className = 'footer-install-link';
        installLink.textContent = '📲 アプリとして使う方法';
        footerLeft.appendChild(installLink);

        const releaseNotesBtn = document.createElement('button');
        releaseNotesBtn.id = 'footer-releasenotes-btn';
        releaseNotesBtn.className = 'footer-text-btn';
        releaseNotesBtn.type = 'button';
        releaseNotesBtn.textContent = '📋 リリースノート';
        footerLeft.appendChild(releaseNotesBtn);

        const reloadBtn = document.createElement('button');
        reloadBtn.id = 'footer-reload-btn';
        reloadBtn.className = 'footer-reload-btn';
        reloadBtn.type = 'button';
        reloadBtn.title = '設定の最新版を確認して更新';
        reloadBtn.textContent = '↻';

        footerRow.appendChild(footerLeft);
        footerRow.appendChild(reloadBtn);

        const footerCopyright = document.createElement('div');
        footerCopyright.className = 'footer-copyright';
        footerCopyright.innerHTML = 'このページで利用している株式会社スクウェア・エニックスを代表とする共同著作者が権利を所有する画像の転載・配布は禁止いたします。<br>&copy; ARMOR PROJECT/BIRD STUDIO/SQUARE ENIX All Rights Reserved.';

        homeFooter.appendChild(footerRow);
        homeFooter.appendChild(footerCopyright);

        homeContainer.appendChild(homeHeader);
        homeContainer.appendChild(homeGrid);
        homeContainer.appendChild(homeFooter);
        this.container.replaceChildren(homeContainer);

        document.getElementById('global-dark-toggle').onclick = () => this.toggleDarkMode();

        // ネットインジケーター
        const netDot = document.getElementById('dqx-net-status');
        const netPopoverEl = document.getElementById('dqx-net-popover');
        if (netDot && netPopoverEl) {
            if (window.dqxUpdateNetIndicator) window.dqxUpdateNetIndicator();
            netDot.onclick = (e) => {
                e.stopPropagation();
                netPopoverEl.classList.toggle('show');
            };
            if (this._netPopoverAbort) this._netPopoverAbort.abort();
            this._netPopoverAbort = new AbortController();
            document.addEventListener('click', (e) => {
                if (!netDot.contains(e.target) && !netPopoverEl.contains(e.target)) {
                    netPopoverEl.classList.remove('show');
                }
            }, { signal: this._netPopoverAbort.signal });
        }

        // フッターのインストールリンク
        document.getElementById('footer-install-link').onclick = (e) => {
            e.preventDefault();
            if (this.tools && this.tools['install']) {
                this.loadTool('install');
            } else if (window.DQX_MANIFEST_FETCH_PROMISE) {
                window.DQX_MANIFEST_FETCH_PROMISE.then(() => {
                    if (this.tools && this.tools['install']) this.loadTool('install');
                });
            }
        };

        // フッターの更新ボタン
        document.getElementById('footer-reload-btn').onclick = async () => {
            if (!navigator.onLine) {
                window.dqxShowToast('オフラインのため更新を確認できません。オンライン環境で再度お試しください。');
                return;
            }
            await window.dqxCheckVersion();
            if (window.DQX_NET_STATE === 'update') {
                window.dqxShowToast('更新があります。ページを再読み込みします。');
                window.location.reload(true);
            } else if (window.DQX_NET_STATE === 'latest') {
                window.dqxShowToast('現在の読み込みキャッシュは最新です。');
            } else {
                window.dqxShowToast('最新状態を確認できませんでした。');
            }
        };

        // リリースノートボタン
        document.getElementById('footer-releasenotes-btn').onclick = () => this.openReleaseNotesModal();

        // カードクリック
        this.container.querySelectorAll('.tool-card').forEach((card) => {
            card.onclick = () => {
                const toolId       = card.dataset.toolId;
                const requiresToken = card.dataset.requiresToken === 'true';
                if (requiresToken && !hasValidToken()) {
                    this._promptToken();
                    return;
                }
                this.loadTool(toolId);
            };
        });

        document.getElementById('open-manage-link').onclick = () => this.openManageDialog();

        const homeGridEl = this.container.querySelector('.home-grid');
        if (homeGridEl && typeof Sortable !== 'undefined') {
            if (this.sortableInstance) this.sortableInstance.destroy();
            this.sortableInstance = new Sortable(homeGridEl, {
                animation: 150,
                onEnd: () => {
                    const newOrder = [...homeGridEl.children].map((card) => card.dataset.toolId);
                    localStorage.setItem(STORAGE_KEYS.CARD_ORDER, JSON.stringify(newOrder));
                }
            });
        }

        // 初回のみ、ホーム画面の使い方ガイドを自動表示する
        // （showGuide側で既読フラグ・多重起動を判定するため、resize等で
        //   showLauncher()が再度呼ばれても実害はない）
        if (this.currentTool === null) {
            this.maybeShowHomeGuide();
        }
    },

    // トークン入力を専用UIで行う（prompt() は PWA standalone で動作しない環境がある）
    _promptToken: function() {
        const existing = document.getElementById('dqx-token-modal');
        if (existing) return;

        const modal = document.createElement('div');
        modal.id    = 'dqx-token-modal';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:30000;';

        const dialog = document.createElement('div');
        dialog.style.cssText = 'background:#fff;padding:24px;border-radius:12px;width:90%;max-width:400px;';

        const title = document.createElement('h3');
        title.style.cssText = 'margin:0 0 12px;color:#0066cc;';
        title.textContent = '🔑 開発者認証';
        dialog.appendChild(title);

        const description = document.createElement('p');
        description.style.cssText = 'font-size:13px;color:#555;margin:0 0 12px;';
        description.textContent = 'GitHub APIトークンを入力してください（開発者専用）';
        dialog.appendChild(description);

        const input = document.createElement('input');
        input.id = 'dqx-token-input';
        input.type = 'password';
        input.style.cssText = 'width:100%;padding:10px;border:1px solid #ccc;border-radius:8px;font-size:14px;box-sizing:border-box;';
        input.placeholder = 'ghp_...';
        dialog.appendChild(input);

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:8px;margin-top:12px;justify-content:flex-end;';

        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'dqx-token-cancel';
        cancelBtn.style.cssText = 'padding:8px 16px;border:1px solid #ccc;border-radius:8px;background:#fff;cursor:pointer;';
        cancelBtn.textContent = 'キャンセル';
        actions.appendChild(cancelBtn);

        const okBtn = document.createElement('button');
        okBtn.id = 'dqx-token-ok';
        okBtn.style.cssText = 'padding:8px 16px;background:#0066cc;color:#fff;border:none;border-radius:8px;cursor:pointer;';
        okBtn.textContent = '確認';
        actions.appendChild(okBtn);

        dialog.appendChild(actions);
        modal.appendChild(dialog);
        document.body.appendChild(modal);

        const close = () => modal.remove();
        cancelBtn.onclick = close;
        okBtn.onclick = () => {
            const token = input.value.trim();
            if (token && token.length >= 40) {
                sessionStorage.setItem(STORAGE_KEYS.TEST_TOKEN, token);
                close();
                this.showLauncher();
            } else {
                input.style.borderColor = '#dc3545';
            }
        };
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') okBtn.click(); });
        input.focus();
    },

    openManageDialog: function() {
        if (document.getElementById('manage-modal')) return;

        const modal  = document.createElement('div');
        modal.id     = 'manage-modal';
        modal.className = 'manage-modal';

        const dialog = document.createElement('div');
        dialog.className = 'manage-dialog';

        const title = document.createElement('h3');
        title.textContent = 'カード編集';
        dialog.appendChild(title);

        const description = document.createElement('p');
        description.textContent = 'ホームに表示するツールの表示/非表示を切り替えます。変更は即時保存されます。';
        dialog.appendChild(description);

        const listContainer = document.createElement('div');
        listContainer.id = 'manage-list';
        listContainer.className = 'manage-list';
        dialog.appendChild(listContainer);

        const actions = document.createElement('div');
        actions.className = 'manage-actions';

        const saveBtn = document.createElement('button');
        saveBtn.id = 'manage-save';
        saveBtn.className = 'manage-save-btn';
        saveBtn.type = 'button';
        saveBtn.textContent = '閉じる';
        actions.appendChild(saveBtn);
        dialog.appendChild(actions);

        modal.appendChild(dialog);
        document.body.appendChild(modal);

        const loadVisible = () => {
            const stored = localStorage.getItem('dqx_visible_tools');
            try { return stored ? JSON.parse(stored) : null; } catch (e) { return null; }
        };
        let visible = loadVisible();
        // hideInMenu=true かつ requiresToken=false のもの（installなど）は除外
        // テストツール（requiresToken=true）はカードに表示されるので残す
        const allIds = Object.keys(this.tools).filter((id) => {
            const t = this.tools[id];
            return !(t.hideInMenu && !t.requiresToken);
        }).sort();
        // 表示設定が未保存の場合に使う初期選択状態（defaultHidden なツールは除く）
        const defaultVisibleIds = allIds.filter((id) => !this.tools[id].defaultHidden);
        // defaultHidden を持つツールが1つでもある場合、「全部チェック＝設定削除（無条件全表示に戻す）」
        // をしてしまうと、次回起動時に defaultHidden 判定が働いて再び非表示化されてしまう
        // （チェックを入れた操作が保存されない）ため、その場合は必ず明示的に保存する。
        const hasDefaultHidden = allIds.some((id) => this.tools[id].defaultHidden);

        const renderList = () => {
            listContainer.innerHTML = '';
            allIds.forEach((id) => {
                const row = document.createElement('div');
                row.className = 'manage-row';

                const chk = document.createElement('input');
                chk.type    = 'checkbox';
                chk.checked = visible ? visible.includes(id) : defaultVisibleIds.includes(id);

                const label = document.createElement('div');
                label.className = 'manage-label';
                label.textContent = id + (this.tools[id] ? ` — ${this.tools[id].name}` : '');

                chk.onchange = () => {
                    if (chk.checked) {
                        if (!visible) visible = defaultVisibleIds.slice();
                        if (!visible.includes(id)) visible.push(id);
                    } else {
                        const checkedCount = listContainer.querySelectorAll('input[type="checkbox"]:checked').length;
                        if (checkedCount === 0) {
                            chk.checked = true;
                            if (window.dqxShowToast) {
                                window.dqxShowToast('最低1つのツールを表示する必要があります。', { duration: 3000 });
                            }
                            return;
                        }
                        visible = (visible || defaultVisibleIds.slice()).filter((x) => x !== id);
                    }
                    if (!hasDefaultHidden && visible && visible.length === allIds.length) {
                        localStorage.removeItem(STORAGE_KEYS.VISIBLE_TOOLS);
                    } else {
                        localStorage.setItem(STORAGE_KEYS.VISIBLE_TOOLS, JSON.stringify(visible || []));
                    }
                };

                row.appendChild(chk);
                row.appendChild(label);
                listContainer.appendChild(row);
            });
        };

        renderList();
        saveBtn.onclick = () => {
            modal.remove();
            this.showLauncher();
        };
    },

    openReleaseNotesModal: function() {
        if (document.getElementById('dqx-releasenotes-modal')) return;

        const open = (notes) => {
            const modal = document.createElement('div');
            modal.id        = 'dqx-releasenotes-modal';
            modal.className = 'rn-modal-overlay';

            const sheet = document.createElement('div');
            sheet.className = 'rn-sheet';

            const header = document.createElement('div');
            header.className = 'rn-sheet-header';

            const title = document.createElement('span');
            title.className   = 'rn-sheet-title';
            title.textContent = '📋 リリースノート';

            const closeBtn = document.createElement('button');
            closeBtn.className   = 'rn-close-btn';
            closeBtn.textContent = '✕';
            closeBtn.setAttribute('aria-label', '閉じる');
            closeBtn.onclick = () => modal.remove();

            header.appendChild(title);
            header.appendChild(closeBtn);

            const body = document.createElement('div');
            body.className = 'rn-sheet-body';

            const entries = Array.isArray(notes) ? notes : [];
            if (entries.length === 0) {
                const empty = document.createElement('p');
                empty.className = 'rn-empty';
                empty.textContent = 'リリースノートはありません。';
                body.appendChild(empty);
            } else {
                entries.forEach((entry) => {
                    const entryEl = document.createElement('div');
                    entryEl.className = 'rn-entry';

                    const entryHeader = document.createElement('div');
                    entryHeader.className = 'rn-header';

                    const version = document.createElement('span');
                    version.className = 'rn-version';
                    version.textContent = `v${entry.version}`;
                    entryHeader.appendChild(version);

                    const date = document.createElement('span');
                    date.className = 'rn-date';
                    date.textContent = entry.date;
                    entryHeader.appendChild(date);

                    const list = document.createElement('ul');
                    list.className = 'rn-list';
                    (entry.notes || []).forEach((note) => {
                        const item = document.createElement('li');
                        item.textContent = note;
                        list.appendChild(item);
                    });

                    entryEl.appendChild(entryHeader);
                    entryEl.appendChild(list);
                    body.appendChild(entryEl);
                });
            }

            sheet.appendChild(header);
            sheet.appendChild(body);
            modal.appendChild(sheet);
            document.body.appendChild(modal);
            modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
        };

        const p = window.DQX_RELEASE_NOTES_PROMISE || Promise.resolve(window.DQX_RELEASE_NOTES);
        p.then((notes) => open(notes || window.DQX_RELEASE_NOTES));
    },

    renderToolMenu: function() {
        const isMobile = this.isMobile();

        const menuEntries = this.filterByUserVisibility(
            Object.entries(this.tools).filter(([, tool]) => !tool.hideInMenu)
        );
        document.getElementById('tool-menu-bar')?.remove();
        document.getElementById('sidebar-float-toggle')?.remove();

        const menuBar = document.createElement('div');
        menuBar.id = 'tool-menu-bar';

        const scrollArea = document.createElement('div');
        const fixedArea = document.createElement('div');

        if (isMobile) {
            const isHidden = !this.sidebarVisible;
            menuBar.className = 'tool-menu-bottom';
            menuBar.style.display = isHidden ? 'none' : '';

            scrollArea.className = 'tool-menu-scroll';
            fixedArea.className = 'tool-menu-fixed';

            menuEntries.forEach(([id, tool]) => {
                const btn = document.createElement('button');
                btn.className = `tool-menu-btn ${this.currentTool === id ? 'active' : ''}`;
                btn.dataset.toolId = id;
                btn.type = 'button';
                btn.appendChild(document.createTextNode(tool.icon || '🔧'));

                const label = document.createElement('span');
                label.className = 'menu-btn-label';
                dqxAppendEscapedTextWithBr(label, tool.name);
                btn.appendChild(label);
                btn.onclick = () => {
                    const toolId = btn.dataset.toolId;
                    if (toolId && this.currentTool !== toolId) this.loadTool(toolId);
                };
                scrollArea.appendChild(btn);
            });

            const homeBtn = document.createElement('button');
            homeBtn.className = 'tool-menu-btn home-btn';
            homeBtn.type = 'button';
            homeBtn.dataset.action = 'home';
            homeBtn.appendChild(document.createTextNode('🏠'));
            const homeLabel = document.createElement('span');
            homeLabel.className = 'menu-btn-label';
            homeLabel.textContent = 'ホーム';
            homeBtn.appendChild(homeLabel);
            homeBtn.onclick = () => this.goHome();
            fixedArea.appendChild(homeBtn);

            const collapseBtn = document.createElement('button');
            collapseBtn.className = 'tool-menu-btn collapse-btn';
            collapseBtn.type = 'button';
            collapseBtn.dataset.action = 'toggle-sidebar';
            collapseBtn.appendChild(document.createTextNode('▼'));
            const collapseLabel = document.createElement('span');
            collapseLabel.className = 'menu-btn-label';
            collapseLabel.textContent = '閉じる';
            collapseBtn.appendChild(collapseLabel);
            collapseBtn.onclick = () => this.toggleSidebar();
            fixedArea.appendChild(collapseBtn);

            menuBar.appendChild(scrollArea);
            menuBar.appendChild(fixedArea);
            document.body.appendChild(menuBar);

            if (isHidden) {
                const floatBtn = document.createElement('button');
                floatBtn.id = 'sidebar-float-toggle';
                floatBtn.className = 'sidebar-float-btn';
                floatBtn.textContent = '▲';
                floatBtn.title = 'ツールバーを表示';
                floatBtn.style.display = 'flex';
                floatBtn.onclick = () => this.toggleSidebar();
                document.body.appendChild(floatBtn);
            }
        } else {
            const isHidden = !this.sidebarVisible;
            menuBar.className = 'tool-menu-sidebar';
            menuBar.style.display = isHidden ? 'none' : '';

            scrollArea.className = 'tool-menu-sidebar-scroll';
            fixedArea.className = 'tool-menu-sidebar-fixed';

            menuEntries.forEach(([id, tool]) => {
                const btn = document.createElement('button');
                btn.className = `tool-menu-btn ${this.currentTool === id ? 'active' : ''}`;
                btn.dataset.toolId = id;
                btn.type = 'button';
                btn.appendChild(document.createTextNode(tool.icon || '🔧'));

                const label = document.createElement('span');
                label.className = 'menu-btn-label';
                dqxAppendEscapedTextWithBr(label, tool.name);
                btn.appendChild(label);
                btn.onclick = () => {
                    const toolId = btn.dataset.toolId;
                    if (toolId && this.currentTool !== toolId) this.loadTool(toolId);
                };
                scrollArea.appendChild(btn);
            });

            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'tool-menu-btn sidebar-toggle-btn';
            toggleBtn.type = 'button';
            toggleBtn.dataset.action = 'toggle-sidebar';
            toggleBtn.appendChild(document.createTextNode('◀'));
            const toggleLabel = document.createElement('span');
            toggleLabel.className = 'menu-btn-label';
            toggleLabel.textContent = '閉じる';
            toggleBtn.appendChild(toggleLabel);
            toggleBtn.onclick = () => this.toggleSidebar();
            fixedArea.appendChild(toggleBtn);

            const homeBtn = document.createElement('button');
            homeBtn.className = 'tool-menu-btn home-btn';
            homeBtn.type = 'button';
            homeBtn.dataset.action = 'home';
            homeBtn.appendChild(document.createTextNode('🏠'));
            const homeLabel = document.createElement('span');
            homeLabel.className = 'menu-btn-label';
            homeLabel.textContent = 'ホーム';
            homeBtn.appendChild(homeLabel);
            homeBtn.onclick = () => this.goHome();
            fixedArea.appendChild(homeBtn);

            menuBar.appendChild(scrollArea);
            menuBar.appendChild(fixedArea);
            document.body.appendChild(menuBar);

            if (isHidden) {
                const floatBtn = document.createElement('button');
                floatBtn.id = 'sidebar-float-toggle';
                floatBtn.className = 'sidebar-float-btn';
                floatBtn.textContent = '▶';
                floatBtn.title = 'ツールバーを表示';
                floatBtn.style.display = 'flex';
                floatBtn.onclick = () => this.toggleSidebar();
                document.body.appendChild(floatBtn);
            }
        }

        this.updateContainerPadding();
    },

    updateContainerPadding: function() {
        const toolContainer = document.getElementById('dqx-tool-container');
        if (!toolContainer) return;
        if (this.isMobile()) {
            toolContainer.style.paddingBottom = this.sidebarVisible ? '70px' : '0';
            toolContainer.style.paddingRight  = '0';
        } else {
            toolContainer.style.paddingBottom = '0';
            toolContainer.style.paddingRight  = this.sidebarVisible ? '80px' : '0';
        }
    },

    loadTestTool: async function(toolId, tool) {
        // バージョン整合性チェック（テストツール読み込み前）
        if (typeof window.HTML_VERSION !== 'undefined' && window.HTML_VERSION !== APP_VERSION) {
            const reloadKey   = window.RELOAD_KEY || 'dqx_reload_count';
            const maxReload   = window.MAX_RELOAD || 2;
            const reloadCount = parseInt(sessionStorage.getItem(reloadKey)) || 0;
            if (reloadCount < maxReload) {
                sessionStorage.setItem(reloadKey, reloadCount + 1);
                window.dqxShowToast(
                    `バージョン不一致が検出されました。再読み込みします。（${reloadCount + 1}/${maxReload}）`,
                    { duration: 2500 }
                );
                setTimeout(() => location.reload(true), 2600);
                return false;
            } else {
                sessionStorage.removeItem(reloadKey);
                window.dqxShowToast(
                    'バージョン不一致ですが再読み込み上限に達したため続行します。ページを手動で再読み込みしてください。',
                    { duration: 8000 }
                );
            }
        }

        const config = tool.testToolConfig;
        if (!config) return false;

        let token = sessionStorage.getItem('dqx_test_token');
        if (!token) {
            this._promptToken();
            return false;
        }

        const loadingDiv         = document.createElement('div');
        loadingDiv.id            = 'dqx-loading-test';
        loadingDiv.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.0);z-index:10001;';
        document.body.appendChild(loadingDiv);

        try {
            const res = await fetch(
                `https://api.github.com/repos/rre1111/dqx-private-api/contents/${config.filename}`,
                {
                    headers: {
                        Authorization: `token ${token}`,
                        Accept: 'application/vnd.github.v3.raw'
                    }
                }
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const code = await res.text();

            const script = document.createElement('script');
            script.dataset.testTool = config.filename;
            script.textContent      = code;
            document.head.appendChild(script);

            loadingDiv.remove();

            const globalObj = window[config.globalName];
            if (globalObj && typeof globalObj.render === 'function') {
                this.container.innerHTML = '';
                const newContainer       = document.createElement('div');
                newContainer.id          = 'dqx-tool-container';
                this.container.appendChild(newContainer);
                globalObj.render('#dqx-tool-container');
                this.currentTool = toolId;
                this.renderToolMenu();
                return true;
            } else {
                throw new Error('ツール読み込み失敗');
            }
        } catch (e) {
            loadingDiv.remove();
            console.error(e);
            window.dqxShowToast(`認証失敗: ${e.message}`, { duration: 6000 });
            sessionStorage.removeItem(STORAGE_KEYS.TEST_TOKEN);
            this.goHome();
            return false;
        }
    },

    loadTool: async function(toolId) {
        const tool = this.tools[toolId];
        if (!tool || this.currentTool === toolId) return;

        // 6時跨ぎ（JST日付ロールオーバー）を検知したら、以降の処理はせず
        // キャッシュクリア込みの再読み込みに委ねる（アプデ蓄積防止）
        if (dqxCheckDateRollover()) return;

        // バッジクリア
        if (window.DQX_CARD_BADGES && window.DQX_CARD_BADGES[toolId]) {
            delete window.DQX_CARD_BADGES[toolId];
            try {
                const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.BG_BADGES) || '{}');
                delete saved[toolId];
                localStorage.setItem(STORAGE_KEYS.BG_BADGES, JSON.stringify(saved));
            } catch(e) {}
        }

        if (window.dqxCheckVersion) window.dqxCheckVersion();

        if (tool.hideInMenu && tool.testToolConfig) {
            this.destroyCurrentTool();
            document.getElementById('dqx-tool-container')?.remove();
            await this.loadTestTool(toolId, tool);
            return;
        }

        this.destroyCurrentTool();
        document.getElementById('dqx-tool-container')?.remove();

        const toolContainer    = document.createElement('div');
        toolContainer.id       = 'dqx-tool-container';
        this.container.appendChild(toolContainer);

        const loadingDiv         = document.createElement('div');
        loadingDiv.id            = 'dqx-loading';
        loadingDiv.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.0);z-index:20000;';
        document.body.appendChild(loadingDiv);

        try {
            this.removeOldToolScripts(tool.url, tool.ver);
            await this.loadScript(tool.url, tool.renderFn, tool.ver);

            // renderFn（例: "Kaji.render"）からメソッドと呼び出し元オブジェクトを分離する。
            // 従来は関数参照だけを取り出して `fn('#dqx-tool-container')` のように
            // 素の関数呼び出しをしていたため、render内で `this` を参照するツール
            // （kaji.js 等）では this が undefined になりエラーになっていた。
            const renderPath   = tool.renderFn.split('.');
            const methodName   = renderPath.pop();
            const thisContext  = renderPath.reduce((obj, key) => obj && obj[key], window);
            const fn           = thisContext && thisContext[methodName];

            loadingDiv.remove();

            if (typeof fn === 'function') {
                this.container.innerHTML = '';
                const newToolContainer   = document.createElement('div');
                newToolContainer.id      = 'dqx-tool-container';
                this.container.appendChild(newToolContainer);
                fn.call(thisContext, '#dqx-tool-container');
                this.currentTool = toolId;
                this.renderToolMenu();
            } else {
                toolContainer.innerHTML = '<div style="color:red;text-align:center;padding:40px;">エラー: ツールの読み込みに失敗しました</div>';
                this.goHome();
            }
        } catch (e) {
            loadingDiv.remove();
            console.error('ツール読み込みエラー:', e);
            toolContainer.innerHTML = '<div style="color:red;text-align:center;padding:40px;">エラー: ツールの読み込みに失敗しました</div>';
            this.goHome();
        }
    },

    goHome: function() {
        // 6時跨ぎ検知（ホームへの遷移時にも同様にチェックする）
        if (dqxCheckDateRollover()) return;

        this.destroyCurrentTool();
        document.getElementById('tool-menu-bar')?.remove();
        document.getElementById('sidebar-float-toggle')?.remove();
        document.getElementById('dqx-tool-container')?.remove();

        const newContainer = document.createElement('div');
        newContainer.id    = 'dqx-tool-container';
        this.container.appendChild(newContainer);

        this.removeTestToolScripts();
        this.currentTool = null;
        this.showLauncher();
    },

    destroyCurrentTool: function() {
        if (this.currentTool) {
            const tool = this.tools[this.currentTool];
            if (tool) {
                const globalName = tool.testToolConfig
                    ? tool.testToolConfig.globalName
                    : tool.renderFn && tool.renderFn.split('.')[0];
                if (globalName && window[globalName] && typeof window[globalName].destroy === 'function') {
                    window[globalName].destroy();
                }
            }
        }
        this.removeTestToolScripts();

        // testToolConfig を持つすべての登録済みツールの destroy を呼ぶ
        Object.values(this.tools).forEach((tool) => {
            if (!tool.testToolConfig) return;
            const g = tool.testToolConfig.globalName;
            if (window[g] && typeof window[g].destroy === 'function') {
                window[g].destroy();
            }
        });
    },

    // ========== 機能ガイド（スポットライト式ツアー） ==========
    // steps: [{ selector, title, text }, ...]
    // guideKey: localStorageの既読管理キー（例: 'dqx_guide_seen_home'）
    // options.force: true の場合、既読フラグを無視して強制表示する（設定画面からの手動呼び出し用）
    showGuide: function(steps, guideKey, options) {
        options = options || {};
        const force = !!options.force;
        if (!Array.isArray(steps) || steps.length === 0) return;
        if (!force) {
            try {
                if (localStorage.getItem(guideKey) === '1') return;
            } catch (e) { /* noop */ }
        }
        // 多重起動防止（resize等で複数回呼ばれても二重表示しない）
        if (document.getElementById('dqx-guide-overlay')) return;

        let idx = 0;

        const overlay = document.createElement('div');
        overlay.id = 'dqx-guide-overlay';

        const highlight = document.createElement('div');
        highlight.id = 'dqx-guide-highlight';

        const balloon = document.createElement('div');
        balloon.id = 'dqx-guide-balloon';

        const cleanup = () => {
            window.removeEventListener('resize', reposition);
            overlay.remove();
            highlight.remove();
            balloon.remove();
        };

        const finish = () => {
            try { localStorage.setItem(guideKey, '1'); } catch (e) { /* noop */ }
            cleanup();
            if (window.dqxShowToast) {
                window.dqxShowToast('ガイドは設定からいつでも見返せます', { duration: 4000 });
            }
        };

        const reposition = () => {
            const step = steps[idx];
            if (!step) { finish(); return; }
            const target = document.querySelector(step.selector);
            if (!target) {
                // 対象要素が見つからない場合は次のステップへ（全滅なら終了）
                if (idx < steps.length - 1) { idx++; renderStep(); }
                else finish();
                return;
            }
            const rect = target.getBoundingClientRect();
            const pad  = 8;
            highlight.style.top    = (rect.top - pad) + 'px';
            highlight.style.left   = (rect.left - pad) + 'px';
            highlight.style.width  = (rect.width + pad * 2) + 'px';
            highlight.style.height = (rect.height + pad * 2) + 'px';

            // 吹き出し位置：対象の下に置けるならそこ、収まらなければ上に出す
            const balloonWidth    = balloon.offsetWidth || 300;
            const estimatedHeight = balloon.offsetHeight || 160;
            let top = rect.bottom + pad + 12;
            if (top + estimatedHeight > window.innerHeight - 10) {
                top = Math.max(10, rect.top - pad - estimatedHeight - 12);
            }
            let left = rect.left + rect.width / 2 - balloonWidth / 2;
            left = Math.max(10, Math.min(left, window.innerWidth - balloonWidth - 10));
            balloon.style.top  = top + 'px';
            balloon.style.left = left + 'px';

            target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        };

        const renderStep = () => {
            const step = steps[idx];
            if (!step) { finish(); return; }

            balloon.innerHTML = '';

            const closeBtn = document.createElement('button');
            closeBtn.className = 'dqx-guide-close-btn';
            closeBtn.textContent = '✕';
            closeBtn.setAttribute('aria-label', '閉じる');
            closeBtn.onclick = finish;
            balloon.appendChild(closeBtn);

            const countEl = document.createElement('div');
            countEl.className = 'dqx-guide-step-count';
            countEl.textContent = `${idx + 1} / ${steps.length}`;
            balloon.appendChild(countEl);

            const titleEl = document.createElement('div');
            titleEl.className = 'dqx-guide-title';
            titleEl.textContent = step.title || '';
            balloon.appendChild(titleEl);

            const textEl = document.createElement('div');
            textEl.className = 'dqx-guide-text';
            textEl.textContent = step.text || '';
            balloon.appendChild(textEl);

            const actions = document.createElement('div');
            actions.className = 'dqx-guide-actions';

            if (idx === 0) {
                const skipBtn = document.createElement('button');
                skipBtn.className = 'dqx-guide-skip-btn';
                skipBtn.textContent = 'スキップ';
                skipBtn.onclick = finish;
                actions.appendChild(skipBtn);
            } else {
                actions.appendChild(document.createElement('span'));
            }

            const actionsRight = document.createElement('div');
            actionsRight.className = 'dqx-guide-actions-right';

            if (idx > 0) {
                const backBtn = document.createElement('button');
                backBtn.className = 'dqx-guide-nav-btn';
                backBtn.textContent = '戻る';
                backBtn.onclick = () => { idx--; renderStep(); };
                actionsRight.appendChild(backBtn);
            }

            const nextBtn = document.createElement('button');
            nextBtn.className = 'dqx-guide-nav-btn dqx-guide-primary';
            nextBtn.textContent = (idx === steps.length - 1) ? '完了' : '次へ';
            nextBtn.onclick = () => {
                if (idx === steps.length - 1) { finish(); return; }
                idx++;
                renderStep();
            };
            actionsRight.appendChild(nextBtn);

            actions.appendChild(actionsRight);
            balloon.appendChild(actions);

            requestAnimationFrame(reposition);
        };

        window.addEventListener('resize', reposition);

        document.body.appendChild(overlay);
        document.body.appendChild(highlight);
        document.body.appendChild(balloon);
        renderStep();
    },

    // ホーム画面用ガイド（初回自動表示・設定画面からの再表示の両方で使う）
    maybeShowHomeGuide: function(force) {
        // 起動時ローディングオーバーレイが表示されている間はガイドを隠してしまうため、
        // オーバーレイが消えるまで待ってから表示する。
        if (document.getElementById('dqx-loading-overlay')) {
            setTimeout(() => this.maybeShowHomeGuide(force), 300);
            return;
        }
        const steps = [
            { selector: '.home-grid',            title: 'ツール一覧',   text: 'ここをタップすると各ツールが開きます。カードは長押しして並び替えることもできます。' },
            { selector: '#open-manage-link',     title: 'カード編集',   text: '表示するツールの選択ができます。' },
            { selector: '#global-dark-toggle',   title: 'ダークモード', text: '画面全体の明るさを切り替えられます。' },
            { selector: '#dqx-net-status',       title: '更新状況',     text: 'タップすると、ツールの更新状況や通信状況を確認できます。' },
            { selector: '#footer-releasenotes-btn', title: 'リリースノート', text: '更新による変更内容はここから確認できます。' },
        ];
        this.showGuide(steps, 'dqx_guide_seen_home', { force: !!force });
    },

    // 設定画面の「ガイドをもう一度見る」ボタンから呼ばれる。
    // ガイドの対象要素はホーム画面にしかないため、まずホームへ戻してから表示する。
    showHomeGuideForced: function() {
        this.goHome();
        setTimeout(() => this.maybeShowHomeGuide(true), 50);
    },

    destroy: function() {
        if (this.sortableInstance) {
            this.sortableInstance.destroy();
            this.sortableInstance = null;
        }
        if (this.boundResizeHandler) {
            window.removeEventListener('resize', this.boundResizeHandler);
            this.boundResizeHandler = null;
        }
        if (this._netPopoverAbort) {
            this._netPopoverAbort.abort();
            this._netPopoverAbort = null;
        }
        document.getElementById('sidebar-float-toggle')?.remove();
    },

    removeOldToolScripts: function(url, ver) {
        const cacheBustUrl = url + '?v=' + encodeURIComponent(ver || APP_VERSION);
        document.querySelectorAll(`script[src="${cacheBustUrl}"]`).forEach((s) => s.remove());
        document.querySelectorAll(`script[src^="${url}?v="]`).forEach((s) => s.remove());
        document.querySelectorAll(`script[src="${url}"]`).forEach((s) => s.remove());
    },

    removeTestToolScripts: function() {
        document.querySelectorAll('script[data-test-tool]').forEach((s) => s.remove());
    },

    loadScript: function(url, renderFn, ver) {
        // renderFn のホワイトリスト確認
        if (renderFn && !isAllowedRenderFn(renderFn)) {
            return Promise.reject(new Error(`Blocked renderFn: ${renderFn}`));
        }

        // バージョン整合性チェック
        if (typeof window.HTML_VERSION !== 'undefined' && window.HTML_VERSION !== APP_VERSION) {
            const reloadKey   = window.RELOAD_KEY || 'dqx_reload_count';
            const maxReload   = window.MAX_RELOAD || 2;
            const reloadCount = parseInt(sessionStorage.getItem(reloadKey)) || 0;
            if (reloadCount < maxReload) {
                sessionStorage.setItem(reloadKey, reloadCount + 1);
                window.dqxShowToast(
                    `バージョン不一致が検出されました。再読み込みします。（${reloadCount + 1}/${maxReload}）`,
                    { duration: 2500 }
                );
                setTimeout(() => location.reload(true), 2600);
                return new Promise(() => {});
            } else {
                sessionStorage.removeItem(reloadKey);
                window.dqxShowToast(
                    'バージョン不一致ですが再読み込み上限に達したため続行します。ページを手動で再読み込みしてください。',
                    { duration: 8000 }
                );
            }
        }

        const cacheBustUrl = url + '?v=' + encodeURIComponent(ver || APP_VERSION);
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${cacheBustUrl}"]`)) {
                resolve();
                return;
            }
            const script    = document.createElement('script');
            script.src      = cacheBustUrl;
            script.onload   = () => resolve();
            script.onerror  = () => reject(new Error(`Script load failed: ${url}`));
            document.head.appendChild(script);
        });
    }
};

if (typeof window.DQXTools === 'undefined') {
    window.DQXTools = DQXTools;
}
