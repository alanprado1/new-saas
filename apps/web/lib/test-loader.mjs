import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

// Load app modules in Node without a browser or Next's alias resolver.
export function loadAppModule(filename, overrides = {}, extraExports = "", cache = new Map()) {
  const root = path.resolve(import.meta.dirname, "..");
  const absolute = path.resolve(root, filename);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const loadedModule = { exports: {} };
  cache.set(absolute, loadedModule);
  const nativeRequire = createRequire(absolute);
  const require = (id) => {
    if (Object.hasOwn(overrides, id)) return overrides[id];
    if (id.startsWith("@/") || id.startsWith(".")) {
      const base = id.startsWith("@/") ? path.join(root, id.slice(2)) : path.resolve(path.dirname(absolute), id);
      const resolved = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
      if (resolved) return loadAppModule(resolved, overrides, "", cache);
    }
    return nativeRequire(id);
  };
  const source = fs.readFileSync(absolute, "utf8") + extraExports;
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2020 } }).outputText;
  new Function("require", "module", "exports", output)(require, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
