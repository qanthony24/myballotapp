import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

function processEnvPlugin(replacements: Record<string, string>): Plugin {
  const sorted = Object.entries(replacements).sort(
    ([a], [b]) => b.length - a.length,
  );
  return {
    name: 'process-env-define',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('node_modules')) return;
      let result = code;
      for (const [key, value] of sorted) {
        result = result.split(key).join(value);
      }
      return result !== code ? result : undefined;
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const processEnvDefines: Record<string, string> = {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.UI_REFRESH': JSON.stringify(env.UI_REFRESH ?? 'true'),
    };
    return {
      plugins: [
        processEnvPlugin(processEnvDefines),
        VitePWA({
          registerType: 'autoUpdate',
          workbox: {
            globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
                handler: 'CacheFirst',
                options: { cacheName: 'google-fonts', expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 } },
              },
              {
                urlPattern: /^https:\/\/randomuser\.me\/.*/i,
                handler: 'CacheFirst',
                options: { cacheName: 'avatar-images', expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 } },
              },
              {
                urlPattern: /^https:\/\/picsum\.photos\/.*/i,
                handler: 'CacheFirst',
                options: { cacheName: 'placeholder-images', expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 } },
              },
            ],
          },
          manifest: false,
        }),
      ],
      define: processEnvDefines,
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
