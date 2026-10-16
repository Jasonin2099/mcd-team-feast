#!/usr/bin/env node
import { run } from '../src/app.js';
run(process.argv.slice(2)).catch(e => { console.error('❌ ' + e.message); process.exit(1); });
