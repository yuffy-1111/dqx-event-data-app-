// ========== アプリの使い方（ホーム画面インストール案内） ==========
(function(global) {
    const Install = {
        _deferredPrompt: null,
        _onBeforeInstall: null,
        _onAppInstalled: null,

        render: function(containerSelector) {
            const container = document.querySelector(containerSelector);
            if (!container) return;

            // スタイルを先に注入（DOM生成前）
            Install._injectStyle();

            container.innerHTML = `
                <div class="install-container">
                    <h2>📲 アプリとして使う</h2>
                    <p class="install-lead">
                        このツールは対応ブラウザでホーム画面に追加すると、アドレスバーのないアプリのような見た目で起動できます。
                        未対応のブラウザではブラウザ内のブックマークをご利用ください。
                    </p>

                    <div id="install-standalone-badge"></div>

                    <div class="install-tabs" role="tablist">
                        <button class="install-tab" data-target="tab-android">📱 Android</button>
                        <button class="install-tab" data-target="tab-ios">🍎 iPhone / iPad</button>
                        <button class="install-tab" data-target="tab-pc">💻 PC</button>
                    </div>

                    <div id="tab-android" class="install-panel">
                        <div id="install-android-chrome-action"></div>
                        <h3>Chrome（推奨）</h3>
                        <ol>
                            <li>右上の「⋮」メニューを開く</li>
                            <li>「アプリをインストール」または「ホーム画面に追加」をタップ</li>
                            <li>表示された名前のまま「インストール」をタップ</li>
                        </ol>
                        <p class="install-note-inline">Firefoxなど一部ブラウザではPWAとしてインストールできません。ブラウザ内のブックマークをご利用ください。</p>
                    </div>

                    <div id="tab-ios" class="install-panel">
                        <h3>Safari（iPhone標準ブラウザ）</h3>
                        <ol>
                            <li>画面下部の「共有」ボタン（□に↑のアイコン）をタップ</li>
                            <li>メニューを下にスクロールして「ホーム画面に追加」をタップ</li>
                            <li>右上の「追加」をタップ</li>
                        </ol>
                        <p class="install-note">
                            ※ iPhone/iPadではSafari以外のブラウザからはホーム画面追加できない場合があります。
                        </p>
                    </div>

                    <div id="tab-pc" class="install-panel">
                        <div id="install-pc-chrome-action"></div>
                        <h3>Chrome / Edge</h3>
                        <ol>
                            <li>アドレスバー右側のインストールアイコン（⊕のようなマーク）をクリック</li>
                            <li>表示されない場合は右上「⋮」→「アプリをインストール」</li>
                            <li>「インストール」をクリック</li>
                        </ol>
                        <p class="install-note-inline">未対応のブラウザではPWAインストールできません。ブラウザ内のブックマークをご利用ください。</p>
                        <div id="install-pc-download-area"></div>
                        <p class="install-note">
                            ※ ローカルファイルで開いた場合、Service Worker（オフラインキャッシュ）は動作しません。ファイルを直接開く形式での利用となります。
                        </p>
                    </div>

                    <div class="install-faq">
                        <h3>❓ よくある質問</h3>
                        <div class="qa-item">
                            <p class="qa-q">Q. インストールしないと使えない？</p>
                            <p class="qa-a">A. いいえ、ブラウザで開くだけでも通常通り使えます。インストールは任意の追加機能です。</p>
                        </div>
                        <div class="qa-item">
                            <p class="qa-q">Q. オフラインでも使えるの？</p>
                            <p class="qa-a">A. 一度オンラインで開いたことがあれば、その後はオフラインでも起動できます。API認証が必要なテストツールはオンライン時のみ利用できます。</p>
                        </div>
                        <div class="qa-item">
                            <p class="qa-q">Q. 削除したい場合は？</p>
                            <p class="qa-a">A. 通常のアプリと同じようにアイコンを長押しして削除できます。完全に消したい場合は設定の「全キャッシュを削除」もあわせてどうぞ。</p>
                        </div>
                    </div>
                </div>
            `;

            Install._bindTabs(container);
            Install._bindInstallButtons();
        },

        _bindTabs: function(container) {
            const tabs = container.querySelectorAll('.install-tab');
            const panels = container.querySelectorAll('.install-panel');

            // タブのクリックで切り替え
            tabs.forEach(tab => {
                tab.onclick = () => {
                    tabs.forEach(t => t.classList.remove('active'));
                    panels.forEach(p => {
                        p.classList.remove('active');
                        p.style.display = 'none';
                    });
                    tab.classList.add('active');
                    const target = document.getElementById(tab.dataset.target);
                    if (target) {
                        target.classList.add('active');
                        target.style.display = 'block';
                    }
                };
            });

            // 端末判定で初期タブを選択（click()ではなく直接状態を設定）
            const ua = navigator.userAgent;
            const isIOS = /iPhone|iPad|iPod/.test(ua) && !window.MSStream;
            const isAndroid = /Android/.test(ua);
            let initialTarget = 'tab-pc';
            if (isAndroid) initialTarget = 'tab-android';
            else if (isIOS) initialTarget = 'tab-ios';

            tabs.forEach(t => t.classList.remove('active'));
            panels.forEach(p => { p.classList.remove('active'); p.style.display = 'none'; });

            const activeTab = container.querySelector(`.install-tab[data-target="${initialTarget}"]`);
            const activePanel = document.getElementById(initialTarget);
            if (activeTab) activeTab.classList.add('active');
            if (activePanel) {
                activePanel.classList.add('active');
                activePanel.style.display = 'block';
            }
        },

        _bindInstallButtons: function() {
            const self = this;
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches
                || window.navigator.standalone === true;

            const badge = document.getElementById('install-standalone-badge');
            if (badge) {
                badge.innerHTML = isStandalone
                    ? `<p class="install-already">✅ 現在、アプリとして起動しています。</p>`
                    : '';
            }

            const renderActionButtons = () => {
                [['install-android-chrome-action', 'Android Chromeでインストール'],
                 ['install-pc-chrome-action', 'このブラウザでインストール']].forEach(([id, label]) => {
                    const el = document.getElementById(id);
                    if (!el) return;
                    if (self._deferredPrompt && !isStandalone) {
                        el.innerHTML = `<button class="install-action-btn">${label}</button>`;
                        el.querySelector('button').onclick = async () => {
                            if (!self._deferredPrompt) return;
                            self._deferredPrompt.prompt();
                            const choice = await self._deferredPrompt.userChoice;
                            self._deferredPrompt = null;
                            renderActionButtons();
                        };
                    } else {
                        el.innerHTML = '';
                    }
                });
            };

            Install._onBeforeInstall = (e) => {
                e.preventDefault();
                Install._deferredPrompt = e;
                renderActionButtons();
            };
            Install._onAppInstalled = () => {
                Install._deferredPrompt = null;
                renderActionButtons();
            };

            window.addEventListener('beforeinstallprompt', Install._onBeforeInstall);
            window.addEventListener('appinstalled', Install._onAppInstalled);

            renderActionButtons();

            const dlArea = document.getElementById('install-pc-download-area');
            if (dlArea) {
                dlArea.innerHTML = `
                    <div class="install-pc-download-links">
                        <p class="install-note-inline">現在のブラウザでこのPWAをインストールできます。上部の「インストール」ボタンが表示されたら、それをクリックしてください。</p>
                        <p class="install-note-inline">表示されない場合は、ブラウザメニューから「ホーム画面に追加」または「アプリをインストール」を選んでください。</p>
                    </div>
                `;
            }
        },

        _injectStyle: function() {
            if (document.getElementById('install-style')) return;
            const style = document.createElement('style');
            style.id = 'install-style';
            style.textContent = `
                .install-container {
                    max-width: 680px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .install-container h2 {
                    margin: 0 0 12px 0;
                    color: #0066cc;
                    border-bottom: 2px solid #0066cc;
                    padding-bottom: 8px;
                }
                .install-lead {
                    color: #555;
                    line-height: 1.6;
                    margin: 0 0 20px 0;
                }
                .install-already {
                    background: #e6f9ef;
                    color: #0a6e4f;
                    border-radius: 10px;
                    padding: 10px 14px;
                    margin: 0 0 16px 0;
                    font-size: 14px;
                }
                .install-tabs {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 16px;
                    flex-wrap: wrap;
                }
                .install-tab {
                    background: #f0f0f0;
                    border: none;
                    border-radius: 20px;
                    padding: 8px 18px;
                    font-size: 13px;
                    cursor: pointer;
                    color: #555;
                }
                .install-tab.active {
                    background: #0066cc;
                    color: white;
                }
                .install-panel {
                    display: none;
                    background: #f5f5f5;
                    border-radius: 12px;
                    padding: 16px 20px;
                }
                .install-panel.active {
                    display: block;
                }
                .install-panel h3 {
                    color: #0066cc;
                    margin: 16px 0 8px 0;
                }
                .install-panel h3:first-of-type {
                    margin-top: 0;
                }
                .install-panel ol {
                    margin: 0 0 12px 0;
                    padding-left: 20px;
                }
                .install-panel li {
                    margin: 6px 0;
                    line-height: 1.5;
                }
                .install-note {
                    font-size: 12px;
                    color: #888;
                    margin-top: 12px;
                }
                .install-note-inline { font-size: 13px; color: #555; margin: 0 0 8px 0; line-height: 1.5; }
                .install-panel code { background: #e8edf2; padding: 1px 5px; border-radius: 4px; font-size: 12px; }
                body.dark-mode .install-note-inline { color: #94a3b8; }
                body.dark-mode .install-panel code { background: #334155; color: #e2e8f0; }
                .install-action-btn {
                    background: #0066cc;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 24px;
                    cursor: pointer;
                    font-size: 13px;
                    margin-bottom: 12px;
                    display: block;
                }
                .install-action-btn:hover { background: #0052a3; }
                .install-faq { margin-top: 24px; }
                .install-faq h3 { color: #0066cc; }
                .qa-item { margin: 16px 0; }
                .qa-q { font-weight: bold; margin: 0 0 4px 0; color: #0066cc; }
                .qa-a { margin: 0; padding-left: 16px; border-left: 3px solid #0066cc; color: #444; line-height: 1.5; }
                /* ダークモード */
                body.dark-mode .install-container h2 { color: #60a5fa; border-bottom-color: #60a5fa; }
                body.dark-mode .install-lead { color: #94a3b8; }
                body.dark-mode .install-already { background: #0a3d2c; color: #6ee7b7; }
                body.dark-mode .install-tab { background: #1e293b; color: #94a3b8; }
                body.dark-mode .install-tab.active { background: #60a5fa; color: #0f172a; }
                body.dark-mode .install-panel { background: #1e293b; }
                body.dark-mode .install-panel h3 { color: #60a5fa; }
                body.dark-mode .install-panel li { color: #cbd5e1; }
                body.dark-mode .install-note { color: #94a3b8; }
                body.dark-mode .qa-q { color: #60a5fa; }
                body.dark-mode .qa-a { border-left-color: #60a5fa; color: #cbd5e1; }
            `;
            document.head.appendChild(style);
        },

        destroy: function() {
            if (Install._onBeforeInstall) {
                window.removeEventListener('beforeinstallprompt', Install._onBeforeInstall);
                Install._onBeforeInstall = null;
            }
            if (Install._onAppInstalled) {
                window.removeEventListener('appinstalled', Install._onAppInstalled);
                Install._onAppInstalled = null;
            }
        }
    };

    global.Install = Install;
})(window);
