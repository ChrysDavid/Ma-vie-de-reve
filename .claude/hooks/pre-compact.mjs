// PreCompact: append a timestamped snapshot to .projetmemory/state.md before compaction.
import { readFileSync, appendFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execSync } from 'node:child_process';

let input = {};
try { input = JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch {}

const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
const stateFile = join(root, '.projetmemory', 'state.md');
const SKIP = new Set(['node_modules', '.git', 'dist', 'public', '.projetmemory']);
const since = Date.now() - 3 * 3600 * 1000;

function recentFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const p = join(dir, name);
    let s; try { s = statSync(p); } catch { continue; }
    if (s.isDirectory()) recentFiles(p, out);
    else if (s.mtimeMs > since) out.push(relative(root, p).replaceAll('\\', '/'));
    if (out.length >= 15) break;
  }
  return out;
}

function fromTranscript(path) {
  const res = { lastPrompt: '', todos: [] };
  if (!path || !existsSync(path)) return res;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    let e; try { e = JSON.parse(line); } catch { continue; }
    const content = e?.message?.content;
    if (e.type === 'user' && typeof content === 'string') res.lastPrompt = content;
    if (Array.isArray(content)) for (const c of content) {
      if (e.type === 'user' && c.type === 'text') res.lastPrompt = c.text;
      if (c.type === 'tool_use' && c.name === 'TodoWrite' && c.input?.todos) res.todos = c.input.todos;
    }
  }
  return res;
}

let git = '';
try { git = execSync('git status --short', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().split('\n').slice(0, 15).join('\n'); } catch {}

const { lastPrompt, todos } = fromTranscript(input.transcript_path);
const files = recentFiles(root);
const lines = [
  '', `### ${new Date().toISOString().slice(0, 16)} — compaction ${input.trigger || ''}`.trimEnd(),
  lastPrompt && `- Dernière demande : ${lastPrompt.replace(/\s+/g, ' ').slice(0, 300)}`,
  todos.length && '- Todos :\n' + todos.map(t => `  - [${t.status === 'completed' ? 'x' : ' '}] ${t.content}`).join('\n'),
  files.length && `- Fichiers modifiés (<3h) : ${files.join(', ')}`,
  git && '- git status :\n```\n' + git + '\n```',
].filter(Boolean);

if (existsSync(stateFile)) appendFileSync(stateFile, lines.join('\n') + '\n');
