// ========== 傭兵用多機能ツール ver1.5.5 ==========

(function (global) {
  // 既存のツールと変数が被らないように独自の名前空間でラップ

  const ExpCalc = {
    // ----- タイマー状態 -----
    timer: null,         // setInterval の戻り値
    startTime: 0,        // タイマー開始時刻（ms）
    pauseSec: 0,         // 一時停止時の経過秒数
    lastLapSec: 0,       // 最後のLAPを記録した秒数
    jobOffsetSec: 0,     // 転職ボタン押下による加算オフセット（秒）
    passbookOffset: 0,   // 通帳引き出し済み累計経験値

    // ----- カウンタ -----
    killCount: 0,        // 加算ボタンを押した合計回数
    optCallCount: 1,     // 最適な呼び数（A〜L の数値）
    calcLockedUntil: 0,  // 加算ボタンのロック解除時刻（ms）

    // ----- 定数 -----
    /** 討伐数の表示ラベル（インデックス 1〜12 = A〜L） */
    CALL_LABELS: ["", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"],

    /** お供の種類ごとの基本経験値 */
    PARTNER_EXP: {
      none:     0,
      mk:       48240, // メタキン
      hm1:       12060, // はぐメタ1
      hm2:       24120, // はぐメタ2
      hm3:       36180, // はぐメタ3
      tappitsu:  4800, // 達筆
      gn:        2240, // ゲノミー
      sn:        1120, // 仙人
      zucchini:  9010, // ズッキ祖（ダースリカント専用）
    },

    /** 通帳1Lv分の経験値 */
    EXP_PER_LV: 1589326,

    // ----- ユーティリティ -----

    /** ID でDOM要素を取得する */
    $: function (id) {
      return document.getElementById(id);
    },

    /**
     * 秒数を "MM:SS.ss" 形式の文字列に変換する
     * @param {number} sec
     * @returns {string}
     */
    formatTime: function (sec) {
      if (isNaN(sec) || sec < 0 || sec === Infinity) return "00:00.00";
      const minutes = Math.floor(sec / 60);
      const seconds = (sec % 60).toFixed(2).padStart(5, "0");
      return `${minutes.toString().padStart(2, "0")}:${seconds}`;
    },

    /**
     * 現在の設定から経験値レートを計算して返す
     * @returns {number}
     */
    getRate: function () {
      let rate = 1.0;
      if (this.$("fd").checked) rate += 0.3;
      const elixirType = document.querySelector('input[name="e_exp"]:checked')?.value || "none";
      if (elixirType === "genki")   rate += 1;
      if (elixirType === "bakushin") rate += 2;
      if (this.$("tr").checked) rate += 1;
      if (this.$("em").checked) rate += 1;
      return rate;
    },

    /**
     * 経験値を上限に合わせて丸め・クランプする
     * 料理補正がある整数値は切り上げ+1、それ以外は切り上げ
     * @param {number} val   生の経験値
     * @param {number} limit 上限値
     * @returns {number}
     */
    applyLimit: function (val, limit) {
      const rounded = Math.round(val);
      const isNearInt = Math.abs(val - rounded) < 0.1;
      const ceiled = this.$("fd").checked && isNearInt ? rounded + 1 : Math.ceil(val);
      return Math.min(ceiled, limit);
    },

    /**
     * 討伐数・お供の種類から獲得経験値を計算する
     * snap を渡すと DOM を一切参照せずスナップショット時点のバフで計算する（行の再計算用）
     * @param {number} callCount   - 討伐数（1〜12）
     * @param {string} [partnerKey="none"] - お供の種類キー
     * @param {object|null} [snap=null]    - バフスナップショット（省略時は現在のDOM値を使用）
     * @returns {{
     *   total: number, common: number, angel: number, overflow: number,
     *   rawTotalCapped: number, rawCommonCapped: number, rawAngelCapped: number
     * }}
     */
    calcExp: function (callCount, partnerKey = "none", snap = null) {
      // モンスター基礎値の取得（snap.ms がある場合は option の data 属性から直接取得）
      let baseExp, bonusExp;
      if (snap) {
        const msOption = document.querySelector(`#ms option[value="${snap.ms}"]`);
        baseExp  = parseInt(msOption?.dataset.base)  || 0;
        bonusExp = parseInt(msOption?.dataset.bonus) || 0;
      } else {
        const selectedOption = this.$("ms").options[this.$("ms").selectedIndex];
        baseExp  = parseInt(selectedOption.dataset.base)  || 0;
        bonusExp = parseInt(selectedOption.dataset.bonus) || 0;
      }

      // バフ値の取得（snap があればそちらを優先）
      const fd       = snap ? snap.fd       : this.$("fd").checked;
      const tr       = snap ? snap.tr       : this.$("tr").checked;
      const ag       = snap ? snap.ag       : this.$("ag").checked;
      const em       = snap ? snap.em       : this.$("em").checked;
      const elixir   = snap ? snap.elixir   : (document.querySelector('input[name="e_exp"]:checked')?.value || "none");
      const pbVal    = snap ? snap.pb       : this.$("pb").value;

      // レート計算（DOM を使わない純粋計算）
      let rate = 1.0;
      if (fd) rate += 0.3;
      if (elixir === "genki")    rate += 1;
      if (elixir === "bakushin") rate += 2;
      if (tr) rate += 1;
      if (em) rate += 1;

      // applyLimit 内の料理フラグも snap 対応（一時的に fd を渡す）
      const applyLimitWithFd = (val, limit) => {
        const rounded   = Math.round(val);
        const isNearInt = Math.abs(val - rounded) < 0.1;
        const ceiled    = fd && isNearInt ? rounded + 1 : Math.ceil(val);
        return Math.min(ceiled, limit);
      };

      const partnerExpVal = this.PARTNER_EXP[partnerKey] || 0;
      const hasAngel      = ag;
      const passbookLimit = parseInt(pbVal) || 0;
      const hasPassbook   = passbookLimit > 0;

      const isHighLimit = elixir === "bakushin" || tr;
      const expLimit    = isHighLimit ? 1499999 : 599999;
      const angelLimit  = 599999;

      const rawCommonPerKill = baseExp * rate + bonusExp;
      const rawAngelPerKill  = hasAngel ? baseExp * 2 : 0;
      const rawPartnerCommon = partnerExpVal * rate;
      const rawPartnerAngel  = hasAngel ? partnerExpVal * 2 : 0;

      const rawTotalCommon = rawCommonPerKill * callCount + rawPartnerCommon;
      const rawTotalAngel  = rawAngelPerKill  * callCount + rawPartnerAngel;
      const rawTotal       = rawTotalCommon + rawTotalAngel;

      if (hasPassbook) {
        const commonCapped = Math.min(rawTotalCommon, expLimit);
        const angelCapped  = Math.min(rawTotalAngel,  angelLimit);
        const totalOverflow = (rawTotalCommon - commonCapped) + (rawTotalAngel - angelCapped);
        const common = applyLimitWithFd(commonCapped, expLimit);
        const angel  = Math.min(Math.ceil(angelCapped), angelLimit);
        return {
          total:           common + angel,
          common,
          angel,
          overflow:        Math.ceil(totalOverflow),
          rawTotalCapped:  commonCapped + angelCapped,
          rawCommonCapped: commonCapped,
          rawAngelCapped:  angelCapped,
        };
      } else {
        const cappedTotal = Math.min(rawTotal, expLimit);
        const total = applyLimitWithFd(cappedTotal, expLimit);
        return {
          total,
          common:          total,
          angel:           0,
          overflow:        Math.ceil(rawTotal - cappedTotal),
          rawTotalCapped:  cappedTotal,
          rawCommonCapped: cappedTotal,
          rawAngelCapped:  0,
        };
      }
    },

    /**
     * 上限に達しない最大討伐数（最適呼び数）を求めて optCallCount に保存する
     */
    calcOptimalCallCount: function () {
      const elixirType = document.querySelector('input[name="e_exp"]:checked')?.value || "none";
      const isHighLimit = elixirType === "bakushin" || this.$("tr").checked;
      const expLimit = isHighLimit ? 1499999 : 599999;
      this.optCallCount = 1;
      for (let i = 1; i <= 12; i++) {
        if (this.calcExp(i).common < expLimit) this.optCallCount = i;
        else break;
      }
    },

    /**
     * 経験値表示・溢れ表示・最適呼び数を更新する
     * @param {boolean} [autoSetCount=false] 討伐数セレクトを自動更新するか
     */
    updateUI: function (autoSetCount = false) {
      const passbookLimit = parseInt(this.$("pb").value) || 0;
      const passbookArea  = this.$("passbookArea");

      if (passbookLimit > 0) {
        passbookArea.classList.remove("hidden");
        this.$("passbookLimitText").textContent = passbookLimit.toLocaleString();
      } else {
        passbookArea.classList.add("hidden");
      }

      this.calcOptimalCallCount();
      if (autoSetCount) this.$("cn").value = this.optCallCount;

      const callCount = parseInt(this.$("cn").value);
      const expResult = this.calcExp(callCount);

      this.$("currentExpDisplay").textContent = expResult.total.toLocaleString();
      this.$("overflowDisplay").style.visibility = expResult.overflow > 0 ? "visible" : "hidden";
      this.$("overflowDisplay").textContent = `溢れ:${expResult.overflow.toLocaleString()}`;
    },

    /**
     * 履歴行の合計・平均タイム・想定玉給・通帳残量を更新する
     */
    updateTotal: function () {
      let totalExp    = 0;
      let passbookExp = 0;
      let lapTimes    = [];
      let penaltyMin  = 0;
      let penaltyMax  = 0;

      document.querySelectorAll(".exp-row").forEach(el => {
        const expVal = parseInt(el.dataset.val) || 0;
        if (!isNaN(expVal)) {
          totalExp += expVal;
          if (el.dataset.type === "pass") passbookExp += expVal;
        }

        // 平均タイム用のLAP収集（メイン行かつ有効なLAP時間のみ）
        if (
          el.dataset.lap &&
          el.dataset.lap !== "-1" &&
          el.dataset.type !== "lap_only" &&
          el.dataset.type !== "job" &&
          el.dataset.main === "true"
        ) {
          lapTimes.push(parseFloat(el.dataset.lap));
        }

        // デスペナ想定の計算
        if (
          el.dataset.desp === "true" &&
          el.dataset.lap &&
          el.dataset.lap !== "-1" &&
          el.dataset.type !== "lap_only" &&
          el.dataset.type !== "job"
        ) {
          const rawCapped = parseFloat(el.dataset.rawValCapped) || parseInt(el.dataset.val) || 0;
          const lapSec    = parseFloat(el.dataset.lap);
          if (lapSec > 6.45) {
            penaltyMin += rawCapped * (6.45 / lapSec);
            penaltyMax += rawCapped * (2.58 / lapSec);
          }
        }
      });

      this.$("totalExpDisplay").textContent = Math.ceil(totalExp).toLocaleString();

      // 通帳残量の更新
      const passbookLimit = parseInt(this.$("pb").value) || 0;
      if (passbookLimit > 0) {
        const remaining = Math.max(0, passbookExp - this.passbookOffset);
        this.$("passbookExpDisplay").textContent = Math.ceil(remaining).toLocaleString();
      }

      // デスペナ表示の更新
      const hasPenalty = document.querySelectorAll('.exp-row[data-desp="true"]').length > 0;
      const penaltyRef = this.$("penaltyRef");
      if (hasPenalty && penaltyMin > 0) {
        penaltyRef.style.display = "block";
        penaltyRef.innerHTML =
          `デスペナ想定:<br>${Math.ceil(penaltyMax).toLocaleString()}～${Math.ceil(penaltyMin).toLocaleString()}`;
      } else {
        penaltyRef.style.display = "none";
      }

      // 平均タイム・想定玉給の更新
      if (lapTimes.length > 0) {
        const avgSec = lapTimes.reduce((a, b) => a + b, 0) / lapTimes.length;
        this.$("avgTimeDisplay").textContent = this.formatTime(avgSec);
        if (avgSec > 0.01) {
          const battles30min = Math.floor(1800 / avgSec);
          const expPerBattle = totalExp / (lapTimes.length || 1);
          this.$("estimatedGoldDisplay").textContent =
            `${Math.round(expPerBattle * battles30min / 1e4)}万～` +
            `${Math.round(expPerBattle * (battles30min + 1) / 1e4)}万`;
        } else {
          this.$("estimatedGoldDisplay").textContent = "--";
        }
      } else {
        this.$("avgTimeDisplay").textContent = "--:--.--";
        this.$("estimatedGoldDisplay").textContent = "--";
      }
    },

    /**
     * お供セレクトの <option> HTML を生成する
     * @param {string} monsterId - モンスターの value 値
     * @returns {string}
     */
    getPartnerOptions: function (monsterId) {
      const baseOptions =
        `<option value="none">お供無</option>` +
        `<option value="hm1">はぐメタ1</option>` +
        `<option value="hm2">はぐメタ2</option>` +
        `<option value="hm3">はぐメタ3</option>` +
        `<option value="mk">メタキン</option>` +
        `<option value="gn">ゲノミー</option>` +
        `<option value="sn">仙人</option>`;
      return monsterId === "dearthlicant"
        ? baseOptions + `<option value="zucchini">ズッキ祖</option>`
        : baseOptions;
    },

    /**
     * 履歴に1行追加する
     * @param {number|string} rowId        - 行番号（"LAP"/"JOB" の場合もある）
     * @param {number}        callCount    - 討伐数
     * @param {number}        expVal       - 表示する経験値
     * @param {string}        rowType      - "normal"|"pass"|"angel"|"overflow"|"lap_only"|"job"
     * @param {number}        elapsedSec   - 経過時間（秒）
     * @param {number|null}   lapSec       - LAP秒数（null = LAP不明）
     * @param {boolean}       [isMain=false]   - 平均タイム計算に使うメイン行か
     * @param {number|null}   [rawCapped=null] - 上限適用前の生経験値（通帳計算用）
     * @param {string|null}   [monsterId=null] - モンスターID（null = 現在の選択値）
     * @param {boolean}       [hasDeathPenalty=false] - デスペナ中か
     */
    addRow: function (
      rowId, callCount, expVal, rowType, elapsedSec, lapSec,
      isMain = false, rawCapped = null, monsterId = null, hasDeathPenalty = false
    ) {
      const row = document.createElement("div");
      row.className = "exp-row h";
      row.dataset.val         = expVal;
      row.dataset.rawValCapped = rawCapped !== null ? rawCapped : expVal;

      // 行が追加された時点のバフ設定スナップショット（再計算用）
      const snapshot = {
        fd: this.$("fd").checked,
        tr: this.$("tr").checked,
        ag: this.$("ag").checked,
        em: this.$("em").checked,
        elixir: document.querySelector('input[name="e_exp"]:checked')?.value || "none",
        pb: this.$("pb").value,
        ms: monsterId || this.$("ms").value,
      };
      row.dataset.snapshot    = JSON.stringify(snapshot);
      row.dataset.type        = rowType;
      row.dataset.sec         = elapsedSec;
      row.dataset.lap         = lapSec != null ? lapSec : -1;
      row.dataset.main        = isMain;
      row.dataset.count       = callCount;
      row.dataset.bid         = rowId;
      row.dataset.monsterId   = monsterId || this.$("ms").value;
      row.dataset.desp        = hasDeathPenalty ? "true" : "false";

      // 行タイプごとの表示テキスト・カラー
      const TYPE_LABEL = {
        pass:     "[通]",
        angel:    "[エ]",
        overflow: "[溢]",
        normal:   "",
        lap_only: "[LAP]",
        job:      "転職",
      };
      const TYPE_COLOR = {
        pass:     "#f88",
        angel:    "#5a9eff",
        overflow: "#aaa",
        lap_only: "#2cc9ff",
        job:      "#00bcd4",
      };

      // 行番号表示
      const rowIdHtml = rowId === "LAP"
        ? `<span class="row-id-lap">LAP</span>`
        : `<span class="row-id-normal">#${rowId}</span>`;

      // タイム表示
      const timeHtml =
        `<div class="time-cell">` +
        `<div class="time-main">${this.formatTime(elapsedSec)}</div>` +
        (lapSec != null && lapSec >= 0
          ? `<div class="time-lap">L ${this.formatTime(lapSec)}</div>`
          : "") +
        `</div>`;

      // 経験値表示
      let expHtml;
      if (rowId === "LAP") {
        expHtml = `<div class="exp-cell-lap">LAP MARK</div>`;
      } else if (rowType === "job") {
        expHtml =
          `<div class="exp-cell">` +
          `<span class="exp-label" style="color:${TYPE_COLOR[rowType]}">${TYPE_LABEL[rowType]}</span>` +
          `</div>`;
      } else {
        expHtml =
          `<div class="exp-cell">` +
          `<strong class="exp-value">${expVal.toLocaleString()}</strong>` +
          `<span class="exp-label" style="color:${TYPE_COLOR[rowType]}">${TYPE_LABEL[rowType]}</span>` +
          `</div>`;
      }

      // デスペナチェックボックス
      const deathPenaltyHtml =
        `<label class="desp-label">` +
        `<input type="checkbox" class="desp-tgl" ${hasDeathPenalty ? "checked" : ""}>` +
        `<span class="desp-icon">💀</span></label>`;

      // お供・呼び数セレクト（LAP/転職行は非表示）
      const controlsHtml = (rowId !== "LAP" && rowType !== "job")
        ? `<div class="row-controls">` +
          `<select class="rs">` +
          `${this.getPartnerOptions(row.dataset.monsterId)}</select>` +
          `<select class="cs">` +
          `${this.CALL_LABELS.map((label, i) =>
            i > 0 ? `<option value="${i}" ${i == callCount ? "selected" : ""}>${label}</option>` : ""
          ).join("")}` +
          `</select></div>`
        : `<div class="row-controls-placeholder">----------</div>`;

      row.innerHTML =
        rowIdHtml +
        timeHtml +
        expHtml +
        deathPenaltyHtml +
        `<button class="del">×</button>` +
        controlsHtml;

      // 経験値再計算イベント（LAP/転職行は不要）
      if (rowId !== "LAP" && rowType !== "job") {
        const self = this;

        const recalcRowExp = () => {
          const snap = JSON.parse(row.dataset.snapshot);

          // スナップショットを直接 calcExp に渡すことで DOM を操作せず再計算
          const newCallCount  = parseInt(row.querySelector(".cs").value);
          const newPartnerKey = row.querySelector(".rs").value;
          row.dataset.count   = newCallCount;
          const expResult     = self.calcExp(newCallCount, newPartnerKey, snap);
          const newExpVal     = row.dataset.type === "angel"   ? expResult.angel
                              : row.dataset.type === "pass"    ? expResult.common
                              : expResult.total;
          row.dataset.val          = newExpVal;
          row.dataset.rawValCapped = newExpVal;
          row.querySelector(".exp-value").textContent = newExpVal.toLocaleString();

          self.updateTotal();
        };

        row.querySelector(".cs").onchange = recalcRowExp;
        row.querySelector(".rs").onchange = recalcRowExp;

        const despCheckbox = row.querySelector(".desp-tgl");
        if (despCheckbox) {
          despCheckbox.onchange = () => {
            row.dataset.desp = despCheckbox.checked ? "true" : "false";
            this.updateTotal();
          };
        }
      }

      row.querySelector(".del").onclick = () => {
        row.remove();
        this.updateTotal();
      };

      this.$("rowHistory").prepend(row);
      this.updateTotal();
    },

    /**
     * タイマーの時間表示・LAPタイム表示・オプション持続時間を更新する
     * @param {number} elapsedSec - 現在の経過秒数
     */
    updateTimerDisplay: function (elapsedSec) {
      this.$("timerDisplay").textContent    = this.formatTime(elapsedSec);
      this.$("lapTimeDisplay").textContent  = this.formatTime(elapsedSec - this.lastLapSec);
      const syncSec = Math.max(0, elapsedSec - this.jobOffsetSec);
      this.$("syncDisplay").innerHTML = syncSec > 0
        ? `オプション持続: ${this.formatTime(syncSec)}`
        : "&nbsp;";
    },

    /**
     * 指定コンテナにHTMLを注入してイベントリスナーを設定する
     * @param {string} containerSelector - マウント先のCSSセレクタ
     */
    render: function (containerSelector) {
      const container = document.querySelector(containerSelector);
      if (!container) return;
      const self = this;

      container.innerHTML = `
<style>
  *{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
  body{margin:0;padding:0}
  .c{max-width:none;width:100%;margin:0;padding:0;background:transparent;border:none;border-radius:0;font-family:sans-serif;color:#333;line-height:1.25}
  select,input,button{font-family:inherit}
  .h{display:flex;align-items:center;padding:6px 4px;border-bottom:1px solid #eee;font-size:12px;white-space:nowrap;gap:4px}
  .btn-primary{background:#0066cc;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;box-shadow:0 2px 4px rgba(0,0,0,0.2)}
  .btn-danger{background:#e74c3c;color:#fff;border:none;border-radius:4px;font-weight:bold;cursor:pointer}
  .btn-info{background:#3498db;color:#fff;border:none;border-radius:4px;font-weight:bold;cursor:pointer}
  .btn-warning{background:#fff1f0;border:1px solid #ffa39e;color:#cf1322;border-radius:4px;font-weight:bold;cursor:pointer}
  .btn-teal{background:#00bcd4;color:#fff;border:none;border-radius:4px;font-weight:bold;cursor:pointer}
  .panel-bg{background:#f9f9f9;border:1px solid #eee;border-radius:6px}
  .rs,.cs{font-size:12px;padding:2px 4px;min-width:52px}
  .rs{flex:1.45}
  .cs{flex:0.9}
  .mono-digit{font-family:'Verdana',system-ui,sans-serif;font-variant-numeric:tabular-nums}
  #timerDisplay,#lapTimeDisplay,#avgTimeDisplay,#passbookExpDisplay,#passbookLimitText{font-family:'Verdana',system-ui,sans-serif;font-variant-numeric:tabular-nums}
  #passbookExpDisplay,#passbookLimitText{font-size:15px;font-weight:bold}
  .timer-row{background:#f8f9fc;border-radius:6px;padding:6px 8px;margin-bottom:6px}
  label{color:#000}
  .text-orange{color:#f39c12}
  .text-green{color:#27ae60}
  .text-cyan{color:#2cc9ff}
  .text-red{color:#e74c3c}
  .sync-small{font-size:9px;color:#888;text-align:right;height:14px;line-height:14px}
  .lap-display{font-size:18px;font-weight:bold;color:#2cc9ff;line-height:24px}
  .timer-right{text-align:right}
  .penalty-ref{font-size:11px;color:#ff6666;margin-top:4px;white-space:pre-line}
  .passbook-area{background:#f0f7ff;border-radius:6px;padding:4px 8px;display:flex;flex-direction:column;gap:3px}
  .passbook-area.hidden{display:none}
  .passbook-info{font-size:13px;text-align:center;font-weight:bold}
  .passbook-buttons{display:flex;gap:6px;justify-content:center}
  .passbook-buttons button{background:#06c;color:#fff;border:none;border-radius:4px;padding:3px 8px;font-size:11px;cursor:pointer;flex:1}
  #ms{text-align:center}
  #ms,#pb,#cn,.rs,.cs{border-color:#7ab8ff}
  #btnTimerStop{background:#008888;color:#fff;border:1px solid #00aaaa;border-radius:4px;cursor:pointer;font-weight:bold;padding:2px}
  .btn-copy{background:#008888;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold;display:flex;align-items:center;justify-content:center;padding:4px 8px;font-size:12px}
  .btn-oc{background:#fff1f0;border:1px solid #ffa39e;color:#cf1322;border-radius:4px;padding:6px 12px;font-size:12px;cursor:pointer;margin-right:8px}
  
  /* 背景クラス */
  .exp-card{background:#f0f7ff;border:1px solid #7ab8ff;border-radius:6px}
  .opt-button{background:#f0f7ff;border:1px solid #7ab8ff;border-radius:6px}
  .monster-select{background:#f0f7ff}
  .reward-card{background:#f0f7ff}
  
  /* 行内クラス */
  .row-id-lap{color:#2cc9ff;font-weight:bold;width:26px;font-size:10px}
  .row-id-normal{color:#999;width:26px;font-size:10px}
  .time-cell{font-family:'Verdana',system-ui,sans-serif;font-variant-numeric:tabular-nums;width:65px}
  .time-main{font-size:11px;font-weight:bold}
  .time-lap{color:#2cc9ff;font-size:10px}
  .exp-cell{width:95px}
  .exp-cell-lap{width:95px;color:#aaa;font-size:10px}
  .exp-value{font-size:13px;min-width:62px;text-align:right;font-family:'Verdana',system-ui,sans-serif;font-variant-numeric:tabular-nums}
  .exp-label{font-size:10px}
  .desp-label{margin:0 2px;display:inline-flex;align-items:center}
  .desp-icon{font-size:9px}
  .del{border:none;background:none;color:#aaa;cursor:pointer;font-size:19px;padding:0 4px}
  .row-controls{display:flex;gap:3px;flex:1}
  .row-controls-placeholder{flex:1;color:#aaa;text-align:center;font-size:10px}
  
  /* ===== ダークモード ===== */
  body.dark-mode{background:#0a0a0f}
  body.dark-mode .c{background:#1a1a2a;color:#e8e8f0}
  body.dark-mode select,body.dark-mode input,body.dark-mode button{background:#2a2a3a;color:#e8e8f0}
  body.dark-mode .h{border-bottom-color:#2a2a3a}
  body.dark-mode .panel-bg{background:#0f0f17;border-color:#2a2a3a}
  /* 背景上書き（インラインスタイルを打ち消すため !important） */
  body.dark-mode .exp-card{background:#2a2f45 !important}
  body.dark-mode .opt-button{background:#2a2f45 !important}
  body.dark-mode .monster-select{background:#2a2f45 !important}
  body.dark-mode .reward-card{background:#2a2f45 !important}
  /* インラインスタイルの色を上書きするものだけ !important */
  body.dark-mode #currentExpDisplay{color:#5a9eff !important}
  body.dark-mode #ms,body.dark-mode #pob div{color:#5a9eff !important}
  body.dark-mode .text-orange{color:#ffaa66}
  body.dark-mode .text-green{color:#66ffaa}
  body.dark-mode .text-red{color:#ff8888}
  body.dark-mode #totalExpDisplay{color:#fff}
  body.dark-mode .timer-row{background:#2a2f45}
  body.dark-mode label{color:#e8e8f0}
  body.dark-mode .btn-primary{background:#1a6eaa;color:#fff;border:1px solid #3399cc}
  body.dark-mode .btn-danger{background:#aa3333;color:#fff;border:1px solid #cc5555}
  body.dark-mode .btn-info{background:#1a77aa;color:#fff;border:1px solid #3399cc}
  body.dark-mode .btn-warning{background:#2a1515;border:1px solid #883333;color:#cc7777}
  body.dark-mode .btn-teal{background:#1a8899;color:#fff;border:1px solid #33aabb}
  body.dark-mode .passbook-area{background:#1e2a44}
  body.dark-mode .passbook-buttons button{background:#1a73e8}
  body.dark-mode #btnTimerStop{background:#006666;border:1px solid #008888}
  body.dark-mode .btn-copy{background:#006666}
  body.dark-mode .btn-oc{background:#2a1515;border:1px solid #883333;color:#cc7777}
  body.dark-mode #ms,body.dark-mode #pb,body.dark-mode #cn,body.dark-mode .rs,body.dark-mode .cs{border-color:#7ab8ff}
  body.dark-mode #ms{background-color:#2a2f45}
  body.dark-mode #overflowDisplay{color:#888}
  body.dark-mode #timerDisplay{color:#e8e8f0}
  body.dark-mode #rowHistory{border-top-color:#2a2a3a;background:#1a1a2a}
  body.dark-mode .sync-small{color:#aaa}
  body.dark-mode .penalty-ref{color:#ff8888}
  body.dark-mode .exp-cell-lap{color:#aaa}
  body.dark-mode .row-id-normal{color:#aaa}
  body.dark-mode .row-id-lap{color:#2cc9ff}
  body.dark-mode .time-lap{color:#2cc9ff}
  body.dark-mode .row-controls-placeholder{color:#aaa}
  body.dark-mode .del{color:#aaa}
</style>

<div class="c">

  <!-- モンスター選択・通帳選択 -->
  <div style="display:flex;gap:6px;margin-bottom:8px">
    <select id="ms" class="monster-select" style="flex:2;padding:6px;font-size:15px;border:1px solid #7ab8ff;border-radius:4px;font-weight:bold">
      <option value="returner"      data-base="13118" data-bonus="0">リターナーモア</option>
      <option value="durahan"       data-base="22802" data-bonus="4561" selected>デュラハーン</option>
      <option value="hell"          data-base="23990" data-bonus="4798">ヘルガーディアン</option>
      <option value="scare"         data-base="22904" data-bonus="4581">スケアフレイル</option>
      <option value="dearthlicant"  data-base="15191" data-bonus="0">ダースリカント</option>
      <option value="golem_strong"  data-base="20350" data-bonus="0">ゴーレム強</option>
    </select>
    <select id="pb" style="flex:1;padding:6px;font-size:12px;border:1px solid #7ab8ff;border-radius:4px">
      <option value="0" selected>通帳なし</option>
      <option value="5000000">通帳1(500万)</option>
      <option value="10000000">通帳2(1000万)</option>
    </select>
  </div>

  <!-- 経験値表示・最適ボタン・討伐数選択 -->
  <div style="display:flex;gap:4px;margin-bottom:8px">
    <div class="exp-card" style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4px">
      <span id="currentExpDisplay" style="font-size:22px;font-weight:bold;color:#06c">0</span>
      <span id="overflowDisplay" style="font-size:9px;color:#999;margin-top:2px;visibility:hidden">溢れ:0</span>
    </div>
    <div id="pob" class="opt-button" style="width:46px;cursor:pointer;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center">
      <div style="font-size:8px;color:#06c">最適</div>
      <div style="font-size:13px;font-weight:bold;color:#06c">+1</div>
    </div>
    <div style="width:60px">
      <div style="font-size:7px;color:#666;text-align:center">討伐数</div>
      <select id="cn" style="width:100%;padding:2px;font-size:18px;font-weight:bold;border:1px solid #7ab8ff;border-radius:4px;text-align:center">
        <option value="1">A</option><option value="2">B</option><option value="3">C</option>
        <option value="4">D</option><option value="5">E</option><option value="6">F</option>
        <option value="7">G</option><option value="8">H</option><option value="9">I</option>
        <option value="10">J</option><option value="11" selected>K</option><option value="12">L</option>
      </select>
    </div>
  </div>

  <!-- バフ設定・タイマー開始ボタン -->
  <div id="timer-row" class="timer-row" style="padding:6px 8px;margin-bottom:8px;display:flex;gap:6px">
    <div style="flex:1;font-size:12px;display:flex;flex-direction:column;align-items:flex-end;padding-right:50px;justify-content:center">
      <!-- エリクサー選択 -->
      <div style="margin-bottom:3px;display:flex;gap:8px">
        <label><input name="e_exp" type="radio" value="none" />無</label>
        <label><input name="e_exp" type="radio" value="genki" checked />元気</label>
        <label><input name="e_exp" type="radio" value="bakushin" />爆伸</label>
      </div>
      <!-- バフチェックボックス・OCリセット -->
      <div style="border-top:1px solid #ddd;padding-top:3px;width:100%;display:flex;justify-content:flex-end;gap:14px;font-size:11px;align-items:center">
        <button id="btnBuffReset" class="btn-oc">OC</button>
        <div style="display:flex;flex-direction:column;gap:2px">
          <label><input id="fd" type="checkbox" checked />料理</label>
          <label><input id="tr" type="checkbox" />修練</label>
        </div>
        <div style="display:flex;flex-direction:column;gap:2px">
          <label><input id="ag" type="checkbox" />エンゼル</label>
          <label><input id="em" type="checkbox" />皇帝</label>
        </div>
      </div>
    </div>
    <button id="btnTimerStop" style="width:72px;font-size:12px;border-radius:4px;cursor:pointer;font-weight:bold;padding:2px">タイマー<br />開始</button>
  </div>

  <!-- 総獲得・加算ボタン -->
  <div style="display:flex;gap:6px;margin-bottom:8px">
    <div class="panel-bg" style="flex:6;padding:6px 8px;border-radius:6px;text-align:center">
      <div>
        <span style="font-size:12px;font-weight:bold">総獲得</span>
        <span id="totalExpDisplay" class="mono-digit" style="font-size:22px;font-weight:bold">0</span>
      </div>
      <div id="penaltyRef" class="penalty-ref" style="display:none"></div>
      <div style="font-size:11px;border-top:1px solid #ddd;margin-top:4px;padding-top:4px">
        <div>平均:<strong id="avgTimeDisplay" class="text-orange mono-digit" style="font-size:22px;font-weight:bold">--:--.--</strong></div>
      </div>
    </div>
    <button id="btnCalc" class="btn-primary" style="flex:4;font-size:21px;border-radius:6px">加算</button>
  </div>

  <!-- タイマー表示エリア -->
  <div class="panel-bg" style="padding:6px;border-radius:6px;margin-bottom:8px">
    <div style="display:flex;gap:6px;margin-bottom:4px;align-items:flex-start;justify-content:space-between">
      <div id="timerDisplay" class="mono-digit" style="font-size:28px;font-weight:bold">00:00.00</div>
      <div class="timer-right">
        <div id="syncDisplay" class="sync-small">&nbsp;</div>
        <div><span style="font-size:10px">LAP:</span><span id="lapTimeDisplay" class="lap-display mono-digit">00:00.00</span></div>
      </div>
    </div>
    <!-- タイマー操作ボタン -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:3px;margin-top:4px">
      <button id="btnAllClear"     class="btn-warning" style="padding:7px;font-size:11px">AC</button>
      <button id="btnTimerPause"   class="btn-danger"  style="padding:7px;font-size:11px">停止</button>
      <button id="btnJob"          class="btn-teal"    style="padding:7px;font-size:11px">転職</button>
      <button id="btnLap"          class="btn-info"    style="padding:7px;font-size:11px">LAP</button>
    </div>
  </div>

  <!-- 履歴コピー・想定玉給 -->
  <div style="display:flex;gap:6px;margin-bottom:6px;align-items:center">
    <button id="btnCopyHistory" class="btn-copy" style="flex:3;white-space:nowrap">履歴コピー</button>
    <div id="estimatedReward" class="reward-card" style="flex:7;border-radius:6px;padding:3px 6px;text-align:center;font-size:12px;display:flex;align-items:center;justify-content:center">
      想定玉給:<span id="estimatedGoldDisplay" class="text-green" style="font-weight:bold;font-size:13px;margin-left:4px">--</span>
    </div>
  </div>

  <!-- 通帳エリア -->
  <div id="passbookArea" class="passbook-area hidden" style="margin-bottom:6px">
    <div class="passbook-info" style="font-size:11px">
      通帳:<strong id="passbookExpDisplay" class="text-red mono-digit" style="font-size:13px">0</strong>/<span id="passbookLimitText" class="mono-digit" style="font-size:13px">0</span>
    </div>
    <div class="passbook-buttons">
      <button id="btnPassbookReset">リセット</button>
      <button id="btnPassbookWithdraw">1Lv分引出</button>
    </div>
  </div>

  <!-- 履歴リスト -->
  <div id="rowHistory" style="margin-top:4px;max-height:250px;overflow-y:auto;border-top:1px solid #eee"></div>
</div>
`;

      // ----- イベントリスナー設定（元のコードを完全維持）-----
      
      // 加算ボタン
      self.$("btnCalc").onclick = () => {
        if (Date.now() < self.calcLockedUntil) return;
        self.killCount++;
        const elapsedSec = self.timer
          ? (Date.now() - self.startTime) / 1000
          : self.pauseSec;
        const lapSec     = self.timer ? (elapsedSec - self.lastLapSec) : null;
        const callCount  = parseInt(self.$("cn").value);
        const expResult  = self.calcExp(callCount);
        const passbookLimit = parseInt(self.$("pb").value) || 0;

        if (passbookLimit > 0) {
          // エンゼル経験値行
          if (expResult.angel > 0) {
            self.addRow(self.killCount, callCount, expResult.angel, "angel", elapsedSec, lapSec, false, expResult.angel, null, false);
          }
          // 通帳残量を確認して通常/溢れを振り分け
          let accumulatedRaw = 0;
          document.querySelectorAll('.exp-row[data-type="pass"]').forEach(el => {
            const raw = parseFloat(el.dataset.rawValCapped);
            if (!isNaN(raw)) accumulatedRaw += raw;
          });
          const remainingRaw = Math.max(0, passbookLimit - (accumulatedRaw - self.passbookOffset));
          const remaining    = Math.ceil(remainingRaw);

          if (remaining >= expResult.common) {
            self.addRow(self.killCount, callCount, expResult.common, "pass", elapsedSec, lapSec, true, expResult.common, null, false);
          } else if (remaining > 0) {
            self.addRow(self.killCount, callCount, expResult.common - remaining, "overflow", elapsedSec, lapSec, false, expResult.common - remaining, null, false);
            self.addRow(self.killCount, callCount, remaining, "pass", elapsedSec, lapSec, true, remaining, null, false);
          } else {
            self.addRow(self.killCount, callCount, expResult.common, "overflow", elapsedSec, lapSec, true, expResult.common, null, false);
          }
        } else {
          self.addRow(self.killCount, callCount, expResult.total, "normal", elapsedSec, lapSec, true, expResult.total, null, false);
        }

        self.lastLapSec = elapsedSec;
        self.updateTimerDisplay(elapsedSec);

        // 加算後3秒間はボタンをロック
        self.calcLockedUntil = Date.now() + 3000;
        const calcBtn = self.$("btnCalc");
        calcBtn.disabled = true;
        calcBtn.style.opacity = "0.5";
        let countdown = 3;
        const countdownInterval = setInterval(() => {
          countdown--;
          if (countdown > 0) {
            calcBtn.textContent = `(${countdown})`;
          } else {
            clearInterval(countdownInterval);
            calcBtn.disabled = false;
            calcBtn.style.opacity = "1";
            calcBtn.textContent = "加算";
            self.updateUI();
          }
        }, 1000);
      };

      // ACボタン（全リセット）
      self.$("btnAllClear").onclick = () => {
        if (self.timer) { clearInterval(self.timer); self.timer = null; }
        self.pauseSec       = 0;
        self.startTime      = 0;
        self.lastLapSec     = 0;
        self.killCount      = 0;
        self.jobOffsetSec   = 0;
        self.passbookOffset = 0;
        self.$("rowHistory").innerHTML = "";
        self.updateTimerDisplay(0);
        self.updateTotal();
        self.updateUI();
      };

      // 通帳1Lv引き出しボタン
      self.$("btnPassbookWithdraw").onclick = () => {
        let accumulatedRaw = 0;
        document.querySelectorAll('.exp-row[data-type="pass"]').forEach(el => {
          const raw = parseFloat(el.dataset.rawValCapped);
          if (!isNaN(raw)) accumulatedRaw += raw;
        });
        const balance = accumulatedRaw - self.passbookOffset;
        if (balance <= 0) return;
        const withdrawn = Math.min(self.EXP_PER_LV, balance);
        self.passbookOffset += withdrawn;
        self.updateTotal();
      };

      // LAPボタン
      self.$("btnLap").onclick = () => {
        const elapsedSec = self.timer
          ? (Date.now() - self.startTime) / 1000
          : self.pauseSec;
        self.addRow("LAP", 0, 0, "lap_only", elapsedSec, elapsedSec - self.lastLapSec);
        self.lastLapSec = elapsedSec;
        self.updateTimerDisplay(elapsedSec);
      };

      // 転職ボタン
      self.$("btnJob").onclick = () => {
        if (!self.timer && self.pauseSec === 0) return;
        const elapsedSec = self.timer
          ? (Date.now() - self.startTime) / 1000
          : self.pauseSec;
        self.jobOffsetSec += 20;
        if (self.jobOffsetSec > elapsedSec) self.jobOffsetSec = elapsedSec;
        self.updateTimerDisplay(elapsedSec);
        if (self.timer) {
          self.addRow("JOB", 0, 0, "job", elapsedSec, elapsedSec - self.lastLapSec);
          self.lastLapSec = elapsedSec;
        }
      };

      // 最適+1ボタン
      self.$("pob").onclick = () => {
        self.$("cn").value = Math.min(12, self.optCallCount + 1);
        self.updateUI(false);
      };

      // タイマー開始ボタン
      self.$("btnTimerStop").onclick = () => {
        if (!self.timer) {
          self.startTime = Date.now() - self.pauseSec * 1000;
          self.timer = setInterval(() => {
            const elapsedSec = (Date.now() - self.startTime) / 1000;
            self.updateTimerDisplay(elapsedSec);
          }, 30);
          // 開始直後のロック解除
          self.calcLockedUntil = Math.max(self.calcLockedUntil, Date.now()) + 100;
          self.$("btnCalc").disabled = true;
          self.$("btnCalc").style.opacity = "0.5";
          setTimeout(() => {
            if (Date.now() >= self.calcLockedUntil) {
              self.$("btnCalc").disabled = false;
              self.$("btnCalc").style.opacity = "1";
            }
          }, 100);
        }
      };

      // タイマー停止ボタン
      self.$("btnTimerPause").onclick = () => {
        if (self.timer) {
          clearInterval(self.timer);
          self.timer = null;
          self.pauseSec = (Date.now() - self.startTime) / 1000;
          self.updateTimerDisplay(self.pauseSec);
        }
      };

      // 通帳リセットボタン
      self.$("btnPassbookReset").onclick = () => {
        let accumulatedRaw = 0;
        document.querySelectorAll('.exp-row[data-type="pass"]').forEach(el => {
          const raw = parseFloat(el.dataset.rawValCapped);
          if (!isNaN(raw)) accumulatedRaw += raw;
        });
        self.passbookOffset = Math.ceil(accumulatedRaw);
        self.updateTotal();
      };

      // 履歴コピーボタン
      self.$("btnCopyHistory").onclick = () => {
        try {
          const lines = [];
          lines.push(`モンスター/${self.$("ms").options[self.$("ms").selectedIndex].text}`);
          lines.push(`総獲得/平均タイム/想定玉給`);
          lines.push(
            `${self.$("totalExpDisplay").textContent.replace(/,/g, "")}` +
            `/${self.$("avgTimeDisplay").textContent}` +
            `/${self.$("estimatedGoldDisplay").textContent}`
          );
          lines.push(``);
          lines.push(`#/戦闘時間/獲得exp/呼び数/お供/種類`);

          document.querySelectorAll(".exp-row").forEach(el => {
            const rowType = el.dataset.type || "";
            const rowId   = el.dataset.bid  || "-";

            if (rowType === "lap_only") {
              lines.push(`${rowId}/LAPMARK////`);
              return;
            }
            if (rowType === "job") {
              const timeStr = self.formatTime(parseFloat(el.dataset.sec) || 0);
              lines.push(`${rowId}/${timeStr}////転職`);
              return;
            }

            const timeStr   = self.formatTime(parseFloat(el.dataset.sec) || 0);
            const expVal    = (parseInt(el.dataset.val) || 0).toString();
            const callIdx   = parseInt(el.dataset.count);
            const callLabel = !isNaN(callIdx) ? (self.CALL_LABELS[callIdx] || "--") : "--";
            const partnerSelect = el.querySelector(".rs");
            const partnerLabel  = partnerSelect
              ? (partnerSelect.options[partnerSelect.selectedIndex]?.text || "お供無")
              : "お供無";
            const typeLabel = rowType === "pass"     ? "通帳"
                            : rowType === "angel"    ? "エンゼル"
                            : rowType === "overflow" ? "溢れ"
                            : "通常";
            lines.push(`${rowId}/${timeStr}/${expVal}/${callLabel}/${partnerLabel}/${typeLabel}`);
          });

          navigator.clipboard.writeText(lines.join("\n"))
            .then(() => alert("履歴をコピーしました"));
        } catch (e) {
          alert("コピー失敗");
        }
      };

      // OCリセットボタン（バフを初期状態に戻す）
      self.$("btnBuffReset").onclick = () => {
        self.$("fd").checked = true;
        self.$("tr").checked = false;
        self.$("ag").checked = false;
        self.$("em").checked = false;
        const genkiradio = document.querySelector('input[name="e_exp"][value="genki"]');
        if (genkiradio) genkiradio.checked = true;
        self.$("pb").value = "0";
        self.updateUI(true);
      };

      // バフ変更時のUI更新（討伐数は自動調整）
      document.querySelectorAll('input[name="e_exp"], #fd, #tr, #ag, #em, #ms, #pb').forEach(el => {
        el.onchange = () => self.updateUI(true);
      });

      // 討伐数変更時のUI更新（討伐数は変えない）
      self.$("cn").onchange = () => self.updateUI(false);

      // 初期表示
      self.updateUI(true);
    },
  };

  // 外部公開 API
  global.ExpmercenaryV155 = {
    render: ExpCalc.render.bind(ExpCalc),
    destroy: function () {
      if (ExpCalc.timer) {
        clearInterval(ExpCalc.timer);
        ExpCalc.timer = null;
      }
      ExpCalc.startTime      = 0;
      ExpCalc.pauseSec       = 0;
      ExpCalc.lastLapSec     = 0;
      ExpCalc.jobOffsetSec   = 0;
      ExpCalc.passbookOffset = 0;
    },
  };
})(window);
