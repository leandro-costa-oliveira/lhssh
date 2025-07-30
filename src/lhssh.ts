import { Client, ClientChannel, ConnectConfig } from "ssh2";

interface ExecResult {
  stdout: string;
  stderr: string;
  code: number | null;
  signal: string | undefined;
}

type ReadHandler = () => void;

class LHSSH {
  private sshConfig: ConnectConfig;
  private conn: Client;
  private connected: boolean;
  private _read_handlers: Record<string, ReadHandler>;
  private buffer?: string;
  private stream?: any;
  private _read_until?: string;
  private _read_until_resolve?: (value: string) => void;

  constructor(sshConfig: ConnectConfig) {
    this.sshConfig = sshConfig;
    this.conn = new Client();
    this.connected = false;
    this._read_handlers = {};
  }

  connect(): Promise<LHSSH> {
    return new Promise((resolve, reject) => {
      this.conn
        .on("ready", () => {
          this.connected = true;
          resolve(this);
        })
        .on("error", (error: Error) => {
          reject(error);
        })
        .on("end", () => {
          if (!this.connected) {
            reject(new Error("CONEXÃO SSH REJEITADA"));
          }
          this.connected = false;
        })
        .on("close", () => {
          this.connected = false;
        })
        .connect(this.sshConfig);
    });
  }

  exec(cmd: string): Promise<ExecResult> {
    if (!this.connected) {
      return this.connect().then(() => {
        return this.exec(cmd);
      });
    }

    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";

      this.conn.exec(cmd, (err: Error | undefined, stream: ClientChannel) => {
        if (err) return reject(err);
        if (!stream) return reject(new Error(`LHSSH Exec Sem Stream`));

        stream.on("close", (code: number | null, signal: string | undefined) => {
          resolve({ stdout, stderr, code, signal });
        });

        stream.on("data", (data: Buffer) => {
          stdout += data.toString();
        });

        stream.on("exit", (code: number | null, signal: string | undefined) => {
          resolve({ stdout, stderr, code, signal });
        });

        if (stream.stderr) {
          stream.stderr.on("data", (data: Buffer) => {
            stderr += data.toString();
          });
        }
      });
    });
  }

  addReadHandler(txt: string, callback: ReadHandler): void {
    this._read_handlers[txt] = callback;
  }

  shell(): Promise<LHSSH> {
    return new Promise((resolve, reject) => {
      this.conn.shell({}, (err: Error | undefined, stream: any) => {
        if (err) return reject(err);

        this.buffer = "";
        this.stream = stream;

        stream
          .on("close", () => {
            this.close();
          })
          .on("data", (data: Buffer) => {
            this.buffer += data.toString();
            this.onData();
          });

        resolve(this);
      });
    });
  }

  write(txt: string, readUntil: string | null = null): Promise<LHSSH | string> {
    return new Promise((resolve, reject) => {
      if (!this.stream) {
        return reject(new Error("LHSSH: Acquire a shell first!"));
      }

      this.stream.write(txt + "\n", () => {
        if (readUntil) {
          console.log("## WRITE SENT:", txt, " WAITING FOR:", readUntil);
          return this.readUntil(readUntil).then((ret: string) => {
            resolve(ret);
          });
        }

        resolve(this);
      });
    });
  }

  readUntil(txt: string): Promise<string> {
    return new Promise((resolve) => {
      this._read_until = txt;
      this._read_until_resolve = resolve;
    });
  }

  private onData(): void {
    if (this._read_until && this.buffer && this.buffer.indexOf(this._read_until) !== -1) {
      const idx = this.buffer.indexOf(this._read_until) + this._read_until.length;
      const ret = this.buffer;
      this.buffer = this.buffer.substring(idx);

      this._read_until = undefined;
      if (this._read_until_resolve) {
        this._read_until_resolve(ret);
        this._read_until_resolve = undefined;
      }
    }

    if (this.buffer) {
      Object.keys(this._read_handlers).forEach((key: string) => {
        if (this.buffer && this.buffer.indexOf(key) !== -1) {
          this.buffer = this.buffer.replace(key, "");
          this._read_handlers[key]();
        }
      });
    }
  }

  end(): void {
    this.conn.end();
  }

  close(): void {
    this.conn.end();
  }
}

export default LHSSH;
