// ========== 傭兵用多機能ツール ver2.7.3 ==========
// ベース: ver2.4.0 統合
// [CSS]    インラインstyleを全廃し、クラスベースで再定義
// [AUDIO]  playLapWarning移植（AudioContext管理・resume対応・音色変更）
// [QUAL]   基本的な動作ロジックは2.1.0から変更なし（ver2.2.0時点）
// [LOGIC]  経験値計算を実測値ベースに修正: applyLimit 廃止 → floor + fdBonus 方式に変更（ver2.3.0）
// [RECOVERY] 電話中断・誤操作等でdestroyを経由せず終了した場合のセッション自動保存/復元を追加（ver2.4.0）
// [BUG]      passbookOffset/remaining への不要な Math.ceil を削除（ver2.5.0）
// [NOTE]     お供あり+料理あり時の経験値計算は合算floor+1方式で正しいことを実測確認済み
//             （デュラハーン+はぐメタ×3(hg), 料理+元気, E=368243）
// [DOC]      お供・各Buff/アイテム・通帳1/2・LAPの実質的用途をコメント内に明示（ver2.5.1）
// [REMOVE]   デスペナルティ及び関連UIを撤廃（実用性のある精度の実装が不可能なため。ver2.5.1）
// [FIX]      通帳の引出(リセット/1Lv分引出)を履歴行(withdraw)化。passbookOffset を廃止し、
//            残高は履歴を時系列でたどって都度算出。引出は「その時点の残高」まで（ver2.5.2）
// [FEATURE]  履歴の変更（条件編集/呼び数/お供/削除/引出/通帳切替）に応じて、以降の通帳・溢れ行を
//            時系列で連動再計算（recomputePassbookFlow）。履歴行の条件編集を追加し、モンスター/料理/修練/エンゼル/皇帝/エリクサー/通帳の
//            スナップショットを適用して、通帳・溢れ・エンゼル・通常行の構造を再構築（ver2.6.0）

// [FIX]      (ver2.7.3) 経験値計算の浮動小数点誤差を修正。料理(+0.3)を含む倍率を小数で足していたため、数学的に整数ちょうどになる
//            組み合わせで floor が1少なくなり、料理の+1補正が打ち消されてゲームより1少なくなっていた
//            （例: ヘルガーディアン 料理+元気 10匹 599750→599751）。倍率を10倍整数で扱う整数演算に変更。

// [CHANGE]   (ver2.7.2) 強敵ボーナスはデュラハーン +15% 固定に変更し、率のプルダウン(sb)を廃止。PTメンバーに141以上がいると
//            「しらべる」のレベル差が変わり自分のLvだけでは率が決まらないため、職Lvからの自動判定は取りやめ。
//            職/Lv/次までの入力は、レベル推移（通帳キャップ・次までの確認）用としてそのまま残す。
// [CHANGE]   (ver2.7.0) 通帳の「1Lv分引出」を撤廃し「リセット」(全額引出)のみに統一。Lv143に到達する分を超える額は
//            引き出さず通帳に残す（キャップ適用後の額を引出行の要求額(req)として記録。Lv/次まで未入力時はキャップなし）。
// [UX]       (ver2.7.0) 強敵プルダウンの幅を約1.3倍に拡張（「自動+15%」表記が収まるように）。
// [FEATURE]  (ver2.7.0) 履歴の条件編集に「手前の履歴も含む」を追加。チェック時は、変更した項目のみを
//            編集行以前の全グループへ適用し、通帳・溢れ・強敵率を時系列で再計算する。
// [FIX]      (ver2.7.0) 「今は手を出さない方が良さそうだ」(自Lv-敵Lv≦-25)の強敵ボーナスは +20%（+25%は誤り）。+25%の選択肢を廃止。
// [UX]       (ver2.7.0) 職の表示名を短縮（値は正式名のまま）。「次Lvまで」の小ラベル追加。入力は桁数制限(Lv3桁/次まで7桁)し欄幅を圧縮。
// [FIX]      (ver2.7.0) 履歴削除でレベルの経験値が戻らない問題を修正。入力欄の書き換え時は「入力値 − 既存履歴の獲得分」を
//            逆算して起点を決め直し、全履歴をレベル加算の対象のままにする（各行の強敵率だけは固定して過去値を保持）。
// [UX]       (ver2.7.0) 強敵/職/Lv/次までの行をタイマー行の上へ移動。Lvに左右矢印を追加。「次まで」は任意入力
//            （空ならレベルは手動固定で履歴連動なし。Lv別の強敵率だけ反映）。バフ欄は2行構成に圧縮。
// [UX]       (ver2.8.0) レベル入力欄(職名/Lv/次まで)をそのまま現在値の表示にし、欄の数字を書き換えるとその時点から再起点化。
//            欄を空にすると連動解除。加算直後に即時反映（従来はロック解除後）。職は職名プルダウン(遊び人は必要経験値×0.75を切上げ)。
// [FEATURE]  強敵ボーナス率のプルダウン(自動/なし/+10/+15/+20)と、職Lv・次までの経験値の入力による
//            レベル自動推移を追加。履歴を時系列でたどって獲得経験値からレベルアップを判定し、
//            自Lv-敵Lv の差で強敵ボーナス率を自動決定する。対象はデュラハーンのみ(敵Lv150。
//            140→141で「かなり強そう+20%」→「強そう+15%」の境目から確定)。（ver2.7.0）
//            ・レベルに加算する行: 通常/エンゼル/引出。通帳(通)への預入と溢れは加算しない（要実測確認）
//            ・DQXの基本計算は切り上げ(ceil)。従来値 ceil(22802*0.2)=4561 と一致

// 変更履歴（ver2.0.0時点）:
// [BUG] _recalcLaps: 削除後の lastLapSec 更新を正確化
// [BUG] jobOffsetSec: 転職ボタン連打防止(1秒クールダウン)
// [SEC] innerHTML を createElement+textContent に置き換え(XSS対策)
// [PERF] querySelectorAll を addRow 時のキャッシュ配列管理に変更
// [PERF] setInterval を 42ms（~24fps）に変更(表示更新負荷削減)
// [PERF] getPartnerOptions を DocumentFragment+cloneNode で効率化
// [UX] btnTimerStop のラベルを状態に応じて「開始」「再開」に切り替え
// [QUAL] ExpCalc をファクトリ関数化（複数インスタンス対応）
// [QUAL] CSV1/CSV2 のキー型を統一(すべて文字列)
// [QUAL] ritaOrKuma は AC リセット対象外(転職先選好はセッション継続が自然なため)
// [QUAL] calcLockedUntil の 100ms 制限を 3000ms（加算後クールダウン）に変更

(function (global) {
  "use strict";

  // ═══════════════════════════════════════════════════════════════════
  // 用語・仕様定義
  // ═══════════════════════════════════════════════════════════════════
  //
  // [お供] 戦闘中に対象のモンスター以外で同時にエンカウントする可能性のあるもの。
  //
  // [Buff/アイテム]（効果・時間・課金情報）
  //   修練の心得     … 1,100円　使用から3日間　効果100%
  //   皇帝のタロット   … 魔法の迷宮のミネアによる　正位置2時間／逆位置1時間　効果100%
  //   元気玉/超元気玉  … 30分　使用者に100% / PT全体に100%
  //   爆伸丸        … 330円　30分　使用者に200%（元気玉系と併用不可）
  //
  // [経験値の通帳1/2]
  //   通帳1 … 220円　蓄積上限500万
  //   通帳2 … 440円　蓄積上限1000万
  //   通帳1/2は排他選択（同時併用不可）。いずれも月額利用権に付随するオプション契約。
  //
  // [LAPの実質的用途]
  //   基本的な戦闘間の記録用途では使用しない（転職時も対象外）。
  //   操作ミスや全滅、通信トラブル等が発生した際の目印としてのみ用いる。
  //
  // ═══════════════════════════════════════════════════════════════════

  // ─── お供経験値定数 ───────────────────────────────────────────────
  const PARTNER_EXP = {
    none: 0, mk: 48240, hm1: 12060, hm2: 24120, hm3: 36180,
    gn: 720, sn: 720, zucchini: 9010,
  };

  const EXP_PER_LV = 1589326;   // 121〜140Lvの1Lv分（141以降は LV_DIFF を参照すること）

  // ─── レベル・必要経験値テーブル（極限攻略DB 職業レベルの必要経験値より。差分から都度積み上げる） ──
  const LV_CAP = 143;
  const LV_DIFF = (function () {
    const fill = (n, v) => new Array(n).fill(v);
    // Lv86〜143（初期職・追加職・マスター共通）
    const common86 = [].concat(
      [249346, 299346, 349346, 399346, 449346],
      [599346, 749346, 959346],
      fill(17, 959346),
      [997720, 1036094, 1074468, 1112842, 1151216, 1189590, 1227964, 1266338, 1304712, 1343086],
      [1378960, 1412334, 1443208, 1471582, 1497456, 1520830, 1541704, 1560078, 1575952],
      fill(11, 1589326),
      [1621112, 1668791, 1722827]
    );
    // 初期職 Lv2〜85
    const base2to85 = [].concat(
      [7, 15, 26, 40, 59, 87, 128, 184, 264, 370, 512, 691, 920, 1200, 1540, 1946, 2423, 2975, 3609],
      [4324, 5127, 6012, 6985, 8036, 9165, 10364, 11629, 12961, 14359],
      [15826, 17362, 18969, 20650, 22404, 24232, 26136, 28118, 30180, 32319],
      [34541, 36844, 39231, 41704, 44262, 46907, 49641, 52464, 55381, 58387],
      [61488, 67917, 71537, 75271, 79117, 83073, 87137, 91308, 95585, 99971],
      [104464, 109062, 113764, 118569, 123479, 128492, 133606, 138820, 144133, 149547],
      [155060, 160688, 166466, 172442, 178667, 185192, 192068],
      fill(8, 199346)
    );
    // 追加職 Lv2〜85
    const add2to85 = [].concat(
      [9, 20, 35, 53, 79, 116, 171, 245, 352, 493, 682, 921, 1226, 1600, 2053, 2594, 3230, 3966, 4811],
      [5764, 6834, 8014, 9311, 10712, 12217, 13815, 15501, 17277, 19141],
      [21096, 23144, 25286, 27526, 29865, 32301, 34839, 37481, 40230, 43081],
      [46043, 49113, 52295, 55591, 59001, 62527, 66171, 69935, 73823, 77830],
      [81964, 90533, 95359, 100336, 105463, 110736, 116154, 121714, 127415, 133261],
      [139251, 145380, 151647, 158052, 164598, 171280, 178097, 185047, 192129, 199346],
      fill(15, 199346)
    );
    // マスター Lv100以降（Lv100は 99→100 の差分）
    const masterFrom100 = [].concat(
      [3660778],
      [997720, 1035135, 1071615, 1107183, 1141862, 1175674, 1208641, 1240784, 1272123, 1302679],
      [1332471, 1361518, 1389839, 1417452, 1444375, 1470625, 1496219, 1521173, 1545503, 1569225],
      fill(20, 1589326),
      [1621112, 1668791, 1722827]
    );
    // index = レベル（そのレベルに上がるための差分）。index 0,1 は 0
    const idx = (arr) => [0, 0].concat(arr);
    return {
      base:   idx([].concat(base2to85, common86)),
      add:    idx([].concat(add2to85,  common86)),
      master: idx([].concat(add2to85, common86.slice(0, 14), masterFrom100)),
    };
  })();

  // ─── 職名 → 区分（必要経験値テーブル） ───────────────────────────────
  const LV_JOBS = {
    "基本職":   ["戦士", "僧侶", "魔法使い", "武闘家", "盗賊", "旅芸人"],
    "追加職":   ["バトルマスター", "パラディン", "魔法戦士", "レンジャー", "賢者", "スーパースター",
                 "まもの使い", "どうぐ使い", "踊り子", "占い師", "天地雷鳴士", "デスマスター", "魔剣士", "海賊", "遊び人"],
    "マスター": ["ガーディアン", "竜術士", "隠者", "ストームカイザー"],
  };
  // 表示名の短縮（欄幅の都合）。value は正式名のまま
  const LV_JOB_LABEL = {
    "バトルマスター": "バトマス", "パラディン": "パラ", "レンジャー": "レン", "スーパースター": "スパスタ",
    "まもの使い": "まも", "どうぐ使い": "どう", "天地雷鳴士": "天地", "デスマスター": "デス",
    "ガーディアン": "ガデ", "ストームカイザー": "スト",
  };
  const LV_JOB_OPTIONS_HTML = Object.keys(LV_JOBS).map(g =>
    `<optgroup label="${g}">${LV_JOBS[g].map(j => `<option value="${j}">${LV_JOB_LABEL[j] || j}</option>`).join("")}</optgroup>`
  ).join("");
  function jobClass(job) {
    if (LV_JOBS["基本職"].includes(job) || job === "base") return "base";
    if (LV_JOBS["マスター"].includes(job) || job === "master") return "master";
    return "add";
  }
  // Lv lv → lv+1 に必要な経験値（上限Lvは0）。遊び人は追加職の0.75倍（DQXは切り上げ）
  function lvNeed(job, lv) {
    if (lv >= LV_CAP) return 0;
    const d = LV_DIFF[jobClass(job)][lv + 1] || 0;
    return job === "遊び人" ? Math.ceil(d * 0.75) : d;
  }
  // 獲得経験値を加算してレベルを進める（st = { job, lv, rem(次までの残り) }。破壊的）
  function lvAdvance(st, gain) {
    if (st.rem == null) return st;   // 「次まで」未入力＝手動固定（経験値では連動しない）
    st.rem -= gain;
    while (st.lv < LV_CAP && st.rem <= 0) {
      st.lv++;
      st.rem += lvNeed(st.job, st.lv);
    }
    if (st.lv >= LV_CAP) st.rem = Math.max(0, st.rem);
    return st;
  }
  // 逆算: 状態(lv, rem)が「獲得gain」を得た後のものとして、その前の状態を返す（lvAdvanceの逆）
  function lvUnwind(job, lv, rem, gain) {
    let p = lv >= LV_CAP ? 0 : Math.max(0, lvNeed(job, lv) - rem);   // 現レベル内で獲得済みの量
    let g = gain;
    while (g > p && lv > 1) {
      g -= p;
      lv--;
      p = lvNeed(job, lv);                                            // 1つ前のレベルは満タンでレベルアップ
    }
    p = Math.max(0, p - g);
    return { job, lv, rem: lv >= LV_CAP ? 0 : Math.max(0, lvNeed(job, lv) - p) };
  }
  // 強敵ボーナス率(%)。敵Lv(data-elv)を持つモンスター（現状デュラハーンのみ）に適用する固定値。
  // 実測: 総獲得経験値がゲーム内の値と1の位まで一致（+20%固定だと端数戦闘で1匹あたり1,140ずれる）
  const STRONG_BONUS_PCT = 15;

  // Lv143(上限)に到達するまでに必要な残り経験値。「次まで」未入力(rem=null)や状態なしは上限なし(Infinity)
  function lvCapNeed(st) {
    if (!st || st.rem == null) return Infinity;
    if (st.lv >= LV_CAP) return 0;
    let need = st.rem;
    for (let l = st.lv + 1; l < LV_CAP; l++) need += lvNeed(st.job, l);
    return Math.max(0, need);
  }

  const CALL_LABELS = ["", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

  const TYPE_LABEL = {
    pass: "[通]", angel: "[エ]", overflow: "[溢]",
    normal: "", lap_only: "[LAP]", job: "転職", withdraw: "[引出]",
  };
  const TYPE_COLOR = {
    pass: "#f88", angel: "#5a9eff", overflow: "#aaa",
    lap_only: "#2cc9ff", job: "#00bcd4", withdraw: "#f0c452",
  };

  // ─── CSV2テーブル（最適モンスター選定） ────────────────────────────────
  const CSV2_TABLE = (function () {
    const rows = [
      // [food, tr, ag, em, elix, pb, result]
      ["0","0","1","1","none","0","rita_or_kuma"],
      ["1","0","1","1","none","0","rita_or_kuma"],
      ["0","0","1","0","genki","0","rita_or_kuma"],
      ["1","0","1","0","genki","0","rita_or_kuma"],
      ["0","0","1","1","genki","0","rita_or_kuma"],
      ["1","0","1","1","genki","0","rita_or_kuma"],
    ];
    const map = {};
    rows.forEach(([food, tr, ag, em, elix, pb, result]) => {
      map[`${food}|${tr}|${ag}|${em}|${elix}|${pb}`] = result;
    });
    return map;
  })();

  // ─── CSV1テーブル（最適呼び数） ────────────────────────────────────────
  const CSV1_TABLE = (function () {
    const rows = [
      ["returner","0","0","0","1","0","genki",11],
      ["returner","0","0","1","1","0","none",11],
      ["returner","0","0","1","1","0","genki",10],
      ["returner","1","0","0","1","0","genki",10],
      ["returner","1","0","1","1","0","none",10],
      ["returner","1","0","1","1","0","genki",8],
      ["durahan","0","0","0","0","0","genki",12],
      ["durahan","0","0","0","0","1","genki",12],
      ["durahan","0","0","0","1","0","none",9],
      ["durahan","0","0","0","1","0","genki",7],
      ["durahan","0","0","0","1","1","genki",12],
      ["durahan","0","0","1","0","0","none",12],
      ["durahan","0","0","1","0","0","genki",9],
      ["durahan","0","0","1","0","1","none",12],
      ["durahan","0","0","1","0","1","genki",9],
      ["durahan","0","0","1","1","0","none",7],
      ["durahan","0","0","1","1","0","genki",6],
      ["durahan","0","0","1","1","0","bakushin",11],
      ["durahan","0","0","1","1","1","none",12],
      ["durahan","0","0","1","1","1","genki",9],
      ["durahan","0","1","0","1","0","bakushin",11],
      ["durahan","0","1","1","1","0","genki",11],
      ["durahan","0","1","1","1","0","bakushin",9],
      ["durahan","1","0","0","0","0","genki",10],
      ["durahan","1","0","0","0","1","genki",10],
      ["durahan","1","0","0","1","0","none",8],
      ["durahan","1","0","0","1","0","genki",6],
      ["durahan","1","0","0","1","0","bakushin",12],
      ["durahan","1","0","0","1","1","genki",10],
      ["durahan","1","0","1","0","0","none",10],
      ["durahan","1","0","1","0","0","genki",8],
      ["durahan","1","0","1","0","1","none",10],
      ["durahan","1","0","1","0","1","genki",8],
      ["durahan","1","0","1","1","0","none",6],
      ["durahan","1","0","1","1","0","genki",5],
      ["durahan","1","0","1","1","0","bakushin",10],
      ["durahan","1","0","1","1","1","none",10],
      ["durahan","1","0","1","1","1","genki",8],
      ["durahan","1","1","0","1","0","genki",12],
      ["durahan","1","1","0","1","0","bakushin",10],
      ["durahan","1","1","1","0","0","bakushin",12],
      ["durahan","1","1","1","0","1","bakushin",12],
      ["durahan","1","1","1","1","0","none",12],
      ["durahan","1","1","1","1","0","genki",10],
      ["durahan","1","1","1","1","0","bakushin",9],
      ["durahan","1","1","1","1","1","bakushin",12],
      ["dearthlicant","0","0","0","1","0","genki",10],
      ["dearthlicant","0","0","1","1","0","none",10],
      ["dearthlicant","0","0","1","1","0","genki",8],
      ["dearthlicant","1","0","0","1","0","none",12],
      ["dearthlicant","1","0","0","1","0","genki",9],
      ["dearthlicant","1","0","1","0","0","genki",12],
      ["dearthlicant","1","0","1","0","1","genki",12],
      ["dearthlicant","1","0","1","1","0","none",9],
      ["dearthlicant","1","0","1","1","0","genki",7],
      ["dearthlicant","1","0","1","1","1","genki",12],
    ];
    const map = {};
    rows.forEach(([mid, food, tr, em, ag, pb, elix, num]) => {
      map[`${mid}|${food}|${tr}|${em}|${ag}|${pb}|${elix}`] = num;
    });
    return map;
  })();

  // ─── お供選択肢テンプレート（cloneNode で再利用） ───────────────
  function buildPartnerTemplate(includeDearth) {
    const frag = document.createDocumentFragment();
    const defs = [
      ["none",     "お供無"],
      ["hm1",      "はぐメタ1"],
      ["hm2",      "はぐメタ2"],
      ["hm3",      "はぐメタ3"],
      ["mk",       "メタキン"],
      ["gn",       "ゲノミー"],
      ["sn",       "ﾀｯﾋﾟﾂ仙人"],
    ];
    if (includeDearth) defs.push(["zucchini", "ズッキ祖"]);
    defs.forEach(([val, label]) => {
      const opt = document.createElement("option");
      opt.value = val;
      opt.textContent = label;
      frag.appendChild(opt);
    });
    return frag;
  }

  // ─── ファクトリ関数（インスタンスを返す） ─────────────────────────────
  function createExpCalc() {
    // 状態
    let timerHandle  = null;
    let startTime    = 0;
    let pauseSec     = 0;
    let lastLapSec   = 0;
    let jobOffsetSec = 0;
    let killCount    = 0;
    let optCallCount = 1;
    let calcLockedUntil = 0;
    let ritaOrKuma   = "returner";
    let lapNotifyEnabled = false;
    let lapNotifyFired   = false;
    let audioCtx     = null;
    let jobBtnLocked = false;      // 転職ボタン連打防止フラグ
    let flowSuspend  = 0;          // >0 の間は通帳振り分けの連動再計算を保留（複数行をまとめて追加する間）
    let flowBusy     = false;      // 連動再計算の再入防止
    let lvAnchor     = null;       // レベル推移の起点 { job, lv, rem }（「設定」時点＝それまでの履歴を含んだ状態）
    let lvNow        = null;       // 履歴をたどった現在のレベル状態 { job, lv, rem }（未設定ならnull）
    let lvInputsPending = false;   // レベル入力の編集中は、他の再描画で空欄を上書きしない

    // DOM キャッシュ（render後に設定）
    let root = null;

    // ── DOM ヘルパー ────────────────────────────────────────────────────
    function $(id) { return root ? root.querySelector(`#${id}`) : document.getElementById(id); }

    // ── 時間フォーマット ─────────────────────────────────────────────────
    function formatTime(sec) {
      if (!isFinite(sec) || sec < 0) return "00:00.00";
      const m = Math.floor(sec / 60);
      const s = (sec % 60).toFixed(2).padStart(5, "0");
      return `${String(m).padStart(2, "0")}:${s}`;
    }

    // ── 経験値計算 ───────────────────────────────────────────────────────
    function calcExp(callCount, partnerKey = "none", snap = null) {
      let baseExp, bonusExp, fd, tr, ag, em, elixir, pbVal, elv;

      if (snap) {
        const msOption = root.querySelector(`#ms option[value="${snap.ms}"]`);
        baseExp  = parseInt(msOption?.dataset.base)  || 0;
        bonusExp = parseInt(msOption?.dataset.bonus) || 0;
        elv      = parseInt(msOption?.dataset.elv) || 0;
        ({ fd, tr, ag, em, elixir, pb: pbVal } = snap);
      } else {
        const sel = $("ms");
        const opt = sel.options[sel.selectedIndex];
        baseExp  = parseInt(opt.dataset.base)  || 0;
        bonusExp = parseInt(opt.dataset.bonus) || 0;
        elv      = parseInt(opt.dataset.elv) || 0;
        fd     = $("fd").checked;
        tr     = $("tr").checked;
        ag     = $("ag").checked;
        em     = $("em").checked;
        elixir = root.querySelector('input[name="e_exp"]:checked')?.value || "none";
        pbVal  = root.querySelector('input[name="pb"]:checked')?.value || "0";
      }

      // 強敵ボーナス: 敵Lv(data-elv)を持つモンスター（現状デュラハーンのみ）は +15% 固定（端数は切り上げ）。
      // 他のモンスターは従来の固定値(data-bonus)のまま。
      if (elv > 0) {
        bonusExp = Math.ceil(baseExp * STRONG_BONUS_PCT / 100);
      }

      // 倍率は「10倍した整数」(r10)で保持する（ver2.7.3）。
      // 小数のまま足す(1.0+0.3+1=2.3)と、23990*2.3=55176.99999999999 のような浮動小数点誤差が出て、
      // 数学的に整数ちょうどになる組み合わせで floor が1つ落ち、料理の+1補正が打ち消されていた。
      let r10 = 10;
      if (fd) r10 += 3;
      if (elixir === "genki")   r10 += 10;
      if (elixir === "bakushin") r10 += 20;
      if (tr) r10 += 10;
      if (em) r10 += 10;

      const partnerExpVal  = PARTNER_EXP[partnerKey] || 0;
      const passbookLimit  = parseInt(pbVal) || 0;
      const hasPassbook    = passbookLimit > 0;
      const isHighLimit    = elixir === "bakushin" || tr;
      const expLimit       = isHighLimit ? 1499999 : 599999;

      // 通常分は10倍整数(tenths)のまま保持し、最後に整数除算で floor する
      const tenCommon  = baseExp * r10 + bonusExp * 10;
      const tenPCommon = partnerExpVal * r10;
      const rawAngel   = ag ? baseExp * 2 : 0;
      const rawPAngel  = ag ? partnerExpVal * 2 : 0;

      // ゲームの経験値計算ロジック（実測値10件から確定）:
      //   floor(total) + (料理あり ? 1 : 0)
      // 料理(+0.3)があるとrateに小数部が生じる。c=5,10等でtotalが
      // 数学的には整数になる組み合わせでもゲームは+1する。
      // 料理なし(rate=整数)はtotalが正確に整数になるため+1不要。
      // 実測: ヘルガーディアン 料理+元気 10匹=599751 / ダースリカント+ズッキ 料理+元気 10匹=370117（ver2.7.3）
      // エンゼル経験値(rawAngel)のrateは×2固定(整数)なので
      // callCount倍しても小数部が生じない → fdBonus不要。
      const fdBonus = fd ? 1 : 0;
      const rawTotalCommon = Math.floor((tenCommon * callCount + tenPCommon) / 10) + fdBonus;
      const rawTotalAngel  = Math.floor(rawAngel  * callCount + rawPAngel);
      const rawTotal       = rawTotalCommon + rawTotalAngel;

      if (hasPassbook) {
        const commonCapped = Math.min(rawTotalCommon, expLimit);
        const angelCapped  = Math.min(rawTotalAngel,  expLimit);
        const overflow     = Math.max(0, (rawTotalCommon - commonCapped) + (rawTotalAngel - angelCapped));
        const common       = commonCapped;
        const angel        = angelCapped;
        return { total: common + angel, common, angel, overflow,
          rawTotalCapped: commonCapped + angelCapped,
          rawCommonCapped: commonCapped, rawAngelCapped: angelCapped };
      } else {
        const cappedTotal = Math.min(rawTotal, expLimit);
        return { total: cappedTotal, common: cappedTotal, angel: 0,
          overflow: Math.max(0, rawTotal - cappedTotal),
          rawTotalCapped: cappedTotal, rawCommonCapped: cappedTotal, rawAngelCapped: 0 };
      }
    }

    // ── 最適モンスター特定 ───────────────────────────────────────────────
    function lookupOptimalMonster() {
      const elixir = root.querySelector('input[name="e_exp"]:checked')?.value || "none";
      if (elixir === "none") return "durahan";
      const food = $("fd").checked ? "1" : "0";
      const tr   = $("tr").checked ? "1" : "0";
      const ag   = $("ag").checked ? "1" : "0";
      const em   = $("em").checked ? "1" : "0";
      const pbRaw = root.querySelector('input[name="pb"]:checked')?.value || "0";
      const pb   = pbRaw !== "0" ? "1" : "0";
      const key  = `${food}|${tr}|${ag}|${em}|${elixir}|${pb}`;
      const result = CSV2_TABLE[key];
      if (!result) return "durahan";
      return result === "rita_or_kuma" ? ritaOrKuma : result;
    }

    // ── 最適呼び数特定 ───────────────────────────────────────────────────
    function lookupOptimalCallCount() {
      const ms     = $("ms").value;
      const food   = $("fd").checked   ? "1" : "0";
      const tr     = $("tr").checked   ? "1" : "0";
      const em     = $("em").checked   ? "1" : "0";
      const ag     = $("ag").checked   ? "1" : "0";
      const pbRaw  = root.querySelector('input[name="pb"]:checked')?.value || "0";
      const pb     = pbRaw !== "0"     ? "1" : "0";
      const elixir = root.querySelector('input[name="e_exp"]:checked')?.value || "none";
      const key    = `${ms}|${food}|${tr}|${em}|${ag}|${pb}|${elixir}`;

      if (CSV1_TABLE[key] !== undefined) return CSV1_TABLE[key];

      // テーブルに無い場合: 上限以下の最大呼び数を探索
      const isHighLimit = elixir === "bakushin" || tr === "1";
      const expLimit    = isHighLimit ? 1499999 : 599999;
      let opt = 1;
      for (let i = 1; i <= 12; i++) {
        if (calcExp(i).common < expLimit) opt = i;
        else break;
      }
      return opt;
    }

    // ── 音声通知（2つ目から移植: state管理・resume対応・音色変更） ────────
    function playLapWarning() {
      try {
        if (!audioCtx || audioCtx.state === 'closed') {
          audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') {
          audioCtx.resume().catch(() => {});
        }

        const ctx = audioCtx;
        const playBeep = (freq, start, dur) => {
          const osc  = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = freq;
          osc.type = "sine";
          gain.gain.setValueAtTime(0.25, start);
          gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
          osc.start(start);
          osc.stop(start + dur);
        };

        // 一般的な通知音に近い音階
        playBeep(880, ctx.currentTime,        0.18);
        playBeep(1047, ctx.currentTime + 0.24, 0.22);
      } catch (e) {
        console.warn('Lap notification unavailable:', e);
      }
    }

    // ── タイマー表示更新 ─────────────────────────────────────────────────
    function updateTimerDisplay(elapsedSec) {
      $("timerDisplay").textContent    = formatTime(elapsedSec);
      $("lapTimeDisplay").textContent  = formatTime(elapsedSec - lastLapSec);
      const syncSec = Math.max(0, elapsedSec - jobOffsetSec);
      const syncEl  = $("syncDisplay");
      if (syncSec > 0) {
        syncEl.textContent = `オプション持続: ${formatTime(syncSec)}`;
      } else {
        syncEl.textContent = "\u00A0";
      }
    }

    // ── 平均ラップ取得 ───────────────────────────────────────────────────
    // { avg: number, count: number } を返す。対象行がなければ null
    function getAverageLapSec() {
      const times = rowCache
        .filter(r => r.dataset.lap !== "-1" &&
                     r.dataset.type !== "lap_only" &&
                     r.dataset.type !== "job" &&
                     r.dataset.main === "true")
        .map(r => parseFloat(r.dataset.lap))
        .filter(v => !isNaN(v));
      if (times.length === 0) return null;
      return { avg: times.reduce((a, b) => a + b, 0) / times.length, count: times.length };
    }

    // ── 行キャッシュ（追加順: 古い→新しい） ─────────────────────────────
    const rowCache = [];   // rowCache[0] が最初に追加された行

    // ── 通帳残高を時系列で計算し、引出行の実額を同期する ─────────────────────
    // 引出は「その時点の残高」を超えて引けない（現実にマイナス残高は存在しない）。
    // 引出行は要求額(dataset.req)を保持し、実額(dataset.val)は都度 min(req, その時点の残高) で
    // 決める。引出後に元の通帳行を下方修正しても赤字が後続に持ち越されず、
    // 元の値に戻せば引出も要求額に戻る。戻り値は現在の通帳残高。
    // cap: Lv143到達までに必要な経験値（これを超える分は引き出さず通帳に残す）。
    //      省略時は recomputePassbookFlow が保存した dataset.wcap を使う（無ければ上限なし）。
    function applyWithdraw(r, balance, cap) {
      const req = parseFloat(r.dataset.req);
      const requested = isNaN(req) ? (parseFloat(r.dataset.val) || 0) : req;
      const c = cap !== undefined ? cap : parseFloat(r.dataset.wcap);
      const capV = Number.isFinite(c) ? c : Infinity;
      const eff = Math.min(requested, balance, capV);
      if (parseFloat(r.dataset.val) !== eff) {
        r.dataset.val          = eff;
        r.dataset.rawValCapped = eff;
        const el = r.querySelector(".exp-value");
        if (el) el.textContent = "-" + eff.toLocaleString();
      }
      return balance - eff;
    }

    function syncPassbook(upTo = rowCache.length) {
      let balance = 0;
      rowCache.slice(0, upTo).forEach(r => {
        if (r.dataset.type === "pass") balance += parseFloat(r.dataset.val) || 0;
        else if (r.dataset.type === "withdraw") balance = applyWithdraw(r, balance);
      });
      return balance;
    }

    // ── パートナーセレクト生成 ───────────────────────────────────────────
    function buildPartnerSelect(monsterId, selectedKey) {
      const sel = document.createElement("select");
      sel.className = "rs";
      const frag = buildPartnerTemplate(monsterId === "dearthlicant");
      sel.appendChild(frag);
      if (selectedKey) sel.value = selectedKey;
      return sel;
    }

    // ── 呼び数セレクト生成 ───────────────────────────────────────────────
    function buildCallSelect(callCount) {
      const sel = document.createElement("select");
      sel.className = "cs";
      for (let i = 1; i <= 12; i++) {
        const opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = CALL_LABELS[i];
        if (i === parseInt(callCount)) opt.selected = true;   // 復元時は文字列で渡るため数値化して比較
        sel.appendChild(opt);
      }
      return sel;
    }

    // ── 履歴行の条件編集（createExpCalc 直下に配置。addRow のたびに再生成しない）──
    function readRowSnapshot(row) {
      const base = {
        fd:     $("fd").checked,
        tr:     $("tr").checked,
        ag:     $("ag").checked,
        em:     $("em").checked,
        elixir: root.querySelector('input[name="e_exp"]:checked')?.value || "none",
        pb:     root.querySelector('input[name="pb"]:checked')?.value || "0",
        ms:     row?.dataset.monsterId || $("ms").value,
      };
      if (!row?.dataset.snapshot) return base;
      try {
        return { ...base, ...JSON.parse(row.dataset.snapshot) };
      } catch {
        return base;
      }
    }


    // ═══════════════════════════════════════════════════════════════════
    // 通帳振り分けの連動再計算
    // ═══════════════════════════════════════════════════════════════════
    // 方針: 1回の戦闘（グループ）の行構成は「条件(snapshot)・呼び数・お供・その時点の通帳残高」
    // から導出される。どこかの履歴を変更（条件編集/呼び数/お供/削除/引出/通帳切替）したら、
    // 時系列で先頭から通帳残高をたどり直し、以降の全グループの
    //   通帳行 / 溢れ行 / エンゼル行 / 通常行
    // を再計算する。構成が変わるグループだけ行を作り直し、値だけ変わるものは値のみ更新する。
    //
    // グループ = main==="true" の行 + 直後に続く main!=="true" の戦闘行
    //            （通帳行+溢れ行+エンゼル行。全額溢れの場合は溢れ行がmain）

    function snapOf(r) {
      try { return JSON.parse(r.dataset.snapshot || "{}"); } catch (e) { return {}; }
    }
    // 「設定」時点までに存在した行（入力されたLv状態に既に含まれている行）
    function isLvOld(r) { return snapOf(r).lo === 1; }
    function stampLv(group, lv) {
      group.forEach(r => {
        const sn = snapOf(r);
        if (sn.lv !== lv) { sn.lv = lv; r.dataset.snapshot = JSON.stringify(sn); }
      });
    }
    // レベル入力欄＝現在値の表示。入力中の欄は上書きしない
    function updateLvInfo() {
      const jobSel = $("lvJob"), inLv = $("lvIn"), inRem = $("lvRem");
      if (!inLv || !inRem || !jobSel) return;
      const active = document.activeElement;
      if (lvNow && active !== jobSel && jobSel.value !== lvNow.job) jobSel.value = lvNow.job;
      const jobSelected = jobSel.value !== "";
      inLv.disabled = !jobSelected;
      inRem.disabled = !jobSelected;
      $("btnLvDown").disabled = !jobSelected;
      $("btnLvUp").disabled = !jobSelected;
      $("lvRem").parentElement.querySelector(".lv-rem-label")?.classList.toggle("lv-disabled", !jobSelected);
      if (lvNow) {
        if (!lvInputsPending && active !== inLv)   inLv.value  = lvNow.lv;
        if (!lvInputsPending && active !== inRem)  inRem.value = lvNow.rem == null ? "" : Math.max(0, Math.round(lvNow.rem));
      }
      if (lvNow) {
        try {
          localStorage.setItem(STORAGE_KEYS.LV, JSON.stringify({ job: lvNow.job, lv: lvNow.lv, rem: lvNow.rem == null ? null : Math.round(lvNow.rem) }));
        } catch (e) {}
      }
    }

    function isBattleRow(r) {
      const t = r.dataset.type;
      return t !== "lap_only" && t !== "job" && t !== "withdraw";
    }

    function getGroupOf(row) {
      if (!isBattleRow(row)) return [row];
      let i = rowCache.indexOf(row);
      if (i < 0) return [row];
      while (i > 0 && rowCache[i].dataset.main !== "true" && isBattleRow(rowCache[i - 1])) i--;
      let j = i + 1;
      while (j < rowCache.length && isBattleRow(rowCache[j]) && rowCache[j].dataset.main !== "true") j++;
      return rowCache.slice(i, j);
    }

    // 1グループを現在の通帳残高(balance)で割り当て直す。戻り値: { used: 通帳に入った額, n: 割当後の行数 }
    function allocateGroup(group, startIdx, balance) {
      const main = group[0];
      let snap;
      try { snap = JSON.parse(main.dataset.snapshot || "{}"); } catch (e) { snap = {}; }
      const count = parseInt(main.dataset.count) || 1;
      let partner = group.map(r => r.querySelector(".rs")?.value).find(Boolean) || "none";
      if (partner === "zucchini" && snap.ms !== "dearthlicant") partner = "none";   // ズッキ祖はダースリカント専用
      const result = calcExp(count, partner, snap);
      const limit  = parseInt(snap.pb || "0") || 0;

      const desired = [];
      let passVal = 0;
      if (limit > 0) {
        const remaining = Math.max(0, limit - balance);
        passVal = Math.min(result.common, remaining);
        const ovVal = result.common - passVal;
        if (passVal > 0) desired.push({ type: "pass",     val: passVal, main: true });
        if (ovVal   > 0) desired.push({ type: "overflow", val: ovVal,   main: passVal === 0 });
        if (result.angel > 0) desired.push({ type: "angel", val: result.angel, main: false });
      } else {
        desired.push({ type: "normal", val: result.total, main: true });
      }
      if (desired.length === 0) desired.push({ type: limit > 0 ? "pass" : "normal", val: 0, main: true });

      const dirty = group.some(r => r.dataset.dirty === "1");   // 条件編集直後（モンスター変更でお供選択肢も変わる）
      const sameShape = !dirty && desired.length === group.length &&
        desired.every((d, k) => d.type === group[k].dataset.type && String(d.main) === group[k].dataset.main);

      if (sameShape) {
        desired.forEach((d, k) => {
          const r = group[k];
          if (parseFloat(r.dataset.val) !== d.val) {
            r.dataset.val          = d.val;
            r.dataset.rawValCapped = d.val;
            const el = r.querySelector(".exp-value");
            if (el) el.textContent = d.val.toLocaleString();
          }
        });
        return { used: passVal, n: group.length, changed: false };
      }

      // 構成が変わる: このグループの行を作り直す（位置・時刻・呼び数・お供・条件は引き継ぐ）
      const elapsedSec = parseFloat(main.dataset.sec) || 0;
      const lapRaw     = parseFloat(main.dataset.lap);
      const lapSec     = Number.isFinite(lapRaw) && lapRaw >= 0 ? lapRaw : null;
      const bid        = main.dataset.bid;
      group.forEach(r => {
        r.remove();
        rowCache.splice(rowCache.indexOf(r), 1);
      });
      desired.forEach((d, k) => {
        addRow(bid, count, d.val, d.type, elapsedSec, lapSec, d.main, d.val, snap.ms,
               { insertAt: startIdx + k, snapshot: snap, partner });
      });
      return { used: passVal, n: desired.length, changed: true };
    }

    // 履歴全体を時系列でたどり、通帳の振り分けと引出の実額を確定する。戻り値は最終残高。
    function recomputePassbookFlow() {
      if (flowBusy) return null;
      flowBusy = true;
      let balance = 0;
      let structureChanged = false;
      // レベル推移: 起点（全履歴より前の状態）から、履歴を時系列で加算して現在のLvを求める
      let st = lvAnchor ? { job: lvAnchor.job, lv: lvAnchor.lv, rem: lvAnchor.rem } : null;
      try {
        let i = 0;
        while (i < rowCache.length) {
          const r = rowCache[i];
          if (r.dataset.type === "withdraw") {
            const wcap = st ? lvCapNeed(st) : Infinity;
            if (Number.isFinite(wcap)) r.dataset.wcap = String(wcap); else delete r.dataset.wcap;
            balance = applyWithdraw(r, balance, wcap);
            if (st) lvAdvance(st, parseFloat(r.dataset.val) || 0);   // 引出分はキャラの経験値になる（全履歴が対象＝削除で巻き戻る）
            i++;
          } else if (!isBattleRow(r)) {
            i++;
          } else {
            let j = i + 1;
            while (j < rowCache.length && isBattleRow(rowCache[j]) && rowCache[j].dataset.main !== "true") j++;
            const grp = rowCache.slice(i, j);
            // 強敵率は行ごとに固定: 起点の再設定前から存在した行（lo）は過去の値を保持し、以降の行だけ時点のLvを記録する
            if (st && !isLvOld(grp[0])) stampLv(grp, st.lv);
            const res = allocateGroup(grp, i, balance);
            balance += res.used;
            if (res.changed) structureChanged = true;
            if (st) {
              // 通常・エンゼル行のみ加算（通帳への預入・溢れは加算しない）
              let gain = 0;
              rowCache.slice(i, i + res.n).forEach(x => {
                if (x.dataset.type === "normal" || x.dataset.type === "angel") gain += parseFloat(x.dataset.val) || 0;
              });
              lvAdvance(st, gain);
            }
            i += res.n;
          }
        }
        lvNow = st;
        updateLvInfo();
      } finally {
        flowBusy = false;
      }
      if (structureChanged) {
        renumberRows();
        recalcLaps();
      }
      return balance;
    }

    // 履歴行の条件編集: グループ全体に新しい条件を設定し、連動再計算に任せる
    function applyGroupSnapshot(row, nextSnapshot) {
      const json = JSON.stringify(nextSnapshot);
      getGroupOf(row).forEach(r => {
        r.dataset.snapshot  = json;
        r.dataset.monsterId = nextSnapshot.ms;
        r.dataset.dirty     = "1";
      });
      updateTotal();
      saveSession();
    }

    // 編集行を含め、それ以前（古い側）の全戦闘グループへ「変更した項目のみ」を適用する。
    // 編集行自身は編集内容そのもの(nextSnapshot)を適用。通帳・溢れ・強敵率の再計算は連動再計算に任せる。
    function applyGroupSnapshotUpTo(row, nextSnapshot, changes) {
      const editedGroup = getGroupOf(row);
      const lastIdx = rowCache.indexOf(editedGroup[editedGroup.length - 1]);
      const seen = new Set();
      const groups = [];
      rowCache.slice(0, lastIdx + 1).forEach((r) => {
        if (!isBattleRow(r)) return;
        const g = getGroupOf(r);
        if (seen.has(g[0])) return;
        seen.add(g[0]);
        groups.push(g);
      });
      groups.forEach((g) => {
        const isEdited = g[0] === editedGroup[0];
        const next = isEdited ? nextSnapshot : { ...readRowSnapshot(g[0]), ...changes };
        const json = JSON.stringify(next);
        g.forEach((r) => {
          r.dataset.snapshot  = json;
          r.dataset.monsterId = next.ms;
          r.dataset.dirty     = "1";
        });
      });
      updateTotal();
      saveSession();
    }

    function openRowSnapshotEditor(row) {
      const existing = root?.querySelector(".snapshot-editor");
      if (existing) { existing.remove(); }

      const snap = readRowSnapshot(row);
      const editor = document.createElement("div");
      editor.className = "snapshot-editor";

      const title = document.createElement("div");
      title.className = "snapshot-editor-title";
      title.textContent = "条件を編集";
      editor.appendChild(title);

      const grid = document.createElement("div");
      grid.className = "snapshot-editor-grid";

      const monsterWrap = document.createElement("label");
      monsterWrap.className = "snapshot-editor-field";
      monsterWrap.innerHTML = '<span>モンスター</span>';
      const monsterSel = document.createElement("select");
      monsterSel.className = "snapshot-editor-select";
      ["returner", "durahan", "hell", "scare", "dearthlicant", "golem_strong"].forEach((value) => {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = $("ms").querySelector(`option[value="${value}"]`)?.textContent || value;
        if (value === (snap.ms || $("ms").value)) opt.selected = true;
        monsterSel.appendChild(opt);
      });
      monsterWrap.appendChild(monsterSel);
      grid.appendChild(monsterWrap);

      const buffWrap = document.createElement("div");
      buffWrap.className = "snapshot-editor-buffs";
      const makeCheck = (id, labelText, checked) => {
        const label = document.createElement("label");
        label.className = "snapshot-editor-check";
        const box = document.createElement("input");
        box.type = "checkbox";
        box.checked = checked;
        box.id = `snapshot-${row.dataset.bid}-${id}`;
        const txt = document.createElement("span");
        txt.textContent = labelText;
        label.appendChild(box);
        label.appendChild(txt);
        return label;
      };
      buffWrap.appendChild(makeCheck("fd", "料理", !!snap.fd));
      buffWrap.appendChild(makeCheck("tr", "修練", !!snap.tr));
      buffWrap.appendChild(makeCheck("ag", "エンゼル", !!snap.ag));
      buffWrap.appendChild(makeCheck("em", "皇帝", !!snap.em));
      grid.appendChild(buffWrap);

      const elixirWrap = document.createElement("div");
      elixirWrap.className = "snapshot-editor-group";
      const elixirLabel = document.createElement("span");
      elixirLabel.textContent = "エリクサー";
      elixirWrap.appendChild(elixirLabel);
      const elixirRadios = ["none", "genki", "bakushin"];
      elixirRadios.forEach((value) => {
        const label = document.createElement("label");
        label.className = "snapshot-editor-radio";
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = `snapshot-elixir-${row.dataset.bid}`;
        radio.value = value;
        radio.checked = (snap.elixir || "none") === value;
        label.appendChild(radio);
        label.appendChild(document.createTextNode(value === "none" ? "無" : value === "genki" ? "元気" : "爆伸"));
        elixirWrap.appendChild(label);
      });
      grid.appendChild(elixirWrap);

      const pbWrap = document.createElement("div");
      pbWrap.className = "snapshot-editor-group";
      const pbLabel = document.createElement("span");
      pbLabel.textContent = "通帳";
      pbWrap.appendChild(pbLabel);
      ["0", "5000000", "10000000"].forEach((value) => {
        const label = document.createElement("label");
        label.className = "snapshot-editor-radio";
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = `snapshot-pb-${row.dataset.bid}`;
        radio.value = value;
        radio.checked = (snap.pb || "0") === value;
        label.appendChild(radio);
        label.appendChild(document.createTextNode(value === "0" ? "無" : value === "5000000" ? "1" : "2"));
        pbWrap.appendChild(label);
      });
      grid.appendChild(pbWrap);

      const prevWrap = document.createElement("label");
      prevWrap.className = "snapshot-editor-check";
      const prevBox = document.createElement("input");
      prevBox.type = "checkbox";
      prevBox.id = `snapshot-${row.dataset.bid}-prev`;
      const prevTxt = document.createElement("span");
      prevTxt.textContent = "手前の履歴も含む";
      prevWrap.appendChild(prevBox);
      prevWrap.appendChild(prevTxt);
      grid.appendChild(prevWrap);

      const actions = document.createElement("div");
      actions.className = "snapshot-editor-actions";

      const applyBtn = document.createElement("button");
      applyBtn.type = "button";
      applyBtn.textContent = "適用";
      applyBtn.onclick = () => {
        const fd = editor.querySelector(`#snapshot-${row.dataset.bid}-fd`)?.checked ?? !!snap.fd;
        const tr = editor.querySelector(`#snapshot-${row.dataset.bid}-tr`)?.checked ?? !!snap.tr;
        const ag = editor.querySelector(`#snapshot-${row.dataset.bid}-ag`)?.checked ?? !!snap.ag;
        const em = editor.querySelector(`#snapshot-${row.dataset.bid}-em`)?.checked ?? !!snap.em;
        const elixir = editor.querySelector(`input[name="snapshot-elixir-${row.dataset.bid}"]:checked`)?.value || snap.elixir || "none";
        const pb = editor.querySelector(`input[name="snapshot-pb-${row.dataset.bid}"]:checked`)?.value || snap.pb || "0";
        const ms = monsterSel.value;

        const nextSnapshot = { ...snap, fd, tr, ag, em, elixir, pb, ms };
        if (prevBox.checked) {
          // 変更した項目だけを抽出し、編集行以前の全グループへ適用する
          const changes = {};
          ["fd", "tr", "ag", "em", "elixir", "pb", "ms"].forEach((k) => {
            if (String(nextSnapshot[k]) !== String(snap[k])) changes[k] = nextSnapshot[k];
          });
          applyGroupSnapshotUpTo(row, nextSnapshot, changes);
        } else {
          applyGroupSnapshot(row, nextSnapshot);
        }
        editor.remove();
      };

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.textContent = "閉じる";
      cancelBtn.onclick = () => editor.remove();

      actions.appendChild(applyBtn);
      actions.appendChild(cancelBtn);
      editor.appendChild(grid);
      editor.appendChild(actions);

      if (root) {
        root.appendChild(editor);
      } else {
        document.body.appendChild(editor);
      }
    }


    // ── 行追加 ───────────────────────────────────────────────────────────
    // opts: { insertAt, snapshot, partner } … 条件編集での再挿入用（省略時は末尾に追加）
    function addRow(rowId, callCount, expVal, rowType, elapsedSec, lapSec,
                    isMain = false, rawCapped = null, monsterId = null, opts = {}) {

      const row = document.createElement("div");
      row.className = "exp-row";
      row.dataset.val          = expVal;
      row.dataset.rawValCapped = rawCapped !== null ? rawCapped : expVal;
      row.dataset.type         = rowType;
      row.dataset.sec          = elapsedSec;
      row.dataset.lap          = lapSec != null ? lapSec : -1;
      row.dataset.main         = isMain;
      row.dataset.count        = callCount;
      if (rowType === "withdraw") row.dataset.req = expVal;   // 引出の要求額（実額は syncPassbook が決定）
      row.dataset.bid          = rowId;
      row.dataset.monsterId    = monsterId || $("ms").value;

      const snapshot = opts.snapshot || {
        fd:     $("fd").checked,
        tr:     $("tr").checked,
        ag:     $("ag").checked,
        em:     $("em").checked,
        elixir: root.querySelector('input[name="e_exp"]:checked')?.value || "none",
        pb:     root.querySelector('input[name="pb"]:checked')?.value || "0",
        ms:     monsterId || $("ms").value,
      };
      row.dataset.snapshot = JSON.stringify(snapshot);

      // ── row-id span ────────────────────────────────────────────────────
      const rowIdSpan = document.createElement("span");
      if (rowId === "LAP") {
        rowIdSpan.className   = "row-id-lap";
        rowIdSpan.textContent = "LAP";
      } else if (rowType === "withdraw") {
        rowIdSpan.className   = "row-id-lap";
        rowIdSpan.textContent = "引出";
      } else {
        rowIdSpan.className   = "row-id-normal";
        rowIdSpan.textContent = `#${rowId}`;
      }
      row.appendChild(rowIdSpan);

      // ── 時間＋削除ボタン ────────────────────────────────────────────────
      const timeWrapper = document.createElement("div");
      timeWrapper.className = "time-wrapper";

      const timeCell = document.createElement("div");
      timeCell.className = "time-cell";

      const timeMain = document.createElement("div");
      timeMain.className   = "time-main";
      timeMain.textContent = formatTime(elapsedSec);
      timeCell.appendChild(timeMain);

      if (lapSec != null && lapSec >= 0) {
        const timeLap = document.createElement("div");
        timeLap.className   = "time-lap";
        timeLap.textContent = `L ${formatTime(lapSec)}`;
        timeCell.appendChild(timeLap);
      }

      timeWrapper.appendChild(timeCell);

      const delBtn = document.createElement("button");
      delBtn.className   = "del";
      delBtn.textContent = "×";
      delBtn.onclick = () => {
        // 通帳/溢れ/エンゼルは1回の戦闘から導出される行なので、どれを消しても戦闘ごと削除する
        getGroupOf(row).forEach(r => {
          r.remove();
          rowCache.splice(rowCache.indexOf(r), 1);
        });
        renumberRows();
        recalcLaps();
        updateTotal();
        saveSession();
      };
      timeWrapper.appendChild(delBtn);
      row.appendChild(timeWrapper);

      // ── 経験値セル ──────────────────────────────────────────────────────
      const expCell = document.createElement("div");
      if (rowId === "LAP") {
        expCell.className   = "exp-cell-lap";
        expCell.textContent = "LAP MARK";
      } else if (rowType === "job") {
        expCell.className = "exp-cell";
        const lbl = document.createElement("span");
        lbl.className   = "exp-label";
        lbl.style.color = TYPE_COLOR[rowType] || "";
        lbl.textContent = TYPE_LABEL[rowType] || "";
        expCell.appendChild(lbl);
      } else {
        expCell.className = "exp-cell";
        const valSpan = document.createElement("strong");
        valSpan.className   = "exp-value";
        valSpan.textContent = (rowType === "withdraw" ? "-" : "") + expVal.toLocaleString();
        const lbl = document.createElement("span");
        lbl.className   = "exp-label";
        lbl.style.color = TYPE_COLOR[rowType] || "";
        lbl.textContent = TYPE_LABEL[rowType] || "";
        expCell.appendChild(valSpan);
        expCell.appendChild(lbl);

        if (rowType !== "withdraw") {
          valSpan.style.cursor = "pointer";
          valSpan.title = "クリックで条件を編集";
          valSpan.onclick = (event) => {
            event.stopPropagation();
            openRowSnapshotEditor(row);
          };
        }
      }
      row.appendChild(expCell);

      // ── コントロール（呼び数・お供） ──────────────────────────────────
      if (rowId !== "LAP" && rowType !== "job" && rowType !== "withdraw") {
        const controls = document.createElement("div");
        controls.className = "row-controls";

        const rSel = buildPartnerSelect(row.dataset.monsterId, opts.partner || "none");
        const cSel = buildCallSelect(callCount);

        controls.appendChild(rSel);
        controls.appendChild(cSel);
        row.appendChild(controls);

        // 呼び数・お供の変更: 同一グループへ反映し、金額と以降の通帳振り分けは連動再計算に任せる
        const recalcRowExp = () => {
          const newCount   = parseInt(cSel.value);
          const newPartner = rSel.value;
          getGroupOf(row).forEach(r => {
            r.dataset.count = newCount;
            const rSelOther = r.querySelector(".rs");
            const cSelOther = r.querySelector(".cs");
            if (rSelOther && rSelOther !== rSel) rSelOther.value = newPartner;
            if (cSelOther && cSelOther !== cSel) cSelOther.value = String(newCount);
          });
          updateTotal();
          saveSession();
        };

        cSel.onchange = recalcRowExp;
        rSel.onchange = recalcRowExp;
      } else {
        const placeholder = document.createElement("div");
        placeholder.className   = "row-controls-placeholder";
        placeholder.textContent = "----------";
        row.appendChild(placeholder);
      }

      // ── DOM挿入 & キャッシュ追加 ─────────────────────────────────────
      if (opts.insertAt != null) {
        // 履歴途中への再挿入: rowCache は古→新、DOM は新→古なので「一つ古い行」の直前に入れる
        rowCache.splice(opts.insertAt, 0, row);
        const older = rowCache[opts.insertAt - 1];
        if (older && older.parentNode === $("rowHistory")) $("rowHistory").insertBefore(row, older);
        else $("rowHistory").appendChild(row);
      } else {
        $("rowHistory").prepend(row);
        rowCache.push(row);   // キャッシュは追加順（古→新）
      }

      updateTotal();
    }

    // ── 行番号振り直し ───────────────────────────────────────────────────
    function renumberRows() {
      let num = 0;
      rowCache.forEach(r => {
        if (!isBattleRow(r)) return;
        if (r.dataset.main === "true" || num === 0) num++;
        r.dataset.bid = num;   // 溢れ/エンゼル行も同じ番号に揃える（以前は番号振り直し時に取り残されていた）
        const el = r.querySelector(".row-id-normal");
        if (el) el.textContent = `#${num}`;
      });
      killCount = num;
    }

    // ── ラップ再計算 ─────────────────────────────────────────────────────
    function recalcLaps() {
      let prevSec = 0;
      for (let i = 0; i < rowCache.length; i++) {
        const r = rowCache[i];
        if (r.dataset.type === "withdraw") continue;   // 引出は戦闘ではないのでラップ計算から除外
        const sec = parseFloat(r.dataset.sec);
        if (isNaN(sec)) continue;
        const lap = sec - prevSec;
        r.dataset.lap = lap;
        const lapEl   = r.querySelector(".time-lap");
        const timeCell = r.querySelector(".time-cell");
        if (timeCell) {
          if (lapEl) {
            lapEl.textContent = `L ${formatTime(lap)}`;
          } else {
            const newLap = document.createElement("div");
            newLap.className   = "time-lap";
            newLap.textContent = `L ${formatTime(lap)}`;
            timeCell.appendChild(newLap);
          }
        }
        const type = r.dataset.type;
        const currentBid = r.dataset.bid;
        const next = rowCache[i + 1];
        const nextBid = next?.dataset.bid;
        const nextType = next?.dataset.type;
        const isGroupable = type !== "lap_only" && type !== "job" && type !== "withdraw";
        const nextGroupable = nextType !== "lap_only" && nextType !== "job" && nextType !== "withdraw";
        if (!isGroupable || !nextGroupable || currentBid !== nextBid) {
          prevSec = sec;
        }
      }

      const lapRows = rowCache.filter(r => r.dataset.type !== "withdraw");
      if (lapRows.length > 0) {
        const latest = parseFloat(lapRows[lapRows.length - 1].dataset.sec);
        if (!isNaN(latest)) lastLapSec = latest;
      } else {
        lastLapSec = 0;
      }
    }

    // ── 合計更新 ─────────────────────────────────────────────────────────
    function updateTotal() {
      let totalExp    = 0;
      if (!flowSuspend) recomputePassbookFlow();   // 通帳の振り分け・引出の実額を時系列で確定
      const passbookBalance = syncPassbook();

      rowCache.forEach(el => {
        const expVal = parseInt(el.dataset.val) || 0;
        if (el.dataset.type !== "withdraw") totalExp += expVal;   // 引出は新規獲得ではない
      });

      $("totalExpDisplay").textContent = totalExp.toLocaleString();

      const passbookLimit = parseInt(root.querySelector('input[name="pb"]:checked')?.value || "0") || 0;
      if (passbookLimit > 0) {
        const remaining = Math.max(0, passbookBalance);
        $("passbookExpDisplay").textContent = Math.ceil(remaining).toLocaleString();
      }

      const lapResult = getAverageLapSec();
      if (lapResult !== null) {
        const { avg: avgSec, count: lapCount } = lapResult;
        $("avgTimeDisplay").textContent = formatTime(avgSec);
        if (avgSec > 0.01) {
          const battles30min = Math.floor(1800 / avgSec);
          const expPerBattle = totalExp / lapCount;
          $("estimatedGoldDisplay").textContent =
            `${Math.round(expPerBattle * battles30min / 1e4)}万～` +
            `${Math.round(expPerBattle * (battles30min + 1) / 1e4)}万`;
        } else {
          $("estimatedGoldDisplay").textContent = "--";
        }
      } else {
        $("avgTimeDisplay").textContent      = "--:--.--";
        $("estimatedGoldDisplay").textContent = "--";
      }
    }

    // ── UI更新 ───────────────────────────────────────────────────────────
    function updateUI(autoSetCount = false) {
      const passbookLimit = parseInt(root.querySelector('input[name="pb"]:checked')?.value || "0") || 0;
      const passbookArea  = $("passbookArea");
      if (passbookLimit > 0) {
        passbookArea.classList.remove("hidden");
        $("passbookLimitText").textContent = passbookLimit.toLocaleString();
      } else {
        passbookArea.classList.add("hidden");
      }

      optCallCount = lookupOptimalCallCount();
      if (autoSetCount) $("cn").value = optCallCount;
      updateLvInfo();

      const callCount = parseInt($("cn").value);
      const expResult = calcExp(callCount);
      $("currentExpDisplay").textContent = expResult.total.toLocaleString();

      const overflowEl = $("overflowDisplay");
      if (expResult.overflow > 0) {
        overflowEl.classList.remove("invisible");
        overflowEl.textContent = `溢れ:${expResult.overflow.toLocaleString()}`;
      } else {
        overflowEl.classList.add("invisible");
      }

      checkOptimalMonsterButton();
    }

    function checkOptimalMonsterButton() {
      const current  = $("ms").value;
      const optimal  = lookupOptimalMonster();
      const btn      = $("btnOptMonster");
      const isOptimal = current === optimal;
      btn.disabled = isOptimal;
      btn.classList.toggle("is-optimal", isOptimal);
    }

    // ─────────────────────────────────────────────────────────────────────
    // ── 状態保存・復元（電話着信などによるプロセス強制終了への対策） ───────
    // ─────────────────────────────────────────────────────────────────────
    // 方針:
    //   ・使用中は状態を随時 localStorage へスナップショット保存する
    //   ・render() を開いた瞬間、まず必ず initState() でクリーンな状態にしてから、
    //     「起動中フラグ」が残っていれば（＝前回 destroy を経由せず終了した）復元する
    //   ・destroy()（正常な離脱）では保存データを破棄し、次回は復元されないようにする
    const STORAGE_KEYS = Object.freeze({
      SESSION: 'dqx_expm_session',
      ACTIVE: 'dqx_expm_active',
      LAP_NOTIFY: 'dqx_lap_notify',
      LV: 'dqx_expm_lv'
    });
    const STORAGE_KEY_SESSION = STORAGE_KEYS.SESSION;
    const STORAGE_KEY_ACTIVE  = STORAGE_KEYS.ACTIVE;

    function serializeRows() {
      return rowCache.map((r) => ({
        rowId:           r.dataset.bid,
        callCount:       r.dataset.count,
        expVal:          parseFloat(r.dataset.val) || 0,
        rowType:         r.dataset.type,
        elapsedSec:      parseFloat(r.dataset.sec) || 0,
        lapSec:          (r.dataset.lap !== undefined && parseFloat(r.dataset.lap) >= 0)
                            ? parseFloat(r.dataset.lap) : null,
        isMain:          r.dataset.main === "true",
        rawCapped:       r.dataset.rawValCapped !== undefined ? parseFloat(r.dataset.rawValCapped) : null,
        monsterId:       r.dataset.monsterId || null,
        partner:         r.querySelector(".rs")?.value || "none",
        req:             r.dataset.req !== undefined ? parseFloat(r.dataset.req) : null,
        snapshot:        r.dataset.snapshot || null,
      }));
    }

    // 現在のオプション入力状態（fd/tr/ag/em・通帳・呼び数）を取得
    function captureOptionState() {
      return {
        fd: $("fd")?.checked ?? true,
        tr: $("tr")?.checked ?? false,
        ag: $("ag")?.checked ?? false,
        em: $("em")?.checked ?? false,
        pb: root.querySelector('input[name="pb"]:checked')?.value || "0",
        cn: $("cn")?.value ?? null,
      };
    }

    function saveSession() {
      try {
        localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify({
          startTime, pauseSec, lastLapSec, jobOffsetSec,
          killCount, optCallCount, ritaOrKuma, lvAnchor,
          timerRunning: !!timerHandle,
          rows:    serializeRows(),
          options: captureOptionState(),
          savedAt: Date.now(),
        }));
      } catch (e) { /* Safari プライベートモード等での失敗は無視 */ }
    }

    function markActive() {
      try { localStorage.setItem(STORAGE_KEY_ACTIVE, '1'); } catch (e) {}
    }

    function clearSession() {
      try {
        localStorage.removeItem(STORAGE_KEY_ACTIVE);
        localStorage.removeItem(STORAGE_KEY_SESSION);
      } catch (e) {}
    }

    function initState() {
      // destroy() を挟まずに render() が呼ばれても、必ずクリーンな初期値から始める
      if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
      startTime = pauseSec = lastLapSec = jobOffsetSec = 0;
      killCount        = 0;
      optCallCount      = 1;
      calcLockedUntil   = 0;
      ritaOrKuma        = "returner";
      lapNotifyFired    = false;
      jobBtnLocked      = false;
      flowSuspend       = 0;
      flowBusy          = false;
      lvAnchor          = null;
      lvNow             = null;
      rowCache.length   = 0;
    }

    function restoreSessionIfCrashed() {
      const wasActive = localStorage.getItem(STORAGE_KEY_ACTIVE) === '1';
      if (!wasActive) return; // 前回 destroy() を経由して正常終了している → 復元しない

      let data = null;
      try {
        const raw = localStorage.getItem(STORAGE_KEY_SESSION);
        if (!raw) return;
        data = JSON.parse(raw);
      } catch (e) {
        console.warn('[expmercenary] セッション復元失敗:', e);
        clearSession();
        return;
      }

      // 復元可能な猶予は32分。ホーム遷移等を経由しない（destroyされない）状態で
      // 終了した場合でも、32分を超えた古いスナップショットは復元せず、
      // リセット処理（clearSession）を経由してクリーンな状態に倒す。
      const RESTORE_LIMIT_MS = 32 * 60 * 1000;
      if (!data || !data.savedAt || (Date.now() - data.savedAt) > RESTORE_LIMIT_MS) {
        clearSession();
        return;
      }

      try {
        // オプション（fd/tr/ag/em・通帳・呼び数）を先に復元する。
        // 通帳残高(syncPassbook)の計算は pb（通帳上限選択）に依存するため、
        // 行の再構築・updateTotal() より前に復元しておく必要がある。
        // 復元する履歴は保存時の起点に対して再計算する（前回引き継ぎ値との二重加算を避けるため必ず上書き）
        lvAnchor = (data.lvAnchor && data.lvAnchor.job)
          ? { job: data.lvAnchor.job, lv: data.lvAnchor.lv, rem: data.lvAnchor.rem }
          : null;
        lvNow = lvAnchor ? { ...lvAnchor } : null;
        if (data.options) {
          if ($("fd")) $("fd").checked = !!data.options.fd;
          if ($("tr")) $("tr").checked = !!data.options.tr;
          if ($("ag")) $("ag").checked = !!data.options.ag;
          if ($("em")) $("em").checked = !!data.options.em;
          if (data.options.pb !== undefined && data.options.pb !== null) {
            const pbRadio = root.querySelector(`input[name="pb"][value="${CSS.escape(String(data.options.pb))}"]`);
            if (pbRadio) pbRadio.checked = true;
          }
        }

        flowSuspend++;   // グループが揃う前に再計算が走らないよう、全行を戻し終えるまで保留
        (data.rows || []).forEach((r) => {
          addRow(
            r.rowId, r.callCount, r.expVal, r.rowType, r.elapsedSec, r.lapSec,
            r.isMain, r.rawCapped, r.monsterId
          );
          // addRow は現在のUI状態からsnapshotを再計算してしまうため、
          // 保存しておいた本来のsnapshot（当時のfd/tr/ag/em等の状態）で上書きする
          const restoredRow = rowCache[rowCache.length - 1];
          if (restoredRow && r.snapshot) restoredRow.dataset.snapshot = r.snapshot;
          if (restoredRow && r.req != null) restoredRow.dataset.req = r.req;   // 引出の要求額
          // お供の選択も復元（旧バージョンの保存データには partner が無いので無視）
          if (restoredRow && r.partner) {
            const rs = restoredRow.querySelector(".rs");
            if (rs) rs.value = r.partner;
          }
        });
        flowSuspend = Math.max(0, flowSuspend - 1);

        killCount      = data.killCount || 0;
        optCallCount   = data.optCallCount || 1;
        jobOffsetSec   = data.jobOffsetSec || 0;
        lastLapSec     = data.lastLapSec || 0;

        if (data.ritaOrKuma) {
          ritaOrKuma = data.ritaOrKuma;
          const isKuma = ritaOrKuma !== "returner";
          $("btnRita")?.classList.toggle("active-rita-kuma", !isKuma);
          $("btnKuma")?.classList.toggle("active-rita-kuma", isKuma);
        }

        // タイマーは自動再開はしない（安全のため一時停止状態で復元）が、
        // 経過時間は「保存した瞬間」までではなく「復元した瞬間（今）」までを
        // 開始時刻(startTime)との差分で計算する。電話の通話時間なども
        // 実際に経過した時間として反映させるため。
        if (data.timerRunning && data.startTime) {
          pauseSec = Math.max(0, (Date.now() - data.startTime) / 1000);
        } else {
          pauseSec = data.pauseSec || 0;
        }
        if (pauseSec > 0) {
          updateTimerDisplay(pauseSec);
          const btn = $("btnTimerStop");
          if (btn) btn.innerHTML = "タイマー<br>再開";
        }

        renumberRows();
        recalcLaps();
        updateUI(false);   // pb 復元後の通帳エリア表示・oc(optCallCount)の再計算を反映
        // cn（呼び数）は保存していた選択値をそのまま優先する
        // （updateUI(false) では autoSetCount=false のため cn.value は上書きされない）
        if (data.options && data.options.cn !== null && data.options.cn !== undefined && $("cn")) {
          $("cn").value = data.options.cn;
        }
        updateTotal();
        saveSession();   // savedAt を更新し、復元直後の32分猶予をリセットする

        window.dqxShowToast?.('前回のログを復元しました（電話や誤操作などで中断された可能性があります）', { duration: 3500 });
      } catch (e) {
        flowSuspend = 0;
        console.warn('[expmercenary] セッション復元処理でエラー:', e);
      }
    }

    // ─────────────────────────────────────────────────────────────────────
    // ── render ────────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────────────
    function render(containerSelector) {
      const container = typeof containerSelector === "string"
        ? document.querySelector(containerSelector)
        : containerSelector;
      if (!container) return;
      root = container;

      initState();   // ① destroy を挟まず開かれた場合に備え、必ずクリーンな状態にする

      const savedNotify = localStorage.getItem(STORAGE_KEYS.LAP_NOTIFY);
      if (savedNotify !== null) lapNotifyEnabled = savedNotify === "true";

      // ─── HTML テンプレート（1つ目の構造・並び順を維持、クラスベースに変換） ──
      container.innerHTML = `
<style>
${getStyles()}
</style>

<div class="c">
  <div class="row-top">
    <div class="notify-toggle">
      <input type="checkbox" id="lapNotifyToggle" ${lapNotifyEnabled ? "checked" : ""}>
      <label for="lapNotifyToggle">🔊 LAP</label>
    </div>
    <select id="ms" class="monster-select">
      <option value="returner"      data-base="13118" data-bonus="0">リターナーモア</option>
      <option value="durahan"       data-base="22802" data-bonus="4561" data-elv="150" selected>デュラハーン</option>
      <option value="hell"          data-base="23990" data-bonus="4798">ヘルガーディアン</option>
      <option value="scare"         data-base="22904" data-bonus="4581">スケアフレイル</option>
      <option value="dearthlicant"  data-base="15191" data-bonus="0">ダースリカント</option>
      <option value="golem_strong"  data-base="20350" data-bonus="0">ゴーレム強</option>
    </select>
    <div class="rita-kuma-col">
      <button id="btnRita" class="btn-rita-kuma active-rita-kuma">リタ</button>
      <button id="btnKuma" class="btn-rita-kuma">クマ</button>
    </div>
    <button id="btnOptMonster" class="btn-opt-monster">最適<br>ﾓﾝｽﾀｰ</button>
  </div>

  <div class="row-exp-summary">
    <div class="exp-card">
      <span id="currentExpDisplay" class="current-exp-value">0</span>
      <span id="overflowDisplay" class="overflow-text invisible">溢れ:0</span>
    </div>
    <div class="call-count-col">
      <div class="call-count-label">討伐数</div>
      <div class="call-count-stepper">
        <button id="btnCallDown" type="button" class="call-count-arrow" aria-label="討伐数を減らす"><svg viewBox="0 0 24 24" class="call-count-arrow-icon"><path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <select id="cn" class="call-count-select">
          <option value="1">A</option><option value="2">B</option><option value="3">C</option>
          <option value="4">D</option><option value="5">E</option><option value="6">F</option>
          <option value="7">G</option><option value="8">H</option><option value="9">I</option>
          <option value="10">J</option><option value="11" selected>K</option><option value="12">L</option>
        </select>
        <button id="btnCallUp" type="button" class="call-count-arrow" aria-label="討伐数を増やす"><svg viewBox="0 0 24 24" class="call-count-arrow-icon"><path d="M9 5 L16 12 L9 19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div>
    </div>
  </div>

  <div class="lv-panel">
    <select id="lvJob" class="passbook-select lv-job" title="職（必要経験値の計算用）">
      <option value="" selected>選択してください</option>
      ${LV_JOB_OPTIONS_HTML}
    </select>
    <button id="btnLvDown" type="button" class="call-count-arrow lv-arrow" aria-label="Lvを下げる"><svg viewBox="0 0 24 24" class="call-count-arrow-icon"><path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <input id="lvIn" type="number" min="1" max="143" inputmode="numeric" class="lv-num" placeholder="Lv" title="現在のレベル（書き換えるとその時点から再計算。Lvと次までを空にすると連動解除）">
    <button id="btnLvUp" type="button" class="call-count-arrow lv-arrow" aria-label="Lvを上げる"><svg viewBox="0 0 24 24" class="call-count-arrow-icon"><path d="M9 5 L16 12 L9 19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
    <span class="lv-rem-label">次Lv<br>まで</span>
    <input id="lvRem" type="number" min="0" inputmode="numeric" class="lv-rem" placeholder="任意" title="次のレベルまでの経験値（ゲーム内表示）。入力するとレベルが履歴と連動して上がります。空ならLv固定">
  </div>

  <div id="timer-row" class="timer-row">
    <div class="buff-area">
      <div class="buff-row-1">
        <button id="btnBuffReset" class="btn-oc">OC</button>
        <label><input id="fd" type="checkbox" checked />料理</label>
        <label><input id="tr" type="checkbox" />修練</label>
        <label><input id="ag" type="checkbox" />エンゼル</label>
        <label><input id="em" type="checkbox" />皇帝</label>
      </div>
      <div class="buff-row-2">
        <div class="elixir-radio-row">
          <label><input name="e_exp" type="radio" value="none" />無</label>
          <label><input name="e_exp" type="radio" value="genki" checked />元気</label>
          <label><input name="e_exp" type="radio" value="bakushin" />爆伸</label>
        </div>
        <span class="passbook-label">通帳:</span>
        <div class="passbook-radio-group">
          <label><input name="pb" type="radio" value="0" checked />無</label>
          <label><input name="pb" type="radio" value="5000000" />1</label>
          <label><input name="pb" type="radio" value="10000000" />2</label>
        </div>
      </div>
    </div>
    <button id="btnTimerStop" class="btn-timer-stop">タイマー<br>開始</button>
  </div>

  <div class="row-total-calc">
    <div class="total-panel panel-bg">
      <div class="total-row">
        <span class="total-label">総獲得</span>
        <span id="totalExpDisplay" class="total-value">0</span>
      </div>
      <div class="avg-row">
        <div>平均:<strong id="avgTimeDisplay" class="avg-value">--:--.--</strong></div>
      </div>
    </div>
    <button id="btnCalc" class="btn-calc">加算</button>
  </div>

  <div class="timer-panel panel-bg">
    <div class="timer-panel-top">
      <div id="timerDisplay" class="timer-display">00:00.00</div>
      <div class="timer-right">
        <div id="syncDisplay" class="sync-small">&nbsp;</div>
        <div><span class="lap-label-small">LAP:</span><span id="lapTimeDisplay" class="lap-display">00:00.00</span></div>
      </div>
    </div>
    <div class="timer-buttons-grid">
      <button id="btnAllClear"   class="btn-warning">AC</button>
      <button id="btnTimerPause" class="btn-danger">停止</button>
      <button id="btnJob"        class="btn-teal">転職</button>
      <button id="btnLap"        class="btn-info">LAP</button>
    </div>
  </div>

  <div class="row-copy-reward">
    <button id="btnCopyHistory" class="btn-copy">履歴コピー</button>
    <div id="estimatedReward" class="reward-card">
      想定玉給:<span id="estimatedGoldDisplay" class="text-green estimated-gold-value">--</span>
    </div>
  </div>

  <div id="passbookArea" class="passbook-area hidden">
    <div class="passbook-info">
      通帳:<strong id="passbookExpDisplay" class="text-red passbook-exp-value">0</strong>/<span id="passbookLimitText" class="passbook-limit-value">0</span>
    </div>
    <div class="passbook-buttons">
      <button id="btnPassbookReset">リセット</button>
    </div>
  </div>

  <div id="rowHistory" class="row-history"></div>
</div>`;

      // ── イベントリスナー登録 ─────────────────────────────────────────

      $("lapNotifyToggle").onchange = (e) => {
        lapNotifyEnabled = e.target.checked;
        localStorage.setItem(STORAGE_KEYS.LAP_NOTIFY, lapNotifyEnabled);
      };

      $("btnLap").onclick = () => {
        const elapsed = timerHandle
          ? (Date.now() - startTime) / 1000
          : pauseSec;
        const lap = timerHandle ? elapsed - lastLapSec : null;
        addRow("LAP", 0, 0, "lap_only", elapsed, lap);
        lastLapSec = elapsed;
        lapNotifyFired = false;
        updateTimerDisplay(elapsed);
        saveSession();
      };

      $("btnCalc").onclick = () => {
        if (Date.now() < calcLockedUntil) return;
        lapNotifyFired = false;
        killCount++;
        const elapsed = timerHandle
          ? (Date.now() - startTime) / 1000
          : pauseSec;
        const lap = timerHandle ? elapsed - lastLapSec : null;
        const callCount = parseInt($("cn").value);
        const expResult = calcExp(callCount);
        const passbookLimit = parseInt(root.querySelector('input[name="pb"]:checked')?.value || "0") || 0;

        flowSuspend++;   // 通帳行+溢れ行+エンゼル行を追加し終えるまで連動再計算を保留
        if (passbookLimit > 0) {
          const currentBalance = syncPassbook();
          const remaining = Math.max(0, passbookLimit - currentBalance);

          if (remaining >= expResult.common) {
            addRow(killCount, callCount, expResult.common, "pass", elapsed, lap, true, expResult.common, null);
          } else if (remaining > 0) {
            addRow(killCount, callCount, remaining, "pass", elapsed, lap, true, remaining, null);
            addRow(killCount, callCount, expResult.common - remaining, "overflow", elapsed, lap, false, expResult.common - remaining, null);
          } else {
            addRow(killCount, callCount, expResult.common, "overflow", elapsed, lap, true, expResult.common, null);
          }
          if (expResult.angel > 0) {
            addRow(killCount, callCount, expResult.angel, "angel", elapsed, lap, false, expResult.angel, null);
          }
        } else {
          addRow(killCount, callCount, expResult.total, "normal", elapsed, lap, true, expResult.total, null);
        }

        flowSuspend = Math.max(0, flowSuspend - 1);
        updateTotal();
        updateUI(false);   // レベル・強敵率・次回の予想値をロック解除を待たず即時反映

        lastLapSec = elapsed;
        updateTimerDisplay(elapsed);
        saveSession();

        // 3秒クールダウン
        calcLockedUntil = Date.now() + 3000;
        const calcBtn = $("btnCalc");
        calcBtn.disabled = true;
        calcBtn.classList.add("is-locked");
        let countdown = 3;
        const cd = setInterval(() => {
          countdown--;
          if (countdown > 0) {
            calcBtn.textContent = `(${countdown})`;
          } else {
            clearInterval(cd);
            calcBtn.disabled = false;
            calcBtn.classList.remove("is-locked");
            calcBtn.textContent = "加算";
            updateUI();
          }
        }, 1000);
      };

      $("btnAllClear").onclick = () => {
        if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
        pauseSec      = 0;
        startTime     = 0;
        lastLapSec    = 0;
        killCount     = 0;
        jobOffsetSec  = 0;
        rowCache.length = 0;
        $("rowHistory").textContent = "";
        $("btnTimerStop").innerHTML = "タイマー<br>開始";
        updateTimerDisplay(0);
        updateTotal();
        updateUI();
        clearSession();   // 明示的な全消去なので、クラッシュ復旧用スナップショットも消す
        markActive();     // ただし「起動中」フラグは立て直す（消えたままだと、以降のクラッシュが復元されない）
      };

      $("btnPassbookReset").onclick = () => {
        const currentBalance = syncPassbook();
        if (currentBalance <= 0) return;
        // Lv143に到達する分を超える額は引き出さず通帳に残す（Lv/次まで未入力ならキャップなし）
        const cap = lvCapNeed(lvNow);
        if (cap <= 0) {
          window.dqxShowToast?.("すでにLv143のため引き出せません", { duration: 3000 });
          return;
        }
        const amount = Math.min(currentBalance, cap);
        const elapsed = timerHandle ? (Date.now() - startTime) / 1000 : pauseSec;
        // bid は "WD" 固定（数値bidだと同bidの戦闘行と呼び数連動グループに混ざるため）
        addRow("WD", 0, amount, "withdraw", elapsed, null, false, amount, null);
        saveSession();
      };

      $("btnJob").onclick = () => {
        if (!timerHandle && pauseSec === 0) return;
        if (jobBtnLocked) return;
        jobBtnLocked = true;
        setTimeout(() => { jobBtnLocked = false; }, 1000);

        const elapsed = timerHandle
          ? (Date.now() - startTime) / 1000
          : pauseSec;
        jobOffsetSec += 20;
        if (jobOffsetSec > elapsed) jobOffsetSec = elapsed;
        updateTimerDisplay(elapsed);
        if (timerHandle) {
          addRow("JOB", 0, 0, "job", elapsed, elapsed - lastLapSec);
          lastLapSec = elapsed;
        }
        saveSession();
      };

      $("btnRita").onclick = () => {
        ritaOrKuma = "returner";
        $("btnRita").classList.add("active-rita-kuma");
        $("btnKuma").classList.remove("active-rita-kuma");
        updateUI(false);
      };
      $("btnKuma").onclick = () => {
        ritaOrKuma = "dearthlicant";
        $("btnKuma").classList.add("active-rita-kuma");
        $("btnRita").classList.remove("active-rita-kuma");
        updateUI(false);
      };

      $("btnOptMonster").onclick = () => {
        $("ms").value = lookupOptimalMonster();
        updateUI(true);
      };

      // タイマー開始/再開（ラベルを状態に応じて切り替え）
      let lastAutoSaveTs = 0;
      $("btnTimerStop").onclick = () => {
        if (timerHandle) return;   // 既に動作中なら無視
        if (!audioCtx) {
          try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}
        }
        startTime   = Date.now() - pauseSec * 1000;
        timerHandle = setInterval(() => {
          const elapsed = (Date.now() - startTime) / 1000;
          updateTimerDisplay(elapsed);

          if (lapNotifyEnabled) {
            const lapResult = getAverageLapSec();
            const current   = elapsed - lastLapSec;
            if (lapResult !== null && current > lapResult.avg) {
              if (!lapNotifyFired) {
                lapNotifyFired = true;
                playLapWarning();
              }
            } else {
              lapNotifyFired = false;
            }
          }

          // タイマー動作中は1.5秒間隔で間引いてスナップショット保存
          // （42msごとに毎回保存すると負荷が高いため）
          const now = Date.now();
          if (now - lastAutoSaveTs > 1500) {
            lastAutoSaveTs = now;
            saveSession();
          }
        }, 42);    // ~24fps
        $("btnTimerStop").innerHTML = "タイマー<br>作動中";
        saveSession();
      };

      $("btnTimerPause").onclick = () => {
        if (!timerHandle) return;
        clearInterval(timerHandle);
        timerHandle = null;
        pauseSec    = (Date.now() - startTime) / 1000;
        lapNotifyFired = false;   // 停止時に警告状態をリセット
        updateTimerDisplay(pauseSec);
        $("btnTimerStop").innerHTML = "タイマー<br>再開";
        saveSession();
      };

      $("btnCopyHistory").onclick = () => {
        try {
          const lines = [];
          const msEl  = $("ms");
          lines.push(`モンスター/${msEl.options[msEl.selectedIndex].text}`);
          lines.push(`総獲得/平均タイム/想定玉給`);
          lines.push(
            `${$("totalExpDisplay").textContent.replace(/,/g, "")}` +
            `/${$("avgTimeDisplay").textContent}` +
            `/${$("estimatedGoldDisplay").textContent}`
          );
          lines.push(``);
          lines.push(`#/戦闘時間/獲得exp/呼び数/お供/種類`);

          [...rowCache].reverse().forEach(el => {
            const rowType = el.dataset.type || "";
            const rowId   = el.dataset.bid  || "-";
            if (rowType === "lap_only") {
              lines.push(`${rowId}/LAPMARK////`);
              return;
            }
            if (rowType === "job") {
              lines.push(`${rowId}/${formatTime(parseFloat(el.dataset.sec) || 0)}////転職`);
              return;
            }
            if (rowType === "withdraw") {
              lines.push(`引出/${formatTime(parseFloat(el.dataset.sec) || 0)}/-${parseInt(el.dataset.val) || 0}///引出`);
              return;
            }
            const timeStr     = formatTime(parseFloat(el.dataset.sec) || 0);
            const expVal      = (parseInt(el.dataset.val) || 0).toString();
            const callIdx     = parseInt(el.dataset.count);
            const callLabel   = !isNaN(callIdx) ? (CALL_LABELS[callIdx] || "--") : "--";
            const rSel        = el.querySelector(".rs");
            const partnerLabel = rSel
              ? (rSel.options[rSel.selectedIndex]?.text || "お供無")
              : "お供無";
            const typeLabel = rowType === "pass"    ? "通帳"
                            : rowType === "angel"   ? "エンゼル"
                            : rowType === "overflow"? "溢れ"
                            : "通常";
            lines.push(`${rowId}/${timeStr}/${expVal}/${callLabel}/${partnerLabel}/${typeLabel}`);
          });

          navigator.clipboard.writeText(lines.join("\n"))
            .then(()  => alert("履歴をコピーしました"))
            .catch(() => alert("コピー失敗（権限またはHTTPS環境を確認してください）"));
        } catch (e) {
          alert("コピー失敗");
        }
      };

      $("btnBuffReset").onclick = () => {
        $("fd").checked = true;
        $("tr").checked = false;
        $("ag").checked = false;
        $("em").checked = false;
        const genki = root.querySelector('input[name="e_exp"][value="genki"]');
        if (genki) genki.checked = true;
        const pbNone = root.querySelector('input[name="pb"][value="0"]');
        if (pbNone) pbNone.checked = true;
        updateUI(true);
      };

      $("btnCallDown").onclick = () => {
        const sel = $("cn");
        const newVal = Math.max(1, parseInt(sel.value) - 1);
        sel.value = String(newVal);
        updateUI(false);
      };
      $("btnCallUp").onclick = () => {
        const sel = $("cn");
        const newVal = Math.min(12, parseInt(sel.value) + 1);
        sel.value = String(newVal);
        updateUI(false);
      };

      root.querySelectorAll('input[name="e_exp"], #fd, #tr, #ag, #em, #ms')
          .forEach(el => { el.onchange = () => updateUI(true); });
      $("cn").onchange = () => updateUI(false);

      // ── レベル推移 ──
      // 前回終了時の最終状態を起点に引き継ぐ（履歴が空の新規セッション用。クラッシュ復元時は復元側が上書きする）
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.LV) || "null");
        if (saved && saved.job && saved.lv >= 1 && saved.lv <= LV_CAP) {
          lvAnchor = { job: saved.job, lv: saved.lv, rem: saved.rem == null ? null : Math.max(0, saved.rem) };
          lvNow    = { ...lvAnchor };
        }
      } catch (e) {}

      // 入力欄の書き換え = 「この時点の状態はこれ」。
      //   Lv+次まで : 既存履歴の獲得分を逆算して起点を決め直す（以後は履歴の増減に連動。削除で巻き戻る）
      //   Lvのみ    : Lv固定（経験値では連動しない。強敵率だけLvから決まる）
      //   両方空    : 連動解除
      // いずれも既存行の強敵率は書き換え前の値を保持する（過去の値が変わらない）。
      const applyLvInput = () => {
        const job = $("lvJob").value;
        const lvStr = $("lvIn").value.trim(), remStr = $("lvRem").value.trim();
        if (!job) {
          lvAnchor = null;
          lvNow = null;
          $("lvIn").value = "";
          $("lvRem").value = "";
          lvInputsPending = false;
          try { localStorage.removeItem(STORAGE_KEYS.LV); } catch (e) {}
          $("lvIn").classList.remove("lv-err");
          $("lvRem").classList.remove("lv-err");
          updateTotal(); updateUI(false); saveSession();
          return;
        }
        if (lvStr === "" && remStr === "") {
          lvAnchor = null; lvNow = null;
          lvInputsPending = false;
          try { localStorage.removeItem(STORAGE_KEYS.LV); } catch (e) {}
          $("lvIn").classList.remove("lv-err"); $("lvRem").classList.remove("lv-err");
          updateTotal(); updateUI(false); saveSession();
          return;
        }
        if (lvStr === "" && remStr !== "") {
          $("lvIn").classList.remove("lv-err");
          $("lvRem").classList.remove("lv-err");
          return;
        }
        const hasRem = remStr !== "";
        const lv = parseInt(lvStr), rem = parseInt(remStr);
        const lvBad  = !(lv >= 1 && lv <= LV_CAP);
        const remBad = hasRem && (!(rem >= 0) || (!lvBad && lv < LV_CAP && rem > lvNeed(job, lv)));
        $("lvIn").classList.toggle("lv-err",  lvBad && (lvStr !== "" || hasRem));
        $("lvRem").classList.toggle("lv-err", remBad);
        if (lvBad || remBad) return;   // 範囲外・Lv未入力は何もしない（赤枠で示す）
        lvInputsPending = false;
        rowCache.forEach(r => {
          const sn = snapOf(r);
          sn.lo = 1;
          r.dataset.snapshot = JSON.stringify(sn);
        });
        if (!hasRem) {
          lvAnchor = { job, lv, rem: null };
        } else {
          let gain = 0;
          rowCache.forEach(r => {
            const t = r.dataset.type;
            if (t === "normal" || t === "angel" || t === "withdraw") gain += parseFloat(r.dataset.val) || 0;
          });
          lvAnchor = lvUnwind(job, lv, lv >= LV_CAP ? 0 : rem, gain);
        }
        updateTotal(); updateUI(false); saveSession();
      };
      // 左右矢印: Lvを±1（空なら現在の上限Lvから開始）。次まで入力済みなら新Lvの上限内に収める
      const stepLv = (d) => {
        const cur = parseInt($("lvIn").value);
        const next = cur >= 1 ? Math.min(LV_CAP, Math.max(1, cur + d)) : LV_CAP;
        $("lvIn").value = next;
        const remEl = $("lvRem");
        if (remEl.value.trim() !== "") {
          const mx = lvNeed($("lvJob").value, next);
          if (next >= LV_CAP) remEl.value = 0;
          else if (parseInt(remEl.value) > mx) remEl.value = mx;
        }
        applyLvInput();
      };
      $("btnLvDown").onclick = () => stepLv(-1);
      $("btnLvUp").onclick   = () => stepLv(+1);
      // 桁数制限（type=number は maxlength が効かないため入力時に切り詰める）: Lv=3桁 / 次まで=7桁
      [["lvIn", 3], ["lvRem", 7]].forEach(([id, n]) => {
        $(id).oninput = () => {
          const v = $(id).value;
          if (v.length > n) $(id).value = v.slice(0, n);
          lvInputsPending = true;
        };
      });
      ["lvJob", "lvIn", "lvRem"].forEach(id => {
        $(id).onchange = applyLvInput;
        $(id).onkeydown = (ev) => { if (ev.key === "Enter") ev.target.blur(); };
      });

      // 通帳ラジオボタン切り替え時: 通帳あり行の上限を新しい上限へ差し替え、
      // 通帳行/溢れ行の振り分けを時系列で再計算する（超過分は切り捨てず溢れ行へ）
      root.querySelectorAll('input[name="pb"]').forEach(radio => {
        radio.onchange = () => {
          const newLimit = parseInt(root.querySelector('input[name="pb"]:checked')?.value || "0") || 0;
          if (newLimit > 0) {
            rowCache.forEach(r => {
              if (!isBattleRow(r)) return;
              try {
                const snap = JSON.parse(r.dataset.snapshot || "{}");
                if ((parseInt(snap.pb || "0") || 0) > 0) {
                  snap.pb = String(newLimit);
                  r.dataset.snapshot = JSON.stringify(snap);
                }
              } catch (e) {}
            });
          }
          updateTotal();
          updateUI(true);
          saveSession();
        };
      });

      // ── バージョン情報モーダル（ヘッダー常時表示、コンテンツ展開式） ─────
      (function addVersionModal() {
        if (document.getElementById('versionModal')) return;

        const modalHTML = `
<div id="versionModal">
  <div class="modal-tabs">
    <button class="modal-tab" data-tab="terms">利用規約</button>
    <button class="modal-tab" data-tab="data">データテーブル</button>
    <button class="modal-tab" data-tab="changelog">リリースログ</button>
  </div>
  <div id="tab-terms" class="modal-tab-content">
    <p>本ツールは管理人が作成した検証データに基づいて制作されています。</p>
    <p>本ツールは効率や計算結果を保証するためのものではありません。</p>
    <p class="modal-note-bold">内部データの無断転用、および二次利用は固く禁止します。</p>
  </div>
  <div id="tab-data" class="modal-tab-content">
    <div class="ref-table-grid">
        <div class="ref-table-card">
            <div class="ref-table-title">📋 (CSV2)</div>
            <img src="./images/ref_data_csv2.png" alt="最適モンスターテーブル" class="ref-table-img">
        </div>
        <div class="ref-table-card">
            <div class="ref-table-title">📊 (CSV1)</div>
            <img src="./images/ref_data_csv1.png" alt="最適呼び数テーブル" class="ref-table-img">
        </div>
    </div>
</div>
  <div id="tab-changelog" class="modal-tab-content">
    <pre class="modal-changelog">
v2.7.3

  - 経験値の計算誤差を修正しました。料理ありで整数ちょうどになる組み合わせ（例: ヘルガーディアン 料理+元気 10匹）で、ゲームより1少なく表示されていました

v2.7.2

  - デュラハーンの強敵ボーナスを +15% 固定にしました。PTに141以上がいるとレベル差が変わるため、職業レベルからの自動判定と率のプルダウンは廃止しました
  - 職・Lv・次までの入力は、レベルの推移を確認する用として残しています（任意）

v2.7.0

  - 職業レベルに応じた強敵ボーナスを自動計算し、設定から手動でも選べるようにしました
  - 通帳の引き出しについて1レベル分引き出しを撤廃しました。代わりに次のレベルまでの経験値を入力してあると、カンスト時に通帳側に経験値が残ります。設定していない場合は通常通り引き出されます
  - 履歴の条件編集を、編集した行より前の履歴にも同時に適用できるようにしました

v2.6.0 ...最終更新日 2026/10/01
  - 履歴行の条件編集（モンスター・料理・修練・エンゼル・皇帝・エリクサー・通帳）を追加。履歴の経験値部分を選択して編集可能
    - 変更内容に応じて通帳・溢れ・エンゼル・通常行の再構築を行える
    - 通帳を削除した場合は該当行を通常行として再登録し直すことができる
    - 編集後も履歴内の同じ位置に留まり、呼び数・お供の変更も引き続き連動する
    - 履歴のどこかを変更すると、以降の通帳行/溢れ行の振り分けも自動で再計算される
    - 削除は戦闘単位
    - 通帳の切替時、上限超過ぶんは切り捨てず溢れ行へ振り替える

v2.5.2 ...最終更新日 2026/09/30
  - 通帳の「リセット」「1Lv分引出」を履歴行（引出）として記録する方式に変更
    - 引出行を削除すると通帳残高も元に戻る
    - 引出行は総獲得・ラップ・平均タイムには影響しない
  - passbookOffset を廃止（残高は履歴を時系列でたどって都度算出）
  - 引出は「その時点の残高」までしか引けない仕様に変更
    （引出後に通帳行を下方修正しても、マイナス残高が次の加算に持ち越されない）
  - 復元時に匹数・お供のプルダウンが初期値に戻る不具合を修正

v2.5.1 ...最終更新日 2026/07/21
  - 下記定義をコメント内に明示
    - お供
    - 各Buff/アイテム(修練・皇帝・元気・爆伸)の効果・時間・課金情報
    - 通帳1/2の上限・金額・排他・オプション契約
    - LAPの実質的用途
  - 下記機能の撤廃
    - デスペナルティ及び関連UI(実用性のある精度の実装が不可能とされるため)

v2.5.0 ...最終更新日 2026/07/11
  - passbookOffset・remaining への冗長な Math.ceil を削除
  - angellimitの不正な処理を修正
  - お供あり+料理あり時の合算 floor+1 方式を実測確認
    （デュラハーン+はぐメタ3, 料理+元気, E=368243）

v2.4.0 ...最終更新日 2026/07/09
  - セッション自動保存・復元機能を追加
    （電話着信や誤操作などでツールがdestroyを経由せず終了した場合、
      32分以内であれば討伐数・タイマー・行データ等を自動復元）
  - ホーム遷移・ツール切り替え等を経由した正常終了時は保存データを破棄
  - 「全消去」ボタンでも保存データを合わせて破棄するよう修正

v2.3.0 ...最終更新日 2026/06/27
  - お供経験値の設定の修正
  - 計算ロジックの修正（floor + fdBonus 方式）
  - angelLimit を expLimit に統合
  - getAverageLapSec の戻り値を { avg, count } 形式に変更し updateTotal の重複集計を統合
  - renumberRows で overflow 行にも行番号を補正するよう修正
  - destroy() のリセット漏れ変数を追加（killCount / calcLockedUntil / lapNotifyFired / jobBtnLocked）
  - addVersionModal の DOM 参照を document 全体から root 起点に変更
  - totalExpDisplay の冗長な Math.ceil を削除

v2.2.0 ...最終更新日 2026/06/21
  - LAP及び転職行からデスペナルティを削除
  - 微細なカラー及びサイズ調整
  - 通帳選択をラジオボタンに変更
  - 討伐数選択左右にステッパー追加
  - 履歴行の連動強化
  - 大幅なレイアウト配置の変更
  - querySelectorAll をキャッシュ管理に変更
  - ritaOrKuma は AC リセット対象外に調整
  - passbookOffset の端数処理を Math.ceil で統一
  - ExpCalc をファクトリ関数化（複数インスタンス対応）
  - CSV1/CSV2 のキー型をすべて文字列に統一
  - calcLockedUntil の 100ms 制限を廃止

v2.1.0
  - LAP音声通知をresume対応版に更新
  - クラスベースCSSへ全面移行

v2.0.0
  - CSV1/CSV2テーブル導入
  - リタ/クマ優先切り替え追加
  - 最適モンスター選択ボタン追加
  - LAP音声通知機能追加
  - デスペナルティ想定機能調整
  - セキュリティ強化（XSS対策）
  - パフォーマンス調整（24fps）
  - 転職ボタン連打防止
  - 行削除時にAngel行があれば連動して削除
  - データテーブル実装に伴い「最適+1」ボタン廃止
  - ロジックの軽微な調整

v1.5.5
  - デスペナルティ予測(仮実装)
  - ゴーレム強/ダースリカント追加
  - OCボタン追加
  - 履歴コピーボタン追加
  - ブログ版1.5.5に対して軽微な変更
  - 当github pagesへの移行

v1.5.4
  - 一部のフォントサイズ拡大
  - レイアウト調整

v1.5.3
  - ツール枠撤廃
  - ロジックの軽微な調整

v1.4.5
  - 転職機能追加...転職におけるエリア移動の猶予時間を考慮して表示
  - ロジックの軽微な調整

v1.4.2
  - タイマー及び加算についての仮対応

v1.4.1
  - ダークモード導入
  - 呼び数自動選択実装(溢れる手前まで)

v1.2.8
  - 通帳2上限値の修正
  - AC時通帳内の経験値が残存する不具合を修正

v1.2.6
  - レイアウト構造の見直し(スマホ向けに調整)

v1.1.7
  - 最初期ver

ブログ: https://yr-dullahan.hatenablog.com/
    </pre>
  </div>
</div>`;

        const versionContainer = root.parentElement;
        if (versionContainer) {
          versionContainer.insertAdjacentHTML('afterend', modalHTML);
        }

        // モーダルは versionContainer の直後の兄弟要素として挿入される
        const modalEl   = versionContainer ? versionContainer.nextElementSibling : document.getElementById('versionModal');
        const tabs      = modalEl ? modalEl.querySelectorAll('.modal-tab')         : [];
        const contents  = modalEl ? modalEl.querySelectorAll('.modal-tab-content') : [];
        let activeTab = null;

        const openTab = (tabId) => {
          if (activeTab === tabId) {
            contents.forEach(c => c.classList.remove('active'));
            tabs.forEach(t => t.classList.remove('active'));
            activeTab = null;
            return;
          }

          contents.forEach(c => c.classList.remove('active'));
          tabs.forEach(t => t.classList.remove('active'));

          const target = modalEl ? modalEl.querySelector(`#tab-${tabId}`) : null;
          if (target) target.classList.add('active');

          const activeTabEl = modalEl ? modalEl.querySelector(`.modal-tab[data-tab="${tabId}"]`) : null;
          if (activeTabEl) activeTabEl.classList.add('active');

          activeTab = tabId;
        };

        tabs.forEach(tab => {
          tab.onclick = () => openTab(tab.dataset.tab);
        });
      })();

      updateUI(true);

      restoreSessionIfCrashed();   // ② 前回 destroy を経由せず終了していたら復元する
      markActive();                 // 今回のセッションを「起動中」としてマークする
    }

    // ── 公開インターフェース ─────────────────────────────────────────────
    return {
      render,
      destroy() {
        if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
        clearSession();   // 正常な離脱（destroyを経由）なので、復元対象からは外す
        startTime = pauseSec = lastLapSec = jobOffsetSec = 0;
        killCount = calcLockedUntil = 0;
        lapNotifyFired = jobBtnLocked = false;
        flowSuspend = 0; flowBusy = false;
        rowCache.length = 0;

        // render() で root.parentElement の afterend に挿入した versionModal を削除
        const modal = document.getElementById('versionModal');
        if (modal) modal.remove();
      },
    };
  }

  // ─── スタイル定義（クラスベース。1つ目のレイアウト寸法をそのままクラス化） ──
  function getStyles() {
    return `
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  body{margin:0;padding:0}
  .c{max-width:none;width:100%;margin:0;padding:0;background:transparent;border:none;border-radius:0;font-family:sans-serif;color:#333;line-height:1.25}
  select,input,button{font-family:inherit}

  .mono-digit,#timerDisplay,#lapTimeDisplay,#avgTimeDisplay,#passbookExpDisplay,#passbookLimitText,#totalExpDisplay,#estimatedGoldDisplay,#currentExpDisplay{
    font-family:'Verdana',system-ui,sans-serif;font-variant-numeric:tabular-nums;
  }

  label{color:#000}
  .text-orange{color:#f39c12}
  .text-green{color:#27ae60}
  .text-cyan{color:#2cc9ff}
  .text-red{color:#e74c3c}
  .hidden{display:none!important}
  .invisible{visibility:hidden}

  /* ── 上段: LAP通知/モンスター/リタ/クマ/最適モンスター ───────────── */
  .row-top{display:flex;gap:4px;margin-bottom:6px;align-items:center;min-height:36.75px}
  .notify-toggle{display:flex;align-items:center;gap:4px;background:#f0f7ff;padding:2px 8px;border-radius:20px;font-size:11px;border:1px solid #7ab8ff;flex-shrink:0;align-self:stretch}
  .notify-toggle input{width:16px;height:16px;margin:0;cursor:pointer}
  .notify-toggle label{cursor:pointer;font-size:11px;margin:0}
  .monster-select{flex:1.5;padding:6px;font-size:15px;border:1px solid #7ab8ff;border-radius:4px;font-weight:bold;text-align:center;background-color:#fff;color:#333;align-self:stretch}
  .rita-kuma-col{display:flex;flex-direction:row;gap:2px;flex-shrink:0;align-self:stretch}
  .btn-rita-kuma{font-size:10px;padding:2px 6px;border-radius:4px;border:1px solid #bbb;cursor:pointer;font-weight:bold;transition:background 0.15s,color 0.15s,border-color 0.15s;background:#f5f5f5;color:#888;white-space:nowrap;flex:1}
  .btn-rita-kuma.active-rita-kuma{background:#e8f0ff;color:#06c;border-color:#7ab8ff}
  .btn-opt-monster{background:#06c;color:#fff;border:none;border-radius:6px;font-size:10px;font-weight:bold;cursor:pointer;padding:3px 6px;line-height:1.3;white-space:nowrap;flex-shrink:0;align-self:stretch}
  .btn-opt-monster.is-optimal{opacity:0.5;cursor:not-allowed}

  /* ── 経験値・討伐数行 ────────────────────────────────────────────── */
  .row-exp-summary{display:flex;gap:4px;margin-bottom:8px;align-items:stretch}
  .exp-card{flex:2.4;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4px;background:#f0f7ff;border:1px solid #7ab8ff;border-radius:6px}
  .current-exp-value{font-size:22px;font-weight:bold;color:#06c}
  .overflow-text{font-size:9px;color:#999;margin-top:2px}
  .call-count-col{flex:1;display:flex;flex-direction:column;align-items:stretch;justify-content:center;height:auto}
  .call-count-label{font-size:7px;color:#666;margin-bottom:2px;text-align:center;flex-shrink:0}
  .call-count-stepper{display:flex;align-items:stretch;width:100%;gap:3px;flex:1;min-height:0}
  .call-count-arrow{flex:0 0 28px;padding:0;border:1px solid #7ab8ff;border-radius:4px;background-color:#f0f7ff;color:#06c;cursor:pointer;display:flex;align-items:center;justify-content:center}
  .call-count-arrow-icon{width:18px;height:18px}
  .call-count-select{flex:1;min-width:0;height:100%;padding:2px;font-size:20px;font-weight:bold;border:1px solid #7ab8ff;border-radius:4px;text-align:center;background-color:#fff;color:#333}

  /* ── タイマー行（バフ設定） ──────────────────────────────────────── */
  .timer-row{background:#f8f9fc;border-radius:6px;padding:6px 8px;margin-bottom:8px;display:flex;gap:8px;align-items:stretch}
  .buff-area{flex:1;display:flex;flex-direction:column;justify-content:space-between;gap:4px;min-width:0}
  .buff-row-1{display:flex;gap:6px;font-size:11px;justify-content:flex-end;align-items:center}
  .passbook-label{font-size:11px;font-weight:bold;color:#333;margin:0}
  .passbook-radio-group{display:flex;gap:8px;font-size:11px}
  .buff-row-2{display:flex;align-items:center;gap:6px;font-size:11px;justify-content:flex-end;border-top:1px solid #ddd;padding-top:3px}
  .buff-row-3{display:flex;gap:8px;font-size:11px;justify-content:flex-end}
  .elixir-radio-row{display:flex;gap:8px;font-size:11px}
  .btn-oc{background:#fff1f0;border:1px solid #ffa39e;color:#cf1322;border-radius:4px;padding:4px 8px;font-size:10px;line-height:1.2;cursor:pointer;white-space:nowrap;flex-shrink:0;margin-right:auto}
  .btn-timer-stop{width:79px;font-size:12px;border-radius:4px;cursor:pointer;font-weight:bold;padding:2px;background:#008888;color:#fff;border:1px solid #00aaaa;align-self:stretch;line-height:1.3}

  /* ── 合計＋加算ボタン行 ──────────────────────────────────────────── */
  .row-total-calc{display:flex;gap:6px;margin-bottom:8px}
  .panel-bg{background:#f9f9f9;border:1px solid #eee;border-radius:6px}
  .total-panel{flex:6;padding:6px 8px;text-align:center}
  .total-row{display:flex;align-items:baseline;justify-content:center;gap:6px}
  .total-label{font-size:12px;font-weight:bold}
  .total-value{font-size:22px;font-weight:bold}
  .avg-row{font-size:11px;border-top:1px solid #ddd;margin-top:4px;padding-top:4px}
  .avg-value{font-size:22px;font-weight:bold;color:#f39c12}
  .btn-calc{flex:4;font-size:21px;border-radius:6px;background:#0066cc;color:#fff;border:none;cursor:pointer;font-weight:bold;box-shadow:0 2px 4px rgba(0,0,0,0.2)}
  .btn-calc.is-locked{opacity:0.5}

  /* ── タイマーパネル ──────────────────────────────────────────────── */
  .timer-panel{padding:6px;margin-bottom:8px}
  .timer-panel-top{display:flex;gap:6px;margin-bottom:4px;align-items:flex-start;justify-content:space-between}
  .timer-display{font-size:28px;font-weight:bold;color:#333}
  .timer-right{text-align:right}
  .sync-small{font-size:9px;color:#888;text-align:right;height:14px;line-height:14px}
  .lap-label-small{font-size:10px}
  .lap-display{font-size:18px;font-weight:bold;color:#2cc9ff;line-height:24px}
  .timer-buttons-grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:3px;margin-top:4px}
  .timer-buttons-grid button{padding:6px 2px;font-size:10px;font-weight:bold;cursor:pointer;line-height:1.2;white-space:normal}
  .btn-danger{background:#e74c3c;color:#fff;border:none;border-radius:4px}
  .btn-info{background:#2563eb;color:#fff;border:none;border-radius:4px}
  .btn-warning{background:#fff1f0;border:1px solid #ffa39e;color:#cf1322;border-radius:4px}
  .btn-teal{background:#00bcd4;color:#fff;border:none;border-radius:4px}

  /* ── 強敵・レベル推移（1行・入力欄が現在値の表示を兼ねる） ───────────── */
  .lv-panel{background:#f8f9fc;border-radius:6px;padding:3px 6px;margin-bottom:8px;display:flex;gap:4px;align-items:center;flex-wrap:nowrap;font-size:11px}
  .lv-panel select,.lv-panel input{min-width:0;font-size:11px;padding:2px 2px;box-sizing:border-box}
  .lv-panel input[type="number"]{-moz-appearance:textfield}
  .lv-panel input[type="number"]::-webkit-inner-spin-button,.lv-panel input[type="number"]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
  .lv-job{flex:1 1 0;max-width:120px}
  .lv-num{flex:0 0 32px;width:32px;text-align:right}
  .lv-rem{flex:0 0 64px;width:64px;text-align:right}
  .lv-rem-label{font-size:8px;line-height:1.05;color:#666;text-align:right;white-space:nowrap;margin-left:auto}
  .lv-arrow{flex:0 0 24px;height:24px}
  .lv-arrow .call-count-arrow-icon{width:16px;height:16px}
  .lv-panel :disabled{background:#e5e7eb!important;color:#9ca3af!important;border-color:#d1d5db!important;cursor:not-allowed;opacity:.75}
  .lv-rem-label.lv-disabled{color:#aaa}
  .lv-err{outline:2px solid #e55;outline-offset:-1px}

  /* ── 履歴コピー＋想定玉給 ────────────────────────────────────────── */
  .row-copy-reward{display:flex;gap:6px;margin-bottom:6px;align-items:center}
  .btn-copy{flex:3;white-space:nowrap;background:#008888;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;display:flex;align-items:center;justify-content:center;padding:4px 8px;font-size:12px}
  .reward-card{flex:7;border-radius:6px;padding:3px 6px;text-align:center;font-size:12px;display:flex;align-items:center;justify-content:center;background:#f0f7ff}
  .estimated-gold-value{font-weight:bold;font-size:13px;margin-left:4px}

  /* ── 通帳エリア ──────────────────────────────────────────────────── */
  .passbook-area{background:#f0f7ff;border-radius:6px;padding:4px 8px;display:flex;flex-direction:column;gap:3px;margin-bottom:6px}
  .passbook-info{font-size:13px;text-align:center;font-weight:bold}
  .passbook-exp-value,.passbook-limit-value{font-size:15px;font-weight:bold}
  .passbook-buttons{display:flex;gap:6px;justify-content:center}
  .passbook-buttons button{background:#06c;color:#fff;border:none;border-radius:4px;padding:3px 8px;font-size:11px;cursor:pointer;flex:1}

  /* ── 行履歴 ──────────────────────────────────────────────────────── */
  .row-history{margin-top:4px;max-height:250px;overflow-y:auto;border-top:1px solid #eee}
  .exp-row{display:flex;align-items:center;padding:6px 4px;border-bottom:1px solid #eee;font-size:12px;white-space:nowrap;gap:4px;position:relative}
  .snapshot-editor{position:fixed;left:50%;top:50%;transform:translate(-50%, -50%);z-index:999;background:#fff;border:1px solid #7ab8ff;border-radius:8px;box-shadow:0 8px 20px rgba(0,0,0,0.2);padding:8px 10px;min-width:220px;max-width:min(92vw, 360px)}
  .snapshot-editor-title{font-size:11px;font-weight:bold;color:#06c;margin-bottom:6px}
  .snapshot-editor-grid{display:flex;flex-direction:column;gap:6px}
  .snapshot-editor-field,.snapshot-editor-group,.snapshot-editor-buffs{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11px;color:#333}
  .snapshot-editor-select{flex:1;min-width:120px;padding:2px 4px;border:1px solid #7ab8ff;border-radius:4px}
  .snapshot-editor-buffs{border-top:1px solid #e5e7eb;padding-top:4px}
  .snapshot-editor-check,.snapshot-editor-radio{display:inline-flex;align-items:center;gap:4px}
  .snapshot-editor-actions{display:flex;justify-content:flex-end;gap:6px;margin-top:8px}
  .snapshot-editor-actions button{padding:4px 8px;border:none;border-radius:4px;cursor:pointer;font-size:11px}
  .snapshot-editor-actions button:first-child{background:#06c;color:#fff}
  .snapshot-editor-actions button:last-child{background:#eee;color:#333}
  .row-id-lap{color:#2cc9ff;font-weight:bold;width:26px;font-size:10px}
  .row-id-normal{color:#999;width:26px;font-size:10px}
  .time-wrapper{display:flex;align-items:center;gap:4px;width:85px}
  .time-cell{width:65px}
  .time-main{font-size:11px;font-weight:bold}
  .time-lap{color:#2cc9ff;font-size:10px}
  .del{border:none;background:none;color:#aaa;cursor:pointer;font-size:16px;padding:0 2px}
  .exp-cell{width:85px}
  .exp-cell-lap{width:85px;color:#aaa;font-size:10px}
  .exp-value{font-size:13px;min-width:58px;text-align:right;display:inline-block}
  .exp-label{font-size:10px}
  .row-controls{display:flex;gap:4px;align-items:center;flex:1}
  .row-controls-placeholder{flex:1;color:#aaa;text-align:center;font-size:10px}
  .rs{flex:1.2;font-size:12px;padding:2px 4px;background-color:#fff;color:#333}
  .cs{width:55px;font-size:12px;padding:2px 4px;background-color:#fff;color:#333}

  /* ── バージョン情報モーダル ──────────────────────────────────────── */
  #versionModal{margin:24px 0 80px 0;border-top:2px solid #7ab8ff;padding-top:0}
  .modal-tabs{display:flex;gap:0;background:#f8f9fc;border-radius:6px;overflow:hidden}
  .modal-tab{flex:1;padding:10px;background:#f0f0f0;border:none;cursor:pointer;font-weight:bold;color:#333;border-bottom:3px solid transparent;transition:all 0.2s}
  .modal-tab.active{background:#fff;border-bottom-color:#0066cc;color:#0066cc}
  .modal-tab-content{display:none;background:#fff;border:1px solid #ddd;border-top:none;border-radius:0 0 6px 6px;padding:16px;overflow-y:auto;max-height:400px}
  .modal-tab-content.active{display:block}
  .modal-tab-content p{margin:0 0 12px 0;color:#333}
  .modal-note-bold{font-weight:bold}
  .modal-image{max-width:100%;height:auto;border-radius:6px}
  .modal-caption{margin:8px 0 0 0;font-size:12px;color:#666;text-align:center}
  .modal-changelog{margin:0;font-size:12px;white-space:pre-wrap;font-family:monospace;color:#333}

  /* ════════════════════════════════════════════════════════════════
     ダークモード（全要素網羅。平均タイム/想定玉給/総獲得/通帳等を含む）
     ════════════════════════════════════════════════════════════════ */
  body.dark-mode{background:#0a0a0f}
  body.dark-mode .c{background:#1a1a2a;color:#e8e8f0}
  body.dark-mode select,
  body.dark-mode input,
  body.dark-mode button{background:#2a2a3a;color:#e8e8f0}
  body.dark-mode label{color:#e8e8f0}

  body.dark-mode .notify-toggle{background:#2a2f45;border-color:#5a9eff}
  body.dark-mode .monster-select,
  body.dark-mode .passbook-select,
  body.dark-mode .call-count-select,
  body.dark-mode .rs,
  body.dark-mode .cs{background-color:#2a2f45;color:#5a9eff;border-color:#7ab8ff}
  body.dark-mode .call-count-arrow{background-color:#2a2f45;color:#5a9eff;border-color:#7ab8ff}

  body.dark-mode .exp-card{background:#2a2f45;border-color:#7ab8ff}
  body.dark-mode .current-exp-value{color:#5a9eff}
  body.dark-mode .overflow-text{color:#888}
  body.dark-mode .btn-rita-kuma{background:#1a1a2a;color:#666;border-color:#333}
  body.dark-mode .btn-rita-kuma.active-rita-kuma{background:#2a2f45;color:#5a9eff;border-color:#7ab8ff}
  body.dark-mode .btn-opt-monster{background:#1a6eaa;border:1px solid #3399cc}

  body.dark-mode .timer-row{background:#2a2f45}
  body.dark-mode .buff-row-2{border-top-color:#3a3a4a}
  body.dark-mode .buff-row-1,
  body.dark-mode .buff-row-2,
  body.dark-mode .buff-row-3,
  body.dark-mode .passbook-label{color:#e8e8f0}
  body.dark-mode .btn-oc{background:#2a1515;border:1px solid #883333;color:#cc7777}
  body.dark-mode .btn-timer-stop{background:#006666;border:1px solid #008888}

  body.dark-mode .panel-bg{background:#0f0f17;border-color:#2a2a3a}
  body.dark-mode .total-value{color:#fff}
  body.dark-mode .avg-row{border-top-color:#2a2a3a}
  body.dark-mode .avg-value{color:#ffaa66}
  body.dark-mode .btn-calc{background:#1a6eaa;color:#fff;border:1px solid #3399cc}

  body.dark-mode .timer-display{color:#e8e8f0}
  body.dark-mode .sync-small{color:#aaa}
  body.dark-mode .lap-display{color:#2cc9ff}
  body.dark-mode .btn-danger{background:#aa3333;color:#fff;border:1px solid #cc5555}
  body.dark-mode .btn-info{background:#1e40af;color:#fff;border:1px solid #3b82f6}
  body.dark-mode .btn-warning{background:#2a1515;border:1px solid #883333;color:#cc7777}
  body.dark-mode .btn-teal{background:#1a8899;color:#fff;border:1px solid #33aabb}

  body.dark-mode .btn-copy{background:#006666}
  body.dark-mode .reward-card{background:#2a2f45}
  body.dark-mode .estimated-gold-value{color:#66ffaa}
  body.dark-mode .text-green{color:#66ffaa}
  body.dark-mode .text-red{color:#ff8888}
  body.dark-mode .text-orange{color:#ffaa66}

  body.dark-mode .lv-panel{background:#2a2f45}
  body.dark-mode .lv-rem-label{color:#aaa}
  body.dark-mode .passbook-area{background:#1e2a44}
  body.dark-mode .passbook-buttons button{background:#1a73e8}

  body.dark-mode .row-history{border-top-color:#2a2a3a;background:#1a1a2a}
  body.dark-mode .exp-row{border-bottom-color:#2a2a3a}
  body.dark-mode .snapshot-editor{background:#1a1a2a;border-color:#7ab8ff;box-shadow:0 4px 12px rgba(0,0,0,0.35)}
  body.dark-mode .snapshot-editor-title{color:#9ecbff}
  body.dark-mode .snapshot-editor-field,
  body.dark-mode .snapshot-editor-group,
  body.dark-mode .snapshot-editor-buffs,
  body.dark-mode .snapshot-editor-check,
  body.dark-mode .snapshot-editor-radio{color:#e8e8f0}
  body.dark-mode .snapshot-editor-select{background:#2a2f45;color:#e8e8f0;border-color:#7ab8ff}
  body.dark-mode .snapshot-editor-actions button:last-child{background:#2a2f45;color:#e8e8f0}
  body.dark-mode .row-id-lap{color:#2cc9ff}
  body.dark-mode .row-id-normal{color:#aaa}
  body.dark-mode .time-lap{color:#2cc9ff}
  body.dark-mode .exp-cell-lap{color:#aaa}
  body.dark-mode .row-controls-placeholder{color:#aaa}
  body.dark-mode .del{color:#aaa}

  body.dark-mode #versionModal{border-top-color:#2a2a3a}
  body.dark-mode .modal-tabs{background:#1a1a2a}
  body.dark-mode .modal-tab{background:#2a2a3a;color:#94a3b8}
  body.dark-mode .modal-tab.active{background:#1a1a2a;color:#60a5fa;border-bottom-color:#60a5fa}
  body.dark-mode .modal-tab-content{background:#1a1a2a;border-color:#2a2a3a}
  body.dark-mode .modal-tab-content p{color:#cbd5e1}
  body.dark-mode .modal-changelog{color:#cbd5e1}
  body.dark-mode .modal-caption{color:#94a3b8}
  body.dark-mode .modal-image{filter:brightness(0.9)}
`;
  }

  // ─── グローバル公開（後方互換: シングルトン） ──────────────────────────
  const _defaultInstance = createExpCalc();
  global.Expmercenary = {
    render:  _defaultInstance.render,
    destroy: _defaultInstance.destroy,
    // 複数インスタンスが必要な場合
    createInstance: createExpCalc,
  };

})(window);
