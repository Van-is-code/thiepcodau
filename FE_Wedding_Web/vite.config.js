import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    // Bind mount qua Docker Desktop (Windows/Mac) không phát sự kiện file-system đáng
    // tin cậy — không có usePolling thì sửa code xong HMR sẽ không tự cập nhật.
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  }
})
