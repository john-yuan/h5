const path = require('path');
const colors = require('colors');
const express = require('express');
const projectName = path.basename(path.resolve(__dirname, '..'));
const appRoot = path.resolve(__dirname, '../app');
const distRoot = path.resolve(__dirname, '../dist', projectName);
const appPort = process.argv[2] || 8081;
const distPort = process.argv[3] || 8082;
const appServer = express();
const distServer = express();

appServer.use(express.static(appRoot)).listen(appPort);
distServer.use(express.static(distRoot)).listen(distPort);

console.info(colors.yellow(' App-Directroy: ') + colors.green(`${appRoot}`));
console.info(colors.yellow('Dist-Directroy: ') + colors.green(`${distRoot}`));
console.info(colors.yellow('    App-Server: ') + colors.green(`http://127.0.0.1:${appPort}/`));
console.info(colors.yellow('   Dist-Server: ') + colors.green(`http://127.0.0.1:${distPort}/`));
