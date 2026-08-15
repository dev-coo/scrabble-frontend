/* ─────────────────────────────────────────────────────────────
   스크래블 — 칩 받침대

   rack.css 와 한 쌍입니다.

     <link rel="stylesheet" href="game/rack.css" />
     <script src="game/sfx.js"></script>     ← 먼저 읽혀야 합니다
     <script src="game/rack.js"></script>

     var 받침대 = Rack.mount('#rackBox', { points: { A:1, B:3, ... } });
     받침대.deal(['S','C','R','A','B','L','E']);   // 한 장씩 놓이며 소리
     받침대.setUsed({ 2:true });                    // 3번 칩은 지금 판에 나가 있음

   ── 이 파일이 하지 않는 일 ───────────────────────────────
   칩을 만들지 않습니다. 무슨 칩을 쥐었는지는 백엔드가 정해서
   game_started 의 rack 으로 보내주는 값이고, 여기서는 받은 것을
   그리기만 합니다. 프론트가 고르면 그건 지어낸 패입니다.

   끌어다 놓는 일도 여기서 하지 않습니다. 그건 받침대와 게임판 둘 다
   아는 쪽(game/play.js)이 합니다. 받침대는 칩을 보여주고, 어느 칩이
   지금 판에 나가 있는지를 표시할 뿐입니다.
   ───────────────────────────────────────────────────────────── */
window.Rack = (function () {
  'use strict';

  /* 소리는 game/sfx.js 가 냅니다. 받침대·판·제출 결과가 모두 같은
     소리 장치를 써야 해서 한 곳으로 모았습니다. */

  function mount(target, opts) {
    var host = typeof target === 'string' ? document.querySelector(target) : target;
    if (!host) throw new Error('Rack.mount: 붙일 자리를 찾지 못했습니다 — ' + target);

    var o = opts || {};
    // 글자별 점수. GET /api/game/setup 에서 받아온 것을 넘겨받습니다.
    // 없으면 점수를 적지 않습니다 — 모르는 값을 0 이라고 적으면 안 됩니다.
    var points = o.points || null;

    var wrap = document.createElement('div');
    wrap.className = 'rack-wrap';
    host.appendChild(wrap);

    var letters = [];      // 지금 손에 든 칩 (백엔드가 준 그대로)
    var cells = [];        // 칩 하나가 앉는 자리. 판에 나가 있으면 빈 자리가 됩니다.
    var timers = [];

    function clearTimers() {
      timers.forEach(clearTimeout);
      timers = [];
    }

    function chip(letter, i) {
      var blank = letter === '?';
      var e = document.createElement('div');
      e.className = 'chip' + (blank ? ' is-blank' : '');
      e.textContent = blank ? '?' : letter;
      // 몇 번째 칩인지. 끌어다 놓을 때 어느 칩이 나갔는지 이 번호로 셉니다.
      // 같은 글자를 두 장 들고 있을 수 있어서 글자로는 셀 수 없습니다.
      e.dataset.i = i;
      e.dataset.letter = letter;

      var pt = points && points[letter];
      e.setAttribute('role', 'listitem');
      e.setAttribute('aria-label', blank
        ? '빈 칩, 아무 글자로나 쓸 수 있고 0점'
        : letter + (pt != null ? ', ' + pt + '점' : ''));

      // 빈 타일에는 점수를 적지 않습니다. 0 을 적으면 0점짜리 글자가
      // 있는 것처럼 보입니다.
      if (!blank && pt != null) {
        var pip = document.createElement('i');
        pip.className = 'chip-pip';
        pip.textContent = pt;
        e.appendChild(pip);
      }
      return e;
    }

    // 받침대를 처음부터 다시 그립니다.
    function paint(dealing) {
      clearTimers();
      wrap.innerHTML = '';
      cells = [];

      if (!letters.length) {
        var p = document.createElement('p');
        p.className = 'rack-empty';
        p.textContent = '아직 칩을 받지 않았습니다';
        wrap.appendChild(p);
        return;
      }

      var row = document.createElement('div');
      row.className = 'rack';
      row.setAttribute('role', 'list');
      row.setAttribute('aria-label', '내 칩 ' + letters.length + '개');
      wrap.appendChild(row);

      letters.forEach(function (ch, i) {
        // 칩이 판에 나가면 이 자리는 비지만 자리 자체는 남깁니다.
        // 자리가 사라지면 남은 칩들이 좌우로 밀려, 내가 어느 칩을
        // 집었는지 눈으로 놓치게 됩니다.
        var slot = document.createElement('div');
        slot.className = 'slot';
        slot.dataset.i = i;

        var c = chip(ch, i);
        if (dealing) {
          c.classList.add('is-dealing');
          c.style.animationDelay = (i * 0.11) + 's';
          timers.push(setTimeout(function () { Sfx.clack(i); }, i * 110 + 210));
        }
        slot.appendChild(c);
        row.appendChild(slot);
        cells.push(slot);
      });
    }

    var api = {
      /* 백엔드가 나눠준 칩을 받침대에 놓습니다.
         한 장씩 0.11초 간격으로 놓이고, 놓일 때마다 소리가 납니다. */
      deal: function (list) {
        letters = (list || []).slice();
        paint(true);
        return api;
      },

      /* 움직임 없이 그대로 다시 그립니다. */
      show: function (list) {
        if (list) letters = list.slice();
        paint(false);
        return api;
      },

      /* 지금 판에 나가 있는 칩을 표시합니다. { 번호: true } 모양.
         나간 칩은 받침대에서 빈 자리가 됩니다. */
      setUsed: function (used) {
        cells.forEach(function (slot, i) {
          var out = !!(used && used[i]);
          slot.classList.toggle('is-out', out);
          var c = slot.firstChild;
          if (c && c.classList) c.style.visibility = out ? 'hidden' : '';
        });
        return api;
      },

      /* 지금 손에 든 글자들. */
      letters: function () { return letters.slice(); },

      /* 번호로 칩 알맹이를 찾습니다. (끌어다 놓을 때 씁니다) */
      chipAt: function (i) {
        var slot = cells[i];
        return slot ? slot.firstChild : null;
      },

      setPoints: function (p) {
        points = p;
        if (letters.length) paint(false);
        return api;
      },

      destroy: function () {
        clearTimers();
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        return null;
      },

      el: wrap
    };

    return api;
  }

  return {
    mount: mount,
    // 예전 이름을 그대로 둡니다. 소리 담당이 sfx.js 로 옮겨갔다는 것만
    // 여기 한 줄로 적어둡니다.
    sound: function (v) { return Sfx.on(v); },
    wake: function () { return Sfx.wake(); }
  };
})();
