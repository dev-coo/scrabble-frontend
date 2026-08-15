/* ─────────────────────────────────────────────────────────────
   스크래블 — 게임판 (동작)

   board.css 와 한 쌍입니다.

     <link rel="stylesheet" href="game/board.css" />
     <script src="game/board.js"></script>

     var 판 = Board.mount('#boardBox');
     ...
     판.destroy();

   ── 이 파일이 하지 않는 일 ───────────────────────────────
   서버를 부르지 않습니다. 받은 것을 그리기만 합니다.

   판에 놓인 글자는 **언제나 서버가 준 것**입니다(명세). 내가 방금
   놓은 글자도 내가 그리지 않고, board_updated 로 되돌아온 판을
   그립니다. 자기 화면을 자기가 그리기 시작하면 두 사람이 서로 다른
   판을 보게 되고, 그때 어느 쪽이 맞는지 판단할 방법이 없습니다.

   아직 제출하지 않은 내 칩(초안)만 예외입니다. 그건 서버가 모르는
   것이라 이쪽에서 그리고, 제출해서 판에 올라가면 서버가 준 판으로
   바뀝니다.
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

    // 칸 하나를 좌표로 찾습니다.
    // 이름을 sqAt 으로 둔 이유: 위 반복문 안에 `var at = 'A1'…` 이
    // 있는데, var 는 함수 전체에 걸치는 이름이라 at 이라고 지으면
    // 그 문자열이 이 함수를 덮어씁니다.
    function sqAt(r, c) { return grid.children[r * 15 + c]; }

    // 칸에 글자를 올리거나 내립니다.
    //   kind : 'fixed' 서버가 준 글자(못 움직임)
    //          'draft' 아직 제출 안 한 내 칩(움직일 수 있음)
    //          null    비우기
    function put(sq, letter, kind, points, blank) {
      var old = sq.querySelector('.sq-chip');
      if (old) sq.removeChild(old);
      sq.classList.toggle('has-chip', !!letter);
      sq.classList.toggle('is-draft', kind === 'draft');
      if (!letter) return null;

      var c = document.createElement('div');
      c.className = 'chip sq-chip' + (kind === 'draft' ? ' is-draft' : '') +
                    (blank ? ' is-was-blank' : '');
      c.textContent = letter;
      // 빈 칩은 무슨 글자로 쓰든 0점입니다. 그 글자의 점수를 찍으면
      // 없는 점수를 벌어들인 것처럼 보입니다.
      var pt = blank ? null : (points && points[letter]);
      if (pt != null) {
        var pip = document.createElement('i');
        pip.className = 'chip-pip';
        pip.textContent = pt;
        c.appendChild(pip);
      }
      sq.appendChild(c);
      return c;
    }

    var fixed = null;   // 서버가 마지막으로 준 판
    var points = null;

    return {
      /* 글자별 점수표. 칩에 찍히는 숫자입니다. */
      setPoints: function (p) { points = p; return this; },

      /* 서버가 준 판 전체를 그립니다. 15줄 × 15칸, 빈 칸은 "".
         바뀐 부분만 받지 않고 통째로 받는 이유는 명세에 적혀 있습니다 —
         조각을 모아 맞추다 한 번이라도 놓치면 그 뒤로 계속 어긋납니다. */
      setBoard: function (rows) {
        fixed = rows || null;
        for (var r = 0; r < 15; r++) {
          for (var c = 0; c < 15; c++) {
            var ch = rows && rows[r] && rows[r][c] ? rows[r][c] : '';
            put(sqAt(r, c), ch, ch ? 'fixed' : null, points);
          }
        }
        return this;
      },

      /* 아직 제출하지 않은 내 칩들. [{row, col, letter}] */
      setDraft: function (list) {
        // 먼저 지난번 초안을 걷어냅니다. 서버가 준 글자는 건드리지
        // 않습니다.
        [].forEach.call(grid.querySelectorAll('.sq.is-draft'), function (sq) {
          put(sq, '', null, points);
        });
        (list || []).forEach(function (t) {
          var sq = sqAt(t.row, t.col);
          if (sq) put(sq, t.letter, 'draft', points, t.blank);
        });
        return this;
      },

      /* 방금 놓인 자리를 잠깐 반짝이게 합니다. */
      flash: function (list) {
        (list || []).forEach(function (t) {
          var sq = sqAt(t.row, t.col);
          if (!sq) return;
          sq.classList.remove('is-new');
          // 클래스를 다시 붙이려면 브라우저가 한 번 갱신해야 합니다.
          void sq.offsetWidth;
          sq.classList.add('is-new');
        });
        return this;
      },

      /* 그 칸이 비어 있는지. 서버 글자도 초안도 없어야 빈 칸입니다. */
      isEmpty: function (r, c) {
        if (r < 0 || r > 14 || c < 0 || c > 14) return false;
        if (fixed && fixed[r] && fixed[r][c]) return false;
        var sq = sqAt(r, c);
        return !!sq && !sq.classList.contains('has-chip');
      },

      /* 화면 위 한 점이 어느 칸인지. 끌어다 놓을 때 씁니다. */
      cellAtPoint: function (x, y) {
        var e = document.elementFromPoint(x, y);
        var sq = e && e.closest ? e.closest('.sq') : null;
        if (!sq || !grid.contains(sq)) return null;
        var i = [].indexOf.call(grid.children, sq);
        if (i < 0) return null;
        return { row: Math.floor(i / 15), col: i % 15, el: sq };
      },

      /* 어느 칸에 손이 올라가 있는지 표시합니다. */
      hover: function (cell) {
        [].forEach.call(grid.querySelectorAll('.sq.is-over'), function (s) {
          s.classList.remove('is-over', 'is-no');
        });
        if (!cell) return this;
        cell.el.classList.add('is-over');
        if (!this.isEmpty(cell.row, cell.col)) cell.el.classList.add('is-no');
        return this;
      },

      grid: grid,
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
