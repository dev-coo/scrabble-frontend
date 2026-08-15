/* ─────────────────────────────────────────────────────────────
   스크래블 — 소리

     <script src="game/sfx.js"></script>

     Sfx.clack(i);   // 칩을 받침대에 놓을 때 (배분)
     Sfx.place(i);   // 칩을 판에 놓을 때
     Sfx.good();     // 단어가 판에 올라갔을 때
     Sfx.nope();     // 사전에 없거나 자리가 틀렸을 때
     Sfx.on(true);   // 켜고 끄기

   ── 소리 파일이 없는 이유 ────────────────────────────────
   이 저장소는 설치할 것이 없습니다(npm install 불필요). 소리 파일을
   넣으면 그 원칙이 깨지고, 파일을 받아오는 동안 소리가 늦게 납니다.
   그래서 브라우저가 이미 가지고 있는 기능으로 그 자리에서 만듭니다.

   ── 소리를 어떻게 만드나 ─────────────────────────────────
   실제 소리는 대부분 두 겹입니다.
     ① 부딪히는 순간의 "탁"  — 잡음을 아주 빠르게 줄여서 만듭니다
     ② 그 뒤에 남는 울림     — 음을 하나 짧게 울려서 만듭니다
   둘을 겹쳐야 딸깍이 아니라 물건 소리로 들립니다.
   ───────────────────────────────────────────────────────────── */
window.Sfx = (function () {
  'use strict';

  var ctx = null;
  var enabled = true;

  try { enabled = localStorage.getItem('scrabble.sound') !== '0'; } catch (e) {}

  // 브라우저는 사람이 한 번 누르기 전에는 소리를 못 내게 막습니다.
  // 광고가 갑자기 소리를 내는 것을 막으려는 규칙입니다. 그래서 아무
  // 곳이나 처음 누를 때 소리 장치를 깨워둡니다.
  function wake() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!ctx) ctx = new AC();
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) { return null; }
  }

  document.addEventListener('pointerdown', wake, { passive: true });
  document.addEventListener('keydown', wake, { passive: true });

  // 소리를 낼 수 있는 상태인지. 못 내면 게임은 그대로 두고 조용히 넘어갑니다.
  function ready() {
    if (!enabled) return null;
    var c = wake();
    return (c && c.state === 'running') ? c : null;
  }

  /* 부딪히는 소리 — 잡음을 만들어 아주 빠르게 줄입니다.
     hz 가 높을수록 가볍고 단단한 소리가 됩니다. */
  function knock(c, at, hz, vol, ms, sharp) {
    var len = Math.max(1, Math.floor(c.sampleRate * (ms || 0.05)));
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    var fall = sharp || 6;
    for (var n = 0; n < len; n++) {
      d[n] = (Math.random() * 2 - 1) * Math.pow(1 - n / len, fall);
    }
    var src = c.createBufferSource();
    src.buffer = buf;
    var bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = hz;
    bp.Q.value = 1.1;
    var g = c.createGain();
    g.gain.value = vol;
    src.connect(bp); bp.connect(g); g.connect(c.destination);
    src.start(at);
  }

  /* 음 하나. 짧게 울리고 사라집니다. */
  function tone(c, at, hz, vol, ms, type, glideTo) {
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(hz, at);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, at + ms);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, at + ms);
    o.connect(g); g.connect(c.destination);
    o.start(at); o.stop(at + ms + 0.02);
  }

  /* 금관악기 소리 한 음.
     톱니파(sawtooth)는 배음이 잔뜩 든 거친 소리라 그대로 들으면
     시끄럽습니다. 여기에 저역통과 필터를 걸고 그 문턱을 처음엔 높게,
     뒤로 갈수록 낮게 내리면 "훅 불었다가 잦아드는" 나팔이 됩니다.
     시작을 아주 빠르게 세우는 것도 나팔의 특징입니다. */
  function brass(c, at, hz, vol, ms, cents) {
    var o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(hz, at);
    if (cents) o.detune.setValueAtTime(cents, at);

    f.type = 'lowpass';
    f.Q.value = 0.7;
    f.frequency.setValueAtTime(hz * 7, at);
    f.frequency.exponentialRampToValueAtTime(hz * 2.2, at + ms * 0.8);

    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.018);
    g.gain.setValueAtTime(vol, at + ms * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, at + ms);

    o.connect(f); f.connect(g); g.connect(c.destination);
    o.start(at); o.stop(at + ms + 0.04);
  }

  /* 한 음을 두 개로 겹쳐 냅니다. 아주 조금 음을 어긋나게 하면
     두 사람이 같이 부는 것처럼 두툼해집니다. 완전히 똑같은 음
     두 개는 그냥 소리만 커집니다. */
  function brass2(c, at, hz, vol, ms) {
    brass(c, at, hz, vol, ms, -7);
    brass(c, at, hz, vol * 0.8, ms, 7);
  }

  /* 심벌 — 잡음을 높은 쪽만 남기고 천천히 줄입니다.
     마지막 화음 위에 얹으면 "쨍" 하고 퍼집니다. */
  function crash(c, at, vol, ms) {
    var len = Math.floor(c.sampleRate * ms);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var n = 0; n < len; n++) d[n] = (Math.random() * 2 - 1) * Math.pow(1 - n / len, 2.2);
    var src = c.createBufferSource(); src.buffer = buf;
    var hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5000;
    var g = c.createGain(); g.gain.value = vol;
    src.connect(hp); hp.connect(g); g.connect(c.destination);
    src.start(at);
  }

  var api = {
    /* 배분 — 나무 칩이 나무 받침대에 놓이는 소리. 낮고 둔합니다.
       i 는 몇 번째 장인지. 장마다 음을 조금씩 올립니다 — 일곱 번이
       똑같으면 기계 소리가 됩니다. */
    clack: function (i) {
      var c = ready(); if (!c) return;
      var t = c.currentTime;
      knock(c, t, 1500 + (i || 0) * 105, 0.16, 0.05);
      tone(c, t, 210 + (i || 0) * 9, 0.1, 0.085, 'sine', 96);
    },

    /* 판에 놓기 — 배분보다 높고 짧습니다. 받침대는 나무판이고
       게임판은 얇은 종이라, 같은 칩이라도 더 가볍게 들립니다.
       놓는 맛이 나야 해서 배분보다 경쾌한 쪽으로 잡았습니다. */
    place: function (i) {
      var c = ready(); if (!c) return;
      var t = c.currentTime;
      knock(c, t, 2500 + (i || 0) * 140, 0.13, 0.032, 8);
      tone(c, t, 520 + (i || 0) * 26, 0.075, 0.055, 'triangle', 300);
    },

    /* 칩을 도로 집어 올릴 때 — 놓는 소리를 거꾸로 한 느낌으로
       아주 작게. 되돌리는 일에 큰 소리를 내면 잘못한 것처럼 들립니다. */
    lift: function () {
      var c = ready(); if (!c) return;
      var t = c.currentTime;
      knock(c, t, 3200, 0.05, 0.02, 9);
      tone(c, t, 300, 0.04, 0.04, 'triangle', 460);
    },

    /* 단어가 판에 올라갔을 때 — 올라가는 네 음.
       도·미·솔·도 로 한 옥타브를 올라갑니다. 밝게 끝나야
       "됐다"로 들립니다. */
    good: function () {
      var c = ready(); if (!c) return;
      var t = c.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach(function (hz, i) {
        tone(c, t + i * 0.075, hz, 0.11, 0.16, 'triangle');
      });
      // 마지막 음 위에 아주 옅은 반짝임을 얹습니다.
      tone(c, t + 0.225, 1567.98, 0.045, 0.3, 'sine');
    },

    /* 안 되는 수 — 낮은 두 음이 내려갑니다.
       삑 소리를 내지 않는 이유: 없는 단어를 낸 것은 고장이 아니라
       게임에서 흔히 있는 일입니다. 혼내는 소리가 아니라 알려주는
       소리여야 합니다. */
    nope: function () {
      var c = ready(); if (!c) return;
      var t = c.currentTime;
      tone(c, t, 233.08, 0.09, 0.12, 'sine');
      tone(c, t + 0.11, 185.00, 0.09, 0.2, 'sine');
    },

    /* 턴이 넘어갔을 때 — "띵~" 하고 길게 남는 한 음.
       종소리는 배음(원래 음의 2배·3배 되는 음)이 함께 울려서 납니다.
       그래서 한 음만 내면 삑 소리가 되고, 위에 옅게 겹쳐야 종이 됩니다.
       남은 횟수가 줄수록 음이 낮아집니다 — 신호등이 빨간불로 가는
       것을 소리로도 알 수 있게 했습니다. */
    ding: function (left) {
      var c = ready(); if (!c) return;
      var t = c.currentTime;
      // 2번 남음 → 높고 맑게, 0번 남음 → 낮고 무겁게
      var base = [523.25, 587.33, 659.25][Math.max(0, Math.min(2, left == null ? 2 : left))];
      tone(c, t, base, 0.13, 1.1, 'sine');
      tone(c, t, base * 2, 0.05, 0.85, 'sine');
      tone(c, t, base * 3.01, 0.025, 0.5, 'sine');
      // 때리는 순간의 소리. 이게 없으면 어디선가 켜진 소리처럼 들립니다.
      knock(c, t, base * 4, 0.05, 0.02, 10);
    },

    /* 빵빠레 — 이겼을 때.

       나팔 팡파르는 리듬이 반입니다. 짧게 세 번 치고 마지막을 길게
       끄는 "따 따 따 따—" 가 그것입니다. 음만 올라가면 그냥 음계고,
       이 리듬이 붙어야 축하로 들립니다.

       솔·솔·솔 로 세 번 부르고 도로 뛰어올라 도·미·솔 화음을 길게
       끕니다. 마지막에 심벌과 반짝임을 얹습니다. */
    fanfare: function () {
      var c = ready(); if (!c) return;
      var t = c.currentTime;
      var G4 = 391.995, C5 = 523.251, E5 = 659.255, G5 = 783.991, C6 = 1046.502;

      // 따 · 따 · 따 — 짧게 세 번
      [0, 0.135, 0.27].forEach(function (d) {
        brass2(c, t + d, G4, 0.11, 0.115);
        brass(c, t + d, G4 * 2, 0.045, 0.11);   // 한 옥타브 위를 옅게 얹어 밝게
      });

      // 따— 뛰어올라 길게. 세 음을 겹쳐 화음으로.
      var at = t + 0.43;
      brass2(c, at, C5, 0.12, 1.15);
      brass2(c, at, E5, 0.085, 1.15);
      brass2(c, at, G5, 0.075, 1.15);
      brass(c, at, C6, 0.05, 1.1);

      crash(c, at, 0.075, 1.3);
      // 화음 위에 얹는 반짝임 두 방울
      tone(c, at + 0.18, 1567.98, 0.035, 0.5, 'sine');
      tone(c, at + 0.34, 2093.00, 0.028, 0.45, 'sine');
    },

    /* 게임이 끝났을 때. 이긴 쪽과 진 쪽의 소리가 다릅니다. */
    over: function (won) {
      var c = ready(); if (!c) return;
      var t = c.currentTime;
      if (won) {
        api.fanfare();
      } else {
        // 내려가는 세 음. 낮지만 어둡지 않게 — 한 판 끝난 것뿐입니다.
        [493.88, 415.30, 349.23].forEach(function (hz, i) {
          tone(c, t + i * 0.13, hz, 0.09, 0.32, 'sine');
        });
        tone(c, t + 0.4, 261.63, 0.06, 0.9, 'sine');
      }
    },

    /* 내 차례가 돌아왔을 때 — 아주 짧은 두 음. */
    turn: function () {
      var c = ready(); if (!c) return;
      var t = c.currentTime;
      tone(c, t, 587.33, 0.07, 0.1, 'triangle');
      tone(c, t + 0.1, 880.00, 0.07, 0.14, 'triangle');
    },

    /* 켜고 끄기. 브라우저를 닫았다 열어도 그대로입니다.
       끌 수 없는 소리는 무례합니다. */
    on: function (next) {
      if (next != null) {
        enabled = !!next;
        try { localStorage.setItem('scrabble.sound', enabled ? '1' : '0'); } catch (e) {}
      }
      return enabled;
    },

    wake: wake
  };

  return api;
})();
