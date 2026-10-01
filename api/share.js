import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createSharePage } from '../server/share-page.js';
import { nodeHandler } from '../server/adapter.js';

export default nodeHandler(createSharePage(() => readFile(join(process.cwd(), 'dist/index.html'), 'utf8')));
