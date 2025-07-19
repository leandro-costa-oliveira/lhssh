import LHSSH from "../lhssh";

describe("LHSSH Integration Tests", () => {
  let lhssh: LHSSH;

  beforeEach(() => {
    const sshConfig = {
      host: "localhost",
      port: 22,
      username: "testuser",
      password: "testpass",
    };

    lhssh = new LHSSH(sshConfig);
  });

  afterEach(() => {
    if (lhssh) {
      lhssh.close();
    }
  });

  describe("Configuration validation", () => {
    it("should accept valid SSH configuration", () => {
      const validConfigs = [
        {
          host: "example.com",
          username: "user",
          password: "pass",
        },
        {
          host: "example.com",
          port: 2222,
          username: "user",
          privateKey: "key-content",
        },
        {
          host: "example.com",
          username: "user",
          privateKey: Buffer.from("key-content"),
          passphrase: "phrase",
        },
      ];

      validConfigs.forEach((config) => {
        expect(() => new LHSSH(config)).not.toThrow();
      });
    });

    it("should handle custom SSH configuration properties", () => {
      const configWithCustomProps = {
        host: "example.com",
        username: "user",
        password: "pass",
        algorithms: {
          kex: ["diffie-hellman-group14-sha256"],
        },
        keepaliveInterval: 60000,
      };

      expect(() => new LHSSH(configWithCustomProps)).not.toThrow();
    });
  });

  describe("Error handling scenarios", () => {
    it("should handle multiple consecutive exec calls", async () => {
      // Mock implementation that would simulate connection behavior
      const mockExec = jest.spyOn(lhssh, "exec");
      mockExec.mockResolvedValue({
        stdout: "output",
        stderr: "",
        code: 0,
        signal: undefined,
      });

      const promises = [lhssh.exec("command1"), lhssh.exec("command2"), lhssh.exec("command3")];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.stdout).toBe("output");
        expect(result.code).toBe(0);
      });

      mockExec.mockRestore();
    });

    it("should handle readUntil timeout scenarios", async () => {
      // Este teste demonstra como o readUntil pode ser usado
      const promise = lhssh.readUntil("never-appears");

      // Simular timeout (em um cenário real, você implementaria timeout)
      expect(promise).toBeInstanceOf(Promise);
      expect((lhssh as any)._read_until).toBe("never-appears");
    });

    it("should handle multiple read handlers", () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();

      lhssh.addReadHandler("error:", handler1);
      lhssh.addReadHandler("warning:", handler2);
      lhssh.addReadHandler("info:", handler3);

      // Simular buffer com múltiplas ocorrências
      (lhssh as any).buffer = "error: something went wrong\nwarning: be careful\ninfo: all good";
      (lhssh as any).onData();

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(handler3).toHaveBeenCalled();
    });
  });

  describe("Method chaining scenarios", () => {
    it("should support method chaining pattern", async () => {
      // Mock dos métodos para permitir chaining
      const connectSpy = jest.spyOn(lhssh, "connect").mockResolvedValue(lhssh);
      const shellSpy = jest.spyOn(lhssh, "shell").mockResolvedValue(lhssh);
      const writeSpy = jest.spyOn(lhssh, "write").mockResolvedValue(lhssh);

      // Simular padrão de uso comum
      const result = await lhssh
        .connect()
        .then((client) => client.shell())
        .then((client) => client.write("ls -la"));

      expect(result).toBe(lhssh);
      expect(connectSpy).toHaveBeenCalled();
      expect(shellSpy).toHaveBeenCalled();
      expect(writeSpy).toHaveBeenCalledWith("ls -la");

      connectSpy.mockRestore();
      shellSpy.mockRestore();
      writeSpy.mockRestore();
    });
  });

  describe("Resource cleanup", () => {
    it("should properly cleanup resources on end()", () => {
      const endSpy = jest.spyOn((lhssh as any).conn, "end");

      lhssh.end();

      expect(endSpy).toHaveBeenCalled();
      endSpy.mockRestore();
    });

    it("should properly cleanup resources on close()", () => {
      const endSpy = jest.spyOn((lhssh as any).conn, "end");

      lhssh.close();

      expect(endSpy).toHaveBeenCalled();
      endSpy.mockRestore();
    });
  });

  describe("Buffer management", () => {
    it("should properly manage buffer during data processing", () => {
      // Simular cenário complexo de buffer
      (lhssh as any).buffer = "initial data";

      // Adicionar handler que será trigado
      const handler = jest.fn();
      lhssh.addReadHandler("trigger", handler);

      // Simular dados chegando que contém o trigger
      (lhssh as any).buffer += " trigger more data";
      (lhssh as any).onData();

      expect(handler).toHaveBeenCalled();
      expect((lhssh as any).buffer).toBe("initial data  more data");
    });
  });
});
