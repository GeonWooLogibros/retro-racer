import { defineConfig } from 'vitest/config';

export default defineConfig({
  // 공개 사이트를 GitHub Pages처럼 하위 경로에 올려도 파일을 찾을 수 있게 상대 경로를 씁니다.
  base: './',
  build: {
    // 에셋 이미지를 스크립트 안에 넣어서, 빌드 결과를 파일 하나로 합쳐도 그림이 보이게 합니다.
    assetsInlineLimit: 256 * 1024,
  },
  test: {
    // 맵마다 경주를 끝까지 시뮬레이션하는 테스트가 있어서, 여럿이 한꺼번에 돌 때를 생각해 넉넉히 둡니다.
    testTimeout: 30000,
  },
});
