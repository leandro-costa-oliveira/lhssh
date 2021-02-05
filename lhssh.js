const SSHClient = require('ssh2').Client;

class LHSSH {
    constructor(sshConfig){
        this.sshConfig = sshConfig;
        this.conn = new SSHClient();
        this.connected = false;
        // this.debug = false;
        this._read_handlers = {};
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
                if(!stream) reject(`LHSSH Exec Sem Stream`);

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

    addReadHandler(txt, callback) {
        this._read_handlers[txt] = callback;
    }

    shell() {
        const $this = this;

        return new Promise((resolve, reject) => {
            this.conn.shell({}, (err, stream) => {
                if(err) return reject(err);
        
                $this.buffer = "";
                $this.stream = stream;

                stream.on('close', function() {
                    $this.close();
                }).on('data', function(data) {
                    $this.buffer += data.toString();
                    $this.onData();
                });

                resolve(this);
            });
        });
    }

    write(txt, readUntil=null) {
        if(!this.stream) {
            throw new Error("acquire a shell frist !");
        }

        return new Promise((resolve, reject) => {
            this.stream.write(txt + '\n', () => {
                if(readUntil) {
                    console.log("## WRITE SENT:", txt, " WAITING FOR:", readUntil);
                    return this.readUntil(readUntil).then( ret => {
                        resolve(ret);
                    });
                }

                resolve(this);
            });
        });
    }

    readUntil(txt) {
        return new Promise((resolve, reject)=>{
            this._read_until = txt;
            this._read_until_resolve = resolve;
        });
    }

    onData(){
        if(this._read_until && this.buffer.indexOf(this._read_until) !==-1) {
            const idx = this.buffer.indexOf(this._read_until) + (""+this._read_until).length;
            const ret = this.buffer;
            this.buffer = this.buffer.substring(idx);

            this._read_until = null;
            this._read_until_resolve(ret);
        }

        Object.keys(this._read_handlers).forEach( key => {
            if(this.buffer.indexOf(key) !==-1) {
                this.buffer = this.buffer.replace(key, "");
                this._read_handlers[key]();
            }
        });
    }

    end(){
        this.conn.end();
    }

    close(){
        this.conn.end();
    }
}

module.exports = LHSSH;