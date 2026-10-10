// SessionStart (compact|clear): re-inject the project state so work continues after compaction or /clear.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const stateFile = join(root, '.projetmemory', 'state.md');
if (!existsSync(stateFile)) process.exit(0);

const text = readFileSync(stateFile, 'utf8');
const [main, snaps = ''] = text.split('## Snapshots auto');
const lastSnap = snaps.split('\n### ').slice(1).pop();
const out = main.trim() + (lastSnap ? '\n\n## Dernier snapshot\n### ' + lastSnap.trim() : '');
process.stdout.write('[.projetmemory/state.md]\n' + out.slice(0, 6000));
