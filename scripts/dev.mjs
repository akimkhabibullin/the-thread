// Starts the bridge (MCP + live UI link) and the web app together. Ctrl+C stops both.
import {spawn} from 'node:child_process';
const run = (cmd, args) => spawn(cmd, args, {stdio: 'inherit', shell: false});
const kids = [run('npx', ['tsx', 'watch', '--env-file-if-exists=.env', 'server/index.ts']), run('npx', ['vite'])];
const stop = () => { for (const k of kids) k.kill('SIGTERM'); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
