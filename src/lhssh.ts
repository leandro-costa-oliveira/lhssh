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
  private pendingPromises: Array<{ reject: (error: Error) => void }> = [];

  constructor(sshConfig: ConnectConfig) {
    this.sshConfig = sshConfig;
    this.conn = new Client();
    this.connected = false;
    this._read_handlers = {};
    this.pendingPromises = [];
    this.setupConnectionErrorHandlers();
  }

  private setupConnectionErrorHandlers(): void {
    this.conn.on("error", (error: Error) => {
      this.connected = false;
      this.rejectPendingPromises(error);
    });

    this.conn.on("end", () => {
      this.connected = false;
      this.rejectPendingPromises(new Error("CONEXÃO SSH ENCERRADA INESPERADAMENTE"));
    });

    this.conn.on("close", () => {
      this.connected = false;
      this.rejectPendingPromises(new Error("CONEXÃO SSH FECHADA INESPERADAMENTE"));
    });
  }

  private rejectPendingPromises(error: Error): void {
    const promises = [...this.pendingPromises];
    this.pendingPromises = [];
    promises.forEach((promise) => promise.reject(error));
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

  async exec(cmd: string): Promise<ExecResult> {
    if (!this.connected) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      let isResolved = false;

      // Adiciona esta promise à lista de promises pendentes
      const promiseHandler = {
        reject: (error: Error) => {
          if (!isResolved) {
            isResolved = true;
            reject(error);
          }
        },
      };
      this.pendingPromises.push(promiseHandler);

      // Verificação adicional se ainda está conectado
      if (!this.connected) {
        this.removePendingPromise(promiseHandler);
        return reject(new Error("CONEXÃO SSH PERDIDA ANTES DA EXECUÇÃO"));
      }

      this.conn.exec(cmd, (err: Error | undefined, stream: ClientChannel) => {
        if (err) {
          this.removePendingPromise(promiseHandler);
          return reject(err);
        }
        if (!stream) {
          this.removePendingPromise(promiseHandler);
          return reject(new Error(`LHSSH Exec Sem Stream`));
        }

        const handleSuccess = (code: number | null, signal: string | undefined) => {
          if (!isResolved) {
            isResolved = true;
            this.removePendingPromise(promiseHandler);
            resolve({ stdout, stderr, code, signal });
          }
        };

        const handleError = (error: Error) => {
          if (!isResolved) {
            isResolved = true;
            this.removePendingPromise(promiseHandler);
            reject(error);
          }
        };

        stream.on("close", handleSuccess);
        stream.on("exit", handleSuccess);
        stream.on("error", handleError);

        stream.on("data", (data: Buffer) => {
          stdout += data.toString();
        });

        stream.on("*", (...args: any) => {
          console.log("LHSSH Exec Unhandled Event:", args);
        });

        if (stream.stderr) {
          stream.stderr.on("data", (data: Buffer) => {
            stderr += data.toString();
          });

          stream.stderr.on("error", handleError);
        }
      });
    });
  }

  private removePendingPromise(promiseHandler: { reject: (error: Error) => void }): void {
    const index = this.pendingPromises.indexOf(promiseHandler);
    if (index > -1) {
      this.pendingPromises.splice(index, 1);
    }
  }

  addReadHandler(txt: string, callback: ReadHandler): void {
    this._read_handlers[txt] = callback;
  }

  shell(): Promise<LHSSH> {
    return new Promise((resolve, reject) => {
      const promiseHandler = { reject };
      this.pendingPromises.push(promiseHandler);

      this.conn.shell({}, (err: Error | undefined, stream: any) => {
        this.removePendingPromise(promiseHandler);

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
          })
          .on("error", (error: Error) => {
            this.connected = false;
            this.rejectPendingPromises(error);
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

      this.stream.write(txt + "\n", (error?: Error) => {
        if (error) {
          return reject(error);
        }

        if (readUntil) {
          console.log("## WRITE SENT:", txt, " WAITING FOR:", readUntil);
          return this.readUntil(readUntil)
            .then((ret: string) => {
              resolve(ret);
            })
            .catch(reject);
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
    this.connected = false;
    this.rejectPendingPromises(new Error("CONEXÃO SSH ENCERRADA PELO USUÁRIO"));
    this.conn.end();
  }

  close(): void {
    this.connected = false;
    this.rejectPendingPromises(new Error("CONEXÃO SSH FECHADA PELO USUÁRIO"));
    this.conn.end();
  }
}

export default LHSSH;
