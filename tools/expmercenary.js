// ========== 傭兵用多機能ツール ver2.3.0 ==========
// ベース: ver2.2.0 統合
// [CSS]    インラインstyleを全廃し、クラスベース設計思想で再定義
// [AUDIO]  playLapWarning移植（AudioContext管理・resume対応・音色変更）
// [QUAL]   基本的な動作ロジックは2.1.0から変更なし（ver2.2.0時点）
// [LOGIC]  経験値計算を実測値ベースに修正: applyLimit 廃止 → floor + fdBonus 方式に変更（ver2.3.0）

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

  // ─── お供経験値定数 ───────────────────────────────────────────────
  const PARTNER_EXP = {
    none: 0, mk: 48240, hm1: 12060, hm2: 24120, hm3: 36180,
    gn: 720, sn: 720, zucchini: 9010,
  };

  const EXP_PER_LV = 1589326;

  const CALL_LABELS = ["", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

  const TYPE_LABEL = {
    pass: "[通]", angel: "[エ]", overflow: "[溢]",
    normal: "", lap_only: "[LAP]", job: "転職",
  };
  const TYPE_COLOR = {
    pass: "#f88", angel: "#5a9eff", overflow: "#aaa",
    lap_only: "#2cc9ff", job: "#00bcd4",
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
    let passbookOffset = 0;
    let killCount    = 0;
    let optCallCount = 1;
    let calcLockedUntil = 0;
    let ritaOrKuma   = "returner";
    let lapNotifyEnabled = false;
    let lapNotifyFired   = false;
    let audioCtx     = null;
    let jobBtnLocked = false;      // 転職ボタン連打防止フラグ

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
      let baseExp, bonusExp, fd, tr, ag, em, elixir, pbVal;

      if (snap) {
        const msOption = root.querySelector(`#ms option[value="${snap.ms}"]`);
        baseExp  = parseInt(msOption?.dataset.base)  || 0;
        bonusExp = parseInt(msOption?.dataset.bonus) || 0;
        ({ fd, tr, ag, em, elixir, pb: pbVal } = snap);
      } else {
        const sel = $("ms");
        const opt = sel.options[sel.selectedIndex];
        baseExp  = parseInt(opt.dataset.base)  || 0;
        bonusExp = parseInt(opt.dataset.bonus) || 0;
        fd     = $("fd").checked;
        tr     = $("tr").checked;
        ag     = $("ag").checked;
        em     = $("em").checked;
        elixir = root.querySelector('input[name="e_exp"]:checked')?.value || "none";
        pbVal  = root.querySelector('input[name="pb"]:checked')?.value || "0";
      }

      let rate = 1.0;
      if (fd) rate += 0.3;
      if (elixir === "genki")   rate += 1;
      if (elixir === "bakushin") rate += 2;
      if (tr) rate += 1;
      if (em) rate += 1;

      const partnerExpVal  = PARTNER_EXP[partnerKey] || 0;
      const passbookLimit  = parseInt(pbVal) || 0;
      const hasPassbook    = passbookLimit > 0;
      const isHighLimit    = elixir === "bakushin" || tr;
      const expLimit       = isHighLimit ? 1499999 : 599999;

      const rawCommon  = baseExp * rate + bonusExp;
      const rawAngel   = ag ? baseExp * 2 : 0;
      const rawPCommon = partnerExpVal * rate;
      const rawPAngel  = ag ? partnerExpVal * 2 : 0;

      // ゲームの経験値計算ロジック（実測値9件から確定）:
      //   floor(total) + (料理あり ? 1 : 0)
      // 料理(+0.3)があるとrateに小数部が生じる。c=5,10等でtotalが
      // 数学的には整数になる組み合わせでもゲームは+1する。
      // 料理なし(rate=整数)はtotalが正確に整数になるため+1不要。
      // エンゼル経験値(rawAngel)のrateは×2固定(整数)のため料理補正は
      // 通常経験値と同じ条件(ag && fd)でのみ適用する。
      const fdBonus = fd ? 1 : 0;
      const rawTotalCommon = Math.floor(rawCommon * callCount + rawPCommon) + fdBonus;
      const rawTotalAngel  = Math.floor(rawAngel  * callCount + rawPAngel)  + (ag && fd ? 1 : 0);
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
        if (i === callCount) opt.selected = true;
        sel.appendChild(opt);
      }
      return sel;
    }

    // ── 行追加 ───────────────────────────────────────────────────────────
    function addRow(rowId, callCount, expVal, rowType, elapsedSec, lapSec,
                    isMain = false, rawCapped = null, monsterId = null,
                    hasDeathPenalty = false) {

      const row = document.createElement("div");
      row.className = "exp-row";
      row.dataset.val          = expVal;
      row.dataset.rawValCapped = rawCapped !== null ? rawCapped : expVal;
      row.dataset.type         = rowType;
      row.dataset.sec          = elapsedSec;
      row.dataset.lap          = lapSec != null ? lapSec : -1;
      row.dataset.main         = isMain;
      row.dataset.count        = callCount;
      row.dataset.bid          = rowId;
      row.dataset.monsterId    = monsterId || $("ms").value;
      row.dataset.desp         = hasDeathPenalty ? "true" : "false";

      const snapshot = {
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
        const bid  = row.dataset.bid;
        const type = row.dataset.type;
        if (type === "pass") {
          rowCache
            .filter(r => r !== row && r.dataset.bid === bid &&
                    (r.dataset.type === "angel" || r.dataset.type === "overflow"))
            .forEach(r => { r.remove(); rowCache.splice(rowCache.indexOf(r), 1); });
        }
        row.remove();
        rowCache.splice(rowCache.indexOf(row), 1);
        renumberRows();
        recalcLaps();
        updateTotal();
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
        valSpan.textContent = expVal.toLocaleString();
        const lbl = document.createElement("span");
        lbl.className   = "exp-label";
        lbl.style.color = TYPE_COLOR[rowType] || "";
        lbl.textContent = TYPE_LABEL[rowType] || "";
        expCell.appendChild(valSpan);
        expCell.appendChild(lbl);
      }
      row.appendChild(expCell);

      // ── デスペナチェック（LAP・転職行には表示しない） ──────────────────
      if (rowId !== "LAP" && rowType !== "job") {
        const despLabel = document.createElement("label");
        despLabel.className = "desp-label";
        const despCb = document.createElement("input");
        despCb.type      = "checkbox";
        despCb.className = "desp-tgl";
        despCb.checked   = hasDeathPenalty;
        const despIcon = document.createElement("span");
        despIcon.className   = "desp-icon";
        despIcon.textContent = "💀";
        despLabel.appendChild(despCb);
        despLabel.appendChild(despIcon);
        row.appendChild(despLabel);

        despCb.onchange = () => {
          const newDesp = despCb.checked ? "true" : "false";
          const bid = row.dataset.bid;
          rowCache
            .filter(r => r.dataset.bid === bid && r.dataset.type !== "lap_only" && r.dataset.type !== "job")
            .forEach(r => {
              r.dataset.desp = newDesp;
              const cb = r.querySelector(".desp-tgl");
              if (cb) cb.checked = despCb.checked;
            });
          updateTotal();
        };
      }

      // ── コントロール（呼び数・パートナー） ──────────────────────────────
      if (rowId !== "LAP" && rowType !== "job") {
        const controls = document.createElement("div");
        controls.className = "row-controls";

        const rSel = buildPartnerSelect(row.dataset.monsterId, "none");
        const cSel = buildCallSelect(callCount);

        controls.appendChild(rSel);
        controls.appendChild(cSel);
        row.appendChild(controls);

        const recalcRowExp = () => {
          const newCount    = parseInt(cSel.value);
          const newPartner  = rSel.value;
          const bid = row.dataset.bid;

          // 同一bid（通帳/エンゼル/溢れ）の全行へ呼び数・お供を連携
          const group = rowCache.filter(r =>
            r.dataset.bid === bid && r.dataset.type !== "lap_only" && r.dataset.type !== "job");

          const passRow     = group.find(r => r.dataset.type === "pass");
          const overflowRow = group.find(r => r.dataset.type === "overflow");

          // 通帳行と溢れ行が同居する場合: 加算時点の通帳上限(passVal)を維持し、
          // 新しい共通exp合計から通帳上限を差し引いた残りを溢れ行に充てる
          const origPassVal = passRow ? (parseFloat(passRow.dataset.val) || 0) : null;

          group.forEach(r => {
            const snap = JSON.parse(r.dataset.snapshot);
            r.dataset.count = newCount;

            const rSelOther = r.querySelector(".rs");
            const cSelOther = r.querySelector(".cs");
            if (rSelOther && rSelOther !== rSel) rSelOther.value = newPartner;
            if (cSelOther && cSelOther !== cSel) cSelOther.value = String(newCount);

            const result = calcExp(newCount, newPartner, snap);

            let newVal;
            if (r.dataset.type === "angel") {
              newVal = result.angel;
            } else if (r.dataset.type === "pass") {
              // 通帳上限に達していた行は上限値のまま据え置き、未到達なら新しい共通expに追従
              newVal = origPassVal !== null && overflowRow
                ? Math.min(result.common, origPassVal)
                : result.common;
            } else if (r.dataset.type === "overflow" && passRow) {
              newVal = Math.max(0, result.common - origPassVal);
            } else if (r.dataset.type === "overflow") {
              // 通帳行が無い（全額溢れ）場合
              newVal = result.common;
            } else {
              newVal = result.total;
            }

            r.dataset.val          = newVal;
            r.dataset.rawValCapped = newVal;
            const valEl = r.querySelector(".exp-value");
            if (valEl) valEl.textContent = newVal.toLocaleString();
          });

          updateTotal();
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
      $("rowHistory").prepend(row);
      rowCache.push(row);   // キャッシュは追加順（古→新）

      updateTotal();
    }

    // ── 行番号振り直し ───────────────────────────────────────────────────
    function renumberRows() {
      let num = 1;
      rowCache.forEach(r => {
        const type = r.dataset.type;
        if (type === "lap_only" || type === "job") return;
        if (r.dataset.bid === "LAP") return;
        if (type === "angel" || type === "overflow") {
          const el = r.querySelector(".row-id-normal");
          if (el) el.textContent = `#${num - 1}`;
        } else {
          r.dataset.bid = num;
          const el = r.querySelector(".row-id-normal");
          if (el) el.textContent = `#${num}`;
          num++;
        }
      });
      killCount = num - 1;
    }

    // ── ラップ再計算 ─────────────────────────────────────────────────────
    function recalcLaps() {
      let prevSec = 0;
      for (let i = 0; i < rowCache.length; i++) {
        const r = rowCache[i];
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
        const isGroupable = type !== "lap_only" && type !== "job";
        const nextGroupable = nextType !== "lap_only" && nextType !== "job";
        if (!isGroupable || !nextGroupable || currentBid !== nextBid) {
          prevSec = sec;
        }
      }

      if (rowCache.length > 0) {
        const latest = parseFloat(rowCache[rowCache.length - 1].dataset.sec);
        if (!isNaN(latest)) lastLapSec = latest;
      } else {
        lastLapSec = 0;
      }
    }

    // ── 合計更新 ─────────────────────────────────────────────────────────
    function updateTotal() {
      let totalExp    = 0;
      let passbookExp = 0;
      let penaltyMin  = 0;
      let penaltyMax  = 0;

      rowCache.forEach(el => {
        const expVal = parseInt(el.dataset.val) || 0;
        totalExp += expVal;
        if (el.dataset.type === "pass") passbookExp += expVal;

        if (el.dataset.desp === "true" &&
            el.dataset.lap !== "-1" &&
            el.dataset.type !== "lap_only" &&
            el.dataset.type !== "job") {
          const raw    = parseFloat(el.dataset.rawValCapped) || parseInt(el.dataset.val) || 0;
          const lapSec = parseFloat(el.dataset.lap);
          if (lapSec > 6.45) {
            penaltyMin += raw * (6.45  / lapSec);
            penaltyMax += raw * (2.58  / lapSec);
          }
        }
      });

      $("totalExpDisplay").textContent = totalExp.toLocaleString();

      const passbookLimit = parseInt(root.querySelector('input[name="pb"]:checked')?.value || "0") || 0;
      if (passbookLimit > 0) {
        const remaining = Math.max(0, passbookExp - passbookOffset);
        $("passbookExpDisplay").textContent = Math.ceil(remaining).toLocaleString();
      }

      const hasPenalty = rowCache.some(r => r.dataset.desp === "true");
      const penaltyRef = $("penaltyRef");
      if (hasPenalty && penaltyMin > 0) {
        penaltyRef.classList.remove("hidden");
        penaltyRef.textContent = "";
        const line1 = document.createTextNode("デスペナ想定:");
        const br = document.createElement("br");
        const line2 = document.createTextNode(
          `${Math.ceil(penaltyMax).toLocaleString()}～${Math.ceil(penaltyMin).toLocaleString()}`
        );
        penaltyRef.appendChild(line1);
        penaltyRef.appendChild(br);
        penaltyRef.appendChild(line2);
      } else {
        penaltyRef.classList.add("hidden");
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
    // ── render ────────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────────────
    function render(containerSelector) {
      const container = typeof containerSelector === "string"
        ? document.querySelector(containerSelector)
        : containerSelector;
      if (!container) return;
      root = container;

      const savedNotify = localStorage.getItem("dqx_lap_notify");
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
      <option value="durahan"       data-base="22802" data-bonus="4561" selected>デュラハーン</option>
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

  <div id="timer-row" class="timer-row">
    <div class="buff-area">
      <div class="buff-row-1">
        <button id="btnBuffReset" class="btn-oc">OC</button>
        <span class="passbook-label">通帳:</span>
        <div class="passbook-radio-group">
          <label><input name="pb" type="radio" value="0" checked />無</label>
          <label><input name="pb" type="radio" value="5000000" />1</label>
          <label><input name="pb" type="radio" value="10000000" />2</label>
        </div>
      </div>
      <div class="buff-row-2">
        <label><input id="fd" type="checkbox" checked />料理</label>
        <label><input id="tr" type="checkbox" />修練</label>
        <label><input id="ag" type="checkbox" />エンゼル</label>
        <label><input id="em" type="checkbox" />皇帝</label>
      </div>
      <div class="buff-row-3">
        <div class="elixir-radio-row">
          <label><input name="e_exp" type="radio" value="none" />無</label>
          <label><input name="e_exp" type="radio" value="genki" checked />元気</label>
          <label><input name="e_exp" type="radio" value="bakushin" />爆伸</label>
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
      <div id="penaltyRef" class="penalty-ref hidden"></div>
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
      <button id="btnPassbookWithdraw">1Lv分引出</button>
    </div>
  </div>

  <div id="rowHistory" class="row-history"></div>
</div>`;

      // ── イベントリスナー登録 ─────────────────────────────────────────

      $("lapNotifyToggle").onchange = (e) => {
        lapNotifyEnabled = e.target.checked;
        localStorage.setItem("dqx_lap_notify", lapNotifyEnabled);
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

        if (passbookLimit > 0) {
          let accumulatedRaw = 0;
          rowCache.filter(r => r.dataset.type === "pass").forEach(r => {
            accumulatedRaw += parseFloat(r.dataset.rawValCapped) || 0;
          });
          const remaining = Math.ceil(Math.max(0, passbookLimit - (accumulatedRaw - passbookOffset)));

          if (remaining >= expResult.common) {
            addRow(killCount, callCount, expResult.common, "pass", elapsed, lap, true, expResult.common, null, false);
          } else if (remaining > 0) {
            addRow(killCount, callCount, remaining, "pass", elapsed, lap, true, remaining, null, false);
            addRow(killCount, callCount, expResult.common - remaining, "overflow", elapsed, lap, false, expResult.common - remaining, null, false);
          } else {
            addRow(killCount, callCount, expResult.common, "overflow", elapsed, lap, true, expResult.common, null, false);
          }
          if (expResult.angel > 0) {
            addRow(killCount, callCount, expResult.angel, "angel", elapsed, lap, false, expResult.angel, null, false);
          }
        } else {
          addRow(killCount, callCount, expResult.total, "normal", elapsed, lap, true, expResult.total, null, false);
        }

        lastLapSec = elapsed;
        updateTimerDisplay(elapsed);

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
        passbookOffset = 0;
        rowCache.length = 0;
        $("rowHistory").textContent = "";
        $("btnTimerStop").innerHTML = "タイマー<br>開始";
        updateTimerDisplay(0);
        updateTotal();
        updateUI();
      };

      $("btnPassbookReset").onclick = () => {
        let accumulatedRaw = 0;
        rowCache.filter(r => r.dataset.type === "pass").forEach(r => {
          accumulatedRaw += parseFloat(r.dataset.rawValCapped) || 0;
        });
        passbookOffset = Math.ceil(accumulatedRaw);
        updateTotal();
      };

      $("btnPassbookWithdraw").onclick = () => {
        let accumulatedRaw = 0;
        rowCache.filter(r => r.dataset.type === "pass").forEach(r => {
          accumulatedRaw += parseFloat(r.dataset.rawValCapped) || 0;
        });
        const balance = accumulatedRaw - passbookOffset;
        if (balance <= 0) return;
        passbookOffset += Math.min(EXP_PER_LV, balance);
        updateTotal();
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
        }, 42);    // ~24fps
        $("btnTimerStop").innerHTML = "タイマー<br>作動中";
      };

      $("btnTimerPause").onclick = () => {
        if (!timerHandle) return;
        clearInterval(timerHandle);
        timerHandle = null;
        pauseSec    = (Date.now() - startTime) / 1000;
        lapNotifyFired = false;   // 停止時に警告状態をリセット
        updateTimerDisplay(pauseSec);
        $("btnTimerStop").innerHTML = "タイマー<br>再開";
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

      // 通帳ラジオボタン切り替え時：新上限を超えた pass 行を新しい順から切り捨て
      root.querySelectorAll('input[name="pb"]').forEach(radio => {
        radio.onchange = () => {
          const newLimit = parseInt(root.querySelector('input[name="pb"]:checked')?.value || "0") || 0;
        if (newLimit > 0) {
          const passRows = rowCache.filter(r => r.dataset.type === "pass");
          let total = passRows.reduce((s, r) => s + (parseFloat(r.dataset.rawValCapped) || 0), 0);
          for (let i = passRows.length - 1; i >= 0 && total > newLimit; i--) {
            const r = passRows[i];
            const raw = parseFloat(r.dataset.rawValCapped) || 0;
            const over = total - newLimit;
            if (raw <= over) {
              const newVal = 0;
              r.dataset.val          = newVal;
              r.dataset.rawValCapped = newVal;
              const el = r.querySelector(".exp-value");
              if (el) el.textContent = newVal.toLocaleString();
              total -= raw;
            } else {
              const newVal = Math.ceil(raw - over);
              r.dataset.val          = newVal;
              r.dataset.rawValCapped = newVal;
              const el = r.querySelector(".exp-value");
              if (el) el.textContent = newVal.toLocaleString();
              total = newLimit;
            }
          }
          if (passbookOffset > newLimit) passbookOffset = newLimit;
        }
        updateUI(true);
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
    }

    // ── 公開インターフェース ─────────────────────────────────────────────
    return {
      render,
      destroy() {
        if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
        startTime = pauseSec = lastLapSec = jobOffsetSec = passbookOffset = 0;
        killCount = calcLockedUntil = 0;
        lapNotifyFired = jobBtnLocked = false;
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
  .buff-row-1{display:flex;gap:10px;font-size:11px;justify-content:flex-end;align-items:center}
  .passbook-label{font-size:11px;font-weight:bold;color:#333;margin:0}
  .passbook-radio-group{display:flex;gap:12px;font-size:11px}
  .buff-row-2{display:flex;align-items:center;gap:8px;font-size:11px;justify-content:flex-end;border-top:1px solid #ddd;padding-top:3px}
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
  .penalty-ref{font-size:11px;color:#ff6666;margin-top:4px;white-space:pre-line}
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
  .exp-row{display:flex;align-items:center;padding:6px 4px;border-bottom:1px solid #eee;font-size:12px;white-space:nowrap;gap:4px}
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
  .desp-label{margin:0 2px;display:inline-flex;align-items:center}
  .desp-icon{font-size:9px}
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
  body.dark-mode .penalty-ref{color:#ff8888}
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

  body.dark-mode .passbook-area{background:#1e2a44}
  body.dark-mode .passbook-buttons button{background:#1a73e8}

  body.dark-mode .row-history{border-top-color:#2a2a3a;background:#1a1a2a}
  body.dark-mode .exp-row{border-bottom-color:#2a2a3a}
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