// ========== 鍛冶職人シミュレーター ==========
// DQ10準拠データ(温度別数値表・特技・道具会心率・レベル別集中力)を用いた練習/記録用シミュレーター
(function (global) {
  'use strict';

  const STORAGE_KEYS = Object.freeze({
    LEVEL: 'dqx_kaji_level',
    PRESETS: 'dqx_kaji_presets_v1'
  });

  /* ============================================================
     データ定義
     ============================================================ */

  const LEVEL_TABLE = [
    [1,0,50],[2,12,52],[3,30,53],[4,64,56],[5,106,57],[6,178,60],[7,262,61],[8,387,64],
    [9,528,67],[10,720,67],[11,1037,70],[12,1383,73],[13,1836,73],[14,2324,76],[15,3026,79],
    [16,3775,79],[17,4693,82],[18,5946,84],[19,7269,87],[20,8661,87],[21,10299,90],[22,12015,93],
    [23,13809,93],[24,15889,96],[25,18043,98],[26,20789,101],[27,23641,101],[28,26901,104],
    [29,30277,109],[30,34093,109],[31,41453,112],[32,52663,113],[33,70013,113],[34,99413,115],
    [35,147413,119],[36,196413,122],[37,247413,123],[38,300453,123],[39,355573,125],[40,412813,129],
    [41,472213,132],[42,533813,134],[43,597653,137],[44,663773,139],[45,732213,139],[46,803013,142],
    [47,876213,142],[48,951853,144],[49,1029973,147],[50,1110613,149],[51,1210453,152],[52,1313413,152],
    [53,1419541,154],[54,1528885,157],[55,1641493,159],[56,1757413,162],[57,1876693,162],[58,1999381,164],
    [59,2125525,167],[60,2255173,169],[61,2388373,171],[62,2525173,171],[63,2665621,173],[64,2809765,175],
    [65,2957653,177],[66,3109333,180],[67,3264333,182],[68,3424333,184],[69,3589333,186],[70,3759333,188],
    [71,3934333,189],[72,4114333,191],[73,4299333,193],[74,4489333,195],[75,4684333,197],
    [76,4884333,197],[77,5089333,197],[78,5299333,197],[79,5514333,197],[80,5734333,197]
  ];
  function concByLevel(lv) {
    const row = LEVEL_TABLE.find(r => r[0] === lv) || LEVEL_TABLE[LEVEL_TABLE.length - 1];
    return row[2];
  }
  function critBonusByLevel(lv) {
    let b = 0;
    if (lv >= 10) b += 0.1;
    if (lv >= 20) b += 0.2;
    if (lv >= 30) b += 0.3;
    return b;
  }

  // 鍛冶ハンマー一覧（★0〜★3。集中力は道具ごとの固定値、会心率は星で変動）
  const HAMMERS = [
    { name:'銅の鍛冶ハンマー',     lv:5,  special:null,       uses:15, conc:0,
      stars:[{crit:1.0},{crit:1.1},{crit:1.2},{crit:2.0}] },
    { name:'鉄の鍛冶ハンマー',     lv:13, special:null,       uses:20, conc:10,
      stars:[{crit:1.5},{crit:1.6},{crit:1.7},{crit:2.5}] },
    { name:'銀の鍛冶ハンマー',     lv:21, special:null,       uses:25, conc:15,
      stars:[{crit:2.0},{crit:2.1},{crit:2.2},{crit:3.0}] },
    { name:'プラチナ鍛冶ハンマー', lv:28, special:null,       uses:30, conc:25,
      stars:[{crit:2.5},{crit:2.6},{crit:2.7},{crit:3.5}] },
    { name:'超鍛冶ハンマー',       lv:32, special:null,       uses:30, conc:35,
      stars:[{crit:3.0},{crit:3.1},{crit:3.2},{crit:4.0}] },
    { name:'奇跡の鍛冶ハンマー',   lv:34, special:'conc30',   uses:30, conc:40,
      stars:[{crit:3.3,chance:4.1},{crit:3.4,chance:8.3},{crit:3.5,chance:12.5},{crit:4.3,chance:16.6}] },
    { name:'光の鍛冶ハンマー',     lv:40, special:'hissatsu', uses:30, conc:45,
      stars:[{crit:3.6,chance:2.5},{crit:3.7,chance:5.0},{crit:3.8,chance:7.5},{crit:4.6,chance:10.0}] }
  ];

  const INGOTS = [
    { key:'none', name:'なし' },
    { key:'modori', name:'戻り地金（再生地金）' },
    { key:'conc_change', name:'集中変化地金' },
    { key:'power_half', name:'倍半地金' },
    { key:'hikari', name:'威力会心地金（光地金）' }
  ];

  // 温度別・技グループ別 数値候補表（50〜2000℃、50刻み）
  const TEMP_TABLE = {
    2000:{taku:[27,26,24,23,21,20,18],tekagen:[14,14,12,12,11,11,9],ren4:[33,32,30,29,26,24,23],bai2:[54,51,48,45,42,39,36],bai3:[81,77,72,68,63,59,54],neppu:[68,65,60,57,53,50,45],midare:[23,21,20,20,18,17,15]},
    1950:{taku:[27,26,24,23,21,20,18],tekagen:[14,14,12,12,11,11,9],ren4:[33,31,30,29,26,24,23],bai2:[54,51,48,45,42,39,36],bai3:[80,76,71,67,62,58,54],neppu:[67,64,59,57,52,49,45],midare:[23,21,20,20,18,17,15]},
    1900:{taku:[27,25,24,22,21,19,18],tekagen:[14,14,12,12,11,11,9],ren4:[32,31,29,28,25,24,22],bai2:[53,50,47,44,41,38,35],bai3:[79,74,70,66,61,57,53],neppu:[66,63,58,56,51,48,44],midare:[22,21,19,19,18,16,15]},
    1850:{taku:[26,25,23,22,20,19,18],tekagen:[13,13,12,12,10,10,9],ren4:[32,30,29,28,25,23,22],bai2:[52,49,46,43,40,38,35],bai3:[77,73,69,65,60,56,52],neppu:[65,62,57,55,50,48,43],midare:[22,20,19,19,18,16,15]},
    1800:{taku:[26,24,23,21,20,19,17],tekagen:[13,13,12,12,10,10,9],ren4:[31,30,28,27,24,23,21],bai2:[51,48,45,42,40,37,34],bai3:[76,72,68,63,59,55,51],neppu:[63,61,56,54,49,47,42],midare:[21,20,19,19,17,16,14]},
    1750:{taku:[25,24,22,21,20,18,17],tekagen:[13,13,11,11,10,10,9],ren4:[31,29,28,27,24,22,21],bai2:[50,47,44,42,39,36,33],bai3:[75,71,66,62,58,54,50],neppu:[62,60,55,53,49,46,42],midare:[21,20,18,18,17,16,14]},
    1700:{taku:[25,23,22,21,19,18,17],tekagen:[13,13,11,11,10,10,9],ren4:[30,29,27,26,23,22,21],bai2:[49,46,44,41,38,36,33],bai3:[73,69,65,61,57,53,49],neppu:[61,59,54,52,48,45,41],midare:[21,19,18,18,17,15,14]},
    1650:{taku:[24,23,22,20,19,18,16],tekagen:[12,12,11,11,10,10,8],ren4:[30,28,27,26,23,22,20],bai2:[48,46,43,40,38,35,32],bai3:[72,68,64,60,56,52,48],neppu:[60,57,53,51,47,44,40],midare:[20,19,18,18,16,15,14]},
    1600:{taku:[24,23,21,20,19,17,16],tekagen:[12,12,11,11,10,10,8],ren4:[29,28,26,25,23,21,20],bai2:[47,45,42,39,37,34,32],bai3:[71,67,63,59,55,51,47],neppu:[59,56,52,50,46,43,39],midare:[20,19,17,17,16,15,13]},
    1550:{taku:[23,22,21,20,18,17,16],tekagen:[12,12,11,11,9,9,8],ren4:[29,27,26,25,22,21,20],bai2:[46,44,41,39,36,34,31],bai3:[69,66,62,58,54,50,46],neppu:[58,55,51,49,45,43,39],midare:[20,18,17,17,16,15,13]},
    1500:{taku:[23,22,20,19,18,17,15],tekagen:[12,12,10,10,9,9,8],ren4:[28,27,25,24,22,20,19],bai2:[45,43,40,38,35,33,30],bai3:[68,64,60,57,53,49,45],neppu:[57,54,50,48,44,42,38],midare:[19,18,17,17,15,14,13]},
    1450:{taku:[23,21,20,19,18,16,15],tekagen:[12,12,10,10,9,9,8],ren4:[27,26,25,24,21,20,19],bai2:[45,42,40,37,35,32,30],bai3:[67,63,59,56,52,48,45],neppu:[56,53,49,47,43,41,37],midare:[19,18,16,16,15,14,13]},
    1400:{taku:[22,21,20,18,17,16,15],tekagen:[11,11,10,10,9,9,8],ren4:[27,26,24,23,21,20,18],bai2:[44,41,39,36,34,32,29],bai3:[65,62,58,54,51,47,44],neppu:[54,52,48,46,42,40,36],midare:[18,17,16,16,15,14,12]},
    1350:{taku:[22,20,19,18,17,16,15],tekagen:[11,11,10,10,9,9,8],ren4:[26,25,24,23,20,19,18],bai2:[43,40,38,36,33,31,29],bai3:[64,60,57,53,50,46,43],neppu:[53,51,47,45,42,39,36],midare:[18,17,16,16,15,13,12]},
    1300:{taku:[21,20,19,18,17,15,14],tekagen:[11,11,10,10,9,9,7],ren4:[26,25,23,22,20,19,18],bai2:[42,40,37,35,33,30,28],bai3:[63,59,56,52,49,45,42],neppu:[52,50,46,44,41,38,35],midare:[18,17,15,15,14,13,12]},
    1250:{taku:[21,20,18,17,16,15,14],tekagen:[11,11,9,9,8,8,7],ren4:[25,24,23,22,20,18,17],bai2:[41,39,36,34,32,30,27],bai3:[61,58,54,51,48,44,41],neppu:[51,49,45,43,40,38,34],midare:[17,16,15,15,14,13,12]},
    1200:{taku:[20,19,18,17,16,15,14],tekagen:[10,10,9,9,8,8,7],ren4:[25,24,22,21,19,18,17],bai2:[40,38,36,33,31,29,27],bai3:[60,57,53,50,47,43,40],neppu:[50,48,44,42,39,37,33],midare:[17,16,15,15,14,13,11]},
    1150:{taku:[20,19,18,17,16,14,13],tekagen:[10,10,9,9,8,8,7],ren4:[24,23,22,21,19,18,17],bai2:[39,37,35,33,31,28,26],bai3:[59,55,52,49,46,42,39],neppu:[49,47,43,41,38,36,33],midare:[17,16,14,14,13,12,11]},
    1100:{taku:[19,18,17,16,15,14,13],tekagen:[10,10,9,9,8,8,7],ren4:[24,23,21,20,18,17,16],bai2:[38,36,34,32,30,28,26],bai3:[57,54,51,48,45,41,38],neppu:[48,46,42,40,37,35,32],midare:[16,15,14,14,13,12,11]},
    1050:{taku:[19,18,17,16,15,14,13],tekagen:[10,10,9,9,8,8,7],ren4:[23,22,21,20,18,17,16],bai2:[37,35,33,31,29,27,25],bai3:[56,53,50,47,44,40,37],neppu:[47,45,41,39,36,34,31],midare:[16,15,14,14,13,12,11]},
    1000:{taku:[18,17,16,15,14,13,12],tekagen:[9,9,8,8,7,7,6],ren4:[22,21,20,19,17,16,15],bai2:[36,34,32,30,28,26,24],bai3:[54,51,48,45,42,39,36],neppu:[45,43,40,38,35,33,30],midare:[15,14,13,13,12,11,10]},
    950:{taku:[18,17,16,15,14,13,12],tekagen:[9,9,8,8,7,7,6],ren4:[22,21,20,19,17,16,15],bai2:[36,34,32,30,28,26,24],bai3:[53,50,47,44,41,39,36],neppu:[44,42,39,38,35,33,30],midare:[15,14,13,13,12,11,10]},
    900:{taku:[18,17,16,15,14,13,12],tekagen:[9,9,8,8,7,7,6],ren4:[21,20,19,19,17,16,15],bai2:[35,33,31,29,27,25,23],bai3:[52,49,46,43,40,38,35],neppu:[43,41,38,37,34,32,29],midare:[15,14,13,13,12,11,10]},
    850:{taku:[17,16,15,14,13,13,12],tekagen:[9,9,8,8,7,7,6],ren4:[21,20,19,18,16,15,14],bai2:[34,32,30,28,26,25,23],bai3:[50,48,45,42,39,37,34],neppu:[42,40,37,36,33,31,28],midare:[14,13,13,13,12,11,10]},
    800:{taku:[17,16,15,14,13,12,11],tekagen:[9,9,8,8,7,7,6],ren4:[20,19,18,18,16,15,14],bai2:[33,31,29,27,26,24,22],bai3:[49,46,44,41,38,36,33],neppu:[41,39,36,35,32,30,27],midare:[14,13,12,12,11,10,9]},
    750:{taku:[16,15,14,14,13,12,11],tekagen:[8,8,7,7,7,7,6],ren4:[20,19,18,17,15,14,14],bai2:[32,30,28,27,25,23,21],bai3:[48,45,42,40,37,35,32],neppu:[40,38,35,34,31,29,27],midare:[14,13,12,12,11,10,9]},
    700:{taku:[16,15,14,13,12,12,11],tekagen:[8,8,7,7,6,6,6],ren4:[19,18,17,17,15,14,13],bai2:[31,29,28,26,24,23,21],bai3:[46,44,41,39,36,34,31],neppu:[39,37,34,33,30,29,26],midare:[13,12,12,12,11,10,9]},
    650:{taku:[15,15,14,13,12,11,10],tekagen:[8,8,7,7,6,6,5],ren4:[19,18,17,16,15,14,13],bai2:[30,29,27,25,24,22,20],bai3:[45,43,40,38,35,33,30],neppu:[38,36,33,32,29,28,25],midare:[13,12,11,11,10,10,9]},
    600:{taku:[15,14,13,12,12,11,10],tekagen:[8,8,7,7,6,6,5],ren4:[18,17,16,16,14,13,12],bai2:[29,28,26,24,23,21,20],bai3:[44,41,39,36,34,32,29],neppu:[36,35,32,31,28,27,24],midare:[12,12,11,11,10,9,8]},
    550:{taku:[14,14,13,12,11,11,10],tekagen:[7,7,7,7,6,6,5],ren4:[18,17,16,15,14,13,12],bai2:[28,27,25,24,22,21,19],bai3:[42,40,38,35,33,31,28],neppu:[35,34,31,30,28,26,24],midare:[12,11,11,11,10,9,8]},
    500:{taku:[14,13,12,12,11,10,9],tekagen:[7,7,6,6,6,6,5],ren4:[17,16,15,15,13,12,12],bai2:[27,26,24,23,21,20,18],bai3:[41,39,36,34,32,30,27],neppu:[34,33,30,29,27,25,23],midare:[12,11,10,10,9,9,8]},
    450:{taku:[14,13,12,11,11,10,9],tekagen:[7,7,6,6,6,6,5],ren4:[16,16,15,14,13,12,11],bai2:[27,25,24,22,21,19,18],bai3:[40,37,35,33,31,29,27],neppu:[33,32,29,28,26,24,22],midare:[11,11,10,10,9,8,8]},
    400:{taku:[13,12,12,11,10,10,9],tekagen:[7,7,6,6,5,5,5],ren4:[16,15,14,14,12,12,11],bai2:[26,24,23,21,20,19,17],bai3:[38,36,34,32,30,28,26],neppu:[32,31,28,27,25,24,21],midare:[11,10,10,10,9,8,7]},
    350:{taku:[13,12,11,11,10,9,9],tekagen:[7,7,6,6,5,5,5],ren4:[15,15,14,13,12,11,11],bai2:[25,23,22,21,19,18,17],bai3:[37,35,33,31,29,27,25],neppu:[31,30,27,26,24,23,21],midare:[11,10,9,9,9,8,7]},
    300:{taku:[12,12,11,10,10,9,8],tekagen:[6,6,6,6,5,5,4],ren4:[15,14,13,13,12,11,10],bai2:[24,23,21,20,19,17,16],bai3:[36,34,32,30,28,26,24],neppu:[30,28,26,25,23,22,20],midare:[10,10,9,9,8,8,7]},
    250:{taku:[12,11,10,10,9,9,8],tekagen:[6,6,5,5,5,5,4],ren4:[14,14,13,12,11,10,10],bai2:[23,22,20,19,18,17,15],bai3:[34,32,30,29,27,25,23],neppu:[29,27,25,24,22,21,19],midare:[10,9,9,9,8,7,7]},
    200:{taku:[11,11,10,9,9,8,8],tekagen:[6,6,5,5,5,5,4],ren4:[14,13,12,12,11,10,9],bai2:[22,21,20,18,17,16,15],bai3:[33,31,29,27,26,24,22],neppu:[27,26,24,23,21,20,18],midare:[9,9,8,8,8,7,6]},
    150:{taku:[11,10,10,9,9,8,7],tekagen:[6,6,5,5,5,5,4],ren4:[13,13,12,11,10,10,9],bai2:[21,20,19,18,17,15,14],bai3:[32,30,28,26,25,23,21],neppu:[26,25,23,22,21,19,18],midare:[9,9,8,8,7,7,6]},
    100:{taku:[10,10,9,9,8,8,7],tekagen:[5,5,5,5,4,4,4],ren4:[13,12,11,11,10,9,9],bai2:[20,19,18,17,16,15,14],bai3:[30,29,27,25,24,22,20],neppu:null,midare:[9,8,8,8,7,7,6]},
    50:{taku:[10,9,9,8,8,7,7],tekagen:[5,5,5,5,4,4,4],ren4:[12,12,11,10,9,9,8],bai2:[19,18,17,16,15,14,13],bai3:[29,27,26,24,23,21,19],neppu:null,midare:[8,8,7,7,7,6,6]}
  };
  function clampTemp(t) { return Math.max(50, Math.min(2500, Math.round(t / 50) * 50)); }
  function tableTemp(t) { return Math.min(2000, clampTemp(t)); }

  const SKILLS = [
    { key:'taku',      name:'たたく',         lv:1,  cost:5,  group:'taku',    target:'single',   tempDrop:50,  desc:'1マスを通常の威力で叩く' },
    { key:'updown',    name:'上下打ち',       lv:2,  cost:8,  group:'ren4',    target:'updown',   tempDrop:50,  desc:'上下2マスを1.2倍の威力で叩く' },
    { key:'tekagen',   name:'てかげん打ち',   lv:3,  cost:10, group:'tekagen', target:'single',   tempDrop:50,  desc:'1マスを0.5倍の威力で叩く' },
    { key:'bai2',      name:'2倍打ち',        lv:5,  cost:8,  group:'bai2',    target:'single',   tempDrop:50,  desc:'1マスを2倍の威力で叩く' },
    { key:'kariki',    name:'火力上げ',       lv:7,  cost:10, group:null,     target:'temp_up',   tempDrop:0,   desc:'温度を300度上げる' },
    { key:'ren4',      name:'4連打ち',        lv:11, cost:12, group:'ren4',    target:'square4',  tempDrop:50,  desc:'2×2マスを1.2倍の威力で叩く' },
    { key:'midare',    name:'みだれ打ち',     lv:13, cost:7,  group:'midare',  target:'midare',   tempDrop:50,  desc:'ランダムに4回、0.8倍の威力で叩く' },
    { key:'bai3',      name:'3倍打ち',        lv:16, cost:11, group:'bai3',    target:'single',   tempDrop:50,  desc:'1マスを3倍の威力で叩く' },
    { key:'neraiuchi', name:'ねらい打ち',     lv:23, cost:16, group:'taku',    target:'single',   tempDrop:50,  desc:'通常威力・会心が出やすい', critUp:true },
    { key:'cho4',      name:'超4連打ち',      lv:27, cost:18, group:'bai2',    target:'square4',  tempDrop:50,  desc:'2×2マスを2倍の威力で叩く' },
    { key:'hiyashi',   name:'冷やし込み',     lv:33, cost:12, group:null,     target:'temp_down', tempDrop:0,   desc:'温度を300度下げる' },
    { key:'naname',    name:'ななめ打ち',     lv:38, cost:7,  group:'ren4',    target:'naname',   tempDrop:50,  desc:'右上・左下2マスを1.2倍の威力で叩く' },
    { key:'neppu',     name:'熱風おろし',     lv:47, cost:6,  group:'neppu',   target:'single',   tempDrop:150, desc:'1マスを2.5倍の威力で叩き、温度が150度下がる' },
    { key:'jouge_nerai', name:'上下ねらい打ち', lv:52, cost:25, group:'ren4',  target:'updown',   tempDrop:50,  desc:'上下2マスを1.2倍で叩く・会心が出やすい', critUp:true },
    { key:'yowa_nerai', name:'弱ねらい打ち',  lv:75, cost:20, group:'tekagen', target:'single',   tempDrop:50,  desc:'0.5倍のねらい打ち・会心が出やすい', critUp:true },
    { key:'leftright', name:'左右打ち',       lv:80, cost:12, group:'ren4',    target:'leftright', tempDrop:50, desc:'左右2マスを強く叩く' }
  ];
  function skillAvailable(skill, lv, conc) { return lv >= skill.lv && conc >= skill.cost; }

  const COLS = 2, ROWS = 4;
  function cellId(r, c) { return r + '-' + c; }
  function emptyGrid() {
    const cells = {};
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        cells[cellId(r, c)] = { r:r, c:c, included:false, zoneMin:null, zoneMax:null, critTarget:null, current:0, critHit:false, flashType:null, glow:false, popup:null };
      }
    }
    return cells;
  }
  function patternCells(target, r, c, grid) {
    const inb = (rr, cc) => rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS;
    const isIncluded = (rr, cc) => inb(rr, cc) && grid[cellId(rr, cc)].included;
    let offsets;
    switch (target) {
      case 'single': offsets = [[0,0]]; break;
      case 'updown': offsets = [[0,0],[1,0]]; break;
      case 'leftright': offsets = [[0,0],[0,1]]; break;
      case 'naname': offsets = [[0,0],[1,-1]]; break;
      case 'square4': offsets = [[0,0],[0,1],[1,0],[1,1]]; break;
      default: offsets = [[0,0]];
    }
    return offsets
      .map(([dr, dc]) => [r + dr, c + dc])
      .filter(([rr, cc]) => isIncluded(rr, cc))
      .map(([rr, cc]) => cellId(rr, cc));
  }
  function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  const GRADE_TABLE = { 2:[0,3,7], 3:[2,5,11], 4:[3,7,15], 5:[5,9,19], 6:[7,11,23], 7:[9,13,27], 8:[10,15,31] };
  function gradeFromError(err, cellCount) {
    const key = Math.max(2, Math.min(8, cellCount));
    const t = GRADE_TABLE[key];
    if (err <= t[0]) return '★★★（大成功）';
    if (err <= t[1]) return '★★';
    if (err <= t[2]) return '★';
    return '無星';
  }

  const CP400 = [400,800,1200,1600,2000,2400];
  const CP400_200 = [200,600,1000,1400,1800,2200];

  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  /* ============================================================
     本体
     ============================================================ */
  const Kaji = {
    _container: null,
    _flashTimers: {},
    _clickHandler: null,
    _changeHandler: null,
    _inputHandler: null,
    _blurHandler: null,
    _tickTimer: null,

    _initialState: function () {
      return {
        tab: 'setup',
        level: 30,
        hammerName: '',
        hammerStar: 0,
        ingotKey: 'none',
        kotsuMastered: false,
        grid: emptyGrid(),
        shapeLocked: false,
        temp: 1000,
        conc: concByLevel(30),
        pendingMulti: null,
        previewAnchor: null,
        log: [],
        hephaestusReady: false,
        hephaestusActive: false,
        finalGrade: null,
        triggeredCPs: [],
        turnCount: 0,
        critBanner: false,
        tempBanner: null,
        presets: [],
        presetName: '',
        presetStatus: '',
        recAwaiting: null,
        recInputs: {},
        recMidareTargets: []
      };
    },

    render: function (containerSelector) {
      const container = document.querySelector(containerSelector);
      if (!container) return;
      this._container = container;
      this._flashTimers = {};
      this.state = this._initialState();
      this._loadLevel();
      this._loadPresets();

      this._clickHandler = this._onClick.bind(this);
      this._changeHandler = this._onChange.bind(this);
      container.addEventListener('click', this._clickHandler);
      container.addEventListener('change', this._changeHandler);

      this._injectStyle();
      this._renderAll();
    },

    destroy: function () {
      if (this._container) {
        this._container.removeEventListener('click', this._clickHandler);
        this._container.removeEventListener('change', this._changeHandler);
      }
      Object.values(this._flashTimers).forEach(t => clearTimeout(t));
      this._flashTimers = {};
    },

    /* ---------- 永続化 ---------- */
    _loadLevel: function () {
      try {
        const v = localStorage.getItem(STORAGE_KEYS.LEVEL);
        if (v !== null) this.state.level = Number(v) || 30;
      } catch (e) { /* noop */ }
    },
    _saveLevel: function () {
      try { localStorage.setItem(STORAGE_KEYS.LEVEL, String(this.state.level)); } catch (e) { /* noop */ }
    },
    _loadPresets: function () {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.PRESETS);
        this.state.presets = raw ? JSON.parse(raw) : [];
      } catch (e) { this.state.presets = []; }
    },
    _savePresetsToStorage: function () {
      try { localStorage.setItem(STORAGE_KEYS.PRESETS, JSON.stringify(this.state.presets)); return true; }
      catch (e) { console.error('プリセット保存エラー', e); return false; }
    },

    /* ---------- 派生値 ---------- */
    _effLevel: function () {
      const lv = this.state.level;
      return (lv != null && lv >= 1) ? Math.min(80, lv) : 1;
    },
    _hammer: function () {
      return HAMMERS.find(h => h.name === this.state.hammerName) || null;
    },
    _hammerData: function () {
      const h = this._hammer();
      return h ? h.stars[this.state.hammerStar] : null;
    },
    _maxConc: function () {
      const h = this._hammer();
      return concByLevel(this._effLevel()) + (h ? h.conc : 0);
    },
    _levelCrit: function () { return critBonusByLevel(this._effLevel()); },
    _baseCrit: function () {
      const hd = this._hammerData();
      return Math.min(100, this._levelCrit() + (hd ? hd.crit : 0) + (this.state.kotsuMastered ? 1.0 : 0));
    },
    _includedCount: function () {
      return Object.values(this.state.grid).filter(c => c.included).length;
    },

    /* ---------- ユーティリティ ---------- */
    _pushLog: function (entry) {
      this.state.log.push(Object.assign({}, entry, { t: Date.now() }));
    },
    _flashCell: function (id, type) {
      const cell = this.state.grid[id];
      if (!cell) return;
      cell.flashType = type;
      if (this._flashTimers[id]) clearTimeout(this._flashTimers[id]);
      this._flashTimers[id] = setTimeout(() => { this._clearCellFx(id); }, 850);
    },
    /* ---------- 生産開始・リセット ---------- */
    _startProduction: function () {
      const s = this.state;
      const hammer = this._hammer();
      const hd = this._hammerData();
      let startConc = this._maxConc();
      const logEntries = [];
      let hephaReady = false;
      if (hammer && hammer.special === 'hissatsu' && hd && Math.random() * 100 < hd.chance) {
        hephaReady = true;
        logEntries.push({ skill: '★必殺チャージ発動★', temp: 1000, note: hammer.name + 'の固有効果！次に使う技が確定会心になる' });
      }
      if (hammer && hammer.special === 'conc30' && hd && Math.random() * 100 < hd.chance) {
        startConc += 30;
        logEntries.push({ skill: '★集中力+30★', temp: 1000, note: hammer.name + 'の固有効果が発動！' });
      }
      s.conc = startConc;
      s.temp = 1000;
      s.log = logEntries.map(e => Object.assign({}, e, { t: Date.now() }));
      s.finalGrade = null;
      s.hephaestusReady = hephaReady;
      s.hephaestusActive = false;
      s.triggeredCPs = [];
      s.pendingMulti = null;
      s.previewAnchor = null;
      s.turnCount = 0;
      s.recAwaiting = null;
      s.recInputs = {};
      s.recMidareTargets = [];
    },

    _lockShape: function () {
      const s = this.state;
      Object.keys(s.grid).forEach(id => {
        const cell = s.grid[id];
        if (cell.included && cell.zoneMin != null && cell.zoneMax != null) {
          cell.critTarget = randInt(cell.zoneMin, cell.zoneMax);
          cell.current = 0; cell.critHit = false; cell.flashType = null; cell.glow = false; cell.popup = null;
        }
      });
      s.shapeLocked = true;
      this._startProduction();
    },

    _retrySameShape: function () {
      const s = this.state;
      Object.values(this._flashTimers).forEach(t => clearTimeout(t));
      this._flashTimers = {};
      Object.keys(s.grid).forEach(id => {
        const cell = s.grid[id];
        if (cell.included && cell.zoneMin != null && cell.zoneMax != null) {
          cell.critTarget = randInt(cell.zoneMin, cell.zoneMax);
          cell.current = 0; cell.critHit = false; cell.flashType = null; cell.glow = false; cell.popup = null;
        }
      });
      this._startProduction();
    },

    _fullReset: function () {
      const s = this.state;
      Object.values(this._flashTimers).forEach(t => clearTimeout(t));
      this._flashTimers = {};
      s.grid = emptyGrid();
      s.shapeLocked = false;
      s.log = [];
      s.finalGrade = null;
      s.hephaestusReady = false;
      s.hephaestusActive = false;
      s.triggeredCPs = [];
      s.temp = 1000;
      s.pendingMulti = null;
      s.previewAnchor = null;
      s.turnCount = 0;
      s.recAwaiting = null;
      s.recInputs = {};
      s.recMidareTargets = [];
      s.tab = 'shape';
    },

    /* ---------- 地金 ---------- */
    _ingotModifiers: function () {
      const s = this.state;
      let concMult = 1, powerMult = 1, critTurnActive = false;
      if (s.turnCount === 0) return { concMult, powerMult, critTurnActive };
      if (s.ingotKey === 'conc_change') {
        if (CP400.includes(s.temp)) concMult = 0.5;
        else if (CP400_200.includes(s.temp)) { concMult = 1.5; critTurnActive = true; }
      }
      if (s.ingotKey === 'power_half') {
        if (CP400.includes(s.temp)) powerMult = 2;
        else if (CP400_200.includes(s.temp)) powerMult = 0.5;
      }
      return { concMult, powerMult, critTurnActive };
    },
    _ingotStatusText: function () {
      const s = this.state;
      if (s.ingotKey === 'none' || s.turnCount === 0) return null;
      if (s.ingotKey === 'conc_change') {
        if (CP400.includes(s.temp)) return '消費集中力が半分（0.5倍）';
        if (CP400_200.includes(s.temp)) return '消費集中力1.5倍・会心率が基礎値の+400%（×5）に大幅アップ';
        return null;
      }
      if (s.ingotKey === 'power_half') {
        if (CP400.includes(s.temp)) return '威力2倍';
        if (CP400_200.includes(s.temp)) return '威力0.5倍';
        return null;
      }
      return null;
    },
    _applyIngotOnTempChange: function (newTemp) {
      const s = this.state;
      if (s.ingotKey === 'none') return;
      if (s.ingotKey === 'modori') {
        if (CP400.includes(newTemp) && !s.triggeredCPs.includes('modori' + newTemp)) {
          s.triggeredCPs.push('modori' + newTemp);
          const cells = Object.values(s.grid).filter(c => c.included && c.zoneMin != null);
          const overshoot = cells.filter(c => c.current > c.zoneMax);
          let target = null;
          if (overshoot.length > 0) {
            target = overshoot.reduce((a, b) => (a.current - a.zoneMax) > (b.current - b.zoneMax) ? a : b);
          } else {
            const under = cells.filter(c => c.current < c.zoneMin);
            if (under.length > 0) target = under.reduce((a, b) => a.current > b.current ? a : b);
          }
          if (target) {
            const dec = randInt(12, 16);
            target.current = Math.max(0, target.current - dec);
            this._pushLog({ skill: '戻り地金 発動', temp: newTemp, note: '(' + (target.r + 1) + ',' + (target.c + 1) + ') が ' + dec + ' 減少' });
          }
        }
      }
      if (s.ingotKey === 'hikari') {
        if (CP400.concat(CP400_200).includes(newTemp) && !s.triggeredCPs.includes('hikari' + newTemp)) {
          s.triggeredCPs.push('hikari' + newTemp);
          const ids = Object.values(s.grid).filter(c => c.included).map(c => cellId(c.r, c.c));
          if (ids.length > 0) {
            const glowId = pickRandom(ids);
            Object.keys(s.grid).forEach(id => { if (s.grid[id].included) s.grid[id].glow = (id === glowId); });
            const g = s.grid[glowId];
            this._pushLog({ skill: '光地金 発動', temp: newTemp, note: '(' + (g.r + 1) + ',' + (g.c + 1) + ') が発光！次のヒットで威力2倍・会心率+400%' });
          }
        }
      }
    },

    /* ---------- 候補威力 ---------- */
    _getCandidatesForSkill: function (skill) {
      if (!skill || !skill.group) return null;
      const table = TEMP_TABLE[tableTemp(this.state.temp)];
      if (!table || !table[skill.group]) return null;
      const { powerMult } = this._ingotModifiers();
      return table[skill.group].map(v => Math.round(v * powerMult));
    },

    /* ---------- 自動モード：技実行 ---------- */
    _executeSkill: function (skill, anchorR, anchorC) {
      const s = this.state;
      const { concMult, powerMult, critTurnActive } = this._ingotModifiers();
      const actualCost = Math.max(1, Math.round(skill.cost * concMult));
      if (s.conc < actualCost) return;

      if (skill.target === 'temp_up' || skill.target === 'temp_down') {
        const newTemp = clampTemp(s.temp + (skill.target === 'temp_up' ? 300 : -300));
        const oldTemp = s.temp;
        s.temp = newTemp;
        s.conc -= actualCost;
        this._pushLog({ skill: skill.name, temp: oldTemp, note: '温度変化 → ' + (skill.target === 'temp_up' ? '+300' : '-300') + '（' + oldTemp + '℃→' + newTemp + '℃）' });
        s.hephaestusActive = false;
        this._applyIngotOnTempChange(newTemp);
        s.turnCount += 1;
        s.tempBanner = { type: skill.target === 'temp_up' ? 'up' : 'down', key: Date.now() };
        this._renderAll();
        setTimeout(() => { s.tempBanner = null; this._renderAll(); }, 900);
        return;
      }

      const roundedTemp = clampTemp(s.temp);
      const table = TEMP_TABLE[tableTemp(s.temp)];
      const candidates = table ? table[skill.group] : null;
      if (!candidates) { this._pushLog({ skill: skill.name, temp: roundedTemp, note: 'この温度帯では発動できません' }); this._renderAll(); return; }

      let targets = [];
      if (skill.target === 'midare') {
        const includedIds = Object.values(s.grid).filter(c => c.included).map(c => cellId(c.r, c.c));
        if (includedIds.length === 0) return;
        for (let i = 0; i < 4; i++) targets.push(pickRandom(includedIds));
      } else {
        targets = patternCells(skill.target, anchorR, anchorC, s.grid);
        if (targets.length === 0) return;
      }

      const useHepha = s.hephaestusActive;
      const baseCrit = this._baseCrit();
      const detailParts = [];

      const applyOneHit = (id) => {
        const cell = s.grid[id];
        if (!cell || !cell.included) return;

        // 本会心（critTargetに到達済み）のマスへの追撃はmiss扱いとし、変化させない
        if (cell.critTarget != null && cell.current >= cell.critTarget) {
          detailParts.push('(' + (cell.r + 1) + ',' + (cell.c + 1) + ')miss（本会心済み）');
          cell.glow = false;
          cell.flashType = 'miss';
          cell.popup = { val: null, crit: false, miss: true, key: Date.now() + '_' + Math.random() };
          if (this._flashTimers[id]) clearTimeout(this._flashTimers[id]);
          this._flashTimers[id] = setTimeout(() => { this._clearCellFx(id); }, 850);
          return;
        }

        const glowBonus = cell.glow;
        const critMultiplier = 1 + (skill.critUp ? 6 : 0) + (critTurnActive ? 4 : 0) + (glowBonus ? 4 : 0);
        const thisCritChance = useHepha ? 100 : Math.min(100, baseCrit * critMultiplier);
        const isCrit = Math.random() * 100 < thisCritChance;
        let val = pickRandom(candidates) * powerMult * (glowBonus ? 2 : 1);
        val = Math.round(val);
        let newCurrent;
        if (isCrit) {
          const doubled = val * 2;
          const candidateVal = cell.current + doubled;
          newCurrent = (cell.critTarget != null && candidateVal >= cell.critTarget) ? cell.critTarget : candidateVal;
        } else {
          newCurrent = cell.current + val;
        }
        const delta = newCurrent - cell.current;
        detailParts.push('(' + (cell.r + 1) + ',' + (cell.c + 1) + ')+' + delta + (isCrit ? '[会心]' : ''));
        cell.current = newCurrent;
        cell.critHit = isCrit;
        cell.glow = false;
        cell.flashType = isCrit ? 'crit' : 'normal';
        cell.popup = { val: delta, crit: isCrit, key: Date.now() + '_' + Math.random() };
        if (isCrit) {
          s.critBanner = true;
          setTimeout(() => { s.critBanner = false; this._renderAll(); }, 700);
        }
        if (this._flashTimers[id]) clearTimeout(this._flashTimers[id]);
        this._flashTimers[id] = setTimeout(() => { this._clearCellFx(id); }, 850);
      };

      if (skill.target === 'midare') {
        targets.forEach((id, i) => setTimeout(() => { applyOneHit(id); this._patchCell(id); }, i * 300));
      } else {
        targets.forEach(id => applyOneHit(id));
      }

      s.conc -= actualCost;
      const newTemp = clampTemp(s.temp - skill.tempDrop);
      s.temp = newTemp;
      const logDelay = skill.target === 'midare' ? targets.length * 300 + 50 : 0;
      setTimeout(() => {
        this._pushLog({
          skill: skill.name, targets: targets, temp: roundedTemp,
          crit: useHepha ? '確定会心' : (detailParts.some(d => d.includes('[会心]')) ? '会心' : undefined),
          note: detailParts.join(' ')
        });
        this._renderAll();
      }, logDelay);
      s.hephaestusActive = false;
      this._applyIngotOnTempChange(newTemp);
      s.turnCount += 1;
      this._renderAll();
    },

    _useHephaestus: function () {
      const s = this.state;
      if (!s.hephaestusReady) return;
      s.hephaestusReady = false;
      s.hephaestusActive = true;
      this._pushLog({ skill: '必殺チャージ 使用', temp: s.temp, note: '次の1手は確定会心' });
      this._renderAll();
    },

    _handleAutoCellClick: function (r, c) {
      const s = this.state;
      if (!s.pendingMulti) return;
      const skill = SKILLS.find(sk => sk.key === s.pendingMulti);
      if (!skill) return;
      const id = cellId(r, c);
      if (!s.grid[id].included) return;
      if (skill.target === 'midare') {
        this._executeSkill(skill, r, c);
        s.pendingMulti = null; s.previewAnchor = null;
        return;
      }
      if (s.previewAnchor && s.previewAnchor.r === r && s.previewAnchor.c === c) {
        this._executeSkill(skill, r, c);
        s.pendingMulti = null; s.previewAnchor = null;
      } else {
        s.previewAnchor = { r: r, c: c };
      }
      this._renderAll();
    },

    _cancelMulti: function () {
      this.state.pendingMulti = null;
      this.state.previewAnchor = null;
      this._renderAll();
    },

    _evaluateResult: function () {
      const s = this.state;
      const cells = Object.values(s.grid).filter(c => c.included && c.critTarget != null);
      if (cells.length === 0) return;
      const breakdown = cells.map(c => ({ r: c.r, c: c.c, current: c.current, target: c.critTarget, error: Math.abs(c.current - c.critTarget) }));
      const totalError = breakdown.reduce((sum, b) => sum + b.error, 0);
      const grade = gradeFromError(totalError, cells.length);
      s.finalGrade = { grade: grade, totalError: totalError, cellCount: cells.length, breakdown: breakdown };
      this._pushLog({ skill: '■最終評価', temp: s.temp, note: '誤差合計 ' + totalError + ' → ' + grade });
      this._renderAll();
    },

    /* ---------- 記録モード ---------- */
    _openRecInput: function (skill, targets) {
      const s = this.state;
      const init = {};
      targets.forEach(id => { init[id] = { value: (s.grid[id] ? s.grid[id].current : 0), crit: false }; });
      s.recInputs = init;
      s.recAwaiting = { skill: skill, targets: targets };
      s.pendingMulti = null;
      s.previewAnchor = null;
      s.recMidareTargets = [];
    },
    _handleRecordSkillSelect: function (skill) {
      const s = this.state;
      if (s.conc < skill.cost) return;
      if (skill.target === 'temp_up' || skill.target === 'temp_down') {
        const newTemp = clampTemp(s.temp + (skill.target === 'temp_up' ? 300 : -300));
        const oldTemp = s.temp;
        s.temp = newTemp;
        s.conc -= skill.cost;
        this._pushLog({ skill: skill.name, temp: oldTemp, note: '温度変化 → ' + (skill.target === 'temp_up' ? '+300' : '-300') + '（' + oldTemp + '℃→' + newTemp + '℃）' });
        s.turnCount += 1;
        s.tempBanner = { type: skill.target === 'temp_up' ? 'up' : 'down', key: Date.now() };
        this._renderAll();
        setTimeout(() => { s.tempBanner = null; this._renderAll(); }, 900);
        return;
      }
      s.pendingMulti = skill.key;
      s.previewAnchor = null;
      s.recMidareTargets = [];
      this._renderAll();
    },
    _handleRecordCellClick: function (r, c) {
      const s = this.state;
      if (!s.pendingMulti) return;
      const skill = SKILLS.find(sk => sk.key === s.pendingMulti);
      if (!skill) return;
      const id = cellId(r, c);
      if (!s.grid[id].included) return;
      if (skill.target === 'midare') {
        s.recMidareTargets.push(id);
        if (s.recMidareTargets.length >= 4) {
          this._openRecInput(skill, s.recMidareTargets.slice());
          s.recMidareTargets = [];
        }
        this._renderAll();
        return;
      }
      if (skill.target === 'single') { this._openRecInput(skill, [id]); this._renderAll(); return; }
      if (s.previewAnchor && s.previewAnchor.r === r && s.previewAnchor.c === c) {
        const targets = patternCells(skill.target, r, c, s.grid);
        this._openRecInput(skill, targets);
      } else {
        s.previewAnchor = { r: r, c: c };
      }
      this._renderAll();
    },
    _applyRecInput: function () {
      const s = this.state;
      if (!s.recAwaiting) return;
      const skill = s.recAwaiting.skill;
      const targets = s.recAwaiting.targets;
      const detail = [];
      let anyCrit = false;
      targets.forEach(id => {
        const cell = s.grid[id];
        if (!cell) return;
        const inp = s.recInputs[id] || { value: cell.current, crit: false };
        const newVal = Number(inp.value) || 0;
        const delta = newVal - cell.current;
        detail.push('(' + (cell.r + 1) + ',' + (cell.c + 1) + ')→' + newVal + (inp.crit ? '[会心]' : ''));
        if (inp.crit) anyCrit = true;
        cell.current = newVal;
        cell.critHit = !!inp.crit;
        cell.flashType = inp.crit ? 'crit' : 'normal';
        cell.popup = { val: delta, crit: !!inp.crit, key: Date.now() + '_' + Math.random() };
        if (this._flashTimers[id]) clearTimeout(this._flashTimers[id]);
        this._flashTimers[id] = setTimeout(() => { this._clearCellFx(id); }, 850);
      });
      if (anyCrit) { s.critBanner = true; setTimeout(() => { s.critBanner = false; this._renderAll(); }, 700); }
      s.conc = Math.max(0, s.conc - skill.cost);
      const newTemp = clampTemp(s.temp - skill.tempDrop);
      const oldTemp = s.temp;
      s.temp = newTemp;
      this._pushLog({ skill: skill.name, temp: oldTemp, note: detail.join(' '), crit: anyCrit ? '会心' : undefined });
      s.turnCount += 1;
      s.recAwaiting = null;
      s.recInputs = {};
      this._renderAll();
    },
    _cancelRecInput: function () {
      this.state.recAwaiting = null;
      this.state.recInputs = {};
      this.state.recMidareTargets = [];
      this._renderAll();
    },

    /* ---------- プリセット ---------- */
    _savePreset: function () {
      const s = this.state;
      if (!s.presetName || !s.presetName.trim()) { s.presetStatus = '名前を入力してください'; this._renderAll(); return; }
      const cleanGrid = {};
      Object.keys(s.grid).forEach(id => {
        const c = s.grid[id];
        cleanGrid[id] = { r: c.r, c: c.c, included: c.included, zoneMin: c.zoneMin, zoneMax: c.zoneMax };
      });
      const uid = 'preset_' + Date.now() + '_' + Math.floor(Math.random() * 100000);
      const preset = {
        id: uid, name: s.presetName.trim(), savedAt: new Date().toISOString(),
        level: s.level, hammerName: s.hammerName, hammerStar: s.hammerStar, ingotKey: s.ingotKey,
        kotsuMastered: !!s.kotsuMastered, grid: cleanGrid
      };
      s.presets.unshift(preset);
      const ok = this._savePresetsToStorage();
      if (!ok) { s.presetStatus = '保存に失敗しました'; this._renderAll(); return; }
      s.presetName = '';
      s.presetStatus = '保存しました';
      this._renderAll();
      setTimeout(() => { s.presetStatus = ''; this._renderAll(); }, 2500);
    },
    _loadPreset: function (id) {
      const s = this.state;
      const p = s.presets.find(x => x.id === id);
      if (!p) return;
      const restored = emptyGrid();
      Object.keys(restored).forEach(cid => {
        const saved = p.grid ? p.grid[cid] : null;
        if (saved) {
          restored[cid].included = saved.included;
          restored[cid].zoneMin = saved.zoneMin;
          restored[cid].zoneMax = saved.zoneMax;
        }
      });
      s.level = p.level; s.hammerName = p.hammerName || ''; s.hammerStar = p.hammerStar || 0;
      s.ingotKey = p.ingotKey || 'none'; s.kotsuMastered = !!p.kotsuMastered;
      s.grid = restored; s.shapeLocked = false;
      s.presetStatus = '「' + p.name + '」を読み込みました';
      this._saveLevel();
      this._renderAll();
      setTimeout(() => { s.presetStatus = ''; this._renderAll(); }, 2500);
    },
    _deletePreset: function (id) {
      const s = this.state;
      s.presets = s.presets.filter(p => p.id !== id);
      this._savePresetsToStorage();
      this._renderAll();
    },
    /* ---------- 描画 ---------- */
    _injectStyle: function () {
      if (document.getElementById('kaji-style')) return;
      const style = document.createElement('style');
      style.id = 'kaji-style';
      style.textContent = `
        .kaji-wrap { background:#1c1815; color:#ece4d8; padding:12px 0 12px 12px; border-radius:12px; font-family:'Zen Kaku Gothic New','Hiragino Sans',sans-serif; }
        .kaji-wrap * { box-sizing:border-box; }
        .kaji-title { font-size:20px; font-weight:800; color:#d97b3f; letter-spacing:1px; }
        .kaji-sub { font-size:12px; color:#a89a8a; }
        .kaji-header { display:flex; align-items:baseline; gap:12px; justify-content:space-between; margin-bottom:14px; flex-wrap:wrap; }
        .kaji-tabs { display:flex; gap:6px; margin-bottom:16px; background:#26201b; padding:6px; border-radius:10px; width:fit-content; flex-wrap:wrap; }
        .kaji-tab-btn { padding:8px 14px; border-radius:8px; border:none; cursor:pointer; background:transparent; color:#a89a8a; font-weight:600; font-size:13px; }
        .kaji-tab-btn.active { background:#d97b3f; color:#221a14; }
        .kaji-resetbtn { padding:6px 14px; border-radius:8px; border:1px solid #b0504a; background:transparent; color:#b0504a; font-weight:700; cursor:pointer; font-size:12px; }
        .kaji-panel { background:#26201b; border-radius:12px; padding:16px; position:relative; z-index:0; }
        .kaji-row { display:flex; gap:12px; flex-wrap:nowrap; align-items:flex-start; margin-right:-4px; }
        .kaji-row > .kaji-panel { min-width:0; }
        .kaji-row > .kaji-panel:first-child { flex: 0 0 150px; }
        .kaji-row > .kaji-panel:last-child { flex: 1.35 1 0; min-width: 0; margin-right:0; }
        .kaji-section-title { font-size:13px; letter-spacing:2px; color:#d97b3f; text-transform:uppercase; font-weight:700; margin-bottom:10px; }
        .kaji-input, .kaji-select { background:#2f2721; border:1px solid #4a3c30; border-radius:6px; color:#ece4d8; padding:6px 8px; font-size:14px; }
        .kaji-input { width:70px; }
        .kaji-btn { padding:8px 16px; border-radius:8px; border:none; background:#2f2721; color:#ece4d8; font-weight:700; cursor:pointer; font-size:13px; }
        .kaji-btn.primary { background:#d97b3f; color:#221a14; }
        .kaji-btn.success { background:#7fae62; color:#12200f; }
        .kaji-btn.outline { background:transparent; border:1px solid #8fa3ad; color:#8fa3ad; }
        .kaji-btn.gold { background:#f0c452; color:#3a2a05; }
        .kaji-btn:disabled { opacity:0.45; cursor:not-allowed; }
        .kaji-crit-box { padding:12px; background:#2f2721; border-radius:8px; font-size:14px; }
        .kaji-crit-box b.big { color:#d97b3f; font-size:18px; }
        .kaji-grid { display:inline-grid; grid-template-columns: repeat(2, 63px); gap:5px; }
        .kaji-grid-shell { display:inline-flex; justify-content:center; align-items:flex-start; padding:6px; border-radius:10px; background:rgba(34,29,25,0.55); position:relative; z-index:0; width:fit-content; max-width:100%; }
        .kaji-cell { position:relative; overflow:visible; height:51px; border-radius:8px; cursor:pointer; display:flex; flex-direction:column; align-items:center; justify-content:center; font-size:10px; gap:2px; border:1.5px dashed #443830; background:#221d19; color:#a89a8a; transition:box-shadow .3s ease, border-color .3s ease, transform .18s ease, background .3s ease; z-index:2; }
        .kaji-cell.included { border:2px solid #d97b3f; background:#2f2721; color:#ece4d8; }
        .kaji-cell.preview { border-color:#5aa8ff; background:#233145; }
        .kaji-cell.glow { border-color:#7fd4ff; box-shadow:0 0 18px 3px #7fd4ff; }
        .kaji-cell.flash-normal { border-color:#f0c452; background:#3a2c12; box-shadow:0 0 18px 3px #f0c452; transform:scale(1.06); }
        .kaji-cell.flash-crit { border-color:#ff5b3d; background:#3a1712; box-shadow:0 0 28px 6px #ff5b3d; transform:scale(1.12); }
        .kaji-cell.flash-miss { border-color:#6b6058; background:#2a2622; }
        .kaji-cell-num { font-size:14px; font-weight:700; }
        .kaji-cell-zone { font-size:8px; color:#a89a8a; }
        .kaji-cell-crit { font-size:8px; font-weight:700; }
        .kaji-popup { position:absolute; top:-4px; left:50%; font-weight:900; text-shadow:0 0 6px rgba(0,0,0,0.8); pointer-events:none; white-space:nowrap; z-index:5; animation:kajiPopUp 0.75s ease-out forwards; }
        @keyframes kajiPopUp { 0%{transform:translate(-50%,4px) scale(0.6);opacity:0;} 15%{transform:translate(-50%,-6px) scale(1.25);opacity:1;} 70%{transform:translate(-50%,-26px) scale(1);opacity:1;} 100%{transform:translate(-50%,-38px) scale(0.9);opacity:0;} }
        @keyframes kajiTempFx { 0%{opacity:0;transform:scale(0.9);} 20%{opacity:1;transform:scale(1.04);} 80%{opacity:0.85;transform:scale(1.0);} 100%{opacity:0;transform:scale(1.0);} }
        .kaji-critbanner { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; z-index:10; }
        .kaji-critbanner-text { font-size:26px; font-weight:900; color:#ff5b3d; text-shadow:0 0 18px #ff5b3d, 0 0 6px #fff; background:rgba(20,10,8,0.55); padding:10px 22px; border-radius:12px; }
        .kaji-tempfx { position:absolute; inset:0; border-radius:8px; pointer-events:none; animation:kajiTempFx 0.9s ease-out; z-index:10; }
        .kaji-tempfx-text { position:absolute; top:8px; left:50%; transform:translateX(-50%); font-size:15px; font-weight:900; white-space:nowrap; }
        .kaji-minilog { margin-top:14px; font-size:11px; max-height:120px; overflow-y:auto; background:#2f2721; border-radius:8px; padding:8px; }
        .kaji-minilog-item { color:#a89a8a; margin-bottom:2px; }
        .kaji-skill-btn { text-align:left; padding:8px 10px; border-radius:8px; border:1px solid #443830; background:#2f2721; color:#ece4d8; cursor:pointer; font-size:11px; width:100%; margin-bottom:6px; }
        .kaji-skill-btn.selected { border:1.5px solid #d97b3f; }
        .kaji-skill-btn:disabled { background:#1d1815; color:#665a4d; cursor:not-allowed; }
        .kaji-skill-head { display:flex; justify-content:space-between; gap:6px; }
        .kaji-skill-desc { font-size:9px; color:#a89a8a; line-height:1.3; }
        .kaji-preset-item { display:flex; justify-content:space-between; align-items:center; background:#2f2721; border-radius:6px; padding:6px 10px; font-size:12px; margin-bottom:6px; }
        .kaji-preset-link { padding:3px 10px; border-radius:6px; border:1px solid #8fa3ad; background:transparent; color:#8fa3ad; cursor:pointer; font-size:12px; }
        .kaji-preset-link.danger { border-color:#b0504a; color:#b0504a; }
        .kaji-log-item { padding:6px; background:#2f2721; border-radius:6px; margin-bottom:6px; font-size:12px; }
        .kaji-candidate-box { margin-top:0; padding:8px; background:#2f2721; border-radius:8px; font-size:9px; max-height:140px; overflow-y:auto; line-height:1.3; }
        @media (max-width: 560px) {
          .kaji-wrap { padding:6px 0 6px 6px !important; }
          .kaji-title { font-size:14px !important; }
          .kaji-row { gap:6px !important; }
          .kaji-row > .kaji-panel { padding:8px !important; }
          .kaji-row > .kaji-panel:first-child { flex-basis: 130px !important; flex-grow: 0 !important; }
          .kaji-row > .kaji-panel:last-child { flex: 1.2 1 auto !important; }
          .kaji-grid { grid-template-columns: repeat(2, 54px) !important; gap:4px !important; }
          .kaji-grid-shell { padding:8px 6px !important; }
          .kaji-cell { width:54px !important; height:44px !important; font-size:9px !important; }
          .kaji-cell-num { font-size:12px !important; }
          .kaji-cell-zone { font-size:7px !important; }
          .kaji-cell-crit { font-size:7px !important; }
          .kaji-cell-num { font-size:12px !important; }
          .kaji-panel { padding:8px !important; }
          .kaji-panel button { font-size:11px !important; padding:6px 8px !important; }
        }
      `;
      document.head.appendChild(style);
    },

    _saveScrollPositions: function () {
      if (!this._container) return;
      this._scrollPositions = {};
      const autoList = this._container.querySelector('#kaji-skill-list-auto');
      const recordList = this._container.querySelector('#kaji-skill-list-record');
      if (autoList) this._scrollPositions.autoSkillList = autoList.scrollTop;
      if (recordList) this._scrollPositions.recordSkillList = recordList.scrollTop;
    },

    _restoreScrollPositions: function () {
      if (!this._container || !this._scrollPositions) return;
      const autoList = this._container.querySelector('#kaji-skill-list-auto');
      const recordList = this._container.querySelector('#kaji-skill-list-record');
      if (autoList && typeof this._scrollPositions.autoSkillList === 'number') autoList.scrollTop = this._scrollPositions.autoSkillList;
      if (recordList && typeof this._scrollPositions.recordSkillList === 'number') recordList.scrollTop = this._scrollPositions.recordSkillList;
    },

    _renderAll: function () {
      if (!this._container) return;
      this._saveScrollPositions();
      if (!this._container) return;
      const s = this.state;
      let body = '';
      if (s.tab === 'setup') body = this._renderSetupTab();
      else if (s.tab === 'shape') body = this._renderShapeTab();
      else if (s.tab === 'auto') body = this._renderAutoTab();
      else if (s.tab === 'record') body = this._renderRecordTab();
      else if (s.tab === 'log') body = this._renderLogTab();

      this._container.innerHTML =
        '<div class="kaji-wrap">' +
          '<div class="kaji-header">' +
            '<div style="display:flex;align-items:baseline;gap:12px;">' +
              '<div class="kaji-title">鍛冶職人シミュレーター</div>' +
              '<div class="kaji-sub">DQ10準拠データ試作版</div>' +
            '</div>' +
            '<button class="kaji-resetbtn" data-action="fullReset">🔄 最初からやり直す</button>' +
          '</div>' +
          '<div class="kaji-tabs">' +
            this._tabBtn('setup', '① 設定') +
            this._tabBtn('shape', '② グリッド作成') +
            this._tabBtn('auto', '③ 自動モード') +
            this._tabBtn('record', '④ 記録モード') +
            this._tabBtn('log', '⑤ ログ／保存') +
          '</div>' +
          body +
        '</div>';
      this._restoreScrollPositions();
    },
    _tabBtn: function (id, label) {
      const active = this.state.tab === id ? ' active' : '';
      return '<button class="kaji-tab-btn' + active + '" data-action="tab" data-tab="' + id + '">' + label + '</button>';
    },

    // 1マス分のclass/innerHTMLを生成する共通関数（_renderGridと_patchCellの双方から利用）
    _cellMarkup: function (id, opts) {
      opts = opts || {};
      const s = this.state;
      const cell = s.grid[id];
      const previewIds = opts.previewIds || [];
      const classes = ['kaji-cell'];
      if (cell.included) classes.push('included');
      if (previewIds.indexOf(id) !== -1) classes.push('preview');
      if (cell.glow) classes.push('glow');
      if (cell.flashType === 'normal') classes.push('flash-normal');
      if (cell.flashType === 'crit') classes.push('flash-crit');
      if (cell.flashType === 'miss') classes.push('flash-miss');
      let inner = '';
      if (cell.popup) {
        if (cell.popup.miss) {
          inner += '<div class="kaji-popup" style="color:#a89a8a;font-size:15px;">MISS</div>';
        } else {
          const color = cell.popup.crit ? '#ff5b3d' : '#f0c452';
          const size = cell.popup.crit ? '22px' : '17px';
          inner += '<div class="kaji-popup" style="color:' + color + ';font-size:' + size + ';">' +
            (cell.popup.crit ? '会心！' : '') + '+' + cell.popup.val + '</div>';
        }
      }
      if (cell.included) {
        inner += '<div class="kaji-cell-num">' + cell.current + '</div>';
        if (cell.zoneMin != null) inner += '<div class="kaji-cell-zone">' + cell.zoneMin + '〜' + cell.zoneMax + '</div>';
        if (cell.critHit) inner += '<div class="kaji-cell-crit" style="color:' + (cell.flashType === 'crit' ? '#ff5b3d' : '#f0c452') + ';">会心！</div>';
        if (cell.glow && !cell.critHit) inner += '<div style="font-size:9px;color:#7fd4ff;">発光中</div>';
        if (previewIds.indexOf(id) !== -1) inner += '<div style="font-size:9px;color:#5aa8ff;">対象</div>';
      } else if (opts.selectMode) {
        inner += '<div style="font-size:10px;">クリックで選択</div>';
      }
      return { classes: classes, inner: inner };
    },

    // みだれ打ち等、1ヒットごとの更新をフル再描画せず該当マスのDOMだけ差し替える
    // （フル再描画すると他マスの表示中ポップアップのCSSアニメーションが再生し直され、
    //   実際のヒット数より多く「発火」して見える不具合の対策）
    _patchCell: function (id, opts) {
      if (!this._container) { this._renderAll(); return; }
      const nodes = this._container.querySelectorAll('[data-cell-id="' + id + '"]');
      if (!nodes.length) { this._renderAll(); return; }
      const built = this._cellMarkup(id, opts || {});
      nodes.forEach(node => {
        node.className = built.classes.join(' ');
        node.innerHTML = built.inner;
      });
    },

    // ヒット演出（発光・フラッシュ・ポップアップ）を該当マスだけクリアする
    _clearCellFx: function (id) {
      const cell = this.state.grid[id];
      if (cell) { cell.flashType = null; cell.popup = null; }
      this._patchCell(id);
    },

    _renderGrid: function (opts) {
      opts = opts || {};
      const s = this.state;
      const clickAction = opts.clickAction || null;
      const previewIds = opts.previewIds || [];
      let html = '<div class="kaji-grid">';
      for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
          const id = cellId(r, c);
          const built = this._cellMarkup(id, opts);
          const actionAttr = clickAction ? ' data-action="' + clickAction + '" data-r="' + r + '" data-c="' + c + '"' : '';
          html += '<div class="' + built.classes.join(' ') + '" data-cell-id="' + id + '"' + actionAttr + '>' + built.inner + '</div>';
        }
      }
      html += '</div>';
      return html;
    },

    _renderCritBanner: function () {
      if (!this.state.critBanner) return '';
      return '<div class="kaji-critbanner"><div class="kaji-critbanner-text">会心の一撃！</div></div>';
    },
    _renderTempFx: function () {
      const tb = this.state.tempBanner;
      if (!tb) return '';
      const isUp = tb.type === 'up';
      const bg = isUp
        ? 'radial-gradient(circle, rgba(255,140,40,0.35) 0%, rgba(255,80,20,0.15) 55%, rgba(255,80,20,0) 80%)'
        : 'radial-gradient(circle, rgba(70,170,255,0.35) 0%, rgba(40,120,255,0.15) 55%, rgba(40,120,255,0) 80%)';
      const color = isUp ? '#ffb060' : '#7fd4ff';
      const shadow = isUp ? '0 0 10px rgba(255,120,30,0.9)' : '0 0 10px rgba(60,150,255,0.9)';
      const label = isUp ? '🔥 火力上げ！' : '❄️ 冷やし込み！';
      return '<div class="kaji-tempfx" style="background:' + bg + ';">' +
        '<div class="kaji-tempfx-text" style="color:' + color + ';text-shadow:' + shadow + ';">' + label + '</div></div>';
    },
    _renderMiniLog: function () {
      const log = this.state.log;
      let html = '<div class="kaji-minilog">';
      if (log.length === 0) html += '<div style="color:#a89a8a;">行動履歴なし</div>';
      const recent = log.slice(-8).slice().reverse();
      recent.forEach(l => {
        html += '<div class="kaji-minilog-item"><span style="color:#ece4d8;">' + esc(l.skill) + '</span>';
        if (l.temp != null) html += ' @' + l.temp + '℃';
        if (l.crit) html += ' <span style="color:#f0c452;">[' + esc(l.crit) + ']</span>';
        if (l.note) html += ' ｜' + esc(l.note);
        html += '</div>';
      });
      html += '</div>';
      return html;
    },

    _renderSetupTab: function () {
      const s = this.state;
      const hammer = this._hammer();
      const hd = this._hammerData();
      const levelCrit = this._levelCrit();
      const baseCrit = this._baseCrit();

      let hammerOptions = '<option value=""' + (s.hammerName === '' ? ' selected' : '') + '>道具なし</option>';
      HAMMERS.forEach(h => {
        const disabled = h.lv > this._effLevel() ? ' disabled' : '';
        const selected = h.name === s.hammerName ? ' selected' : '';
        hammerOptions += '<option value="' + esc(h.name) + '"' + disabled + selected + '>' + esc(h.name) + '（Lv' + h.lv + '以上）' + (h.lv > this._effLevel() ? '※未到達' : '') + '</option>';
      });

      let starOptions = '';
      let hammerInfo = '';
      let specialInfo = '';
      if (hammer) {
        hammer.stars.forEach((st, i) => {
          const selected = i === s.hammerStar ? ' selected' : '';
          const label = i === 0 ? '星なし' : ('★' + i);
          starOptions += '<option value="' + i + '"' + selected + '>' + label + '（会心+' + st.crit + '%）</option>';
        });
        hammerInfo = '<div style="font-size:12px;color:#a89a8a;margin-bottom:10px;">' + esc(hammer.name) + '：集中力+' + hammer.conc + ' ／ 使用回数 ' + hammer.uses + '回</div>';
        if (hammer.special) {
          specialInfo = '<div style="font-size:12px;color:#f0c452;margin-bottom:10px;">固有効果：' +
            (hammer.special === 'hissatsu' ? '生産開始時、低確率で必殺チャージ発動（次の1手が確定会心）' : '生産開始時、低確率で集中力+30') +
            '（発動率 約' + (hd ? hd.chance : '?') + '%）</div>';
        }
      }

      return (
        '<div class="kaji-panel" style="max-width:600px;">' +
          '<div class="kaji-section-title">職人ステータス</div>' +
          '<div style="display:flex;gap:20px;align-items:center;margin-bottom:14px;flex-wrap:wrap;">' +
            '<label style="font-size:14px;">職人レベル ' +
              '<input class="kaji-input" type="number" min="1" max="80" data-field="level" value="' + (s.level == null ? '' : s.level) + '" style="margin-left:8px;">' +
            '</label>' +
            '<div style="font-size:13px;color:#a89a8a;">集中力上限: <b style="color:#ece4d8;">' + this._maxConc() + '</b></div>' +
          '</div>' +
          '<div style="margin-bottom:14px;display:flex;gap:14px;align-items:center;flex-wrap:wrap;">' +
            '<label style="font-size:14px;">使用する道具 ' +
              '<select class="kaji-select" data-field="hammerName" style="margin-left:8px;">' + hammerOptions + '</select>' +
            '</label>' +
            (hammer ? ('<label style="font-size:14px;">星 <select class="kaji-select" data-field="hammerStar" style="margin-left:8px;">' + starOptions + '</select></label>') : '') +
          '</div>' +
          hammerInfo + specialInfo +
          '<div class="kaji-crit-box">' +
            '基礎会心率：<b class="big">' + baseCrit.toFixed(1) + '%</b>' +
            '<div style="font-size:12px;color:#a89a8a;margin-top:4px;">内訳：レベル加算 ' + levelCrit.toFixed(1) + '% ＋ 道具加算 ' + (hd ? hd.crit.toFixed(1) : '0.0') + '% ＋ コツ加算 ' + (s.kotsuMastered ? '1.0' : '0.0') + '%</div>' +
            '<div style="font-size:11px;color:#a89a8a;margin-top:6px;">※ねらい打ち系の技は基礎会心率が+600%（×7）、地金の会心ターン中・光地金の発光マスはそれぞれ+400%されます（すべて重なると×15）。</div>' +
          '</div>' +
        '</div>'
      );
    },

    _renderShapeTab: function () {
      const s = this.state;
      const includedCount = this._includedCount();
      let zonePanel = '';
      if (!s.shapeLocked && includedCount > 0) {
        let rows = '';
        Object.values(s.grid).filter(c => c.included).forEach(cell => {
          rows += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;font-size:10px;">' +
            '<span style="color:#a89a8a;width:34px;font-size:9px;">(' + (cell.r + 1) + ',' + (cell.c + 1) + ')</span>' +
            '<input class="kaji-input" type="number" placeholder="下限" data-field="zoneMin" data-r="' + cell.r + '" data-c="' + cell.c + '" value="' + (cell.zoneMin == null ? '' : cell.zoneMin) + '" style="width:70px;min-width:70px;font-size:10px;">' +
            '<span style="color:#a89a8a;">〜</span>' +
            '<input class="kaji-input" type="number" placeholder="上限" data-field="zoneMax" data-r="' + cell.r + '" data-c="' + cell.c + '" value="' + (cell.zoneMax == null ? '' : cell.zoneMax) + '" style="width:70px;min-width:70px;font-size:10px;">' +
            '</div>';
        });
        zonePanel = '<div class="kaji-panel" style="min-width:220px;flex:1 1 320px;padding:12px 12px 12px 12px;">' +
          '<div class="kaji-section-title">成功ゾーン</div>' +
          '<div style="max-height:300px;overflow-y:auto;">' + rows + '</div>' +
        '</div>';
      }

      let ingotOptions = '';
      INGOTS.forEach(i => {
        ingotOptions += '<option value="' + i.key + '"' + (i.key === s.ingotKey ? ' selected' : '') + '>' + esc(i.name) + '</option>';
      });

      let presetRows = '';
      if (s.presets.length === 0) {
        presetRows = '<div style="font-size:12px;color:#a89a8a;">保存されたプリセットはありません</div>';
      } else {
        s.presets.forEach(p => {
          const ingotName = (INGOTS.find(i => i.key === p.ingotKey) || {}).name || '';
          presetRows += '<div class="kaji-preset-item">' +
            '<span>' + esc(p.name) + '（Lv' + p.level + '・' + esc(p.hammerName || '道具なし') + '・' + esc(ingotName) + '）</span>' +
            '<span style="display:flex;gap:6px;">' +
              '<button class="kaji-preset-link" data-action="loadPreset" data-id="' + p.id + '">読込</button>' +
              '<button class="kaji-preset-link danger" data-action="deletePreset" data-id="' + p.id + '">削除</button>' +
            '</span></div>';
        });
      }

      return (
        '<div style="display:flex;flex-direction:column;gap:16px;">' +
          '<div class="kaji-panel" style="max-width:520px;">' +
            '<label style="font-size:14px;">特殊地金 <select class="kaji-select" data-field="ingotKey" style="margin-left:8px;">' + ingotOptions + '</select></label>' +
            '<label style="font-size:13px;display:flex;align-items:center;gap:6px;margin-top:10px;">' +
              '<input type="checkbox" data-field="kotsuMastered"' + (s.kotsuMastered ? ' checked' : '') + '> このアイテムのコツを掴んでいる（会心率+1.0%）' +
            '</label>' +
          '</div>' +
          '<div class="kaji-row">' +
            '<div class="kaji-panel">' +
              '<div class="kaji-section-title">' + (s.shapeLocked ? '確定済みの形' : '成功ゾーン設定') + '</div>' +
              '<div class="kaji-grid-shell">' + this._renderGrid({ clickAction: s.shapeLocked ? null : 'toggleCell', selectMode: !s.shapeLocked }) + '</div>' +
              '<div style="margin-top:14px;display:flex;gap:10px;">' +
                (!s.shapeLocked
                  ? ('<button class="kaji-btn primary" data-action="lockShape"' + (includedCount === 0 ? ' disabled' : '') + '>この形で確定（' + includedCount + 'マス）</button>')
                  : ('<button class="kaji-btn outline" data-action="resetShape">形をリセットしてやり直す</button>')) +
              '</div>' +
            '</div>' +
            zonePanel +
          '</div>' +
          '<div class="kaji-panel" style="max-width:640px;">' +
            '<div class="kaji-section-title">プリセット（形＋道具＋地金）保存・読込</div>' +
            '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
              '<input class="kaji-input" style="width:180px;" type="text" placeholder="プリセット名" data-field="presetName" value="' + esc(s.presetName) + '">' +
              '<button class="kaji-btn primary" data-action="savePreset">現在の内容を保存</button>' +
              (s.presetStatus ? ('<span style="font-size:12px;color:' + (s.presetStatus.indexOf('失敗') !== -1 ? '#b0504a' : '#f0c452') + ';">' + esc(s.presetStatus) + '</span>') : '') +
            '</div>' +
            '<div style="margin-top:10px;max-height:200px;overflow-y:auto;">' + presetRows + '</div>' +
          '</div>' +
        '</div>'
      );
    },
    _renderCandidatePreview: function (mode) {
      const s = this.state;
      if (!s.pendingMulti) return '';
      const skill = SKILLS.find(sk => sk.key === s.pendingMulti);
      if (!skill) return '';
      const candidates = this._getCandidatesForSkill(skill);
      if (!candidates) return '';

      if (skill.target === 'midare') {
        return '<div class="kaji-candidate-box">' +
          '<div style="color:#a89a8a;margin-bottom:4px;">候補威力（会心なしの場合。この中から1回ごとにランダムに選ばれ、4回叩きます）</div>' +
          '<div style="color:#ece4d8;">' + candidates.join(' / ') + '</div></div>';
      }
      if (!s.previewAnchor) {
        return '<div class="kaji-candidate-box">' +
          '<div style="color:#a89a8a;">候補威力（会心なしの場合・現在温度）：<span style="color:#ece4d8;">' + candidates.join(' / ') + '</span></div></div>';
      }
      const targets = patternCells(skill.target, s.previewAnchor.r, s.previewAnchor.c, s.grid);
      let rows = '';
      targets.forEach(id => {
        const cell = s.grid[id];
        rows += '<div style="margin-bottom:6px;">' +
          '<div style="color:#ece4d8;margin-bottom:2px;">(' + (cell.r + 1) + ',' + (cell.c + 1) + ') 現在' + cell.current + ' ／ 目標' + cell.zoneMin + '〜' + cell.zoneMax + '</div>' +
          '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
        candidates.forEach(v => {
          const res = cell.current + v;
          const inZone = cell.zoneMin != null && res >= cell.zoneMin && res <= cell.zoneMax;
          rows += '<span style="color:' + (inZone ? '#7fae62' : '#a89a8a') + ';font-weight:' + (inZone ? '700' : '400') + ';">' + res + '</span>';
        });
        rows += '</div></div>';
      });
      return '<div class="kaji-candidate-box"><div style="color:#a89a8a;margin-bottom:6px;">候補威力と結果予測（会心なしの場合）</div>' + rows + '</div>';
    },

    _renderSkillList: function (mode) {
      const s = this.state;
      const lv = this._effLevel();
      let html = '';
      SKILLS.forEach(skill => {
        const ok = skillAvailable(skill, lv, s.conc);
        const selected = s.pendingMulti === skill.key ? ' selected' : '';
        const action = mode === 'auto' ? 'selectSkillAuto' : 'selectSkillRecord';
        html += '<button class="kaji-skill-btn' + selected + '" data-action="' + action + '" data-skill="' + skill.key + '"' + (ok ? '' : ' disabled') + '>' +
          '<div class="kaji-skill-head"><b>' + esc(skill.name) + '</b><span style="color:#a89a8a;">Lv' + skill.lv + '・集中' + skill.cost + '</span></div>' +
          (mode === 'auto' ? ('<div class="kaji-skill-desc">' + esc(skill.desc) + '</div>') : '') +
          '</button>';
      });
      return html;
    },

    _renderFinalGrade: function () {
      const fg = this.state.finalGrade;
      if (!fg) return '';
      let rows = '';
      fg.breakdown.forEach(b => {
        rows += '<div>(' + (b.r + 1) + ',' + (b.c + 1) + ')　結果:' + b.current + '　目標:' + b.target + '　誤差:' + b.error + '</div>';
      });
      return '<div style="margin-top:10px;padding:10px;background:#2f2721;border-radius:8px;">' +
        '<div>誤差：<b>' + fg.totalError + '</b></div>' +
        '<div>星：<b style="color:#f0c452;">' + esc(fg.grade) + '</b></div>' +
        '<div style="margin-top:6px;font-size:11px;color:#a89a8a;display:flex;flex-direction:column;gap:2px;">' + rows + '</div></div>';
    },

    _renderAutoTab: function () {
      const s = this.state;
      if (!s.shapeLocked) return '<div style="color:#a89a8a;padding:20px;">先に「② グリッド作成」でマス目と成功ゾーンを確定してください。</div>';

      const skill = s.pendingMulti ? SKILLS.find(sk => sk.key === s.pendingMulti) : null;
      const previewIds = (s.pendingMulti && s.previewAnchor && skill)
        ? patternCells(skill.target, s.previewAnchor.r, s.previewAnchor.c, s.grid) : [];

      const ingotStatus = this._ingotStatusText();

      return (
        '<div class="kaji-row">' +
          '<div class="kaji-panel" style="position:relative;">' +
            '<div class="kaji-section-title">グリッド</div>' +
            '<div style="position:relative;display:inline-block;">' +
              '<div class="kaji-grid-shell">' + this._renderGrid({ clickAction: 'autoCell', previewIds: previewIds }) + '</div>' +
              this._renderTempFx() +
              this._renderCritBanner() +
            '</div>' +
            '<div style="margin-top:12px;display:flex;flex-direction:column;gap:6px;font-size:12px;">' +
              '<div>温度: <b style="color:#d97b3f;">' + s.temp + '℃</b></div>' +
              '<div>集中力: <b style="color:#8fa3ad;">' + s.conc + ' / ' + this._maxConc() + '</b></div>' +
            '</div>' +
            (s.hephaestusReady ? '<button class="kaji-btn gold" data-action="useHephaestus" style="margin-top:10px;">🔥 必殺チャージを使う（次の1手が確定会心）</button>' : '') +
            (s.hephaestusActive ? '<div style="margin-top:8px;color:#f0c452;font-weight:700;font-size:13px;">次の1手は確定会心！</div>' : '') +
            '<div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:nowrap;">' +
              '<button class="kaji-btn outline" data-action="retry">やり直す</button>' +
              '<button class="kaji-btn success" data-action="evaluate">おわる</button>' +
            '</div>' +
            (ingotStatus ? ('<div style="margin-top:10px;padding:10px 14px;background:#3a2a10;border:1px solid #f0c452;border-radius:8px;font-size:15px;font-weight:800;color:#f0c452;">★ ' + esc(ingotStatus) + '</div>') : '') +
            this._renderFinalGrade() +
            this._renderMiniLog() +
          '</div>' +
          '<div class="kaji-panel" style="min-width:140px;flex:0 1 220px;padding:12px 12px 12px 12px;display:flex;flex-direction:column;gap:8px;justify-content:flex-start;">' +
            '<div class="kaji-section-title">特技を選択</div>' +
            '<div id="kaji-skill-list-auto" style="max-height:220px;overflow-y:auto;flex:1 1 auto;min-height:0;">' + this._renderSkillList('auto') + '</div>' +
            '<div style="margin-top:auto;flex-shrink:0;">' + this._renderCandidatePreview('auto') + '</div>' +
          '</div>' +
        '</div>'
      );
    },

    _renderRecordTab: function () {
      const s = this.state;
      if (!s.shapeLocked) return '<div style="color:#a89a8a;padding:20px;">先に「② グリッド作成」でマス目と成功ゾーンを確定してください。</div>';

      const skill = s.pendingMulti ? SKILLS.find(sk => sk.key === s.pendingMulti) : null;
      const previewIds = (s.pendingMulti && s.previewAnchor && skill)
        ? patternCells(skill.target, s.previewAnchor.r, s.previewAnchor.c, s.grid) : [];
      const allPreview = s.pendingMulti ? previewIds.concat(s.recMidareTargets) : [];
      const ingotStatus = this._ingotStatusText();

      let rightPanel = '';
      if (!s.recAwaiting) {
        rightPanel = '<div class="kaji-section-title">使用した特技を選択</div>' +
          '<div id="kaji-skill-list-record" style="max-height:260px;overflow-y:auto;">' + this._renderSkillList('record') + '</div>';
      } else {
        let rows = '';
        s.recAwaiting.targets.forEach(id => {
          const cell = s.grid[id];
          const inp = s.recInputs[id] || { value: cell.current, crit: false };
          rows += '<div style="padding:8px;background:#2f2721;border-radius:8px;margin-bottom:10px;">' +
            '<div style="font-size:12px;color:#a89a8a;margin-bottom:6px;">マス (' + (cell.r + 1) + ',' + (cell.c + 1) + ') 目標:' + cell.zoneMin + '〜' + cell.zoneMax + '（現在:' + cell.current + '）</div>' +
            '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
              '<span style="font-size:12px;">ゲーム内の現在値</span>' +
              '<input class="kaji-input" type="number" data-field="recValue" data-id="' + id + '" value="' + inp.value + '">' +
              '<label style="font-size:12px;display:flex;align-items:center;gap:4px;">' +
                '<input type="checkbox" data-field="recCrit" data-id="' + id + '"' + (inp.crit ? ' checked' : '') + '> 会心表示あり' +
              '</label>' +
            '</div></div>';
        });
        rightPanel = '<div class="kaji-section-title">' + esc(s.recAwaiting.skill.name) + ' の結果を入力</div>' +
          '<div style="max-height:420px;overflow-y:auto;">' + rows + '</div>' +
          '<div style="margin-top:12px;display:flex;gap:8px;">' +
            '<button class="kaji-btn primary" data-action="applyRecInput">反映して次へ</button>' +
            '<button class="kaji-btn outline" data-action="cancelRecInput">キャンセル</button>' +
          '</div>';
      }

      return (
        '<div class="kaji-row">' +
          '<div class="kaji-panel" style="position:relative;">' +
            '<div class="kaji-section-title">グリッド（実際にゲームで出た技を選び、結果を入力）</div>' +
            '<div style="position:relative;display:inline-block;">' +
              '<div class="kaji-grid-shell">' + this._renderGrid({ clickAction: 'recordCell', previewIds: allPreview }) + '</div>' +
              this._renderTempFx() +
              this._renderCritBanner() +
            '</div>' +
            '<div style="margin-top:12px;display:flex;flex-direction:column;gap:6px;font-size:12px;">' +
              '<div>温度: <b style="color:#d97b3f;">' + s.temp + '℃</b>（技の使用で自動進行）</div>' +
              '<div>集中力: <b style="color:#8fa3ad;">' + s.conc + ' / ' + this._maxConc() + '</b></div>' +
            '</div>' +
            '<div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:nowrap;">' +
              '<button class="kaji-btn outline" data-action="retry">やり直す</button>' +
              '<button class="kaji-btn success" data-action="evaluate">おわる</button>' +
            '</div>' +
            (ingotStatus ? ('<div style="margin-top:10px;padding:10px 14px;background:#3a2a10;border:1px solid #f0c452;border-radius:8px;font-size:15px;font-weight:800;color:#f0c452;">★ ' + esc(ingotStatus) + '</div>') : '') +
            this._renderFinalGrade() +
            this._renderMiniLog() +
          '</div>' +
          '<div class="kaji-panel" style="min-width:320px;flex:0 1 320px;padding:12px 12px 12px 12px;">' + rightPanel + '</div>' +
        '</div>'
      );
    },

    _renderLogTab: function () {
      const s = this.state;
      let logRows = '';
      if (s.log.length === 0) logRows = '<div style="color:#a89a8a;">まだ記録がありません</div>';
      s.log.forEach(l => {
        logRows += '<div class="kaji-log-item">' +
          '<b>' + esc(l.skill) + '</b>' +
          (l.temp != null ? (' <span style="color:#a89a8a;"> @' + l.temp + '℃</span>') : '') +
          (l.targets ? (' <span style="color:#a89a8a;"> → ' + l.targets.join(', ') + '</span>') : '') +
          (l.crit ? (' <span style="color:#f0c452;"> [' + esc(l.crit) + ']</span>') : '') +
          (l.note ? ('<div style="color:#a89a8a;">' + esc(l.note) + '</div>') : '') +
          '</div>';
      });

      return (
        '<div class="kaji-row">' +
          '<div class="kaji-panel" style="min-width:320px;">' +
            '<div class="kaji-section-title">今回のアクション履歴</div>' +
            '<div style="max-height:300px;overflow-y:auto;">' + logRows + '</div>' +
          '</div>' +
        '</div>'
      );
    },
    /* ---------- イベント ---------- */
    _onClick: function (e) {
      const el = e.target.closest('[data-action]');
      if (!el) return;
      const action = el.dataset.action;
      const s = this.state;
      switch (action) {
        case 'tab':
          s.tab = el.dataset.tab;
          this._renderAll();
          break;
        case 'fullReset':
          this._fullReset();
          this._renderAll();
          break;
        case 'toggleCell': {
          if (s.shapeLocked) return;
          const r = Number(el.dataset.r), c = Number(el.dataset.c);
          const cell = s.grid[cellId(r, c)];
          cell.included = !cell.included;
          this._renderAll();
          break;
        }
        case 'lockShape':
          this._lockShape();
          this._renderAll();
          break;
        case 'resetShape':
          this._fullReset();
          this._renderAll();
          break;
        case 'savePreset':
          this._savePreset();
          break;
        case 'loadPreset':
          this._loadPreset(el.dataset.id);
          break;
        case 'deletePreset':
          this._deletePreset(el.dataset.id);
          break;
        case 'autoCell':
          this._handleAutoCellClick(Number(el.dataset.r), Number(el.dataset.c));
          break;
        case 'recordCell':
          this._handleRecordCellClick(Number(el.dataset.r), Number(el.dataset.c));
          break;
        case 'selectSkillAuto': {
          const skill = SKILLS.find(sk => sk.key === el.dataset.skill);
          if (!skill) break;
          if (!skillAvailable(skill, this._effLevel(), s.conc)) break;
          if (skill.target === 'temp_up' || skill.target === 'temp_down') { this._executeSkill(skill); break; }
          s.pendingMulti = skill.key;
          s.previewAnchor = null;
          this._renderAll();
          break;
        }
        case 'selectSkillRecord': {
          const skill = SKILLS.find(sk => sk.key === el.dataset.skill);
          if (skill && skillAvailable(skill, this._effLevel(), s.conc)) this._handleRecordSkillSelect(skill);
          break;
        }
        case 'cancelMulti':
          this._cancelMulti();
          break;
        case 'useHephaestus':
          this._useHephaestus();
          break;
        case 'retry':
          this._retrySameShape();
          this._renderAll();
          break;
        case 'evaluate':
          this._evaluateResult();
          break;
        case 'applyRecInput':
          this._applyRecInput();
          break;
        case 'cancelRecInput':
          this._cancelRecInput();
          break;
      }
    },

    _onChange: function (e) {
      const el = e.target.closest('[data-field]');
      if (!el) return;
      const field = el.dataset.field;
      const s = this.state;
      switch (field) {
        case 'level': {
          const raw = el.value === '' ? null : Number(el.value);
          const n = Math.round(Number(raw));
          s.level = (!raw || isNaN(n) || n < 1) ? 1 : Math.min(80, n);
          this._saveLevel();
          this._renderAll();
          break;
        }
        case 'hammerName':
          s.hammerName = el.value;
          s.hammerStar = 0;
          this._renderAll();
          break;
        case 'hammerStar':
          s.hammerStar = Number(el.value);
          this._renderAll();
          break;
        case 'ingotKey':
          s.ingotKey = el.value;
          this._renderAll();
          break;
        case 'kotsuMastered':
          s.kotsuMastered = el.checked;
          this._renderAll();
          break;
        case 'presetName':
          s.presetName = el.value;
          break;
        case 'zoneMin':
        case 'zoneMax': {
          const r = Number(el.dataset.r), c = Number(el.dataset.c);
          const cell = s.grid[cellId(r, c)];
          cell[field] = el.value === '' ? null : Number(el.value);
          break;
        }
        case 'recValue': {
          const id = el.dataset.id;
          if (!s.recInputs[id]) s.recInputs[id] = { value: 0, crit: false };
          s.recInputs[id].value = el.value === '' ? 0 : Number(el.value);
          break;
        }
        case 'recCrit': {
          const id = el.dataset.id;
          if (!s.recInputs[id]) s.recInputs[id] = { value: (s.grid[id] ? s.grid[id].current : 0), crit: false };
          s.recInputs[id].crit = el.checked;
          break;
        }
      }
    }
  };

  global.Kaji = Kaji;
})(window);
