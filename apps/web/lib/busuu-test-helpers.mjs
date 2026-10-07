import fs from 'node:fs';
import { loadAppModule } from './test-loader.mjs';

export function loadCourseModule(filename, extraOverrides = {}) {
  const overrides = Object.fromEntries(fs.readdirSync(new URL('../content/busuu/', import.meta.url)).filter(name => name.endsWith('.json')).map(name =>
    [`@/content/busuu/${name}`, JSON.parse(fs.readFileSync(new URL(`../content/busuu/${name}`, import.meta.url)))]));
  return loadAppModule(filename, { ...overrides, '@/app/busuu/runner.module.css': { __esModule: true, default: {} }, ...extraOverrides });
}
