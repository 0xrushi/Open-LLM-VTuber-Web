import { defineConfig, normalizePath } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react-swc';

const createConfig = async (outDir: string) => ({
  plugins: [
    (await import('vite-plugin-static-copy')).viteStaticCopy({
      targets: [
        {
          src: normalizePath(path.resolve(__dirname, 'node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js')),
          dest: './libs/',
        },
        {
          src: normalizePath(path.resolve(__dirname, 'node_modules/@ricky0123/vad-web/dist/silero_vad_v5.onnx')),
          dest: './libs/',
        },
        {
          src: normalizePath(path.resolve(__dirname, 'node_modules/@ricky0123/vad-web/dist/silero_vad_legacy.onnx')),
          dest: './libs/',
        },
        {
          src: normalizePath(path.resolve(__dirname, 'node_modules/onnxruntime-web/dist/*.wasm')),
          dest: './libs/',
        },
        {
          src: normalizePath(path.resolve(__dirname, 'src/renderer/WebSDK/Core/live2dcubismcore.js')),
          dest: './libs/',
        },
      ],
    }),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/renderer/src"),
      "@framework": path.resolve(__dirname, "./src/renderer/WebSDK/Framework/src"),
      "@cubismsdksamples": path.resolve(__dirname, "./src/renderer/WebSDK/src"),
      "@motionsyncframework": path.resolve(
        __dirname,
        "./src/renderer/MotionSync/Framework/src",
      ),
      "@motionsync": path.resolve(__dirname, "./src/renderer/MotionSync/src"),
      "/src": path.resolve(__dirname, "./src/renderer/src"),
    },
  },
  root: path.join(__dirname, "src/renderer"),
  publicDir: path.join(__dirname, "src/renderer/public"),
  base: "./",
  server: {
    port: 3000,
    proxy: {
      '/models': {
        target: 'http://127.0.0.1:12393',
        changeOrigin: true,
      },
      // Also proxy the video file cache if needed
      '/cache': {
        target: 'http://127.0.0.1:12393',
        changeOrigin: true,
      },
      // Proxy websocket for standalone viewer if it uses relative path
      '/ws': {
        target: 'ws://127.0.0.1:12393',
        ws: true,
      }
    }
  },
  build: {
    outDir: path.join(__dirname, outDir),
    // In web mode we build into the backend-served `../frontend` directory.
    // That directory also contains user-provided assets like `frontend/models`,
    // so we must not wipe it on each build.
    emptyOutDir: outDir !== '../frontend',
    assetsDir: "assets",
    rollupOptions: {
      input: {
        main: path.join(__dirname, "src/renderer/index.html"),
      },
    },
  },
  ssr: {
    noExternal: ['vite-plugin-static-copy'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});

export default defineConfig(async ({ mode }) => {
  if (mode === 'web') {
    // For web mode, output directly into the backend's `frontend` directory
    // so the Python server can serve the built assets without manual copying.
    return createConfig('../frontend');
  }
  return createConfig('dist/renderer');
});
