// ========== 設定ツール（ダークモード対応版） ==========
(function(global) {
    const Settings = {
        render: function(containerSelector) {
            const container = document.querySelector(containerSelector);
            if (!container) return;

            container.innerHTML = `
                <div class="settings-container">
                    <h2>⚙️ 設定</h2>
                    
                    <div class="settings-card">
                        <h3>🗑️ データ管理</h3>
                        <div class="button-group">
                            <button id="clearAllCache" class="btn-danger">全キャッシュを削除</button>
                            <button id="clearCheckerCache" class="btn-warning">チェックデータ削除</button>
                            <button id="clearTestToken" class="btn-info">認証トークン削除</button>
                        </div>
                        <p class="settings-note">
                            ※ 削除すると復元できません。呪文書き出しでバックアップすることをおすすめします。
                        </p>
                    </div>

                    <div class="settings-card">
                        <h3>📡 オフライン対応</h3>
                        <div id="pwaStatusInfo"></div>
                        <div class="button-group" style="margin-top: 12px;">
                            <button id="forceUpdateApp" class="btn-info">最新版を確認して更新</button>
                        </div>
                        <p class="settings-note">
                            ※ このツールはオフラインでも起動できます。起動時に自動でオンラインの最新情報を確認しますが、確認できない場合は保存済みのデータで起動します。
                        </p>
                    </div>

                    <div class="settings-card">
                        <h3>📲 アプリとして追加</h3>
                        <div id="pwaInstallInfo"></div>
                        <div class="button-group" id="pwaInstallButtonWrap" style="margin-top: 12px; display:none;">
                            <button id="pwaInstallBtn" class="btn-info">ホーム画面に追加</button>
                        </div>
                    </div>

                    <div class="settings-card">
                        <h3>📦 ストレージ状況</h3>
                        <div id="storageInfo"></div>
                    </div>

                    <div class="feedback-card">
                        <h3>📢 フィードバックはこちら</h3>
                        <div class="link-buttons">
                            <a href="https://github.com/yuffy-1111/dqx-event-data/issues" target="_blank" class="github-link">
                                🐙 GitHub Issues
                            </a>
                            <a href="https://x.com/yuffy_rre_dqx" target="_blank" class="x-link">
                                𝕏 @yuffy_rre_dqx
                            </a>
                        </div>
                    </div>

                    <div class="settings-card">
                        <h3>ℹ️ このツールについて</h3>
                        <p>DQXツールセット - 製作:yuffy_rre</p>
                        <p>バージョン: ${window.LAUNCHER_VERSION || '2.3.4'}</p>
                    </div>
                </div>
            `;

            // スタイル
            const style = document.createElement('style');
            style.textContent = `
                .settings-container {
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .settings-container h2 {
                    margin: 0 0 20px 0;
                    color: #0066cc;
                }
                .settings-card {
                    background: #f5f5f5;
                    border-radius: 12px;
                    padding: 16px;
                    margin: 20px 0;
                    border: 1px solid #e0e0e0;
                }
                .feedback-card {
                    background: #f5f5f5;
                    border-radius: 12px;
                    padding: 16px;
                    margin: 20px 0;
                    border: 1px solid #e0e0e0;
                    text-align: center;
                }
                .settings-card h3, .feedback-card h3 {
                    margin: 0 0 12px 0;
                    color: #333;
                }
                .button-group {
                    display: flex;
                    gap: 12px;
                    flex-wrap: wrap;
                    margin-bottom: 12px;
                }
                .btn-danger {
                    background: #dc3545;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 8px;
                    cursor: pointer;
                }
                .btn-warning {
                    background: #ffc107;
                    color: #333;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 8px;
                    cursor: pointer;
                }
                .btn-info {
                    background: #17a2b8;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 8px;
                    cursor: pointer;
                }
                .settings-note {
                    font-size: 12px;
                    color: #666;
                    margin-top: 10px;
                }
                #storageInfo p {
                    margin: 8px 0;
                    font-size: 14px;
                }
                .link-buttons {
                    display: flex;
                    gap: 16px;
                    justify-content: center;
                    flex-wrap: wrap;
                }
                .github-link {
                    display: inline-block;
                    padding: 10px 20px;
                    background: #24292f;
                    color: white;
                    text-decoration: none;
                    border-radius: 30px;
                    font-size: 14px;
                }
                .github-link:hover {
                    background: #3b444f;
                }
                .x-link {
                    display: inline-block;
                    padding: 10px 20px;
                    background: #000000;
                    color: white;
                    text-decoration: none;
                    border-radius: 30px;
                    font-size: 14px;
                }
                .x-link:hover {
                    background: #333333;
                }
                body.dark-mode .settings-container h2 {
                    color: #60a5fa;
                }
                body.dark-mode .settings-card {
                    background: #1e293b;
                    border-color: #334155;
                }
                body.dark-mode .feedback-card {
                    background: #1e293b;
                    border-color: #334155;
                }
                body.dark-mode .settings-card h3 {
                    color: #e2e8f0;
                }
                body.dark-mode .feedback-card h3 {
                    color: #e2e8f0;
                }
                body.dark-mode .settings-card p {
                    color: #cbd5e1;
                }
                body.dark-mode .settings-note {
                    color: #94a3b8;
                }
                body.dark-mode .btn-warning {
                    background: #d97706;
                    color: white;
                }
                body.dark-mode .btn-info {
                    background: #0d8ba0;
                }
                body.dark-mode #storageInfo {
                    color: #cbd5e1;
                }
                body.dark-mode .github-link {
                    background: #4b5563;
                }
                body.dark-mode .github-link:hover {
                    background: #6b7280;
                }
                body.dark-mode .x-link {
                    background: #1e293b;
                }
                body.dark-mode .x-link:hover {
                    background: #334155;
                }
            `;
            container.appendChild(style);

            function updateStorageInfo() {
                let total = 0;
                let count = 0;
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('dqx_')) {
                        total += localStorage.getItem(key).length;
                        count++;
                    }
                }
                const infoDiv = document.getElementById('storageInfo');
                if (infoDiv) {
                    infoDiv.innerHTML = `
                        <p>📊 内部データ: ${count} 項目</p>
                        <p>💾 概算サイズ: ${Math.round(total / 1024)} KB</p>
                    `;
                }
            }

            // ----- PWA / オフライン対応状況の表示 -----
            async function updatePwaStatusInfo() {
                const statusDiv = document.getElementById('pwaStatusInfo');
                if (!statusDiv) return;

                const swSupported = 'serviceWorker' in navigator;
                const online = navigator.onLine;
                let swActive = false;
                let cachedFileCount = null;

                if (swSupported) {
                    try {
                        const reg = await navigator.serviceWorker.getRegistration();
                        swActive = !!(reg && reg.active);
                    } catch (e) { /* noop */ }

                    try {
                        if ('caches' in window) {
                            const keys = await caches.keys();
                            const dqxKey = keys.find(k => k.startsWith('dqx-tools-'));
                            if (dqxKey) {
                                const cache = await caches.open(dqxKey);
                                const reqs = await cache.keys();
                                cachedFileCount = reqs.length;
                            }
                        }
                    } catch (e) { /* noop */ }
                }

                statusDiv.innerHTML = `
                    <p>${online ? '🟢' : '🔴'} 現在の接続状態: ${online ? 'オンライン' : 'オフライン'}</p>
                    <p>${swActive ? '✅' : '⚠️'} オフライン起動: ${swActive ? '利用可能' : (swSupported ? '準備中／未対応ブラウザの可能性' : '非対応ブラウザ')}</p>
                    ${cachedFileCount !== null ? `<p>📁 保存済みファイル: ${cachedFileCount} 件</p>` : ''}
                `;
            }

            // ----- アプリとして追加（ホーム画面インストール） -----
            function detectEnvironment() {
                const ua = navigator.userAgent;
                const isIOS = /iPhone|iPad|iPod/.test(ua) && !window.MSStream;
                const isAndroid = /Android/.test(ua);
                const isFirefox = /Firefox/.test(ua) && !/Seamonkey/.test(ua);
                const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
                const isStandalone = window.matchMedia('(display-mode: standalone)').matches
                    || window.navigator.standalone === true;
                return { isIOS, isAndroid, isFirefox, isSafari, isStandalone };
            }

            let deferredInstallPrompt = null;
            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                deferredInstallPrompt = e;
                renderInstallUI();
            });
            window.addEventListener('appinstalled', () => {
                deferredInstallPrompt = null;
                renderInstallUI();
            });

            function renderInstallUI() {
                const infoDiv = document.getElementById('pwaInstallInfo');
                const btnWrap = document.getElementById('pwaInstallButtonWrap');
                const installBtn = document.getElementById('pwaInstallBtn');
                if (!infoDiv) return;

                const env = detectEnvironment();

                if (env.isStandalone) {
                    infoDiv.innerHTML = `<p>✅ すでにアプリとして起動しています。</p>`;
                    if (btnWrap) btnWrap.style.display = 'none';
                    return;
                }

                // Chrome/Edge/Android等：ブラウザ提供のインストールボタンが使える
                if (deferredInstallPrompt) {
                    infoDiv.innerHTML = `<p>このツールをホーム画面に追加すると、アプリのように起動できます。</p>`;
                    if (btnWrap) btnWrap.style.display = 'flex';
                    return;
                }

                if (btnWrap) btnWrap.style.display = 'none';

                // Firefox（PC・Android）：手動手順を案内
                if (env.isFirefox) {
                    infoDiv.innerHTML = `
                        <p>Firefoxでは以下の手順でホーム画面・アプリ一覧に追加できます。</p>
                        <p>① アドレスバー右側のメニュー（または ⋮ ）を開く</p>
                        <p>② 「ホーム画面に追加」または「インストール」を選択</p>
                        <p>③ 表示された名前のまま追加してください</p>
                    `;
                    return;
                }

                // iOS Safari：PWAインストールAPIが無いので専用案内
                if (env.isIOS && env.isSafari) {
                    infoDiv.innerHTML = `
                        <p>iPhone/iPadでは以下の手順でホーム画面に追加できます。</p>
                        <p>① 画面下部の「共有」ボタン（□に↑）をタップ</p>
                        <p>② 「ホーム画面に追加」をタップ</p>
                        <p>③ 右上の「追加」をタップ</p>
                    `;
                    return;
                }

                // それ以外（PC Safari等、判定できない場合）
                infoDiv.innerHTML = `
                    <p>お使いのブラウザのメニューから「ホーム画面に追加」または「インストール」を選択すると、アプリのように起動できます。</p>
                `;
            }

            const installBtnEl = document.getElementById('pwaInstallBtn');
            if (installBtnEl) {
                installBtnEl.onclick = async () => {
                    if (!deferredInstallPrompt) return;
                    deferredInstallPrompt.prompt();
                    const choice = await deferredInstallPrompt.userChoice;
                    deferredInstallPrompt = null;
                    renderInstallUI();
                    if (choice.outcome === 'accepted') {
                        alert('✅ アプリとして追加しました');
                    }
                };
            }

            renderInstallUI();

            // ----- 最新版を確認して更新 -----
            const forceUpdateBtn = document.getElementById('forceUpdateApp');
            if (forceUpdateBtn) {
                forceUpdateBtn.onclick = async () => {
                    if (!navigator.onLine) {
                        alert('オフラインのため更新を確認できません。オンライン環境で再度お試しください。');
                        return;
                    }
                    forceUpdateBtn.disabled = true;
                    forceUpdateBtn.textContent = '確認中…';
                    try {
                        if ('caches' in window) {
                            const keys = await caches.keys();
                            await Promise.all(
                                keys.filter(k => k.startsWith('dqx-tools-')).map(k => caches.delete(k))
                            );
                        }
                        if ('serviceWorker' in navigator) {
                            const reg = await navigator.serviceWorker.getRegistration();
                            if (reg) await reg.update();
                        }
                        alert('✅ 最新の状態に更新しました。ページを再読み込みします。');
                        location.reload(true);
                    } catch (e) {
                        console.error(e);
                        forceUpdateBtn.disabled = false;
                        forceUpdateBtn.textContent = '最新版を確認して更新';
                        alert('更新中にエラーが発生しました。時間をおいて再度お試しください。');
                    }
                };
            }

            // 全キャッシュ削除
            const clearBtn = document.getElementById('clearAllCache');
            if (clearBtn) {
                clearBtn.onclick = () => {
                    if (confirm('すべてのデータを削除します。よろしいですか？')) {
                        const keysToRemove = [];
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            if (key && key.startsWith('dqx_')) {
                                keysToRemove.push(key);
                            }
                        }
                        keysToRemove.forEach(key => localStorage.removeItem(key));
                        updateStorageInfo();
                        alert(`✅ ${keysToRemove.length}個のデータを削除しました`);
                    }
                };
            }


            // チェッカーデータのみ削除
            const checkerBtn = document.getElementById('clearCheckerCache');
            if (checkerBtn) {
                checkerBtn.onclick = () => {
                    if (confirm('チェッカーのデータ（キャラクター、チェック状態、非表示設定）を削除します。よろしいですか？')) {
                        const keysToRemove = [];
                        for (let i = 0; i < localStorage.length; i++) {
                            const key = localStorage.key(i);
                            if (key && (key.startsWith('dqx_chars') || key.startsWith('dqx_check_') || key.startsWith('dqx_disabled_') || key.startsWith('dqx_hidden_'))) {
                                keysToRemove.push(key);
                            }
                        }
                        keysToRemove.forEach(key => localStorage.removeItem(key));
                        updateStorageInfo();
                        alert(`✅ ${keysToRemove.length}個のチェッカーデータを削除しました`);
                    }
                };
            }

            // テストツールトークン削除（追加）
            const tokenBtn = document.getElementById('clearTestToken');
            if (tokenBtn) {
                tokenBtn.onclick = () => {
                    if (confirm('テストツールの認証トークンを削除します。次回使用時に再入力が必要になります。')) {
                        localStorage.removeItem('dqx_test_token');
                        alert('✅ 認証トークンを削除しました');
                        updateStorageInfo();
                    }
                };
            }

            updateStorageInfo();
            updatePwaStatusInfo();
        },
        
        destroy: function() {}
    };

    global.Settings = Settings;
})(window);