import { defineConfig } from 'astro/config';
import react from "@astrojs/react";
import tailwind from "tailwindcss";
import autoprefixer from "autoprefixer";

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  vite: {
    css: {
      postcss: {
        plugins: [
          tailwind(),
          autoprefixer(),
        ],
      },
    },
  },
});