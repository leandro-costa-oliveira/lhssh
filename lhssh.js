const SSHClient = require('ssh2').Client;

class LHSSH {
    constructor(sshConfig){
        this.sshConfig = sshConfig;
        this.conn = new SSHClient();
        this.connected = false;
        // this.debug = false;
    }

    connect() { 
        return new Promise( (resolve, reject) => {
            this.conn.on('ready', ()=>{
                this.connected = true;
                // if(this.debug) console.log("## CONNECTION ESTABLISHED");
                resolve(this);
            }).on('error', error => {
                // if(this.debug) console.log("## CONNECTION ERROR:", error);
                reject(error);
            }).on('end', () => {
                if(!this.connected) {
                    reject("CONEXÃO SSH REJEITADA");
                }
                this.connected = false;
            }).on('close', temErro => {
                // if(this.debug) console.log("## CONNECTION CLOSED", temErro ? "COM ERROR" : "");
                this.connected = false;
            })
            .connect(this.sshConfig);
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

            // if(this.debug) console.log("## EXEC:" , cmd);
            this.conn.exec(cmd, function(err, stream) {
                if (err) reject(err);

                stream.on('close', function(code, signal) {
                    // if(this.debug) console.log("## STREAM CLOSE:" , code, signal);
                    resolve({ stdout, stderr, code, signal });
                }).on('data', function(data) {
                    // if(this.debug) console.log("## STREAM STDOUT:" , data);
                    stdout += data;
                }).stderr.on('data', function(data) {
                    // if(this.debug) console.log("## STREAM STDERR:" , data);
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