# Scrabble Frontend

스크래블 프로젝트의 프론트엔드 저장소입니다. (HTML + Node 정적 서버)

3티어 중 **표현(화면)** 티어입니다. 데이터를 직접 만들지 않고,
백엔드에 API로 요청해서 받아옵니다.

## 셋업 (처음 한 번)

설치할 게 없습니다. Node만 있으면 됩니다. (`npm install` 불필요)

```bash
# 커밋 작성자 이름 설정 (프롬프트 로그·커밋에 표시됨)
git config user.name "본인이름"
```

## 실행

```bash
node serve.js
```

| 용도 | 주소 |
|------|------|
| 프론트엔드 화면 | http://localhost:10000 |

화면이 열리면서 백엔드(`http://localhost:11000/api/hello`)를 한 번 호출합니다.
**백엔드가 안 떠 있으면 "백엔드 호출 실패"가 표시됩니다** — 정상 동작입니다.

## 백엔드 확인하기

프론트엔드는 백엔드가 제공하는 API만 씁니다. 어떤 API가 있는지는 아래에서 봅니다.

| 방법 | 주소 |
|------|------|
| **스와거 문서** (눌러보며 확인) | http://localhost:11000/docs |
| OpenAPI (기계용 계약서) | http://localhost:11000/openapi.json |
| 사람이 읽는 계약서 | [`docs/api-contract.md`](./docs/api-contract.md) |

Claude에게 **"이 openapi.json 스펙에 맞춰서 호출해 줘"**라고 하면 됩니다.

> ⚠️ 백엔드가 실행 중이어야 `/docs`가 열립니다. (실행 담당: 엘리)

## 데이터베이스는 여기서 다루지 않습니다

프론트엔드는 DB에 직접 붙지 않습니다. 데이터가 필요하면
**백엔드에 API를 요청**하세요. DB 접속 정보는 백엔드 저장소에만 있습니다.

## 프롬프트 로그 (협업용)

이 저장소는 **Claude에게 입력한 프롬프트가 자동으로 기록**됩니다.

- 파일: [`PROMPTS.md`](./PROMPTS.md)
- 기록 내용: `[타임스탬프] 작성자` + 입력한 질문/명령 (Claude의 응답은 기록되지 않음)
- 동작 방식: Claude Code의 `UserPromptSubmit` 훅 (`.claude/hooks/log-prompt.sh`)

처음 `claude`를 실행하면 프로젝트 훅 실행 승인을 물어봅니다. 허용하세요.

작업 중 또는 작업 후 `PROMPTS.md`를 커밋/푸시하면 서로의 프롬프트를 비교하며
회고할 수 있습니다.

## 관련 문서

- [`CLAUDE.md`](./CLAUDE.md) — Claude가 지킬 작업 규칙
- [`docs/COLLABORATION.md`](./docs/COLLABORATION.md) — 사람이 읽는 협업 가이드
- [`docs/api-contract.md`](./docs/api-contract.md) — 백엔드와의 API 계약
