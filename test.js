const LHSSH = require('./lhssh');

const host = process.argv[2];
const port = process.argv[3];
const username = process.argv[4];
const password = process.argv[5];
const cmd      = process.argv[6];
const debug    = false;

console.log("#".repeat(80));
console.log("## LHSSH TEST", host, port, username, password);
const ssh = new LHSSH({ host, port, username, password });

console.log("## EXEC: ", cmd);
ssh.exec(cmd).then( data => {
    console.log("STDOUT:", data.stdout);
    console.log("DATA:",data);
    ssh.close();
}).then( _ => {
    console.log("## DONE");
}).catch( error => {
    console.log("## CMD ERROR:", error);
});