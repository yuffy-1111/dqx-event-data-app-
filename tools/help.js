// ========== 取扱説明書 ==========
(function(global) {
    const Help = {
        render: function(containerSelector) {
            const container = document.querySelector(containerSelector);
            if (!container) return;

            const helpContainer = document.createElement('div');
            helpContainer.className = 'help-container';

            const createEl = (tag, className, text) => {
                const el = document.createElement(tag);
                if (className) el.className = className;
                if (text !== undefined) el.textContent = text;
                return el;
            };

            const appendListItem = (list, text, note) => {
                const li = createEl('li');
                li.textContent = text;
                if (note) {
                    const span = createEl('span', 'help-note', note);
                    li.appendChild(document.createElement('br'));
                    li.appendChild(span);
                }
                list.appendChild(li);
            };

            helpContainer.appendChild(createEl('h2', null, '📖 取扱説明書'));

            const toc = createEl('div', 'help-toc');
            toc.appendChild(createEl('h3', null, '📑 目次'));
            const tocList = document.createElement('ul');
            ['進捗チェッカー', '傭兵ログトラッカー', '傭兵ログトラッカー旧ver', 'アプリの使い方', '設定', 'Q&A'].forEach((label, index) => {
                const li = document.createElement('li');
                const a = document.createElement('a');
                const hrefs = ['#checker', '#expmercenary', '#oldver', '#install', '#settings', '#qa'];
                a.href = hrefs[index];
                a.textContent = label;
                li.appendChild(a);
                tocList.appendChild(li);
            });
            toc.appendChild(tocList);
            helpContainer.appendChild(toc);

            const sections = [
                {
                    id: 'checker',
                    title: '📋 進捗チェッカー',
                    items: [
                        '日課、週課など周期的なコンテンツの進捗を管理するツールです。',
                        '画面左上のテキストボックスにキャラクター名を入力し、カラーを選択することができます。',
                        'データは端末で開いているブラウザのローカルストレージにキャッシュとして保存されます。',
                        '複数キャラ登録することが可能で、書き出し(クリップボード)・読み込み機能を利用することでバックアップ・共有することができます。',
                        '編集モードを起動するとチェックボックス部分はロック設定に置き換わります。キャラクター、コンテンツ別でチェックボックスをグレーアウトさせることができます。また、表の左側に✓が描画され、選択すると✗に切り替わりその行が非表示になります。'
                    ],
                    note: '※ 名前及びカラーは表ヘッダーでいつでも変更できます。'
                },
                {
                    id: 'expmercenary',
                    title: '⚔️ 傭兵ログトラッカー',
                    items: [
                        'デュラハーン等の傭兵に使うための経験値計算・タイマー等を提供するツールです。',
                        'モンスター名、アイテムのオプションを選択することで自動的に選択中のモンスターの最適な呼び数が選択されます。',
                        'タイマー開始後、加算を押すと履歴行に追加され、お供のモンスターや、呼び数の再選択、デスペナルティ想定値など様々な調整ができます。',
                        '転職ボタンを押すとオプション持続タイマーから20秒引かれます。これはエリア移動の推定延長時間です。LAPは全滅やその他要因での戦闘中断時用です。',
                        '履歴コピーを押すことで主要な情報と履歴行がクリップボードにコピーされます。'
                    ],
                    note: '※ モンスターの自動切り替えはありません。また、このツールにおける最適は経験値が溢れることのない呼び数が設定されているため、実際の最適と異なる場合があります。',
                    note2: '※ デスペナルティ想定値はテスト機能のため実測とは異なる場合があります。'
                },
                {
                    id: 'oldver',
                    title: '📜 傭兵ログトラッカー旧ver',
                    items: [
                        '傭兵ログトラッカーの旧verです。主にはてなブログ時代のHTMLプレビューとして動作させることが可能です。',
                        '古いverのため不具合が残っている場合があります。'
                    ]
                },
                {
                    id: 'install',
                    title: '📲 アプリの使い方',
                    items: [
                        'このツールはホーム画面に追加することで、アプリのように起動できます。',
                        '追加方法はメニューの「アプリの使い方」ページで、お使いの端末・ブラウザに合わせた手順を確認できます。',
                        '追加しなくてもブラウザでそのまま使用できます。インストールはより便利に使うための任意機能です。'
                    ]
                },
                {
                    id: 'settings',
                    title: '⚙️ 設定',
                    items: [
                        'データの管理及び管理人へのフィードバックを行うことができます。',
                        'データ管理では全キャッシュの削除、チェックデータ削除、認証トークン削除ができます。キャッシュの状況についてはストレージ状況に記載されています。',
                        '記載されているGitHub Issues及びX(旧Twitter)アカウントにて管理人へのフィードバックを行うことができます。不具合や質問など気軽にご連絡ください。'
                    ]
                }
            ];

            sections.forEach((section) => {
                const sectionEl = createEl('div', 'help-section');
                sectionEl.id = section.id;
                sectionEl.appendChild(createEl('h3', null, section.title));
                const ul = document.createElement('ul');
                section.items.forEach((text, index) => {
                    if (section.id === 'checker' && index === 1) {
                        appendListItem(ul, text, '※ 名前及びカラーは表ヘッダーでいつでも変更できます。');
                    } else if (section.id === 'expmercenary' && index === 1) {
                        appendListItem(ul, text, '※ モンスターの自動切り替えはありません。また、このツールにおける最適は経験値が溢れることのない呼び数が設定されているため、実際の最適と異なる場合があります。');
                    } else if (section.id === 'expmercenary' && index === 2) {
                        appendListItem(ul, text, '※ デスペナルティ想定値はテスト機能のため実測とは異なる場合があります。');
                    } else {
                        appendListItem(ul, text);
                    }
                });
                sectionEl.appendChild(ul);
                helpContainer.appendChild(sectionEl);
            });

            const qaSection = createEl('div', 'help-section');
            qaSection.id = 'qa';
            qaSection.appendChild(createEl('h3', null, '❓ Q&A'));
            [
                ['Q. 端末の画面を横向きにしたら描画がおかしくなった', 'A. スマホ及びタブレットの場合モバイル端末のレイアウト(縦用)が読み込まれるため横向きで使用する際はブラウザの設定からデスクトップサイトとして読み込むことで描画が改善します。'],
                ['Q. API認証って何？', 'A. テスト用のツールは非公開のファイルを読み込んで使用するため、トークンという鍵を使用してAPI認証を行うことが必要になります。これは開発者及び関係者のみが開くことができます。']
            ].forEach(([q, a]) => {
                const qaItem = createEl('div', 'qa-item');
                qaItem.appendChild(createEl('p', 'qa-q', q));
                qaItem.appendChild(createEl('p', 'qa-a', a));
                qaSection.appendChild(qaItem);
            });
            helpContainer.appendChild(qaSection);

            const footer = createEl('div', 'help-footer');
            footer.appendChild(createEl('p', null, '© yuffy-1111'));
            helpContainer.appendChild(footer);

            container.replaceChildren(helpContainer);
            
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