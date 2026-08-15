/* ─────────────────────────────────────────────────────────────
   스크래블 — 사용설명서

   guide.css 와 한 쌍입니다.

     <link rel="stylesheet" href="game/guide.css" />
     <script src="game/guide.js"></script>

     Guide.open(setup);   // setup = GET /api/game/setup 이 준 값

   ── 내용을 어디서 가져오나 ───────────────────────────────
   점수표·배수 칸 이름·칩 개수는 전부 백엔드가 /api/game/setup 으로
   알려준 값을 그대로 씁니다. 여기에 베껴 적어두면 백엔드가 규칙을
   바꾸는 날 설명서만 옛말을 하게 됩니다.

   반대로 "한 줄로 놓아야 한다" 같은 놓는 규칙은 웹소켓 명세
   (/asyncapi.json 의 submit 메시지)에 적힌 것을 사람 말로 옮긴
   것입니다. 그쪽이 바뀌면 여기도 같이 고쳐야 합니다.
   ───────────────────────────────────────────────────────────── */
window.Guide = (function () {
  'use strict';

  var veil = null;
  var lastFocus = null;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /* 배수 칸 설명. 자리도 이름도 배수도 전부 백엔드가 준
     premium_legend 를 씁니다. 견본에 적히는 글자("3배 / 단어")도
     여기에 적어두지 않고 배수·대상에서 만들어 냅니다 — 판에 그리는
     방식과 같아야 설명서와 판이 어긋나지 않습니다. */
  function keys(legend) {
    // 화면에 쓰는 순서. 센 것부터 놓아야 "무엇이 더 좋은지"가 읽힙니다.
    var order = [
      { k: 'TW', cls: 'tw' },
      { k: 'DW', cls: 'dw' },
      { k: 'TL', cls: 'tl' },
      { k: 'DL', cls: 'dl' },
      { k: 'ST', cls: 'st', star: true }
    ];
    var box = el('div', 'guide-keys');
    order.forEach(function (o) {
      var info = legend && legend[o.k];
      if (!info) return;          // 백엔드에 없는 칸은 그리지 않습니다
      var row = el('div', 'gkey ' + o.cls);
      var tile = el('i');
      tile.textContent = o.star ? '★'
        : info.multiplier + '배\n' +
          (info.applies_to === 'word' ? '단어' : info.applies_to === 'letter' ? '글자' : '');
      tile.style.whiteSpace = 'pre-line';
      row.appendChild(tile);
      row.appendChild(el('span', null, info.name));
      box.appendChild(row);
    });
    return box;
  }

  /* 글자 점수표. 27줄을 늘어놓으면 아무도 안 읽으므로 점수별로 묶습니다. */
  function points(tiles) {
    var by = {};
    (tiles || []).forEach(function (t) {
      (by[t.points] = by[t.points] || []).push(t.letter + (t.count > 1 ? '×' + t.count : ''));
    });
    var box = el('div', 'guide-pts');
    Object.keys(by).map(Number).sort(function (a, b) { return a - b; }).forEach(function (p) {
      var row = el('div', 'gpt');
      row.appendChild(el('span', 'gpt-n', p + '점'));
      row.appendChild(el('span', 'gpt-l', by[p].join('  ')));
      box.appendChild(row);
    });
    return box;
  }

  function section(no, title, html) {
    var s = el('section', 'guide-sec');
    var h = el('h3');
    h.appendChild(el('span', 'guide-no', no));
    h.appendChild(el('span', null, title));
    s.appendChild(h);
    var body = el('div');
    body.innerHTML = html;
    s.appendChild(body);
    return s;
  }

  function close() {
    if (!veil) return;
    document.removeEventListener('keydown', onKey);
    if (veil.parentNode) veil.parentNode.removeChild(veil);
    veil = null;
    // 열기 전에 보던 자리로 초점을 돌려줍니다. 키보드로 쓰는 사람은
    // 창이 닫힌 뒤 초점이 어디 있는지 알 수 없으면 길을 잃습니다.
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  }

  function open(setup) {
    if (veil) return;
    lastFocus = document.activeElement;

    var s = setup || {};
    var rackSize = s.rack_size || 7;
    var total = s.total_tiles || 100;
    var size = s.board_size || 15;

    veil = el('div', 'guide-veil');
    var box = el('div', 'guide');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', '스크래블 사용설명서');

    // ── 머리 ────────────────────────────────────────────
    var head = el('div', 'guide-head');
    var tiles = el('div', 'guide-tiles');
    tiles.setAttribute('aria-hidden', 'true');
    '설명서'.split('').forEach(function (c) { tiles.appendChild(el('i', null, c)); });
    head.appendChild(tiles);
    head.appendChild(el('h2', null, '스크래블 하는 법'));
    var x = el('button', 'guide-x', '✕');
    x.type = 'button';
    x.setAttribute('aria-label', '설명서 닫기');
    x.addEventListener('click', close);
    head.appendChild(x);
    box.appendChild(head);

    // ── 본문 ────────────────────────────────────────────
    var body = el('div', 'guide-body');

    body.appendChild(section('1', '무엇을 하는 게임인가', [
      '<p>가진 <b>글자 칩</b>으로 단어를 만들어 판에 놓고, 그 단어의 점수를 가져가는 게임입니다. ',
      '점수를 더 많이 모은 사람이 이깁니다.</p>',
      '<p>칩은 모두 <b>' + total + '개</b>이고, 한 사람이 한 번에 <b>' + rackSize + '개</b>씩 손에 듭니다. ',
      '판은 <b>' + size + '칸 × ' + size + '칸</b>입니다.</p>'
    ].join('')));

    var sec2 = el('section', 'guide-sec');
    var h2 = el('h3');
    h2.appendChild(el('span', 'guide-no', '2'));
    h2.appendChild(el('span', null, '글자마다 점수가 다릅니다'));
    sec2.appendChild(h2);
    var p2 = el('p');
    p2.innerHTML = '흔한 글자는 싸고, 쓰기 어려운 글자는 비쌉니다. ' +
                   '칩 오른쪽 아래 작은 숫자가 그 글자의 점수입니다.';
    sec2.appendChild(p2);
    sec2.appendChild(points(s.tiles));
    var p2b = el('p');
    p2b.innerHTML = '<b>?</b> 는 <b>빈 칩</b>입니다. 아무 글자로나 쓸 수 있는 대신 <b>0점</b>입니다.';
    sec2.appendChild(p2b);
    body.appendChild(sec2);

    var sec3 = el('section', 'guide-sec');
    var h3 = el('h3');
    h3.appendChild(el('span', 'guide-no', '3'));
    h3.appendChild(el('span', null, '판의 색칠된 칸은 점수를 올려줍니다'));
    sec3.appendChild(h3);
    var p3 = el('p');
    p3.innerHTML = '<b>글자</b> 칸은 그 칸에 놓인 글자 하나의 점수를, ' +
                   '<b>단어</b> 칸은 그 단어 전체의 점수를 곱해줍니다.';
    sec3.appendChild(p3);
    sec3.appendChild(keys(s.premium_legend));
    var p3b = el('p');
    p3b.innerHTML = '판 한가운데 <b>★</b> 칸에서 게임이 시작됩니다. ' +
                    '<b>첫 단어는 반드시 이 칸을 지나야</b> 합니다.';
    sec3.appendChild(p3b);
    body.appendChild(sec3);

    body.appendChild(section('4', '놓는 규칙', [
      '<ul>',
      '<li><b>한 줄로</b> 놓습니다 — 가로 또는 세로 한 방향입니다.</li>',
      '<li>놓은 글자들 <b>사이가 비면 안 됩니다.</b></li>',
      '<li>한 번에 <b>2개에서 ' + rackSize + '개까지</b> 놓을 수 있습니다.</li>',
      '<li>만들어진 단어가 <b>사전에 있어야</b> 합니다. 사전은 20만 단어이고 ',
      '사람 이름·지명 같은 고유명사는 빠져 있습니다.</li>',
      '</ul>',
      '<p>빈 칩을 쓸 때는 <b>무슨 글자로 쓸지 먼저 정해야</b> 합니다. ',
      '<b>?</b> 인 채로는 무슨 단어인지 판단할 수 없습니다.</p>'
    ].join('')));

    body.appendChild(section('5', '차례', [
      '<p>누가 먼저 둘지는 <b>무작위</b>로 정해집니다. 스크래블에서 먼저 두는 쪽이 ',
      '유리한 자리라, 방을 만들었다는 이유만으로 매번 먼저 두면 공평하지 않기 때문입니다.</p>',
      '<p>지금 누구 차례인지는 게임 화면 <b>맨 위 이름 옆</b>에 표시됩니다.</p>',
      '<div class="guide-todo">',
      '<b>아직 만드는 중입니다.</b> 지금은 칩을 받는 데까지 됩니다. ',
      '판에 글자를 놓는 것 · 점수를 매기는 것 · 칩을 다시 뽑는 것은 아직 없습니다. ',
      '없는 기능을 되는 것처럼 보이게 하지 않으려고 화면에도 그대로 적어두었습니다.',
      '</div>'
    ].join('')));

    box.appendChild(body);
    veil.appendChild(box);
    document.body.appendChild(veil);

    // 막을 눌러도 닫힙니다. 창 안을 누른 것은 닫지 않습니다.
    veil.addEventListener('mousedown', function (e) {
      if (e.target === veil) close();
    });
    document.addEventListener('keydown', onKey);

    x.focus();
    return { close: close };
  }

  return { open: open, close: close };
})();
