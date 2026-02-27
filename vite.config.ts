import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';

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
      plugins: [processEnvPlugin(processEnvDefines)],
      define: processEnvDefines,
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
