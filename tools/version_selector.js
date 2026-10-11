// ========== 傭兵ツール バージョンセレクタ（PC:小窓 / スマホ:画面置き換え） ==========
// v3: type: 'html' | 'module' に対応。
//   - 'html'   : 完全独立HTML（旧はてなブログ形式）。iframe.src でそのまま読み込む。
//   - 'module' : tools/expmercenary.js 系のモジュールJS。
//                iframe.srcdoc に <script src="..."></script> を含む最小HTMLを直接生成して埋め込み、
//                iframe内で window[globalName].render(sel) を呼ぶ形式。
//                （旧 module_shell.html はクエリ引数 ?script= を外部から任意指定できてしまい、
//                  同一オリジン権限で任意スクリプトを実行される経路になり得たため廃止。
//                  srcdoc方式は外部から読み込み対象を差し替える余地がない）
//
// 今後バージョンが増えた場合の運用:
//   1. old_tools/ に該当バージョンの .js（モジュール形式）を置く
//      このとき、ファイル末尾のグローバル公開名（例: global.Expmercenary = {...}）を
//      他バージョンや現行版(window.Expmercenary)と重複しないよう
//      一意な名前（例: ExpmercenaryV250）に変更してから配置すること。
//   2. 下の VERSIONS 配列に { version, date, url, desc, type: 'module', globalName: '...' } を1行追加する
//   だけでよい。version_selector.js 本体の修正は不要。
(function(global) {
    const VERSIONS = [
        // ---- モジュールJS版（現行アーキテクチャ。今後もここに追記していく） ----
        { version: 'v2.5.0', date: '2026-07-11', url: './old_tools/ver250.js',  desc: '',                         type: 'module', globalName: 'ExpmercenaryV250' },
        { version: 'v2.4.0', date: '2026-07-09', url: './old_tools/ver240.js',  desc: '',                         type: 'module', globalName: 'ExpmercenaryV240' },
        { version: 'v2.3.0', date: '2026-06-28', url: './old_tools/ver230.js',  desc: '',                         type: 'module', globalName: 'ExpmercenaryV230' },
        { version: 'v2.1.0', date: '2026-06-19', url: './old_tools/ver210.js',  desc: '',                         type: 'module', globalName: 'ExpmercenaryV210' },
        { version: 'v1.5.5', date: '2026-05-xx', url: './old_tools/ver155b.js', desc: 'github移行版', type: 'module', globalName: 'ExpmercenaryV155' },

        // ---- 完全独立HTML版（はてなブログ実装時代のアーカイブ。凍結・修正対象外） ----
        { version: 'v1.5.5', date: '2026-05-12', url: './old_tools/ver155.html', desc: 'はてなブログ版',       type: 'html' },
        { version: 'v1.4.5', date: '2026-04-xx', url: './old_tools/ver145.html', desc: '',                     type: 'html' },
        { version: 'v1.4.1', date: '2026-04-xx', url: './old_tools/ver141.html', desc: 'ｳｪﾌﾞﾌｯｸ版(連携撤廃)',  type: 'html' },
        { version: 'v1.3.0', date: '2026-03-xx', url: './old_tools/ver130.html', desc: '',                     type: 'html' },
        { version: 'v1.2.6', date: '2026-03-xx', url: './old_tools/ver126.html', desc: 'Blue Edition',         type: 'html' },
        { version: 'v1.1.7', date: '2026-02-xx', url: './old_tools/ver117.html', desc: '',                     type: 'html' }
    ];

    let currentIframe = null;
    let isPreviewMode = false;
    let selectedUrl = '';
    let currentContainerSelector = '';

    // ── sandbox の allow-same-origin 付与方針 ──────────────────────────────
    // module型（ver210/230/240/155b等）は tools/expmercenary.js 系と同じ実装
    // 系譜のため、localStorage（LAP通知設定など）に依存する機能を持つ。
    // allow-same-originなしのiframe（opaque origin）ではlocalStorageアクセスが
    // 例外を投げ、render()がDOM構築前に停止して画面が真っ白になる不具合が
    // 実際に発生したため、module型には一律allow-same-originを付与する。
    //
    // これは「old_tools/module_shell.html」の外部URL差し替え可能な読み込み
    // 経路（?script=任意URL）が既に廃止され、iframeのsrcdocへ直接埋め込む
    // 方式に変わったことが前提。読み込み対象は version_selector.js の
    // VERSIONS 配列で固定されており、外部から差し替えられないため、
    // allow-same-originを付与しても「攻撃者の任意コードがその権限を持つ」
    // という経路は生じない。
    //
    // html型（はてなブログ時代のアーカイブ）は、ver141.html のダークモード
    // 自己完結実装（トグルボタン・localStorage連携）を削除済みのため
    // 現状は不要。将来、html型でも同一オリジン権限が必要なアーカイブを
    // 追加する場合はここに追記する。
    const NEEDS_SAME_ORIGIN = [];

    function findVersion(url) {
        return VERSIONS.find(v => v.url === url);
    }

    function getSandboxAttr(url) {
        const version = findVersion(url);
        const needsSameOrigin = NEEDS_SAME_ORIGIN.some((name) => url.endsWith(name))
            || (version && version.type === 'module');
        return needsSameOrigin ? 'allow-same-origin allow-scripts' : 'allow-scripts';
    }

    function applyDarkModeToIframe(iframe) {
        if (!iframe || !iframe.contentDocument) return;
        const isDark = document.body.classList.contains('dark-mode');
        try {
            iframe.contentDocument.body.classList.toggle('dark-mode', isDark);
        } catch (_) {
            // 同一オリジンでない場合や読み込み前は無視
        }
    }

    const bodyClassObserver = new MutationObserver(() => {
        if (currentIframe) {
            applyDarkModeToIframe(currentIframe);
        }
    });
    bodyClassObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

    // module型のシェルHTMLをsrcdocとして直接組み立てる。
    // 旧module_shell.htmlはクエリ引数 ?script= の値をそのままscript srcに使っており、
    // 外部URLを指定されると同一オリジン権限で任意コードが実行され得た。
    // srcdoc方式は読み込み対象が呼び出し元のJSコード内に固定されており、
    // URL経由で外部から差し替える余地がない。
    function buildModuleShellSrcdoc(url, globalName) {
        const absoluteUrl = new URL(url, window.location.href).href;
        // globalNameは英数字のみを想定（VERSIONS配列内の固定値）だが、
        // 念のため許可パターン外の文字が来た場合は安全側に倒して読み込みを中止する。
        if (!/^[A-Za-z0-9_]+$/.test(globalName)) {
            return '<p style="padding:12px;color:#c00">内部設定エラー：不正なモジュール名です。</p>';
        }
        const escapedUrl = absoluteUrl.replace(/"/g, '&quot;');
        return `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>旧バージョン読み込み</title>
<style>html,body{margin:0;padding:0;background:#fff;font-family:sans-serif}#app{min-height:100vh}</style>
</head><body><div id="app"></div>
<script src="${escapedUrl}" onerror="document.getElementById('app').textContent='スクリプトの読み込みに失敗しました';"></script>
<script>
(function() {
  function tryRender() {
    var mod = window[${JSON.stringify(globalName)}];
    if (mod && typeof mod.render === 'function') {
      mod.render('#app');
    } else {
      document.getElementById('app').textContent = 'このバージョンの読み込みに失敗しました（' + ${JSON.stringify(globalName)} + ' が見つかりません）。';
    }
  }
  // 直前のscriptタグが同期読み込みされるため、通常はこの時点で既に定義済みだが、
  // 念のためDOMContentLoaded後にも一度だけ確認する。
  if (window[${JSON.stringify(globalName)}]) {
    tryRender();
  } else {
    document.addEventListener('DOMContentLoaded', tryRender);
  }
})();
</script>
</body></html>`;
    }

    function createEl(tag, className, text) {
        const el = document.createElement(tag);
        if (className) el.className = className;
        if (text !== undefined) el.textContent = text;
        return el;
    }

    // ★ destroy（先に定義）
    const destroy = function() {
        const iframeToDestroy = currentIframe;
        currentIframe = null;
        if (iframeToDestroy) {
            try {
                const globalName = iframeToDestroy.dataset.globalName;
                const win = iframeToDestroy.contentWindow;
                if (win && globalName && win[globalName] && typeof win[globalName].destroy === 'function') {
                    win[globalName].destroy();
                }
            } catch (_) { /* クロスオリジン等で触れない場合は無視 */ }
            try {
                iframeToDestroy.remove();
            } catch (_) {}
        }
        const oldModal = document.getElementById('vs-pc-modal');
        if (oldModal) oldModal.remove();
        const oldOverlay = document.getElementById('vs-modal-overlay');
        if (oldOverlay) oldOverlay.remove();
        isPreviewMode = false;
        selectedUrl = '';
    };

    function mountIframe(container, url) {
        if (currentIframe) {
            try { currentIframe.remove(); } catch (_) {}
            currentIframe = null;
        }
        const version = findVersion(url);
        const iframe = document.createElement('iframe');
        iframe.sandbox = getSandboxAttr(url);
        iframe.style.cssText = 'width:100%;height:100%;border:none;background:white;';

        if (version && version.type === 'module' && version.globalName) {
            iframe.dataset.globalName = version.globalName;
            iframe.srcdoc = buildModuleShellSrcdoc(url, version.globalName);
        } else {
            iframe.src = url;
        }

        container.appendChild(iframe);
        currentIframe = iframe;
        return iframe;
    }

    // ★ スマホ用：プレビュー画面を表示（ツールバーは残る）
    const showMobilePreview = function(container, url, versionName) {
        const previewRoot = createEl('div', 'vs-mobile-preview');
        previewRoot.style.cssText = 'display: flex; flex-direction: column; height: calc(100vh - 140px);';

        const header = document.createElement('div');
        header.style.cssText = 'display: flex; align-items: center; padding: 12px; background: #0066cc; color: white; gap: 12px; border-radius: 12px 12px 0 0;';
        const backBtn = document.createElement('button');
        backBtn.id = 'vs-back-btn';
        backBtn.style.cssText = 'background: rgba(255,255,255,0.2); border: none; color: white; padding: 6px 12px; border-radius: 20px; cursor: pointer;';
        backBtn.textContent = '← 戻る';
        backBtn.onclick = () => {
            destroy();
            render(currentContainerSelector);
        };
        const title = document.createElement('span');
        title.style.fontWeight = 'bold';
        title.textContent = versionName;
        header.appendChild(backBtn);
        header.appendChild(title);

        const previewArea = document.createElement('div');
        previewArea.id = 'vs-preview-area';
        previewArea.style.cssText = 'flex: 1; background: white; border-radius: 0 0 12px 12px; overflow: auto;';

        previewRoot.appendChild(header);
        previewRoot.appendChild(previewArea);
        container.replaceChildren(previewRoot);
        mountIframe(previewArea, url);
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

        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #0066cc; color: white;';
        const title = document.createElement('span');
        title.style.fontWeight = 'bold';
        title.textContent = `📜 ${versionName}`;
        const closeBtn = document.createElement('button');
        closeBtn.id = 'vs-close-modal';
        closeBtn.style.cssText = 'background: none; border: none; color: white; font-size: 20px; cursor: pointer;';
        closeBtn.textContent = '✕';
        header.appendChild(title);
        header.appendChild(closeBtn);

        const previewArea = document.createElement('div');
        previewArea.id = 'vs-modal-preview';
        previewArea.style.cssText = 'flex: 1; background: white;';

        modal.appendChild(header);
        modal.appendChild(previewArea);
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
        const closeModal = () => {
            try { modal.remove(); } catch (_) {}
            try { overlay.remove(); } catch (_) {}
            destroy();
        };
        overlay.onclick = closeModal;
        document.body.appendChild(overlay);

        if (previewArea) {
            mountIframe(previewArea, url);
        }

        if (closeBtn) {
            closeBtn.onclick = closeModal;
        }
    };

    const render = function(containerSelector) {
        currentContainerSelector = containerSelector;
        const container = document.querySelector(containerSelector);
        if (!container) return;

        // スマホでプレビューモード中なら表示を切り替え
        const isMobile = window.innerWidth <= 768;
        if (isMobile && isPreviewMode && selectedUrl) {
            const version = findVersion(selectedUrl);
            showMobilePreview(container, selectedUrl, version ? version.version : '旧バージョン');
            return;
        }

        // 通常の一覧表示（プレビューモード解除時もここに来る）
        isPreviewMode = false;
        selectedUrl = '';

        const root = createEl('div', 'vs-container');
        const header = createEl('div', 'vs-header');
        header.appendChild(createEl('h2', null, '📜 傭兵ツール 過去バージョン'));
        header.appendChild(createEl('p', null, 'バージョンを選択して開く（PC:小窓 / スマホ:画面切替）'));
        root.appendChild(header);

        const list = createEl('div', 'vs-list');
        VERSIONS.forEach((v) => {
            const item = createEl('div', 'version-item');
            item.dataset.url = v.url;
            item.dataset.version = v.version;
            const info = createEl('div', 'version-info');
            info.appendChild(createEl('strong', null, v.version));
            if (v.desc) {
                info.appendChild(createEl('span', 'version-desc', v.desc));
            }
            info.appendChild(createEl('div', 'version-date', v.date));
            const btn = createEl('button', 'preview-btn', '▶ 開く');
            item.appendChild(info);
            item.appendChild(btn);
            list.appendChild(item);
        });
        root.appendChild(list);
        container.replaceChildren(root);

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

    global.VersionSelector = { render, destroy };
})(window);
