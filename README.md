# lhssh
A Simple Promise Wrapper for [[SSH2](https://github.com/mscdex/ssh2)].

## Requirements

* [node.js](http://nodejs.org/) -- v5.2.0 or newer
* [ssh2](https://www.npmjs.com/package/ssh2) -- 0.8.2 or newer

## Installation
    npm i lhssh
    
## Usage Examples

### Execute `uptime` on a server
```js
const LHSSH = require("lhssh");
const ssh = new LHSSH({
  host: '192.168.100.100',
  port: 22,
  username: 'teste',
  password: 'teste'
});

ssh.exec("uptime").then( ({ stdout, stderr, code, signal }) => {
  console.log("Uptime:", stdout);
}).catch( error => {
  console.log("Erro on Executing Uptime:", error);
});