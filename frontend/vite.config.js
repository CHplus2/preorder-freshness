/* global process */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import {execFileSync} from 'node:child_process'

function buildRevision() {
  const supplied = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA;
  if (supplied && /^[a-f0-9]{7,40}$/i.test(supplied)) return supplied.slice(0, 7);
  try { return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim(); }
  catch { return 'development'; }
}

// https://vite.dev/config/
export default defineConfig(({command}) => ({
  base: command === "build" ? "/static/" : "/",
  plugins: [react()],
  define: {__FRESHCAST_REVISION__: JSON.stringify(buildRevision())},
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
}))
