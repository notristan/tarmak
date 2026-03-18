import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'node_modules/cesium/Build/Cesium/Workers', dest: 'cesium/' },
        { src: 'node_modules/cesium/Build/Cesium/Assets', dest: 'cesium/' },
        { src: 'node_modules/cesium/Build/Cesium/Widgets', dest: 'cesium/' },
        { src: 'node_modules/cesium/Build/Cesium/ThirdParty', dest: 'cesium/' },
      ],
    }),
  ],
  define: { CESIUM_BASE_URL: JSON.stringify('/cesium/') },
});