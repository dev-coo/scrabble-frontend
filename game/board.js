/* ─────────────────────────────────────────────────────────────
   스크래블 — 게임판 (동작)

   board.css 와 한 쌍입니다.

     <link rel="stylesheet" href="game/board.css" />
     <script src="game/board.js"></script>

     var 판 = Board.mount('#boardBox', setup);   // setup = GET /api/game/setup
     ...
     판.destroy();

   ── 이 파일이 하지 않는 일 ───────────────────────────────
   서버를 부르지 않고, 판의 생김새를 스스로 알지도 못합니다.
   받은 것을 그리기만 합니다.

   배수 칸이 어디에 있는지(board), 그 칸을 뭐라고 부르는지
   (premium_legend), 한가운데가 어디인지(center), 판이 몇 칸인지
   (board_size) — 전부 백엔드가 /api/game/setup 으로 알려줍니다.
   여기에 베껴 적어두면 백엔드가 판을 바꾸는 날 두 곳이 갈라지고,
   그때 점수 계산은 백엔드 것을 따르는데 화면만 옛 판을 보여줍니다.

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

  /* 배수 칸의 색. 백엔드가 쓰는 이름(TW·DW·TL·DL)을 화면의 색에
     이어 붙이는 표입니다. 자리는 백엔드가 정하고, 여기서는 "그 종류를
     무슨 색으로 칠할지"만 정합니다.

     모르는 종류가 오면 색 없이 이름만 적습니다. 백엔드가 새 칸을
     추가해도 화면이 깨지지 않고, 대신 색이 없어서 눈에 띕니다 —
     "여기 색을 정해야 한다"가 바로 보입니다. */
  var TINT = { TW: 'is-tw', DW: 'is-dw', TL: 'is-tl', DL: 'is-dl' };

  function mount(target, setup) {
    var host = typeof target === 'string' ? document.querySelector(target) : target;
    if (!host) throw new Error('Board.mount: 붙일 자리를 찾지 못했습니다 — ' + target);

    var wrap = document.createElement('div');
    wrap.className = 'board-wrap';

    // 규칙을 못 받았으면 판을 그리지 않습니다. 우리가 아는 판을 대신
    // 그려두면, 백엔드가 쓰는 판과 다를 때 그 사실을 아무도 모릅니다.
    // 없는 것은 없다고 말하는 편이 낫습니다.
    if (!setup || !setup.board || !setup.board.length) {
      var oops = document.createElement('p');
      oops.className = 'board-none';
      oops.textContent = '게임 규칙을 받아오지 못해 판을 그릴 수 없습니다';
      wrap.appendChild(oops);
      host.appendChild(wrap);
      return {
        setPoints: function () { return this; },
        setBoard: function () { return this; },
        setDraft: function () { return this; },
        flash: function () { return this; },
        isEmpty: function () { return false; },
        cellAtPoint: function () { return null; },
        hover: function () { return this; },
        grid: null,
        destroy: function () {
          if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
          return null;
        },
        el: wrap
      };
    }

    var legend = setup.premium_legend || {};
    var N = setup.board_size || setup.board.length;
    var mid = setup.center || [];

    var frame = document.createElement('div');
    frame.className = 'board-frame';

    var grid = document.createElement('div');
    grid.className = 'board-grid';
    // 칸 수도 백엔드가 정합니다. CSS 에 15 를 박아두면 판이 바뀌는 날
    // 격자만 옛 크기로 남습니다.
    grid.style.gridTemplateColumns = 'repeat(' + N + ',1fr)';
    // 눈으로 보면 격자지만, 화면을 읽어주는 프로그램에게는 표입니다.
    grid.setAttribute('role', 'grid');
    grid.setAttribute('aria-label', '스크래블 게임판, 가로 ' + N + '칸 세로 ' + N + '칸');

    // innerHTML 로 문자열을 이어 붙이지 않고 하나씩 만들어 넣습니다.
    // 칸이 수백 개라 문자열로 만들면 어디가 틀렸는지 찾기 어렵습니다.
    for (var r = 0; r < N; r++) {
      var row = setup.board[r] || [];

      // 판이 틀어진 채로 조용히 그려지는 것보다, 바로 알려주는 편이
      // 낫습니다. 한 줄이라도 칸 수가 다르면 점수 계산이 다 어긋납니다.
      if (row.length !== N) {
        throw new Error('Board: 백엔드가 준 판의 ' + (r + 1) + '번째 줄이 ' +
                        N + '칸이 아닙니다 (' + row.length + '칸)');
      }

      for (var c = 0; c < N; c++) {
        var key = row[c] || '';
        var info = legend[key];
        var star = (mid[0] === r && mid[1] === c);

        var sq = document.createElement('div');
        sq.className = 'sq' +
          (star ? ' is-star' : key ? ' ' + (TINT[key] || 'is-other') : '');
        sq.setAttribute('role', 'gridcell');

        // 사람이 부르는 방식(A1 ~ O15)으로 자리를 적어둡니다.
        var name = colName(c) + (r + 1);
        sq.setAttribute('aria-label', name +
          (star ? ', 한가운데 — 첫 단어는 여기를 지나갑니다'
                : info ? ', ' + info.name : ''));
        sq.dataset.at = name;

        if (star) {
          sq.textContent = '★';
        } else if (info) {
          // "3배 / 단어" 두 줄. 백엔드가 준 배수와 대상으로 만듭니다.
          sq.appendChild(el('span', 'sq-x', info.multiplier + '배'));
          sq.appendChild(el('span', 'sq-y',
            info.applies_to === 'word' ? '단어' : info.applies_to === 'letter' ? '글자' : ''));
        } else if (key) {
          // 모르는 종류 — 이름을 그대로 적어둡니다.
          sq.appendChild(el('span', 'sq-x', key));
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
    function sqAt(r, c) { return grid.children[r * N + c]; }

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

      /* 서버가 준 판 전체를 그립니다. board_size 만큼, 빈 칸은 "".
         바뀐 부분만 받지 않고 통째로 받는 이유는 명세에 적혀 있습니다 —
         조각을 모아 맞추다 한 번이라도 놓치면 그 뒤로 계속 어긋납니다. */
      setBoard: function (rows) {
        fixed = rows || null;
        for (var r = 0; r < N; r++) {
          for (var c = 0; c < N; c++) {
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
        if (r < 0 || r >= N || c < 0 || c >= N) return false;
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
        return { row: Math.floor(i / N), col: i % N, el: sq };
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

  /* 칸 이름 (A1 ~ O15). 판이 26칸을 넘어가면 AA 처럼 두 글자가 됩니다. */
  function colName(c) {
    var L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', out = '';
    do { out = L.charAt(c % 26) + out; c = Math.floor(c / 26) - 1; } while (c >= 0);
    return out;
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  return { mount: mount };
})();
