/* ─────────────────────────────────────────────────────────────
   스크래블 — 채팅 모듈 (동작)

   chat.css 와 한 쌍입니다. 페이지에서 이렇게 씁니다:

     <link rel="stylesheet" href="chat/chat.css" />
     <script src="chat/chat.js"></script>

     var 채팅 = Chat.mount('#chatBox', {
       me: '수진',
       onSend: function (text) { ... 보내기 ... }
     });

   ── 왜 "모듈"로 만드나 ────────────────────────────────────
   대기실에도 게임 화면에도 같은 채팅이 필요합니다. 화면마다 따로
   만들면 나중에 말풍선 색 하나 바꾸는 데 두 군데를 고쳐야 하고,
   한 곳만 고치면 두 화면이 서로 달라집니다. 한 벌만 만들어 두 곳이
   같이 쓰면 그런 일이 없습니다.

   ── 백엔드와의 경계 ──────────────────────────────────────
   이 파일은 서버를 부르지 않습니다. 채팅은 웹소켓(WebSocket)을 쓰게
   되는데, 그 명세서(docs/ws-contract.md)가 아직 없어서 접속 주소나
   메시지 형식을 추측하지 않기로 했습니다.

   대신 주고받는 자리만 정해뒀습니다:
     내가 보낼 때  → onSend(text) 가 불립니다        (여기서 socket.send)
     남이 보낼 때  → 채팅.receive({from, text}) 를 부르면 됩니다 (socket.onmessage 에서)

   명세서가 오면 이 두 자리만 이으면 되고, 화면 코드는 그대로입니다.
   ───────────────────────────────────────────────────────────── */
window.Chat = (function () {
  'use strict';

  var DEFAULTS = {
    me: '나',              // 내 닉네임 — 어느 말이 내 것인지 가르는 기준
    title: '채팅',
    open: true,            // 처음에 펼쳐둘지
    collapsible: true,     // 접기 버튼을 보여줄지
    height: null,          // 대화 칸 높이 (예: '320px'). 없으면 CSS 기본값
    maxLen: 200,
    placeholder: '메시지를 입력하세요',
    empty: '아직 대화가 없습니다',
    status: 'online',      // 'online' | 'connecting' | 'offline'
    // 내가 보낸 말을 이 모듈이 바로 화면에 그릴지.
    // 웹소켓을 붙이면 false 로 두고, 서버가 되돌려준 말을 receive 로
    // 받아 그리는 편이 낫습니다 — 진짜 전달된 것만 화면에 남으니까요.
    echo: true,
    onSend: null           // function (text) {}
  };

  var STATUS_TEXT = {
    online: '연결됨',
    connecting: '연결 중',
    offline: '연결 끊김'
  };

  function mount(target, options) {
    var host = typeof target === 'string' ? document.querySelector(target) : target;
    if (!host) throw new Error('Chat.mount: 붙일 자리를 찾지 못했습니다 — ' + target);

    var o = {};
    Object.keys(DEFAULTS).forEach(function (k) { o[k] = DEFAULTS[k]; });
    Object.keys(options || {}).forEach(function (k) { o[k] = options[k]; });

    // ── 뼈대 만들기 ──────────────────────────────────────
    var root = document.createElement('div');
    root.className = 'chat';
    root.setAttribute('data-open', o.open ? 'yes' : 'no');
    root.setAttribute('data-status', o.status);
    if (o.height) root.style.setProperty('--chat-height', o.height);

    root.innerHTML =
      '<div class="chat-head">' +
        '<span class="chat-dot" aria-hidden="true"></span>' +
        '<span class="chat-a11y" data-x="status"></span>' +
        '<span class="chat-title"></span>' +
        '<span class="chat-badge" data-x="badge" aria-live="polite"></span>' +
        (o.collapsible ? '<button class="chat-fold" data-x="fold" type="button"></button>' : '') +
      '</div>' +
      '<div class="chat-body">' +
        '<div class="chat-log" data-x="log" role="log" aria-live="polite"></div>' +
        '<button class="chat-jump" data-x="jump" type="button">새 메시지 ↓</button>' +
        '<p class="chat-typing" data-x="typing">' +
          '<i></i><i></i><i></i><span data-x="typingName"></span>' +
        '</p>' +
        '<div class="chat-foot">' +
          '<input class="chat-input" data-x="input" type="text" autocomplete="off" ' +
                 'maxlength="' + o.maxLen + '" />' +
          '<span class="chat-count" data-x="count"></span>' +
          '<button class="chat-send" data-x="send" type="button">보내기</button>' +
        '</div>' +
      '</div>';

    host.appendChild(root);

    var $ = function (name) { return root.querySelector('[data-x="' + name + '"]'); };
    var log = $('log'), input = $('input'), send = $('send'), count = $('count');
    var badge = $('badge'), jump = $('jump'), fold = $('fold');

    root.querySelector('.chat-title').textContent = o.title;
    input.placeholder = o.placeholder;

    // ── 지금 상태 ────────────────────────────────────────
    var lastKey = null;   // 직전에 말한 사람 — 같으면 이름을 다시 안 씁니다
    var unread = 0;
    var isOpen = !!o.open;

    // ── 잡일 ─────────────────────────────────────────────
    function el(tag, cls, text) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    }

    function hhmm(when) {
      var d = when ? new Date(when) : new Date();
      if (isNaN(d)) d = new Date();
      var h = d.getHours(), m = d.getMinutes();
      return (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m);
    }

    // 맨 아래 근처에 있는지. 위로 올려 읽는 중이면 화면을 뺏지 않습니다.
    function atBottom() {
      return log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    }

    function toBottom() {
      log.scrollTop = log.scrollHeight;
      root.setAttribute('data-behind', 'no');
    }

    function showEmpty() {
      if (log.children.length === 0) log.appendChild(el('p', 'chat-empty', o.empty));
    }

    function dropEmpty() {
      var e = log.querySelector('.chat-empty');
      if (e) log.removeChild(e);
    }

    // 새 줄을 넣은 뒤 공통으로 하는 일
    function settle(mine) {
      var stick = atBottom();
      if (stick || mine) toBottom();
      else root.setAttribute('data-behind', 'yes');
      if (!isOpen && !mine) bump();
    }

    function bump() {
      unread++;
      badge.textContent = unread > 99 ? '99+' : String(unread);
      root.setAttribute('data-unread', 'yes');
    }

    function clearUnread() {
      unread = 0;
      root.setAttribute('data-unread', 'no');
    }

    // ── 화면에 말 한 줄 붙이기 ──────────────────────────
    function line(who, text, when, mine, pending) {
      dropEmpty();

      var key = (mine ? 'me' : 'you:' + who);
      var box = el('div', 'chat-msg' + (mine ? ' is-mine' : '') +
                          (key === lastKey ? ' is-tail' : '') +
                          (pending ? ' is-pending' : ''));
      lastKey = key;

      box.appendChild(el('p', 'chat-who', who));
      var row = el('div', 'chat-line');
      row.appendChild(el('span', 'chat-bubble', text));
      var t = el('time', 'chat-time', hhmm(when));
      t.dateTime = (when ? new Date(when) : new Date()).toISOString();
      row.appendChild(t);
      box.appendChild(row);

      log.appendChild(box);
      settle(mine);
      return box;
    }

    // ── 보내기 ───────────────────────────────────────────
    function refresh() {
      var v = input.value.trim();
      var offline = root.getAttribute('data-status') === 'offline';
      send.disabled = v.length === 0 || offline;
      input.disabled = offline;
      count.textContent = input.value.length + '/' + o.maxLen;
      count.className = 'chat-count' + (input.value.length >= o.maxLen ? ' is-over' : '');
    }

    function doSend() {
      var text = input.value.trim();
      if (!text || send.disabled) return;

      input.value = '';
      refresh();
      input.focus();

      // 내가 보낸 말을 이 모듈이 바로 그릴지는 echo 로 정합니다.
      if (o.echo) line(o.me, text, null, true, false);

      // 여기가 백엔드로 나가는 문입니다. 웹소켓이 붙으면
      // 이 onSend 안에서 socket.send(...) 를 하게 됩니다.
      if (typeof o.onSend === 'function') o.onSend(text);
    }

    send.addEventListener('click', doSend);
    input.addEventListener('input', refresh);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); }
    });

    log.addEventListener('scroll', function () {
      if (atBottom()) root.setAttribute('data-behind', 'no');
    });
    jump.addEventListener('click', toBottom);

    if (fold) {
      fold.addEventListener('click', function () { api.toggle(); });
    }

    // ── 밖에서 부르는 것들 ───────────────────────────────
    var api = {
      /* 남이 한 말을 화면에 붙입니다.
         웹소켓이 붙으면 socket.onmessage 안에서 이걸 부르면 됩니다. */
      receive: function (m) {
        line(m.from || '상대', m.text, m.at, false, false);
        return api;
      },

      /* 내가 한 말을 화면에 붙입니다. (echo:false 로 쓸 때)
         pending: true 면 흐리게 그리고, 돌려받은 confirm() 으로 확정합니다. */
      mine: function (text, opts) {
        var box = line(o.me, text, (opts || {}).at, true, (opts || {}).pending);
        return { confirm: function () { box.classList.remove('is-pending'); } };
      },

      /* "○○님이 들어왔습니다" 같은 알림 줄 */
      system: function (text) {
        dropEmpty();
        lastKey = null;                       // 알림 뒤에는 이름을 다시 씁니다
        log.appendChild(el('p', 'chat-sys', text));
        settle(false);
        return api;
      },

      /* 'online' | 'connecting' | 'offline' */
      setStatus: function (s) {
        root.setAttribute('data-status', s);
        $('status').textContent = STATUS_TEXT[s] || s;
        refresh();
        return api;
      },

      /* 상대가 입력 중. 이름을 빼고 부르면 지웁니다. */
      typing: function (name) {
        if (name) {
          $('typingName').textContent = ' ' + name + ' 님이 입력 중…';
          root.setAttribute('data-typing', 'yes');
        } else {
          root.setAttribute('data-typing', 'no');
        }
        return api;
      },

      open: function () {
        isOpen = true;
        root.setAttribute('data-open', 'yes');
        if (fold) fold.textContent = '접기';
        clearUnread();
        toBottom();
        return api;
      },

      close: function () {
        isOpen = false;
        root.setAttribute('data-open', 'no');
        if (fold) fold.textContent = '펼치기';
        return api;
      },

      toggle: function () { return isOpen ? api.close() : api.open(); },

      /* 내 닉네임이 바뀌었을 때 (대기실에서 '바꾸기'를 누른 경우) */
      setMe: function (name) { o.me = name; return api; },

      clear: function () {
        log.innerHTML = '';
        lastKey = null;
        showEmpty();
        return api;
      },

      /* 화면에서 통째로 떼어냅니다. */
      destroy: function () {
        if (root.parentNode) root.parentNode.removeChild(root);
        return null;
      },

      el: root
    };

    // ── 첫 모습 ──────────────────────────────────────────
    if (fold) fold.textContent = isOpen ? '접기' : '펼치기';
    api.setStatus(o.status);
    showEmpty();
    refresh();

    return api;
  }

  return { mount: mount };
})();
