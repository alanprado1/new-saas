// One reproducible offline entrypoint; each group reads retained local occurrence metadata.
import path from 'node:path';
import {execFileSync} from 'node:child_process';
for(const group of ['taste','emphasis','rail'])execFileSync(process.execPath,[path.join(import.meta.dirname,`assemble-busuu-chapter-six-${group}.mjs`),...process.argv.slice(2)],{stdio:'inherit'});
