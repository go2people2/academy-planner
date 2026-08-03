# 🚀 학원 원내 로컬 파일/미디어 서빙 전용 서버 프로그램 개발 지시서

## 1. 개요 및 목적
- **목적**: 학원 내부 와이파이(LAN)망에서 맥미니(Mac mini)를 로컬 미디어 서버로 구동하여, 학원 일지/플래너 웹 앱에서 대용량 교재 PDF 및 해설 동영상(MP4/MOV)을 0.1초 만에 고속 서빙하는 독립 패키지 프로그램을 제작합니다.

## 2. 필수 요구사항 사양

### 1) 기술 스택
- **백엔드 프레임워크**: Python (FastAPI / Uvicorn) + CORS 전면 허용
- **맥OS 트레이 UI**: `rumps` (맥OS 상단 Menu Bar 트레이 아이콘 및 메뉴 지원)
- **패키징 도구**: `PyInstaller` (독립 실행형 맥 `.app` 번들 빌드)

### 2) 대상 폴더 구조 (기본 설정)
- **루트 경로**: `~/Documents/AcademyMedia/` (맥미니 사용자 문서 폴더)
- **하위 폴더**:
  - `~/Documents/AcademyMedia/pdf/` (PDF 교재 및 해설지 파일 저장소)
  - `~/Documents/AcademyMedia/video/` (MP4, MOV, WebM 동영상 파일 저장소)
- *특이사항*: 해당 폴더가 존재하지 않을 경우, 프로그램 최초 실행 시 자동 생성되도록 작성합니다.

### 3) 핵심 스트리밍 서빙 기능 (`HTTP Range Request`)
- 동영상 재생 시 **0.001초 타임스탬프 스킵 탐색(예: `#t=03m12s` 또는 `currentTime = 92`)** 및 부분 로딩이 가능하도록 `Range` 요청 헤더를 정밀 처리하는 정적 파일 스트리밍 엔드포인트를 구축합니다.
- 웹 앱 브라우저에서 스크립트 차단 없이 재생되도록 **CORS(Cross-Origin Resource Sharing)**를 전면 허용합니다.

### 4) 사용자 경험(UI) 및 시각화 (Menu Bar Tray)
- 프로그램이 구동되면 맥 상단 **메뉴바(Menu Bar) 트레이**에 전용 아이콘(📗)이 표시됩니다.
- **메뉴 구성**:
  - `● 서버 가동 중 (포트: 8080)`
  - 📂 `공유 폴더 열기 (Documents/AcademyMedia)`
  - 📋 `로컬 서버 IP 주소 복사`
  - ❌ `서버 종료`

## 3. 최종 산출물 및 전달 파일
1. 파이썬 소스 코드 (`main.py`)
2. 필요한 의존성 파일 (`requirements.txt`)
3. `PyInstaller` 빌드 스크립트 및 맥 전용 번들 앱(`AcademyMediaServer.app`) 생성 실행 가이드
