// ========== デュラハーン耐久シミュレーター ==========
(function (global) {
  'use strict';

  const Durability = {
    render: function (containerSelector) {
      const container = document.querySelector(containerSelector);
      if (!container) return;

      container.innerHTML = `
        <style>
          .dqx-durability { border:1px solid #7ab8ff; border-radius:8px; padding:14px; margin:16px 0; background:#f8faff; font-family:sans-serif; max-width:100%; box-sizing:border-box; }
          .dqx-durability h4 { margin:0 0 12px; font-size:1.05em; color:#06c; border-bottom:2px solid #7ab8ff; padding-bottom:6px; }
          .dqx-durability .cmp-row { display:flex; align-items:center; gap:10px; margin-bottom:10px; flex-wrap:wrap; }
          .dqx-durability .cmp-row label { font-weight:bold; color:#333; min-width:80px; font-size:0.9em; }
          .dqx-durability .cmp-row input[type="number"], .dqx-durability .cmp-row select { flex:1 1 120px; min-width:0; width:auto; padding:6px 8px; border:1px solid #ccc; border-radius:4px; font-size:16px; box-sizing:border-box; }
          .dqx-durability .cmp-row select { background:#fff; }
          .dqx-durability .cmp-checks { display:flex; flex-wrap:wrap; gap:6px 14px; margin:-2px 0 10px; font-size:0.9em; }
          .dqx-durability .cmp-checks label { display:inline-flex; align-items:center; gap:4px; font-weight:normal; color:#333; cursor:pointer; }
          .dqx-durability .cmp-checks input { margin:0; }
          .dqx-durability .cmp-result { margin-top:12px; }
          .dqx-durability .cmp-card { background:#fff; border:1px solid #7ab8ff; border-radius:8px; padding:10px 12px; margin-bottom:10px; }
          .dqx-durability .cmp-card h5 { margin:0 0 8px; font-size:0.95em; color:#036; border-bottom:1px solid #e0e8f5; padding-bottom:5px; }
          .dqx-durability .cmp-card table { width:100%; border-collapse:collapse; font-size:0.85em; }
          .dqx-durability .cmp-card td { padding:5px 2px; border-bottom:1px solid #f0f0f0; vertical-align:top; }
          .dqx-durability .cmp-card td:first-child { color:#555; width:44%; }
          .dqx-durability .cmp-card td:last-child { text-align:right; font-family:Verdana,monospace; font-variant-numeric:tabular-nums; font-weight:bold; word-break:break-word; }
          .dqx-durability .cmp-card .danger { color:#e74c3c; }
          .dqx-durability .cmp-card .safe { color:#27ae60; }
          .dqx-durability .cmp-card .warn { color:#f39c12; }
          .dqx-durability .cmp-card .label-sm { font-size:0.8em; font-weight:normal; color:#999; }
          .dqx-durability .cmp-card tr.sep td { border-top:1px solid #e0e0e0; }
          .dqx-durability .cmp-note { font-size:0.78em; color:#888; margin-top:8px; line-height:1.5; }
          .dqx-durability .cmp-badge { display:inline-block; font-size:0.75em; padding:1px 6px; border-radius:8px; margin-left:4px; vertical-align:middle; }
          .dqx-durability .cmp-badge.safe { background:#e8ffe8; color:#27ae60; border:1px solid #b8e6b8; }
          .dqx-durability .cmp-badge.danger { background:#ffecec; color:#e74c3c; border:1px solid #f5c0c0; }
          .dqx-durability .cmp-badge.scala { background:#fff4e0; color:#e67e22; border:1px solid #f5d9a8; }
          .dqx-durability .cmp-badge.angry { background:#ffe8e8; color:#c0392b; border:1px solid #f5b8b8; }
          body.dark-mode .dqx-durability { background:#1a1a2a; color:#e8e8f0; border-color:#7ab8ff; }
          body.dark-mode .dqx-durability h4 { color:#9ecbff; }
          body.dark-mode .dqx-durability .cmp-row label,
          body.dark-mode .dqx-durability .cmp-checks label { color:#e8e8f0; }
          body.dark-mode .dqx-durability .cmp-row input[type="number"],
          body.dark-mode .dqx-durability .cmp-row select { background:#2a2f45; color:#e8e8f0; border-color:#7ab8ff; }
          body.dark-mode .dqx-durability .cmp-card { background:#2a2f45; border-color:#7ab8ff; }
          body.dark-mode .dqx-durability .cmp-card h5 { color:#9ecbff; border-bottom-color:#3a3a4a; }
          body.dark-mode .dqx-durability .cmp-card td { border-bottom-color:#3a3a4a; }
          body.dark-mode .dqx-durability .cmp-card td:first-child { color:#c0c0cc; }
          body.dark-mode .dqx-durability .cmp-card tr.sep td { border-top-color:#3a3a4a; }
          body.dark-mode .dqx-durability .cmp-card .label-sm,
          body.dark-mode .dqx-durability .cmp-note { color:#aaa; }
          body.dark-mode .dqx-durability .cmp-card .safe { color:#66ffaa; }
          body.dark-mode .dqx-durability .cmp-card .danger { color:#ff8888; }
          body.dark-mode .dqx-durability .cmp-card .warn { color:#ffaa66; }
          body.dark-mode .dqx-durability .cmp-badge.safe { background:#123321; color:#66ffaa; border-color:#287a50; }
          body.dark-mode .dqx-durability .cmp-badge.danger,
          body.dark-mode .dqx-durability .cmp-badge.angry { background:#2a1515; color:#ff8888; border-color:#883333; }
          body.dark-mode .dqx-durability .cmp-badge.scala { background:#2a2115; color:#ffaa66; border-color:#8a5a22; }
        </style>
        <section class="dqx-durability">
          <h4>⚔ デュラハーン耐久シミュレーター</h4>
          <p class="cmp-note">基準攻撃力 1310 / 「通常攻撃×2」「通常攻撃×1＋ふりまわし×2」を比較</p>
          <div class="cmp-checks">
            <label><input type="checkbox" data-angry="0">1発目 怒り</label>
            <label><input type="checkbox" data-angry="1">2発目 怒り</label>
            <label><input type="checkbox" data-angry="2">3発目 怒り</label>
            <label><input type="checkbox" data-angry-all>全て怒り</label>
          </div>
          <div class="cmp-row"><label>守備力</label><input data-value="def" type="number" value="769" placeholder="769"></div>
          <div class="cmp-row"><label>HP</label><input data-value="hp" type="number" value="911" placeholder="911"></div>
          <div class="cmp-row"><label>被ダメ軽減</label><input data-value="red" type="number" value="57" placeholder="57"></div>
          <div class="cmp-row">
            <label>スカラ</label>
            <select data-value="scala">
              <option value="1.0">なし</option>
              <option value="1.2">1段階</option>
              <option value="1.4">2段階</option>
            </select>
          </div>
          <div class="cmp-result" data-result></div>
        </section>`;

      const root = container.querySelector('.dqx-durability');
      const inputs = {
        def: root.querySelector('[data-value="def"]'),
        hp: root.querySelector('[data-value="hp"]'),
        red: root.querySelector('[data-value="red"]'),
        scala: root.querySelector('[data-value="scala"]')
      };
      const angryChecks = Array.from(root.querySelectorAll('[data-angry]'));
      const angryAll = root.querySelector('[data-angry-all]');
      const output = root.querySelector('[data-result]');
      const DURAHAN_ATK = 1310;
      const HEAL_PCT = 0.10;
      const MAX_UP = 300;
      const COARSE = 10;
      const ANGRY = 1.25;
      let flags = [false, false, false];

      function effectiveDef(def, rate) {
        return Math.ceil(def * rate);
      }

      function base(def) {
        const avg = Math.ceil(DURAHAN_ATK / 2 - def / 4);
        const width = Math.ceil(avg / 16) + 1;
        return { avg, width };
      }

      function normalHit(avg, width, red) {
        return [avg - width - red, avg + width - red];
      }

      function angryNormalHit(avg, width, red) {
        const lo = avg - width, hi = avg + width;
        return [Math.ceil(lo * ANGRY) - red, Math.ceil(hi * ANGRY) - red];
      }

      function furiHit(avg, width, red) {
        const lo = avg - width, hi = avg + width;
        return [Math.ceil(lo * 0.6) - red, Math.ceil(hi * 0.6) - red];
      }

      function angryFuriHit(avg, width, red) {
        const lo = avg - width, hi = avg + width;
        return [Math.ceil(lo * 0.6 * ANGRY) - red, Math.ceil(hi * 0.6 * ANGRY) - red];
      }

      function enumerate(hits, hp) {
        const threshold = Math.floor(hp * HEAL_PCT);
        let total = 0, death = 0, notHealed = 0;
        let minSum = 0, maxSum = 0;
        hits.forEach(hit => { minSum += hit[0]; maxSum += hit[1]; });
        function rec(idx, sum) {
          if (idx === hits.length) {
            total++;
            if (sum >= hp) death++;
            else if (hp - sum > threshold) notHealed++;
            return;
          }
          const hit = hits[idx];
          for (let value = hit[0]; value <= hit[1]; value++) rec(idx + 1, sum + value);
        }
        rec(0, 0);
        return {
          min: minSum, max: maxSum,
          death: total ? death / total * 100 : 0,
          notHealed: total ? notHealed / total * 100 : 0
        };
      }

      function build(def, hp, red, rate) {
        const effectiveDefense = effectiveDef(def, rate);
        const hitBase = base(effectiveDefense);
        const n1 = flags[0] ? angryNormalHit(hitBase.avg, hitBase.width, red) : normalHit(hitBase.avg, hitBase.width, red);
        const n2 = flags[1] ? angryNormalHit(hitBase.avg, hitBase.width, red) : normalHit(hitBase.avg, hitBase.width, red);
        const nHits = [n1, n2];
        const nKinds = [flags[0] ? '怒り' : '通常', flags[1] ? '怒り' : '通常'];
        const f1 = flags[0] ? angryNormalHit(hitBase.avg, hitBase.width, red) : normalHit(hitBase.avg, hitBase.width, red);
        const f2 = flags[1] ? angryFuriHit(hitBase.avg, hitBase.width, red) : furiHit(hitBase.avg, hitBase.width, red);
        const f3 = flags[2] ? angryFuriHit(hitBase.avg, hitBase.width, red) : furiHit(hitBase.avg, hitBase.width, red);
        const fHits = [f1, f2, f3];
        const fKinds = [flags[0] ? '怒り' : '通常', flags[1] ? '怒りふり' : 'ふり', flags[2] ? '怒りふり' : 'ふり'];
        const normal = enumerate(nHits, hp);
        const furi = enumerate(fHits, hp);
        return {
          effDef: effectiveDefense,
          normal, furi, nHits, nKinds, fHits, fKinds,
          normalSurplusMin: hp - normal.max,
          normalSurplusMax: hp - normal.min,
          furiSurplusMin: hp - furi.max,
          furiSurplusMax: hp - furi.min
        };
      }

      function isZeroDeath(def, hp, red, mode, rate) {
        return build(def, hp, red, rate)[mode].death === 0;
      }

      function findNeed(def, hp, red, mode, rate) {
        if (isZeroDeath(def, hp, red, mode, rate)) return { def: 0, hp: 0, both: 0, ok: true };
        let defNeed = 0;
        for (let d = COARSE; d <= MAX_UP; d += COARSE) {
          if (isZeroDeath(def + d, hp, red, mode, rate)) {
            for (let dd = d - COARSE + 1; dd <= d; dd++) {
              if (isZeroDeath(def + dd, hp, red, mode, rate)) { defNeed = dd; break; }
            }
            break;
          }
        }
        let hpNeed = 0;
        for (let h = COARSE; h <= MAX_UP; h += COARSE) {
          if (isZeroDeath(def, hp + h, red, mode, rate)) {
            for (let hh = h - COARSE + 1; hh <= h; hh++) {
              if (isZeroDeath(def, hp + hh, red, mode, rate)) { hpNeed = hh; break; }
            }
            break;
          }
        }
        let bothNeed = 0;
        for (let s = COARSE; s <= MAX_UP; s += COARSE) {
          if (isZeroDeath(def + s, hp + s, red, mode, rate)) {
            for (let ss = s - COARSE + 1; ss <= s; ss++) {
              if (isZeroDeath(def + ss, hp + ss, red, mode, rate)) { bothNeed = ss; break; }
            }
            break;
          }
        }
        return { def: defNeed, hp: hpNeed, both: bothNeed, ok: false };
      }

      function pct(value) { return value.toFixed(2) + '%'; }
      function cls(value) { return value > 0 ? 'danger' : 'safe'; }
      function ncls(value) { return value > 30 ? 'danger' : (value > 10 ? 'warn' : 'safe'); }
      function needStr(need) {
        if (need === null) return '—';
        if (need.ok) return '達成済';
        const parts = [];
        if (need.def) parts.push('守+' + need.def);
        if (need.hp) parts.push('HP+' + need.hp);
        if (need.both) parts.push('両+' + need.both);
        return parts.length ? parts.join(' / ') : MAX_UP + '超';
      }

      function hitLines(hits, kinds) {
        return hits.map((hit, index) => (index + 1) + '発目 ' + kinds[index] + ' ' + hit[0] + '〜' + hit[1]).join('<br>');
      }

      function angryBadge() {
        const count = flags.filter(Boolean).length;
        return count ? '<span class="cmp-badge angry">怒り ' + count + '発</span>' : '';
      }

      function card(title, hitVal, totalVal, surplusMin, surplusMax, death, notHealed, need, hp) {
        const badge = death > 0
          ? '<span class="cmp-badge danger">死亡あり</span>'
          : '<span class="cmp-badge safe">死亡0%</span>';
        const surplusPct = hp > 0 ? surplusMin / hp * 100 : 0;
        const surplusClass = surplusMin <= 0 ? 'danger' : (surplusPct < 10 ? 'warn' : 'safe');
        let html = '<div class="cmp-card"><h5>' + title + badge + angryBadge() + '</h5><table>';
        html += '<tr><td>1発幅</td><td>' + hitVal + '</td></tr>';
        html += '<tr><td>合計幅</td><td>' + totalVal + '</td></tr>';
        html += '<tr><td>最小余剰HP <span class="label-sm">（最大ダメ時）</span></td><td class="' + surplusClass + '">' + surplusMin + ' <span class="label-sm">(' + surplusPct.toFixed(1) + '%)</span></td></tr>';
        html += '<tr><td>最大余剰HP <span class="label-sm">（最小ダメ時）</span></td><td>' + surplusMax + '</td></tr>';
        html += '<tr class="sep"><td>死亡する確率</td><td class="' + cls(death) + '">' + pct(death) + '</td></tr>';
        html += '<tr><td>回復をしない確率</td><td class="' + ncls(notHealed) + '">' + pct(notHealed) + '</td></tr>';
        html += '<tr class="sep"><td>死亡0%までの目安</td><td>' + needStr(need) + '</td></tr></table></div>';
        return html;
      }

      function calc() {
        const def = parseFloat(inputs.def.value);
        const hp = parseFloat(inputs.hp.value);
        const red = parseFloat(inputs.red.value);
        const rate = parseFloat(inputs.scala.value);
        flags = angryChecks.map(check => check.checked);
        if (Number.isNaN(def) || Number.isNaN(hp) || Number.isNaN(red)) {
          output.innerHTML = '<p class="cmp-note">守備力・HP・被ダメ軽減を入力してください。</p>';
          return;
        }
        const result = build(def, hp, red, rate);
        const normalNeed = findNeed(def, hp, red, 'normal', rate);
        const furiNeed = findNeed(def, hp, red, 'furi', rate);
        let html = '';
        if (rate > 1.0) {
          const label = rate === 1.2 ? '1段階' : '2段階';
          html = '<p class="cmp-note"><span class="cmp-badge scala">スカラ' + label + '</span> 実効守備力：' + result.effDef + '</p>';
        }
        html += card('デュラハーン 通常攻撃×2', hitLines(result.nHits, result.nKinds), result.normal.min + '〜' + result.normal.max,
          result.normalSurplusMin, result.normalSurplusMax, result.normal.death, result.normal.notHealed, normalNeed, hp);
        html += card('デュラハーン 通常攻撃×1＋ふりまわし×2', hitLines(result.fHits, result.fKinds), result.furi.min + '〜' + result.furi.max,
          result.furiSurplusMin, result.furiSurplusMax, result.furi.death, result.furi.notHealed, furiNeed, hp);
        output.innerHTML = html;
      }

      [inputs.def, inputs.hp, inputs.red].forEach(input => {
        input.addEventListener('input', calc);
        input.addEventListener('change', calc);
      });
      inputs.scala.addEventListener('change', calc);
      angryChecks.forEach(check => check.addEventListener('change', () => {
        angryAll.checked = angryChecks.every(item => item.checked);
        calc();
      }));
      angryAll.addEventListener('change', () => {
        angryChecks.forEach(check => { check.checked = angryAll.checked; });
        calc();
      });
      calc();
    }
  };

  global.Durahan = Durability;
})(window);