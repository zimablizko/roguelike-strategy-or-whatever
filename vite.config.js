import { defineConfig } from 'vite'

// Get repository name from package.json or environment
const repoName = process.env.REPO_NAME || 'roguelike-strategy-or-whatever';

export default defineConfig({
  base: process.env.GITHUB_PAGES ? `/${repoName}/` : '/',
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
    outDir: 'dist',
  },
})
