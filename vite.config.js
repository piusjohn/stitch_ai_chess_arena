import { defineConfig, loadEnv } from 'vite';
import { handleCoachRequest } from './server/coach.js';

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [{
      name: 'ai-coach-api',
      configureServer(server) {
        server.middlewares.use('/api/coach', (request, response) => {
          handleCoachRequest(request, response, environment.GEMINI_API_KEY);
        });
      },
      configurePreviewServer(server) {
        server.middlewares.use('/api/coach', (request, response) => {
          handleCoachRequest(request, response, environment.GEMINI_API_KEY);
        });
      },
    }],
  };
});
