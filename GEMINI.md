# GEMINI.md

## 💡 개발 원칙 (Core Principles)
1. **Language**: 모든 응답과 설명은 **한국어**로 진행한다. 단, 기술 용어(Technical Terms)나 고유 명사는 **영어**를 사용할 수 있다.
2. **Context First**: 코드 수정 전 `types/`와 `lib/` 등 공통 설정을 반드시 먼저 확인하여 일관성을 유지한다.
3. **Validation**: 변경 사항 적용 후에는 해당 기능이 다른 컴포넌트(Overview, TodaySheet, Progress 등)에 미치는 영향을 전수 체크한다.
4. **Minimalism**: 불필요한 코드나 주석은 지양하며, 기존 프로젝트의 프리미엄 에스테틱과 모듈화 원칙을 철저히 따른다.
5. **Intent Alignment**: 사용자의 질문(Inquiry)과 명령(Directive)을 엄격히 구분한다. 상태 확인이나 단순 질문을 실행 명령으로 자의적으로 해석하여 작업을 진행하지 않으며, 모호할 경우 반드시 확인 과정을 거친다.
