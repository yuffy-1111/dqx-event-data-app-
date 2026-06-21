// ========== 傭兵ツール バージョンセレクタ（PC:小窓 / スマホ:画面置き換え） ==========
(function(global) {
    const VERSIONS = [
        { version: 'v1.5.5', date: '2026-05-12', url: './old_tools/ver155.html', desc: 'はてなブログ版' },
        { version: 'v1.4.5', date: '2026-04-xx', url: './old_tools/ver145.html', desc: '' },
        { version: 'v1.4.1', date: '2026-04-xx', url: './old_tools/ver141.html', desc: 'ｳｪﾌﾞﾌｯｸ版(連携撤廃)' },
        { version: 'v1.3.0', date: '2026-03-xx', url: './old_tools/ver130.html', desc: '' },
        { version: 'v1.2.6', date: '2026-03-xx', url: './old_tools/ver126.html', desc: 'Blue Edition' },
        { version: 'v1.1.7', date: '2026-02-xx', url: './old_tools/ver117.html', desc: '' }
    ];

    let currentIframe = null;
    let isPreviewMode = false;
    let selectedUrl = '';
    let currentContainerSelector = '';

    // ★ destroy（先に定義）
    const destroy = function() {
        if (currentIframe) {
            currentIframe.remove();
            currentIframe = null;
        }
        isPreviewMode = false;
        selectedUrl = '';
    };

    // ★ スマホ用：プレビュー画面を表示（ツールバーは残る）
    const showMobilePreview = function(container, url, versionName) {
        container.innerHTML = `
            <div class="vs-mobile-preview" style="display: flex; flex-direction: column; height: calc(100vh - 140px);">
                <div style="display: flex; align-items: center; padding: 12px; background: #0066cc; color: white; gap: 12px; border-radius: 12px 12px 0 0;">
                    <button id="vs-back-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 6px 12px; border-radius: 20px; cursor: pointer;">← 戻る</button>
                    <span style="font-weight: bold;">${versionName}</span>
                </div>
                <div id="vs-preview-area" style="flex: 1; background: white; border-radius: 0 0 12px 12px; overflow: auto;"></div>
            </div>
        `;

        const previewArea = document.getElementById('vs-preview-area');
        if (previewArea) {
            if (currentIframe) currentIframe.remove();
            const iframe = document.createElement('iframe');
            iframe.src = url;
            iframe.sandbox = 'allow-same-origin allow-scripts';
            iframe.style.cssText = 'width:100%;height:100%;border:none;background:white;';
            previewArea.appendChild(iframe);
            currentIframe = iframe;
        }

        const backBtn = document.getElementById('vs-back-btn');
        if (backBtn) {
            backBtn.onclick = () => {
                if (currentIframe) {
                    currentIframe.remove();
                    currentIframe = null;
                }
                isPreviewMode = false;
                selectedUrl = '';
                render(currentContainerSelector);
            };
        }
    };

    // ★ PC用：小窓（モーダル風）で表示
    const showPcModal = function(url, versionName) {
        // 既存のモーダルを削除
        const oldModal = document.getElementById('vs-pc-modal');
        if (oldModal) oldModal.remove();

        const modal = document.createElement('div');
        modal.id = 'vs-pc-modal';
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 85%;
            max-width: 1000px;
            height: 80%;
            background: white;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3);
            z-index: 10000;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        `;
        modal.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #0066cc; color: white;">
                <span style="font-weight: bold;">📜 ${versionName}</span>
                <button id="vs-close-modal" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer;">✕</button>
            </div>
            <div id="vs-modal-preview" style="flex: 1; background: white;"></div>
        `;
        document.body.appendChild(modal);

        // 背面オーバーレイ
        const overlay = document.createElement('div');
        overlay.id = 'vs-modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5);
            z-index: 9999;
        `;
        overlay.onclick = () => {
            modal.remove();
            overlay.remove();
            if (currentIframe) {
                currentIframe.remove();
                currentIframe = null;
            }
        };
        document.body.appendChild(overlay);

        const previewArea = document.getElementById('vs-modal-preview');
        if (previewArea) {
            if (currentIframe) currentIframe.remove();
            const iframe = document.createElement('iframe');
            iframe.src = url;
            iframe.sandbox = 'allow-same-origin allow-scripts';
            iframe.style.cssText = 'width:100%;height:100%;border:none;background:white;';
            previewArea.appendChild(iframe);
            currentIframe = iframe;
        }

        const closeBtn = document.getElementById('vs-close-modal');
        if (closeBtn) {
            closeBtn.onclick = () => {
                modal.remove();
                overlay.remove();
                if (currentIframe) {
                    currentIframe.remove();
                    currentIframe = null;
                }
            };
        }
    };

    const render = function(containerSelector) {
        currentContainerSelector = containerSelector;
        const container = document.querySelector(containerSelector);
        if (!container) return;

        // スマホでプレビューモード中なら表示を切り替え
        const isMobile = window.innerWidth <= 768;
        if (isMobile && isPreviewMode && selectedUrl) {
            const version = VERSIONS.find(v => v.url === selectedUrl);
            showMobilePreview(container, selectedUrl, version ? version.version : '旧バージョン');
            return;
        }

        // 通常の一覧表示（プレビューモード解除時もここに来る）
        isPreviewMode = false;
        selectedUrl = '';

        const versionRows = VERSIONS.map(v => `
            <div class="version-item" data-url="${v.url}" data-version="${v.version}">
                <div class="version-info">
                    <strong>${v.version}</strong>
                    ${v.desc ? `<span class="version-desc">${escapeHtml(v.desc)}</span>` : ''}
                    <div class="version-date">${v.date}</div>
                </div>
                <button class="preview-btn">▶ 開く</button>
            </div>
        `).join('');

        container.innerHTML = `
            <div class="vs-container">
                <div class="vs-header">
                    <h2>📜 傭兵ツール 過去バージョン</h2>
                    <p>バージョンを選択して開く（PC:小窓 / スマホ:画面切替）</p>
                </div>
                <div class="vs-list">
                    ${versionRows}
                </div>
            </div>
        `;

        // スタイル追加（一度だけ）
        if (!document.getElementById('vs-style-final')) {
            const style = document.createElement('style');
            style.id = 'vs-style-final';
            style.textContent = `
                .vs-container { max-width: 700px; margin: 0 auto; padding: 20px; }
                .vs-header { margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #0066cc; }
                .vs-header h2 { margin: 0 0 8px 0; }
                .vs-header p { margin: 0; font-size: 13px; color: #666; }
                .vs-list { display: flex; flex-direction: column; gap: 8px; }
                .version-item { display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #f9f9f9; border-radius: 12px; border: 1px solid #e0e0e0; cursor: pointer; transition: all 0.2s; }
                .version-item:hover { background: #f0f7ff; border-color: #0066cc; }
                .version-info { flex: 1; }
                .version-desc { font-size: 11px; color: #0066cc; margin-left: 8px; }
                .version-date { font-size: 11px; color: #888; margin-top: 4px; }
                .preview-btn { background: #0066cc; color: white; border: none; padding: 8px 20px; border-radius: 24px; cursor: pointer; font-size: 13px; }
                .preview-btn:hover { background: #0052a3; }
                /* ダークモード */
                body.dark-mode .vs-header p { color: #94a3b8; }
                body.dark-mode .version-item { background: #1e293b; border-color: #334155; }
                body.dark-mode .version-item:hover { background: #2d3a4e; border-color: #60a5fa; }
                body.dark-mode .version-date { color: #94a3b8; }
                body.dark-mode .version-desc { color: #60a5fa; }
                /* スマホ */
                @media (max-width: 768px) {
                    .vs-container { padding: 12px; }
                    .version-item { flex-direction: column; gap: 12px; text-align: center; }
                    .preview-btn { width: 100%; }
                }
            `;
            document.head.appendChild(style);
        }

        // イベント設定
        document.querySelectorAll('.version-item').forEach(item => {
            const url = item.dataset.url;
            const versionName = item.dataset.version;
            const btn = item.querySelector('.preview-btn');
            const isMobile = window.innerWidth <= 768;

            const openVersion = () => {
                if (isMobile) {
                    // スマホ：画面をプレビューに置き換え
                    selectedUrl = url;
                    isPreviewMode = true;
                    render(containerSelector);
                } else {
                    // PC：小窓モーダル
                    showPcModal(url, versionName);
                }
            };

            btn.onclick = (e) => {
                e.stopPropagation();
                openVersion();
            };
            item.onclick = openVersion;
        });
    };

    const escapeHtml = function(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, m => {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    };

    global.VersionSelector = { render, destroy };
})(window);