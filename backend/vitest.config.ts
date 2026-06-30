import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.{test,spec}.{ts,js,mjs,cjs}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['src/**/*.js'],
      exclude: [
        'src/**/*.d.ts',
        // 服务器 bootstrap：靠 dev/start 跑，不写单测
        'src/index.js',
        // 第三方 API 同步：依赖网络，按需测
        'src/ai-usage/sync.js',
        // ai-usage store：依赖文件系统，单独集成测试覆盖
        'src/ai-usage/store.js'
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70
      }
    }
  }
});