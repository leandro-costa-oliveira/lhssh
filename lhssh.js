const SSHClient = require('ssh2').Client;

class LHSSH {
    constructor(sshConfig){
        this.sshConfig = sshConfig;
        this.conn = new SSHClient();
        this.connected = false;
    }

    connect() { 
        return new Promise( (resolve, reject) => {
            this.conn.on('ready', ()=>{
                this.connected = true;
                resolve(this);
            }).connect(this.sshConfig);
        });
    }

    exec( cmd ) {
        if(!this.connected) {
            return this.connect().then( () => {
                return this.exec(cmd);
            });
        }

        return new Promise( (resolve, reject) => {
            let stdout = "";
            let stderr = "";

            this.conn.exec(cmd, function(err, stream) {
                if (err) reject(err);

                stream.on('close', function(code, signal) {
                    resolve({ stdout, stderr, code, signal });
                }).on('data', function(data) {
                    stdout += data;
                }).stderr.on('data', function(data) {
                    stderr += data;
                });
            });
        });
    }

    close(){
        this.conn.end();
    }
}

module.exports = LHSSH;