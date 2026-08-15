// ─────────────────────────────────────────────────────────────
// 스크래블 프론트엔드 정적 서버 — 기본용 (수진이 실행)
//
// index.html 을 웹에서 볼 수 있게 띄워주는 아주 작은 서버입니다.
// 의존성(npm install) 없이 Node 기본 기능만 씁니다.
// 실행:  node serve.js   →  브라우저에서 http://localhost:10000
// ─────────────────────────────────────────────────────────────
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 10000;              // 프론트엔드 포트
const HOST = "0.0.0.0";          // 다른 컴퓨터(테일스케일)에서도 접속 허용

// 파일이 아니라 "화면"인 주소들.
// /game 이라는 파일은 없습니다. 이 주소들은 전부 index.html 을 돌려주고,
// 어느 화면을 보일지는 브라우저 안에서 index.html 이 정합니다.
// 이렇게 해야 주소창에 /game 을 직접 쳐도 404 가 뜨지 않습니다.
const SCREENS = ["/", "/game"];

const server = http.createServer((req, res) => {
  // 주소 뒤에 ?가 붙어 올 수 있습니다(예: /styles.css?v=2). 파일 이름이
  // 아니므로 떼어냅니다.
  let urlPath = req.url.split("?")[0];

  // %20 처럼 인코딩된 글자를 원래 글자로 되돌립니다. 한글 파일 이름이
  // 있어서 필요합니다.
  try { urlPath = decodeURIComponent(urlPath); }
  catch (e) { res.writeHead(400); return res.end("bad request"); }

  const file = SCREENS.includes(urlPath) ? "index.html" : urlPath.replace(/^\//, "");
  const full = path.join(__dirname, path.normalize(file));
  // 이 폴더 밖으로 나가는 주소는 막습니다. 구분자까지 붙여 비교하는
  // 이유: 그냥 비교하면 옆에 있는 scrabble-frontend-something 폴더가
  // 이름이 겹쳐서 통과해 버립니다.
  if (full !== __dirname && !full.startsWith(__dirname + path.sep)) {
    res.writeHead(403); return res.end("forbidden");
  }

  fs.readFile(full, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not Found: " + file); }
    const ext = path.extname(full).toLowerCase();
    const type = ext === ".html" ? "text/html; charset=utf-8"
      : ext === ".js" ? "text/javascript; charset=utf-8"
      : ext === ".css" ? "text/css; charset=utf-8"
      : "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`프론트엔드 실행됨 → http://${HOST}:${PORT}`);
  console.log(`테일스케일로 접속: http://<이 컴퓨터의 테일스케일 IP>:${PORT}`);
});
