// ========== 取扱説明書 ==========
(function(global) {
    const Help = {
        render: function(containerSelector) {
            const container = document.querySelector(containerSelector);
            if (!container) return;
            
            container.innerHTML = `
                <div class="help-container">
                    <h2>📖 取扱説明書</h2>
                    <div class="help-toc">
                        <h3>📑 目次</h3>
                        <ul>
                            <li><a href="#checker">コンテンツチェッカー</a></li>
                            <li><a href="#expmercenary">傭兵用多機能ツール</a></li>
                            <li><a href="#oldver">傭兵用多機能ツール旧ver</a></li>
                            <li><a href="#install">アプリの使い方</a></li>
                            <li><a href="#settings">設定</a></li>
                            <li><a href="#qa">Q&amp;A</a></li>
                        </ul>
                    </div>
                    <div id="checker" class="help-section">
                        <h3>📋 コンテンツチェッカー</h3>
                        <ul>
                            <li>日課、週課など周期的なコンテンツの進捗を管理するツールです。</li>
                            <li>画面左上のテキストボックスにキャラクター名を入力し、カラーを選択することができます。<br>
                                <span class="help-note">※ 名前及びカラーは表ヘッダーでいつでも変更できます。</span>
                            </li>
                            <li>データは端末で開いているブラウザのローカルストレージにキャッシュとして保存されます。</li>
                            <li>複数キャラ登録することが可能で、書き出し(クリップボード)・読み込み機能を利用することでバックアップ・共有することができます。</li>
                            <li>編集モードを起動するとチェックボックス部分はロック設定に置き換わります。キャラクター、コンテンツ別でチェックボックスをグレーアウトさせることができます。また、表の左側に✓が描画され、選択すると✗に切り替わりその行が非表示になります。</li>
                        </ul>
                    </div>
                    <div id="expmercenary" class="help-section">
                        <h3>⚔️ 傭兵用多機能ツール</h3>
                        <ul>
                            <li>デュラハーン等の傭兵に使うための経験値計算・タイマー等を提供するツールです。</li>
                            <li>モンスター名、アイテムのオプションを選択することで自動的に選択中のモンスターの最適な呼び数が選択されます。<br>
                                <span class="help-note">※ モンスターの自動切り替えはありません。また、このツールにおける最適は経験値が溢れることのない呼び数が設定されているため、実際の最適と異なる場合があります。</span>
                            </li>
                            <li>タイマー開始後、加算を押すと履歴行に追加され、お供のモンスターや、呼び数の再選択、デスペナルティ想定値など様々な調整ができます。<br>
                                <span class="help-note">※ デスペナルティ想定値はテスト機能のため実測とは異なる場合があります。</span>
                            </li>
                            <li>転職ボタンを押すとオプション持続タイマーから20秒引かれます。これはエリア移動の推定延長時間です。LAPは全滅やその他要因での戦闘中断時用です。</li>
                            <li>履歴コピーを押すことで主要な情報と履歴行がクリップボードにコピーされます。</li>
                        </ul>
                    </div>
                    <div id="oldver" class="help-section">
                        <h3>📜 傭兵用多機能ツール旧ver</h3>
                        <ul>
                            <li>傭兵用多機能ツールの旧verです。主にはてなブログ時代のHTMLプレビューとして動作させることが可能です。</li>
                            <li>古いverのため不具合が残っている場合があります。</li>
                        </ul>
                    </div>
                    <div id="install" class="help-section">
                        <h3>📲 アプリの使い方</h3>
                        <ul>
                            <li>このツールはホーム画面に追加することで、アプリのように起動できます。</li>
                            <li>追加方法はメニューの「アプリの使い方」ページで、お使いの端末・ブラウザに合わせた手順を確認できます。</li>
                            <li>追加しなくてもブラウザでそのまま使用できます。インストールはより便利に使うための任意機能です。</li>
                        </ul>
                    </div>
                    <div id="settings" class="help-section">
                        <h3>⚙️ 設定</h3>
                        <ul>
                            <li>データの管理及び管理人へのフィードバックを行うことができます。</li>
                            <li>データ管理では全キャッシュの削除、チェックデータ削除、認証トークン削除ができます。キャッシュの状況についてはストレージ状況に記載されています。</li>
                            <li>記載されているGitHub Issues及びX(旧Twitter)アカウントにて管理人へのフィードバックを行うことができます。不具合や質問など気軽にご連絡ください。</li>
                        </ul>
                    </div>
                    <div id="qa" class="help-section">
                        <h3>❓ Q&amp;A</h3>
                        <div class="qa-item">
                            <p class="qa-q">Q. 端末の画面を横向きにしたら描画がおかしくなった</p>
                            <p class="qa-a">A. スマホ及びタブレットの場合モバイル端末のレイアウト(縦用)が読み込まれるため横向きで使用する際はブラウザの設定からデスクトップサイトとして読み込むことで描画が改善します。</p>
                        </div>
                        <div class="qa-item">
                            <p class="qa-q">Q. API認証って何？</p>
                            <p class="qa-a">A. テスト用のツールは非公開のファイルを読み込んで使用するため、トークンという鍵を使用してAPI認証を行うことが必要になります。これは開発者及び関係者のみが開くことができます。</p>
                        </div>
                    </div>
                    
                    <div class="help-footer">
                        <p>© yuffy-1111</p>
                    </div>
                </div>
            `;
            
            // スタイル追加
            const style = document.createElement('style');
            style.textContent = `
                .help-container {
                    max-width: 700px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .help-container h2 {
                    margin: 0 0 20px 0;
                    color: #0066cc;
                    border-bottom: 2px solid #0066cc;
                    padding-bottom: 8px;
                }
                .help-toc {
                    background: #f0f7ff;
                    border-radius: 12px;
                    padding: 16px;
                    margin: 20px 0;
                }
                .help-toc h3 {
                    margin: 0 0 8px 0;
                    color: #0066cc;
                }
                .help-toc ul {
                    margin: 0;
                    padding-left: 20px;
                }
                .help-toc li {
                    margin: 4px 0;
                }
                .help-toc a {
                    color: #0066cc;
                    text-decoration: none;
                }
                .help-toc a:hover {
                    text-decoration: underline;
                }
                .help-section {
                    background: #f5f5f5;
                    border-radius: 12px;
                    padding: 16px;
                    margin: 20px 0;
                    scroll-margin-top: 20px;
                }
                .help-section h3 {
                    margin: 0 0 12px 0;
                    color: #0066cc;
                    border-left: 4px solid #0066cc;
                    padding-left: 12px;
                }
                .help-section ul {
                    margin: 0;
                    padding-left: 20px;
                }
                .help-section li {
                    margin: 8px 0;
                    line-height: 1.5;
                }
                .help-note {
                    font-size: 12px;
                    color: #888;
                }
                .qa-item {
                    margin: 16px 0;
                }
                .qa-q {
                    font-weight: bold;
                    margin: 0 0 4px 0;
                    color: #0066cc;
                }
                .qa-a {
                    margin: 0;
                    padding-left: 16px;
                    border-left: 3px solid #0066cc;
                }
                .help-footer {
                    text-align: center;
                    padding: 20px;
                    font-size: 12px;
                    color: #888;
                    border-top: 1px solid #ddd;
                    margin-top: 20px;
                }
                /* ダークモード */
                body.dark-mode .help-container h2 {
                    color: #60a5fa;
                    border-bottom-color: #60a5fa;
                }
                body.dark-mode .help-toc {
                    background: #1e293b;
                }
                body.dark-mode .help-toc h3 {
                    color: #60a5fa;
                }
                body.dark-mode .help-toc a {
                    color: #60a5fa;
                }
                body.dark-mode .help-section {
                    background: #1e293b;
                }
                body.dark-mode .help-section h3 {
                    color: #60a5fa;
                    border-left-color: #60a5fa;
                }
                body.dark-mode .help-section li {
                    color: #cbd5e1;
                }
                body.dark-mode .help-note {
                    color: #94a3b8;
                }
                body.dark-mode .qa-q {
                    color: #60a5fa;
                }
                body.dark-mode .qa-a {
                    border-left-color: #60a5fa;
                    color: #cbd5e1;
                }
                body.dark-mode .help-footer {
                    border-top-color: #334155;
                    color: #64748b;
                }
            `;
            container.appendChild(style);
        },
        
        // グローバルリスナーを持たないため destroy は空実装
        destroy: function() {}
    };
    
    global.Help = Help;
})(window);