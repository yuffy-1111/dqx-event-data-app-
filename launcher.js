// ========== DQXTools ランチャー ==========
const APP_VERSION = '1.2.1β+';
window.LAUNCHER_VERSION = APP_VERSION;

// ランチャー読み込み完了を通知（index.html 側が受信してバージョン確認を行う）
window.dispatchEvent(new Event('launcher-ready'));

// ========== renderFn ホワイトリスト ==========
// tool.renderFn に指定できるグローバルアクセスパターンを制限する。
// manifest が改ざんされても window.eval 等の危険なプロパティを呼べないようにする。
const ALLOWED_RENDER_PREFIXES = [
    'Checker.', 'Expmercenary.', 'VersionSelector.',
    'Help.', 'Settings.', 'Install.'
];
function isAllowedRenderFn(renderFn) {
    return ALLOWED_RENDER_PREFIXES.some((prefix) => renderFn.startsWith(prefix));
}

function checkVersionUpdate() {
    const storedVersion = localStorage.getItem('dqx_app_version');
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
    localStorage.setItem('dqx_app_version', APP_VERSION);
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

        const saved = localStorage.getItem('dqx_sidebar_visible');
        this.sidebarVisible = saved !== null ? saved !== 'false' : true;
        document.body.classList.toggle('sidebar-hidden', !this.sidebarVisible);

        this.cleanupStorage();

        this.darkMode = localStorage.getItem('darkMode') === 'dark';
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
            'dqx_manifest_version'
        ];
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (!key) continue;
            const allowed = allowedLocal.includes(key)
                || key.startsWith('dqx_check_final10_')
                || key.startsWith('dqx_limited_checks_v3_');
            if (!allowed) {
                try {
                    localStorage.removeItem(key);
                } catch (e) {
                    console.warn('[Storage Cleanup] localStorage の削除に失敗:', key, e);
                }
            }
        }

        const allowedSession = ['dqx_reload_count', 'dqx_test_token'];
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
        localStorage.setItem('darkMode', this.darkMode ? 'dark' : 'light');
        this.applyDarkMode();
        if (this.currentTool === null) {
            this.showLauncher();
        } else {
            this.renderToolMenu();
        }
    },

    toggleSidebar: function() {
        this.sidebarVisible = !this.sidebarVisible;
        localStorage.setItem('dqx_sidebar_visible', String(this.sidebarVisible));
        document.body.classList.toggle('sidebar-hidden', !this.sidebarVisible);
        if (this.currentTool !== null) this.renderToolMenu();
        this.updateContainerPadding();
    },

    showLauncher: function() {
        const savedOrder = localStorage.getItem('dqx_card_order');
        const order      = savedOrder ? JSON.parse(savedOrder) : null;

        const hasValidToken = () => {
            const token = sessionStorage.getItem('dqx_test_token');
            return token && token.length >= 40;
        };

        // hideInMenu かつ testToolConfig を持たないツール（例：アプリの使い方）は
        // ホーム画面のカード一覧から除外する
        let toolEntries = Object.entries(this.tools).filter(([, tool]) => {
            return !(tool.hideInMenu && !tool.testToolConfig);
        });

        try {
            const params    = new URLSearchParams(window.location.search);
            const showParam = params.get('show');
            if (showParam) {
                const wanted = showParam.split(',').map((s) => s.trim()).filter(Boolean);
                toolEntries  = toolEntries.filter(([id]) => wanted.includes(id));
            } else {
                const stored = localStorage.getItem('dqx_visible_tools');
                if (stored) {
                    try {
                        const wanted = JSON.parse(stored);
                        if (Array.isArray(wanted) && wanted.length > 0) {
                            toolEntries = toolEntries.filter(([id]) => wanted.includes(id));
                        }
                    } catch (e) {
                        console.warn('Invalid dqx_visible_tools in localStorage', e);
                    }
                }
            }
        } catch (e) {
            console.warn('Invalid show param', e);
        }

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

        const cardButtons = toolEntries.map(([id, tool]) => {
            const isDisabled = tool.requiresToken && !isValidToken;
            return `
                <div class="tool-card ${isDisabled ? 'tool-card-disabled' : ''}"
                     data-tool-id="${id}"
                     data-requires-token="${tool.requiresToken || false}">
                    <div class="tool-card-icon">${tool.icon || '🔧'}</div>
                    <div class="tool-card-name">${tool.name}</div>
                    <div class="tool-card-desc">${tool.desc || ''}</div>
                </div>
            `;
        }).join('');

        this.container.innerHTML = `
            <div class="home-container">
                <div class="home-header">
                    <h1 class="home-title">DQXツールラボ</h1>
                    <div class="home-header-actions">
                        <button id="open-manage-link" class="manage-btn">カード編集</button>
                        <button id="global-dark-toggle" class="dark-toggle-btn">${this.darkMode ? '☀️' : '🌙'}</button>
                        <div id="dqx-net-status" class="dqx-net-dot dqx-net-checking" aria-label="バージョン状態">⏳</div>
                        <div id="dqx-net-popover"></div>
                    </div>
                </div>
                <div class="home-grid">
                    ${cardButtons}
                </div>
                <div class="home-footer">
                    <div class="footer-row">
                        <a href="#" id="footer-install-link" class="footer-install-link">📲 アプリとして使う方法</a>
                        <button id="footer-reload-btn" class="footer-reload-btn" type="button" title="設定の最新版を確認して更新">↻</button>
                    </div>
                    <div class="footer-copyright">© 2026 yuffy_rre</div>
                </div>
            </div>`;

        document.getElementById('global-dark-toggle').onclick = () => this.toggleDarkMode();

        // ネットインジケーター
        const netDot     = document.getElementById('dqx-net-status');
        const netPopover = document.getElementById('dqx-net-popover');
        if (netDot && netPopover) {
            if (window.dqxUpdateNetIndicator) window.dqxUpdateNetIndicator();
            netDot.onclick = (e) => {
                e.stopPropagation();
                netPopover.classList.toggle('show');
            };
            if (this._netPopoverAbort) this._netPopoverAbort.abort();
            this._netPopoverAbort = new AbortController();
            document.addEventListener('click', (e) => {
                if (!netDot.contains(e.target) && !netPopover.contains(e.target)) {
                    netPopover.classList.remove('show');
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

        const homeGrid = this.container.querySelector('.home-grid');
        if (homeGrid && typeof Sortable !== 'undefined') {
            if (this.sortableInstance) this.sortableInstance.destroy();
            this.sortableInstance = new Sortable(homeGrid, {
                animation: 150,
                onEnd: () => {
                    const newOrder = [...homeGrid.children].map((card) => card.dataset.toolId);
                    localStorage.setItem('dqx_card_order', JSON.stringify(newOrder));
                }
            });
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
        dialog.innerHTML = `
            <h3 style="margin:0 0 12px;color:#0066cc;">🔑 開発者認証</h3>
            <p style="font-size:13px;color:#555;margin:0 0 12px;">GitHub APIトークンを入力してください（開発者専用）</p>
            <input id="dqx-token-input" type="password"
                style="width:100%;padding:10px;border:1px solid #ccc;border-radius:8px;font-size:14px;box-sizing:border-box;"
                placeholder="ghp_...">
            <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end;">
                <button id="dqx-token-cancel"
                    style="padding:8px 16px;border:1px solid #ccc;border-radius:8px;background:#fff;cursor:pointer;">キャンセル</button>
                <button id="dqx-token-ok"
                    style="padding:8px 16px;background:#0066cc;color:#fff;border:none;border-radius:8px;cursor:pointer;">確認</button>
            </div>
        `;
        modal.appendChild(dialog);
        document.body.appendChild(modal);

        const input    = dialog.querySelector('#dqx-token-input');
        const cancelBtn = dialog.querySelector('#dqx-token-cancel');
        const okBtn    = dialog.querySelector('#dqx-token-ok');

        const close = () => modal.remove();
        cancelBtn.onclick = close;
        okBtn.onclick = () => {
            const token = input.value.trim();
            if (token && token.length >= 40) {
                sessionStorage.setItem('dqx_test_token', token);
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
        dialog.innerHTML = `
            <h3>カード編集</h3>
            <p>ホームに表示するツールの表示/非表示を切り替えます。変更は即時保存されます。</p>
            <div id="manage-list" class="manage-list"></div>
            <div class="manage-actions">
                <button id="manage-save" class="manage-save-btn" type="button">閉じる</button>
            </div>
        `;
        modal.appendChild(dialog);
        document.body.appendChild(modal);

        const listContainer = dialog.querySelector('#manage-list');

        const loadVisible = () => {
            const stored = localStorage.getItem('dqx_visible_tools');
            try { return stored ? JSON.parse(stored) : null; } catch (e) { return null; }
        };
        let visible = loadVisible();
        const allIds = Object.keys(this.tools).sort();

        const renderList = () => {
            listContainer.innerHTML = '';
            allIds.forEach((id) => {
                const row = document.createElement('div');
                row.className = 'manage-row';

                const chk = document.createElement('input');
                chk.type    = 'checkbox';
                chk.checked = visible ? visible.includes(id) : true;

                const label = document.createElement('div');
                label.className = 'manage-label';
                label.textContent = id + (this.tools[id] ? ` — ${this.tools[id].name}` : '');

                chk.onchange = () => {
                    if (chk.checked) {
                        if (!visible) visible = allIds.slice();
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
                        visible = (visible || allIds.slice()).filter((x) => x !== id);
                    }
                    if (visible && visible.length === allIds.length) {
                        localStorage.removeItem('dqx_visible_tools');
                    } else {
                        localStorage.setItem('dqx_visible_tools', JSON.stringify(visible || []));
                    }
                };

                row.appendChild(chk);
                row.appendChild(label);
                listContainer.appendChild(row);
            });
        };

        renderList();
        dialog.querySelector('#manage-save').onclick = () => {
            modal.remove();
            this.showLauncher();
        };
    },

    renderToolMenu: function() {
        const isMobile = this.isMobile();

        const menuEntries  = Object.entries(this.tools).filter(([, tool]) => !tool.hideInMenu);
        const menuButtons  = menuEntries.map(([id, tool]) => `
            <button class="tool-menu-btn ${this.currentTool === id ? 'active' : ''}" data-tool-id="${id}">
                ${tool.icon || '🔧'}<span class="menu-btn-label">${tool.name}</span>
            </button>
        `).join('');

        document.getElementById('tool-menu-bar')?.remove();
        document.getElementById('sidebar-float-toggle')?.remove();

        const menuBar  = document.createElement('div');
        menuBar.id     = 'tool-menu-bar';

        if (isMobile) {
            menuBar.className = 'tool-menu-bottom';
            menuBar.innerHTML = `
                <div class="tool-menu-scroll">${menuButtons}</div>
                <div class="tool-menu-fixed">
                    <button class="tool-menu-btn home-btn" data-action="home">🏠<span class="menu-btn-label">ホーム</span></button>
                    <button class="tool-menu-btn dark-mode-btn" data-action="dark">
                        ${this.darkMode ? '☀️' : '🌙'}<span class="menu-btn-label">${this.darkMode ? 'ライト' : 'ダーク'}</span>
                    </button>
                </div>
            `;
            document.body.appendChild(menuBar);
            menuBar.querySelector('[data-action="home"]').onclick  = () => this.goHome();
            menuBar.querySelector('[data-action="dark"]').onclick  = () => this.toggleDarkMode();
            menuBar.querySelectorAll('.tool-menu-scroll .tool-menu-btn').forEach((btn) => {
                btn.onclick = () => {
                    const toolId = btn.dataset.toolId;
                    if (toolId && this.currentTool !== toolId) this.loadTool(toolId);
                };
            });
        } else {
            const isHidden     = !this.sidebarVisible;
            menuBar.className  = 'tool-menu-sidebar';
            menuBar.style.display = isHidden ? 'none' : '';
            menuBar.innerHTML  = `
                <div class="tool-menu-sidebar-scroll">${menuButtons}</div>
                <div class="tool-menu-sidebar-fixed">
                    <button class="tool-menu-btn sidebar-toggle-btn" data-action="toggle-sidebar">◀<span class="menu-btn-label">閉じる</span></button>
                    <button class="tool-menu-btn home-btn" data-action="home">🏠<span class="menu-btn-label">ホーム</span></button>
                    <button class="tool-menu-btn dark-mode-btn" data-action="dark">
                        ${this.darkMode ? '☀️' : '🌙'}<span class="menu-btn-label">${this.darkMode ? 'ライト' : 'ダーク'}</span>
                    </button>
                </div>
            `;
            document.body.appendChild(menuBar);
            menuBar.querySelector('[data-action="toggle-sidebar"]').onclick = () => this.toggleSidebar();
            menuBar.querySelector('[data-action="home"]').onclick           = () => this.goHome();
            menuBar.querySelector('[data-action="dark"]').onclick           = () => this.toggleDarkMode();
            menuBar.querySelectorAll('.tool-menu-sidebar-scroll .tool-menu-btn').forEach((btn) => {
                btn.onclick = () => {
                    const toolId = btn.dataset.toolId;
                    if (toolId && this.currentTool !== toolId) this.loadTool(toolId);
                };
            });

            if (isHidden) {
                const floatBtn       = document.createElement('button');
                floatBtn.id          = 'sidebar-float-toggle';
                floatBtn.className   = 'sidebar-float-btn';
                floatBtn.textContent = '▶';
                floatBtn.title       = 'ツールバーを表示';
                floatBtn.style.display = 'flex';
                floatBtn.onclick     = () => this.toggleSidebar();
                document.body.appendChild(floatBtn);
            }
        }

        this.updateContainerPadding();
    },

    updateContainerPadding: function() {
        const toolContainer = document.getElementById('dqx-tool-container');
        if (!toolContainer) return;
        if (this.isMobile()) {
            toolContainer.style.paddingBottom = '70px';
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
            sessionStorage.removeItem('dqx_test_token');
            this.goHome();
            return false;
        }
    },

    loadTool: async function(toolId) {
        const tool = this.tools[toolId];
        if (!tool || this.currentTool === toolId) return;

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
            this.removeOldToolScripts(tool.url);
            await this.loadScript(tool.url, tool.renderFn);

            const fn = tool.renderFn
                .split('.')
                .reduce((obj, key) => obj && obj[key], window);

            loadingDiv.remove();

            if (typeof fn === 'function') {
                this.container.innerHTML = '';
                const newToolContainer   = document.createElement('div');
                newToolContainer.id      = 'dqx-tool-container';
                this.container.appendChild(newToolContainer);
                fn('#dqx-tool-container');
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

    removeOldToolScripts: function(url) {
        const cacheBustUrl = url + '?v=' + encodeURIComponent(APP_VERSION);
        document.querySelectorAll(`script[src="${cacheBustUrl}"]`).forEach((s) => s.remove());
        document.querySelectorAll(`script[src="${url}"]`).forEach((s) => s.remove());
    },

    removeTestToolScripts: function() {
        document.querySelectorAll('script[data-test-tool]').forEach((s) => s.remove());
    },

    loadScript: function(url, renderFn) {
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

        const cacheBustUrl = url + '?v=' + encodeURIComponent(APP_VERSION);
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
