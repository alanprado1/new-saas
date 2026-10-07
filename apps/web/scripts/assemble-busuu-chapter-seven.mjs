// Deterministic offline authoring; retained raw evidence and released versions stay immutable.
import path from 'node:path';
import {execFileSync} from 'node:child_process';
for(const group of ['creation','recommendation','wondering'])execFileSync(process.execPath,[path.join(import.meta.dirname,`assemble-busuu-chapter-seven-${group}.mjs`),...process.argv.slice(2)],{stdio:'inherit'});
