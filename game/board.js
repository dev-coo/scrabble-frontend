/* ─────────────────────────────────────────────────────────────
   스크래블 — 게임판 (동작)

   board.css 와 한 쌍입니다.

     <link rel="stylesheet" href="game/board.css" />
     <script src="game/board.js"></script>

     var 판 = Board.mount('#boardBox');
     ...
     판.destroy();

   ── 이 파일이 하지 않는 일 ───────────────────────────────
   서버를 부르지 않습니다. 지금은 빈 판을 그리는 것까지만 합니다.
   글자를 놓는 일은 백엔드와 주고받을 규칙(계약)이 정해진 뒤에
   붙입니다. 규칙 없이 먼저 만들면, 나중에 정해진 규칙이 조금만
   달라도 전부 뜯어고쳐야 합니다.
   ───────────────────────────────────────────────────────────── */
window.Board = (function () {
  'use strict';

  /* ── 판의 생김새 ───────────────────────────────────────
     표준 스크래블 판(15 × 15)의 배수 칸 자리입니다. 자리는 바꾸지
     않았습니다 — 스크래블을 아는 사람이 판을 보자마자 알아볼 수
     있어야 하고, 점수 계산도 이 자리를 기준으로 하기 때문입니다.

       T  단어 3배     t  글자 3배
       D  단어 2배     d  글자 2배
       *  한가운데 (첫 단어가 지나야 하는 칸)
       .  아무것도 아닌 칸

     칸 이름(단어 3배 등)은 백엔드가 /api/game/setup 의 premium_legend
     로 알려주는 말과 똑같이 씁니다. 화면마다 다른 말을 쓰면 같은 칸을
     두 가지로 부르게 됩니다.

     글자표로 적어둔 이유: 좌표 목록으로 적으면 눈으로 확인할 수가
     없습니다. 이렇게 두면 판을 위에서 내려다본 모양 그대로라,
     좌우·위아래가 대칭인지 바로 보입니다. */
  var LAYOUT = [
    'T..d...T...d..T',
    '.D...t...t...D.',
    '..D...d.d...D..',
    'd..D...d...D..d',
    '....D.....D....',
    '.t...t...t...t.',
    '..d...d.d...d..',
    'T..d...*...d..T',
    '..d...d.d...d..',
    '.t...t...t...t.',
    '....D.....D....',
    'd..D...d...D..d',
    '..D...d.d...D..',
    '.D...t...t...D.',
    'T..d...T...d..T'
  ];

  // 칸에 무엇이라고 써넣을지.
  //   x = 몇 배인지, y = 무엇이 몇 배인지, cls = 색
  var KIND = {
    'T': { cls: 'is-tw',   x: '3배', y: '단어', label: '단어 3배' },
    'D': { cls: 'is-dw',   x: '2배', y: '단어', label: '단어 2배' },
    't': { cls: 'is-tl',   x: '3배', y: '글자', label: '글자 3배' },
    'd': { cls: 'is-dl',   x: '2배', y: '글자', label: '글자 2배' },
    '*': { cls: 'is-star', star: true,          label: '한가운데 — 첫 단어는 여기를 지나갑니다' }
  };

  function mount(target) {
    var host = typeof target === 'string' ? document.querySelector(target) : target;
    if (!host) throw new Error('Board.mount: 붙일 자리를 찾지 못했습니다 — ' + target);

    var wrap = document.createElement('div');
    wrap.className = 'board-wrap';

    var frame = document.createElement('div');
    frame.className = 'board-frame';

    var grid = document.createElement('div');
    grid.className = 'board-grid';
    // 눈으로 보면 격자지만, 화면을 읽어주는 프로그램에게는 표입니다.
    grid.setAttribute('role', 'grid');
    grid.setAttribute('aria-label', '스크래블 게임판, 가로 15칸 세로 15칸');

    // innerHTML 로 문자열을 이어 붙이지 않고 하나씩 만들어 넣습니다.
    // 225칸이라 문자열로 만들면 어디가 틀렸는지 찾기 어렵습니다.
    for (var r = 0; r < 15; r++) {
      var row = LAYOUT[r];

      // 판이 틀어진 채로 조용히 그려지는 것보다, 바로 알려주는 편이
      // 낫습니다. 한 줄이라도 15칸이 아니면 점수 계산이 다 어긋납니다.
      if (row.length !== 15) {
        throw new Error('Board: ' + (r + 1) + '번째 줄이 15칸이 아닙니다 (' + row.length + '칸)');
      }

      for (var c = 0; c < 15; c++) {
        var kind = KIND[row.charAt(c)];

        var sq = document.createElement('div');
        sq.className = 'sq' + (kind ? ' ' + kind.cls : '');
        sq.setAttribute('role', 'gridcell');
        // 사람이 부르는 방식(A1 ~ O15)으로 자리를 적어둡니다.
        var at = 'ABCDEFGHIJKLMNO'.charAt(c) + (r + 1);
        sq.setAttribute('aria-label', at + (kind ? ', ' + kind.label : ''));
        sq.dataset.at = at;

        if (kind && kind.star) {
          sq.textContent = '★';
        } else if (kind) {
          sq.appendChild(el('span', 'sq-x', kind.x));
          sq.appendChild(el('span', 'sq-y', kind.y));
        }

        grid.appendChild(sq);
      }
    }

    frame.appendChild(grid);
    wrap.appendChild(frame);
    host.appendChild(wrap);

    return {
      /* 화면에서 통째로 떼어냅니다. 채팅 모듈과 같은 방식이라
         var 판 = 판.destroy(); 로 쓰면 변수까지 함께 비워집니다. */
      destroy: function () {
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        return null;
      },
      el: wrap
    };
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  return { mount: mount };
})();
