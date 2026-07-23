// ─────────────────────────────────────────────────────────────
// 스크래블 프론트엔드 정적 서버 — 기본용 (수진이 실행)
//
// index.html 을 웹에서 볼 수 있게 띄워주는 아주 작은 서버입니다.
// 의존성(npm install) 없이 Node 기본 기능만 씁니다.
// 실행:  node serve.js   →  브라우저에서 http://100.115.173.118:10000
// ─────────────────────────────────────────────────────────────
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 10000;              // 프론트엔드 포트
const HOST = "0.0.0.0";          // 다른 컴퓨터(테일스케일)에서도 접속 허용

const server = http.createServer((req, res) => {
  const file = req.url === "/" ? "index.html" : req.url.replace(/^\//, "");
  const full = path.join(__dirname, path.normalize(file));
  if (!full.startsWith(__dirname)) { res.writeHead(403); return res.end("forbidden"); }

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
  console.log(`테일스케일로 접속: http://100.115.173.118:${PORT}`);
});
