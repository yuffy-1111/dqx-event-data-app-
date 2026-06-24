// ==========ツールランチャー（改造版）=========
// ========== バージョン管理 ==========
// APP_VERSION は形式に依存しない任意の文字列として扱います。
const APP_VERSION = '1.1.5β+';

// バージョン情報をグローバルに公開（HTML側と整合性チェック用）
window.LAUNCHER_VERSION = APP_VERSION;
// ランチャー読み込み完了を通知
window.dispatchEvent(new Event('launcher-ready'));

function checkVersionUpdate() {
    const storedVersion = localStorage.getItem('dqx_app_version');
    if (storedVersion !== APP_VERSION) {
        if (storedVersion) {
            // alert()はPWAスタンドアロン等でブロックされるためトースト通知を使用
            setTimeout(() => {
                if (typeof window.dqxShowToast === 'function') {
                    window.dqxShowToast(`アップデートされました！ ${storedVersion} → ${APP_VERSION}`, { variant: 'success', duration: 6000 });
                }
            }, 500);
        }
        // 初回起動時は通知不要（ようこそメッセージ廃止）
        localStorage.setItem('dqx_app_version', APP_VERSION);
    }
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

    isTabletLandscape: function() {
        return window.innerWidth > 768 && window.innerWidth < 1024 && window.innerHeight < window.innerWidth;
    },

    init: function(containerId) {
        checkVersionUpdate();
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('コンテナが見つかりません:', containerId);
            return;
        }

        // サイドバーの表示状態を復元（デフォルトは表示）
        const saved = localStorage.getItem('dqx_sidebar_visible');
        this.sidebarVisible = saved !== null ? saved !== 'false' : true;
        console.log(`[DQXTools] sidebar init: saved=${saved} sidebarVisible=${this.sidebarVisible}`);
        // body にクラスを付与して CSS で見た目を保持（リロード後の復元用）
        document.body.classList.toggle('sidebar-hidden', !this.sidebarVisible);

        // ========== Pull to Refresh（スワイプ引っ張り再読み込み）禁止 ==========
        let touchStartY = 0;
        document.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        }, { passive: false });
        document.addEventListener('touchmove', (e) => {
            const touchY = e.touches[0].clientY;
            if (touchY > touchStartY && window.scrollY === 0) {
                e.preventDefault();
            }
        }, { passive: false });

        // ========== ストレージキーのクリーンアップ ==========
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
        const allowedLocalStorageKeys = [
            'dqx_app_version',
            'dqx_card_order',
            'dqx_visible_tools',
            // 'dqx_test_token' は sessionStorage に移行済み（このリストから除外）
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
            // サイドバーの表示状態を保持するため許可
            'dqx_sidebar_visible',
            // 新規ツール追加検知のため許可
            'dqx_known_tool_ids',
            // リモート manifest のバージョンを保持
            'dqx_manifest_version'
        ];

        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (!key) continue;
            const isAllowed = allowedLocalStorageKeys.includes(key)
                || key.startsWith('dqx_check_final10_')
                || key.startsWith('dqx_limited_checks_v3_');
            if (!isAllowed) {
                try {
                    localStorage.removeItem(key);
                    console.log(`[Storage Cleanup] localStorage から削除: ${key}`);
                } catch (e) {
                    console.warn(`[Storage Cleanup] localStorage の削除に失敗: ${key}`, e);
                }
            }
        }

        const allowedSessionStorageKeys = ['dqx_reload_count', 'dqx_test_token'];
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
            const key = sessionStorage.key(i);
            if (!key) continue;
            if (!allowedSessionStorageKeys.includes(key)) {
                try {
                    sessionStorage.removeItem(key);
                    console.log(`[Storage Cleanup] sessionStorage から削除: ${key}`);
                } catch (e) {
                    console.warn(`[Storage Cleanup] sessionStorage の削除に失敗: ${key}`, e);
                }
            }
        }
    },

    applyDarkMode: function() {
        document.body.classList.toggle('dark-mode', this.darkMode);
        const btn = document.getElementById('global-dark-toggle');
        if (btn) {
            btn.textContent = this.darkMode ? '☀️' : '🌙';
        }
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
        // body クラスを更新して即座に見た目を反映
        document.body.classList.toggle('sidebar-hidden', !this.sidebarVisible);
        console.log(`[DQXTools] toggleSidebar -> sidebarVisible=${this.sidebarVisible}`);
        // ツールメニューを再描画
        if (this.currentTool !== null) {
            this.renderToolMenu();
        }
        this.updateContainerPadding();
    },

    showLauncher: function() {
        const savedOrder = localStorage.getItem('dqx_card_order');
        const order = savedOrder ? JSON.parse(savedOrder) : null;
        
        const hasValidToken = () => {
            const token = sessionStorage.getItem('dqx_test_token');
            return token && token.length >= 40;
        };
        
        // URLパラメータによるフィルタリング: ?show=ToolA,ToolB&includeTest=true
        // hideInMenu かつ testToolConfig を持たないツール（例：アプリの使い方）は
        // ホーム画面のカード一覧から除外する。テストツール（鍵アイコン付き）は
        // 従来通りカードとして表示する。
        let toolEntries = Object.entries(this.tools).filter(([id, tool]) => {
            return !(tool.hideInMenu && !tool.testToolConfig);
        });
        try {
            const params = new URLSearchParams(window.location.search);
            const showParam = params.get('show');
            const includeTest = params.get('includeTest') === 'true';
            if (showParam) {
                const wanted = showParam.split(',').map(s => s.trim()).filter(Boolean);
                toolEntries = toolEntries.filter(([id, tool]) => wanted.includes(id));
                console.log('[DQXTools] Filtered launcher view for (param):', wanted, 'includeTest=', includeTest);
            } else {
                // 保存された表示設定があれば優先して適用
                const stored = localStorage.getItem('dqx_visible_tools');
                if (stored) {
                    try {
                        const wanted = JSON.parse(stored);
                        if (Array.isArray(wanted) && wanted.length > 0) {
                            toolEntries = toolEntries.filter(([id]) => wanted.includes(id));
                            console.log('[DQXTools] Filtered launcher view for (stored):', wanted);
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
            const icon = tool.icon || '🔧';
            const name = tool.name;
            const desc = tool.desc || '';
            const isDisabled = tool.requiresToken && !isValidToken;
            const disabledClass = isDisabled ? 'tool-card-disabled' : '';
            
            return `
                <div class="tool-card ${disabledClass}" data-tool-id="${id}" data-requires-token="${tool.requiresToken || false}">
                    <div class="tool-card-icon">${icon}</div>
                    <div class="tool-card-name">${name}</div>
                    <div class="tool-card-desc">${desc}</div>
                </div>
            `;
        }).join('');

        this.container.innerHTML = `
            <div class="home-container">
                <div class="home-header">
                    <h1 class="home-title">🎮 DQXツール</h1>
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

        const toggleBtn = document.getElementById('global-dark-toggle');
        if (toggleBtn) {
            toggleBtn.onclick = () => this.toggleDarkMode();
        }

        // インジケーターの状態を即時反映＋ポップオーバーのクリック設定
        const netDot = document.getElementById('dqx-net-status');
        const netPopover = document.getElementById('dqx-net-popover');
        if (netDot && netPopover) {
            if (window.dqxUpdateNetIndicator) window.dqxUpdateNetIndicator();
            netDot.onclick = (e) => {
                e.stopPropagation();
                netPopover.classList.toggle('show');
            };
            // 前回のリスナーを破棄してから再登録（showLauncher再呼び出し時の多重登録防止）
            if (this._netPopoverAbort) this._netPopoverAbort.abort();
            this._netPopoverAbort = new AbortController();
            document.addEventListener('click', (e) => {
                if (!netDot.contains(e.target) && !netPopover.contains(e.target)) {
                    netPopover.classList.remove('show');
                }
            }, { signal: this._netPopoverAbort.signal });
        }

        const footerInstallLink = document.getElementById('footer-install-link');
        if (footerInstallLink) {
            footerInstallLink.onclick = (e) => {
                e.preventDefault();
                // クリック時点でtools['install']を参照（登録タイミングに依存しない）
                if (this.tools && this.tools['install']) {
                    this.loadTool('install');
                } else {
                    // まだ登録されていない場合はマニフェスト取得完了後にリトライ
                    const tryLoad = () => {
                        if (this.tools && this.tools['install']) {
                            this.loadTool('install');
                        }
                    };
                    if (window.DQX_MANIFEST_FETCH_PROMISE) {
                        window.DQX_MANIFEST_FETCH_PROMISE.then(tryLoad);
                    }
                }
            };
        }

        const footerReloadBtn = document.getElementById('footer-reload-btn');
        if (footerReloadBtn) {
            footerReloadBtn.onclick = async (e) => {
                e.preventDefault();
                if (!navigator.onLine) {
                    window.dqxShowToast('オフラインのため更新を確認できません。オンライン環境で再度お試しください。');
                    return;
                }
                if (typeof window.dqxCheckVersion !== 'function') {
                    window.location.reload(true);
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
        }

        document.querySelectorAll('.tool-card').forEach(card => {
            card.onclick = () => {
                const toolId = card.dataset.toolId;
                const requiresToken = card.dataset.requiresToken === 'true';
                const isValidTokenNow = hasValidToken();
                
                if (requiresToken && !isValidTokenNow) {
                    const token = prompt('GitHub APIトークンを入力してください（開発者専用）');
                    if (token && token.length >= 40) {
                        sessionStorage.setItem('dqx_test_token', token);
                        this.showLauncher();
                    }
                    return;
                }
                this.loadTool(toolId);
            };
        });

        // 個別カードの別タブリンク機能は削除（手動URLまたは管理画面で制御してください）

        // フィルタ作成機能は廃止（表示管理のみで制御）

        // 表示管理ボタン
        const manageBtn = document.getElementById('open-manage-link');
        if (manageBtn) manageBtn.onclick = () => this.openManageDialog();
        
        const homeGrid = this.container.querySelector('.home-grid');
        if (homeGrid && typeof Sortable !== 'undefined') {
            if (this.sortableInstance) {
                this.sortableInstance.destroy();
            }
            this.sortableInstance = new Sortable(homeGrid, {
                animation: 150,
                onEnd: () => {
                    const newOrder = [...homeGrid.children].map(card => card.dataset.toolId);
                    localStorage.setItem('dqx_card_order', JSON.stringify(newOrder));
                }
            });
        }
    },

        openManageDialog: function() {
            // モーダル要素作成（簡素版：既存ツールの表示/非表示トグルのみ）
            const existing = document.getElementById('manage-modal');
            if (existing) return;

            const modal = document.createElement('div');
            modal.id = 'manage-modal';
            modal.className = 'manage-modal';

            const dialog = document.createElement('div');
            dialog.className = 'manage-dialog';
            dialog.innerHTML = `
                <h3>カード編集</h3>
                <p>ホームに表示するツールの表示/非表示を切り替えます。変更は即時保存されます。</p>
                <div id="manage-list" class="manage-list"></div>
                <div class="manage-actions"><button id="manage-save" class="manage-save-btn" type="button">閉じる</button></div>
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
                allIds.forEach(id => {
                    const row = document.createElement('div');
                    row.className = 'manage-row';
                    const chk = document.createElement('input');
                    chk.type = 'checkbox';
                    // デフォルトはチェックあり（表示）
                    chk.checked = visible ? visible.includes(id) : true;
                    const label = document.createElement('div');
                    label.className = 'manage-label';
                    label.textContent = id + (this.tools[id] ? ` — ${this.tools[id].name}` : '');
                    chk.onchange = () => {
                        if (!visible) visible = allIds.slice();
                        if (chk.checked) {
                            if (!visible.includes(id)) visible.push(id);
                        } else {
                            // 最後の1件は解除させない
                            const checkedCount = listContainer.querySelectorAll('input[type="checkbox"]:checked').length;
                            if (checkedCount === 0) {
                                chk.checked = true;
                                if (window.dqxShowToast) {
                                    window.dqxShowToast('最低1つのツールを表示する必要があります。', { duration: 3000 });
                                }
                                return;
                            }
                            visible = visible.filter(x => x !== id);
                        }
                        // 変更は即時保存
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
        console.log(`[DQXTools] renderToolMenu: sidebarVisible=${this.sidebarVisible} localStorage=${localStorage.getItem('dqx_sidebar_visible')}`);

        const menuEntries = Object.entries(this.tools).filter(([id, tool]) => !tool.hideInMenu);

        const menuButtons = menuEntries.map(([id, tool]) => {
            const icon = tool.icon || '🔧';
            const name = tool.name;
            const isActive = (this.currentTool === id);
            return `
                <button class="tool-menu-btn ${isActive ? 'active' : ''}" data-tool-id="${id}">
                    ${icon}<span class="menu-btn-label">${name}</span>
                </button>
            `;
        }).join('');

        const oldBar = document.getElementById('tool-menu-bar');
        if (oldBar) oldBar.remove();

        // フロートボタンを削除（再作成するため）
        const oldFloatBtn = document.getElementById('sidebar-float-toggle');
        if (oldFloatBtn) oldFloatBtn.remove();

        const menuBar = document.createElement('div');
        menuBar.id = 'tool-menu-bar';
        
        if (isMobile) {
            menuBar.className = 'tool-menu-bottom';
            menuBar.innerHTML = `
                <div class="tool-menu-scroll">
                    ${menuButtons}
                </div>
                <div class="tool-menu-fixed">
                    <button class="tool-menu-btn home-btn" data-action="home">🏠<span class="menu-btn-label">ホーム</span></button>
                    <button class="tool-menu-btn dark-mode-btn" data-action="dark">${this.darkMode ? '☀️' : '🌙'}<span class="menu-btn-label">${this.darkMode ? 'ライト' : 'ダーク'}</span></button>
                </div>
            `;
            
            document.body.appendChild(menuBar);
            
            const homeBtn = menuBar.querySelector('[data-action="home"]');
            if (homeBtn) homeBtn.onclick = () => this.goHome();
            
            const darkBtn = menuBar.querySelector('[data-action="dark"]');
            if (darkBtn) darkBtn.onclick = () => this.toggleDarkMode();
            
            menuBar.querySelectorAll('.tool-menu-scroll .tool-menu-btn').forEach(btn => {
                btn.onclick = () => {
                    const toolId = btn.dataset.toolId;
                    if (toolId && this.currentTool !== toolId) {
                        this.loadTool(toolId);
                    }
                };
            });
        } else {
            // PC／タブレット横向き
            const isHidden = !this.sidebarVisible;
            menuBar.className = 'tool-menu-sidebar';
            menuBar.style.display = isHidden ? 'none' : '';
            
            menuBar.innerHTML = `
                <div class="tool-menu-sidebar-scroll">
                    ${menuButtons}
                </div>
                <div class="tool-menu-sidebar-fixed">
                    <button class="tool-menu-btn sidebar-toggle-btn" data-action="toggle-sidebar">◀<span class="menu-btn-label">閉じる</span></button>
                    <button class="tool-menu-btn home-btn" data-action="home">🏠<span class="menu-btn-label">ホーム</span></button>
                    <button class="tool-menu-btn dark-mode-btn" data-action="dark">${this.darkMode ? '☀️' : '🌙'}<span class="menu-btn-label">${this.darkMode ? 'ライト' : 'ダーク'}</span></button>
                </div>
            `;
            
            document.body.appendChild(menuBar);
            
            const toggleBtn = menuBar.querySelector('[data-action="toggle-sidebar"]');
            if (toggleBtn) toggleBtn.onclick = () => this.toggleSidebar();
            
            const homeBtn = menuBar.querySelector('[data-action="home"]');
            if (homeBtn) homeBtn.onclick = () => this.goHome();
            
            const darkBtn = menuBar.querySelector('[data-action="dark"]');
            if (darkBtn) darkBtn.onclick = () => this.toggleDarkMode();
            
            menuBar.querySelectorAll('.tool-menu-sidebar-scroll .tool-menu-btn').forEach(btn => {
                btn.onclick = () => {
                    const toolId = btn.dataset.toolId;
                    if (toolId && this.currentTool !== toolId) {
                        this.loadTool(toolId);
                    }
                };
            });

            // 格納状態に応じてフロートボタンを表示
            if (isHidden) {
                const floatBtn = document.createElement('button');
                floatBtn.id = 'sidebar-float-toggle';
                floatBtn.className = 'sidebar-float-btn';
                floatBtn.textContent = '▶';
                floatBtn.title = 'ツールバーを表示';
                // 強制的に表示させる（CSS で非表示になっている環境対策）
                floatBtn.style.display = 'flex';
                floatBtn.onclick = () => this.toggleSidebar();
                document.body.appendChild(floatBtn);
            }
        }
        
        this.updateContainerPadding();
    },

    updateContainerPadding: function() {
        const isMobile = this.isMobile();
        const toolContainer = document.getElementById('dqx-tool-container');
        if (!toolContainer) return;

        if (isMobile) {
            toolContainer.style.paddingBottom = '70px';
            toolContainer.style.paddingRight = '0';
        } else {
            const isHidden = !this.sidebarVisible;
            toolContainer.style.paddingBottom = '0';
            toolContainer.style.paddingRight = isHidden ? '0' : '80px';
        }
    },

    loadTestTool: async function(toolId, tool) {
        // HTMLとランチャーのバージョン整合性チェック（テストツール読み込み前）
        if (typeof window.HTML_VERSION !== 'undefined' && window.HTML_VERSION !== APP_VERSION) {
            const reloadKey = window.RELOAD_KEY || 'dqx_reload_count';
            const maxReload = window.MAX_RELOAD || 2;
            const reloadCount = parseInt(sessionStorage.getItem(reloadKey)) || 0;
            if (reloadCount < maxReload) {
                sessionStorage.setItem(reloadKey, reloadCount + 1);
                window.dqxShowToast(`バージョン不一致が検出されました。再読み込みします。（${reloadCount + 1}/${maxReload}）`, { duration: 2500 });
                setTimeout(() => location.reload(true), 2600);
                return false;
            } else {
                sessionStorage.removeItem(reloadKey);
                window.dqxShowToast('バージョン不一致ですが再読み込み上限に達したため続行します。ページを手動で再読み込みしてください。', { duration: 8000 });
            }
        }
        const config = tool.testToolConfig;
        if (!config) return false;
        
        // トークンはセッション中のみ保持（sessionStorage）
        let token = sessionStorage.getItem('dqx_test_token');
        if (!token) {
            token = prompt(`🔑 ${tool.name}を使用するためのGitHub APIトークンを入力してください（開発者専用）`);
            if (!token) return false;
            sessionStorage.setItem('dqx_test_token', token);
        }
        
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'dqx-loading-test';
        loadingDiv.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.0);z-index:10001;';
        document.body.appendChild(loadingDiv);
        
        try {
            const res = await fetch(`https://api.github.com/repos/rre1111/dqx-private-api/contents/${config.filename}`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3.raw'
                }
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const code = await res.text();
            
            const script = document.createElement('script');
            script.dataset.testTool = config.filename;
            script.textContent = code;
            document.head.appendChild(script);
            
            loadingDiv.remove();
            
            if (typeof window[config.globalName] !== 'undefined' && typeof window[config.globalName].render === 'function') {
                this.container.innerHTML = '';
                const newContainer = document.createElement('div');
                newContainer.id = 'dqx-tool-container';
                this.container.appendChild(newContainer);
                window[config.globalName].render('#dqx-tool-container');
                this.currentTool = toolId;
                this.renderToolMenu();
                return true;
            } else {
                throw new Error('ツール読み込み失敗');
            }
        } catch(e) {
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
        if (!tool) return;
        if (this.currentTool === toolId) return;

        // ツール遷移時にバージョン確認（結果はインジケーターに反映）
        if (window.dqxCheckVersion) window.dqxCheckVersion();

        if (tool.hideInMenu && tool.testToolConfig) {
            this.destroyCurrentTool();
            const oldContainer = document.getElementById('dqx-tool-container');
            if (oldContainer) oldContainer.remove();
            await this.loadTestTool(toolId, tool);
            return;
        }

        this.destroyCurrentTool();

        const oldContainer = document.getElementById('dqx-tool-container');
        if (oldContainer) oldContainer.remove();

        const toolContainer = document.createElement('div');
        toolContainer.id = 'dqx-tool-container';
        this.container.appendChild(toolContainer);

        // 読み込み時の画像とテキスト表示は廃止（画像データは残す）
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'dqx-loading';
        loadingDiv.style.cssText = `
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.0);
            z-index: 20000;
        `;
        // 画像と説明文は表示しないため innerHTML は空にする
        document.body.appendChild(loadingDiv);

        try {
            this.removeOldToolScripts(tool.url);
            await this.loadScript(tool.url);

            const fn = tool.renderFn
                .split('.')
                .reduce((obj, key) => obj && obj[key], window);

            // 即時にローディングを消す（任意の遅延は廃止）
            loadingDiv.remove();

            if (typeof fn === 'function') {
                this.container.innerHTML = '';
                const newToolContainer = document.createElement('div');
                newToolContainer.id = 'dqx-tool-container';
                this.container.appendChild(newToolContainer);

                fn('#dqx-tool-container');
                this.currentTool = toolId;
                this.renderToolMenu();
                if (typeof window.dqxCheckVersion === 'function') {
                    window.dqxCheckVersion();
                }
            } else {
                toolContainer.innerHTML = '<div style="color: red; text-align: center; padding: 40px;">エラー: ツールの読み込みに失敗しました</div>';
                this.goHome();
            }
        } catch(e) {
            loadingDiv.remove();
            console.error('ツール読み込みエラー:', e);
            toolContainer.innerHTML = '<div style="color: red; text-align: center; padding: 40px;">エラー: ツールの読み込みに失敗しました</div>';
            this.goHome();
        }
    },

    goHome: function() {
        this.destroyCurrentTool();

        const menuBar = document.getElementById('tool-menu-bar');
        if (menuBar) menuBar.remove();

        const floatBtn = document.getElementById('sidebar-float-toggle');
        if (floatBtn) floatBtn.remove();

        const oldContainer = document.getElementById('dqx-tool-container');
        if (oldContainer) oldContainer.remove();

        const newContainer = document.createElement('div');
        newContainer.id = 'dqx-tool-container';
        this.container.appendChild(newContainer);

        this.removeTestToolScripts();

        this.currentTool = null;
        this.showLauncher();
    },

    destroyCurrentTool: function() {
        if (this.currentTool) {
            const tool = this.tools[this.currentTool];
            if (tool) {
                if (tool.testToolConfig) {
                    const testGlobalName = tool.testToolConfig.globalName;
                    if (window[testGlobalName] && typeof window[testGlobalName].destroy === 'function') {
                        window[testGlobalName].destroy();
                    }
                } else if (tool.renderFn) {
                    const globalName = tool.renderFn.split('.')[0];
                    if (window[globalName] && typeof window[globalName].destroy === 'function') {
                        window[globalName].destroy();
                    }
                }
            }
        }

        this.removeTestToolScripts();

        const possibleGlobalNames = ['DQtool', 'DQtool2', 'DQtool3', 'Tool4'];
        possibleGlobalNames.forEach(globalName => {
            if (window[globalName] && typeof window[globalName].destroy === 'function') {
                window[globalName].destroy();
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
        const floatBtn = document.getElementById('sidebar-float-toggle');
        if (floatBtn) floatBtn.remove();
    },

    removeOldToolScripts: function(url) {
        const cacheBustUrl = url + '?v=' + encodeURIComponent(APP_VERSION);
        const rawUrl = url;

        document.querySelectorAll(`script[src="${cacheBustUrl}"]`).forEach(script => script.remove());
        document.querySelectorAll(`script[src="${rawUrl}"]`).forEach(script => script.remove());
    },

    removeTestToolScripts: function() {
        document.querySelectorAll('script[data-test-tool]').forEach(script => script.remove());
    },

    loadScript: function(url) {
        // HTML側のバージョンが存在する場合、起動中のランチャー版と一致するか確認
        if (typeof window.HTML_VERSION !== 'undefined' && window.HTML_VERSION !== APP_VERSION) {
            const reloadKey = window.RELOAD_KEY || 'dqx_reload_count';
            const maxReload = window.MAX_RELOAD || 2;
            const reloadCount = parseInt(sessionStorage.getItem(reloadKey)) || 0;
            if (reloadCount < maxReload) {
                sessionStorage.setItem(reloadKey, reloadCount + 1);
                window.dqxShowToast(`バージョン不一致が検出されました。再読み込みします。（${reloadCount + 1}/${maxReload}）`, { duration: 2500 });
                setTimeout(() => location.reload(true), 2600);
                return new Promise(() => {}); // ページ再読み込みするので永続的に待つ
            } else {
                sessionStorage.removeItem(reloadKey);
                window.dqxShowToast('バージョン不一致ですが再読み込み上限に達したため続行します。ページを手動で再読み込みしてください。', { duration: 8000 });
            }
        }

        const cacheBustUrl = url + '?v=' + encodeURIComponent(APP_VERSION);
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${cacheBustUrl}"]`);
            if (existing) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = cacheBustUrl;
            script.onload  = () => resolve();
            script.onerror = () => reject(new Error(`Script load failed: ${url}`));
            document.head.appendChild(script);
        });
    }
};

if (typeof window.DQXTools === 'undefined') {
    window.DQXTools = DQXTools;
}
