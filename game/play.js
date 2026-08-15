/* ─────────────────────────────────────────────────────────────
   스크래블 — 칩을 끌어다 놓기

     <script src="game/play.js"></script>

     var 놓기 = Play.start({
       board: 판, rack: 받침대,
       canPlay: function () { return 내차례인가; },
       onChange: function (놓은것) { ... }   // 제출 버튼 상태 갱신용
     });
     놓기.draft();   // [{row, col, letter, from}] — 지금 판에 올려둔 내 칩
     놓기.clear();   // 전부 받침대로 되돌리기

   ── 왜 HTML 의 드래그 기능을 안 쓰나 ────────────────────
   브라우저에 원래 있는 끌어놓기(draggable + dragstart)는 손가락으로는
   동작하지 않습니다. 휴대폰에서 칩을 못 옮기게 되므로, 마우스와
   손가락을 똑같이 다루는 포인터 방식으로 직접 만들었습니다.

   ── 눌렀다 떼기만 해도 됩니다 ───────────────────────────
   끌지 않고 톡 누르면 칩이 "들린" 상태가 되고, 그다음 칸을 누르면
   거기 놓입니다. 화면이 작을 때는 끄는 것보다 이쪽이 쉽습니다.
   ───────────────────────────────────────────────────────────── */
window.Play = (function () {
  'use strict';

  function start(opts) {
    var board = opts.board;
    var rack = opts.rack;
    var canPlay = opts.canPlay || function () { return true; };
    var onChange = opts.onChange || function () {};
    var onBlank = opts.onBlank || null;   // 빈 칩의 글자를 물어보는 함수

    // 판에 올려둔 내 칩들. from = 받침대에서 몇 번째 칩인지.
    var draft = [];

    // 지금 손에 들고 있는 칩
    var held = null;      // { from, letter, ghost, moved, startX, startY }

    function used() {
      var m = {};
      draft.forEach(function (t) { m[t.from] = true; });
      return m;
    }

    function sync() {
      rack.setUsed(used());
      board.setDraft(draft);
      onChange(draft.slice());
    }

    function ghostFor(letter, x, y) {
      var g = document.createElement('div');
      g.className = 'chip chip-ghost' + (letter === '?' ? ' is-blank' : '');
      g.textContent = letter;
      document.body.appendChild(g);
      moveGhost(g, x, y);
      return g;
    }

    function moveGhost(g, x, y) {
      // 손가락으로 집었을 때 칩이 손가락 밑에 가려지지 않도록 조금 위로
      // 띄웁니다.
      g.style.left = x + 'px';
      g.style.top = (y - 26) + 'px';
    }

    function drop(cell) {
      if (!held) return;
      var h = held;
      held = null;

      if (h.ghost && h.ghost.parentNode) h.ghost.parentNode.removeChild(h.ghost);
      board.hover(null);
      document.body.classList.remove('is-dragging');

      if (!cell || !board.isEmpty(cell.row, cell.col)) {
        // 놓을 수 없는 곳입니다. 받침대로 돌아갑니다.
        // 원래 자리에 있던 칩이라면 판에서 내려옵니다.
        if (h.from != null) removeFrom(h.from, true);
        sync();
        return;
      }

      function place(letter) {
        // 이 칩이 판 위 다른 자리에 있었다면 그 자리를 비웁니다.
        draft = draft.filter(function (t) { return t.from !== h.from; });
        draft.push({ row: cell.row, col: cell.col, letter: letter, from: h.from, blank: h.letter === '?' });
        Sfx.place(draft.length - 1);
        sync();
      }

      if (h.letter === '?' && onBlank) {
        // 빈 칩은 무슨 글자로 쓸지 정해야 합니다. ? 인 채로는 무슨
        // 단어인지 판단할 수 없어서 서버가 받아주지 않습니다(명세).
        onBlank(function (letter) {
          if (!letter) { sync(); return; }
          place(letter.toUpperCase());
        });
        return;
      }

      place(h.letter);
    }

    function removeFrom(from, quiet) {
      var before = draft.length;
      draft = draft.filter(function (t) { return t.from !== from; });
      if (draft.length !== before && !quiet) Sfx.lift();
    }

    // ── 누르기 시작 ──────────────────────────────────────
    function onDown(e) {
      if (e.button != null && e.button !== 0) return;   // 왼쪽 버튼만
      if (!canPlay()) return;

      var el = e.target.closest ? e.target.closest('.chip') : null;
      if (!el) return;

      var from = null, letter = null;

      // ① 받침대에서 집기
      var slot = el.closest('.slot');
      if (slot && rack.el.contains(slot)) {
        from = Number(slot.dataset.i);
        // 이미 판에 나가 있는 칩은 받침대에서 집을 수 없습니다.
        if (used()[from]) return;
        letter = el.dataset.letter;
      }

      // ② 판에 올려둔 내 칩을 다시 집기 (서버가 준 글자는 못 집습니다)
      var sq = el.closest('.sq');
      if (sq && el.classList.contains('is-draft')) {
        var cell = board.cellAtPoint(
          sq.getBoundingClientRect().left + 2,
          sq.getBoundingClientRect().top + 2);
        var t = draft.filter(function (d) {
          return cell && d.row === cell.row && d.col === cell.col;
        })[0];
        if (!t) return;
        from = t.from;
        letter = t.blank ? '?' : t.letter;
        removeFrom(from, true);
        sync();
      }

      if (from == null) return;

      e.preventDefault();
      Sfx.wake();

      held = {
        from: from, letter: letter, moved: false,
        startX: e.clientX, startY: e.clientY,
        ghost: ghostFor(letter, e.clientX, e.clientY)
      };
      document.body.classList.add('is-dragging');
    }

    function onMove(e) {
      if (!held) return;
      var dx = e.clientX - held.startX, dy = e.clientY - held.startY;
      if (!held.moved && dx * dx + dy * dy > 25) held.moved = true;
      moveGhost(held.ghost, e.clientX, e.clientY);
      board.hover(board.cellAtPoint(e.clientX, e.clientY));
    }

    function onUp(e) {
      if (!held) return;

      // 끌지 않고 톡 눌렀다 뗀 경우 — 칩을 든 채로 둡니다.
      // 다음에 칸을 누르면 거기 놓입니다.
      if (!held.moved) {
        held.pending = true;
        held.ghost.classList.add('is-held');
        document.body.classList.remove('is-dragging');
        return;
      }
      drop(board.cellAtPoint(e.clientX, e.clientY));
    }

    // 칩을 든 채로 칸을 누르면 거기 놓입니다.
    function onTap(e) {
      if (!held || !held.pending) return;
      var cell = board.cellAtPoint(e.clientX, e.clientY);
      held.pending = false;
      drop(cell);
    }

    var opts_ = { passive: false };
    rack.el.addEventListener('pointerdown', onDown, opts_);
    board.el.addEventListener('pointerdown', onDown, opts_);
    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerup', function (e) {
      if (held && held.pending) { onTap(e); return; }
      onUp(e);
    }, { passive: true });

    return {
      draft: function () { return draft.slice(); },

      /* 판에 올려둔 것을 전부 받침대로 되돌립니다. */
      clear: function () {
        if (!draft.length) return;
        draft = [];
        Sfx.lift();
        sync();
      },

      /* 제출이 받아들여져 서버 판에 올라갔을 때. 소리 없이 비웁니다 —
         board_updated 가 오면서 성공 소리가 따로 납니다. */
      accepted: function () {
        draft = [];
        sync();
      },

      stop: function () {
        document.removeEventListener('pointermove', onMove);
        rack.el.removeEventListener('pointerdown', onDown, opts_);
        board.el.removeEventListener('pointerdown', onDown, opts_);
        if (held && held.ghost && held.ghost.parentNode) {
          held.ghost.parentNode.removeChild(held.ghost);
        }
        held = null;
        document.body.classList.remove('is-dragging');
      }
    };
  }

  return { start: start };
})();
