const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json')));
const page = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
const server = fs.readFileSync(path.join(root, 'src/server.js'), 'utf8');

assert.equal(packageJson.name, 'testbench');
assert.match(packageJson.scripts.test, /tests\/e2e\.js/);
assert.match(page, /<h1>Testbench<\/h1>/);
assert.match(page, /id="run"/);
assert.match(server, /createServer/);
console.log('static checks passed');
