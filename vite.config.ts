import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { createAssistantHandler } from './scripts/assistant.mjs';
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'local-scenario-api',
      configureServer(server) {
        const assistant = createAssistantHandler();
        server.middlewares.use((req, res, next) => {
          const address = server.httpServer?.address();
          if (!address || typeof address === 'string') return next();
          void assistant(req, res, address.port)
            .then((handled) => {
              if (!handled) next();
            })
            .catch(next);
        });
      },
    },
  ],
  test: { include: ['src/**/*.test.ts'] },
});
