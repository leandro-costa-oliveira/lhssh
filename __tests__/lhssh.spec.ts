import { Client } from "ssh2";
import LHSSH from "../src/lhssh";

// Mock do módulo ssh2
jest.mock("ssh2", () => {
  const mockClient = {
    on: jest.fn().mockReturnThis(),
    connect: jest.fn(),
    exec: jest.fn(),
    shell: jest.fn(),
    end: jest.fn(),
  };

  return {
    Client: jest.fn(() => mockClient),
  };
});

describe("LHSSH", () => {
  let lhssh: LHSSH;
  let mockClient: any;
  let sshConfig: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    sshConfig = {
      host: "test.example.com",
      port: 22,
      username: "teste-user",
      password: "test-pass",
    };

    lhssh = new LHSSH(sshConfig);
    mockClient = (lhssh as any).conn;
  });

  describe("constructor", () => {
    it("should create an instance with correct initial values", () => {
      expect(lhssh).toBeInstanceOf(LHSSH);
      expect((lhssh as any).sshConfig).toEqual(sshConfig);
      expect((lhssh as any).connected).toBe(false);
      expect((lhssh as any)._read_handlers).toEqual({});
    });

    it("should create a new SSH Client instance", () => {
      expect(Client).toHaveBeenCalled();
    });
  });

  describe("connect", () => {
    it("should resolve when connection is ready", async () => {
      // Simular que o evento 'ready' é disparado
      mockClient.on.mockImplementation((event: string, callback: Function) => {
        if (event === "ready") {
          setTimeout(() => callback(), 0);
        }
        return mockClient;
      });

      const result = await lhssh.connect();

      expect(result).toBe(lhssh);
      expect((lhssh as any).connected).toBe(true);
      expect(mockClient.connect).toHaveBeenCalledWith(sshConfig);
    });

    it("should reject when connection error occurs", async () => {
      const testError = new Error("Connection failed");

      mockClient.on.mockImplementation((event: string, callback: Function) => {
        if (event === "error") {
          setTimeout(() => callback(testError), 0);
        }
        return mockClient;
      });

      await expect(lhssh.connect()).rejects.toThrow("Connection failed");
      expect((lhssh as any).connected).toBe(false);
    });

    it("should set connected to false when connection closes", async () => {
      let closeCallback: Function | undefined;

      mockClient.on.mockImplementation((event: string, callback: Function) => {
        if (event === "ready") {
          setTimeout(() => callback(), 0);
        } else if (event === "close") {
          closeCallback = callback;
        }
        return mockClient;
      });

      await lhssh.connect();
      expect((lhssh as any).connected).toBe(true);

      // Simular evento de close
      if (closeCallback) {
        closeCallback(false);
      }
      expect((lhssh as any).connected).toBe(false);
    });
  });

  describe("exec", () => {
    beforeEach(() => {
      (lhssh as any).connected = true;
    });

    it("should execute command successfully", async () => {
      const mockStream = {
        on: jest.fn().mockReturnThis(),
        stderr: {
          on: jest.fn(),
        },
      };

      const expectedResult = {
        stdout: "test output",
        stderr: "test error",
        code: 0,
        signal: undefined,
      };

      mockClient.exec.mockImplementation((cmd: string, callback: Function) => {
        callback(null, mockStream);

        // Simular dados chegando
        setTimeout(() => {
          const dataCallback = mockStream.on.mock.calls.find((call) => call[0] === "data")[1];
          const closeCallback = mockStream.on.mock.calls.find((call) => call[0] === "close")[1];
          const stderrCallback = mockStream.stderr.on.mock.calls.find((call) => call[0] === "data")[1];

          dataCallback(Buffer.from("test output"));
          stderrCallback(Buffer.from("test error"));
          closeCallback(0, undefined);
        }, 0);
      });

      const result = await lhssh.exec("test command");

      expect(result).toEqual(expectedResult);
      expect(mockClient.exec).toHaveBeenCalledWith("test command", expect.any(Function));
    });

    it("should reject when exec returns error", async () => {
      const testError = new Error("Exec failed");

      mockClient.exec.mockImplementation((cmd: string, callback: Function) => {
        callback(testError, null);
      });

      await expect(lhssh.exec("test command")).rejects.toThrow("Exec failed");
    });
  });

  describe("addReadHandler", () => {
    it("should add read handler correctly", () => {
      const handler = jest.fn();

      lhssh.addReadHandler("test", handler);

      expect((lhssh as any)._read_handlers["test"]).toBe(handler);
    });
  });

  describe("shell", () => {
    it("should open shell successfully", async () => {
      const mockStream = {
        on: jest.fn().mockReturnThis(),
        write: jest.fn(),
      };

      mockClient.shell.mockImplementation((options: any, callback: Function) => {
        callback(null, mockStream);
      });

      const result = await lhssh.shell();

      expect(result).toBe(lhssh);
      expect((lhssh as any).stream).toBe(mockStream);
      expect((lhssh as any).buffer).toBe("");
      expect(mockClient.shell).toHaveBeenCalledWith({}, expect.any(Function));
    });

    it("should reject when shell returns error", async () => {
      const testError = new Error("Shell failed");

      mockClient.shell.mockImplementation((options: any, callback: Function) => {
        callback(testError, null);
      });

      await expect(lhssh.shell()).rejects.toThrow("Shell failed");
    });

    it("should handle stream data events", async () => {
      const mockStream = {
        on: jest.fn().mockReturnThis(),
        write: jest.fn(),
      };

      let dataCallback: Function | undefined;
      mockStream.on.mockImplementation((event: string, callback: Function) => {
        if (event === "data") {
          dataCallback = callback;
        }
        return mockStream;
      });

      mockClient.shell.mockImplementation((options: any, callback: Function) => {
        callback(null, mockStream);
      });

      const onDataSpy = jest.spyOn(lhssh as any, "onData");

      await lhssh.shell();

      // Simular dados chegando
      if (dataCallback) {
        dataCallback(Buffer.from("test data"));
      }

      expect((lhssh as any).buffer).toBe("test data");
      expect(onDataSpy).toHaveBeenCalled();
    });
  });

  describe("write", () => {
    let mockStream: any;

    beforeEach(async () => {
      mockStream = {
        on: jest.fn().mockReturnThis(),
        write: jest.fn(),
      };

      mockClient.shell.mockImplementation((options: any, callback: Function) => {
        callback(null, mockStream);
      });

      await lhssh.shell();
    });

    it("should write to stream successfully", async () => {
      mockStream.write.mockImplementation((data: string, callback: Function) => {
        callback();
      });

      const result = await lhssh.write("test command");

      expect(result).toBe(lhssh);
      expect(mockStream.write).toHaveBeenCalledWith("test command\n", expect.any(Function));
    });

    it("should wait for readUntil when specified", async () => {
      const readUntilSpy = jest.spyOn(lhssh, "readUntil").mockResolvedValue("response");

      mockStream.write.mockImplementation((data: string, callback: Function) => {
        callback();
      });

      const result = await lhssh.write("test command", "prompt>");

      expect(result).toBe("response");
      expect(readUntilSpy).toHaveBeenCalledWith("prompt>");
    });
  });

  describe("readUntil", () => {
    it("should set up read until promise", () => {
      const promise = lhssh.readUntil("test string");

      expect(promise).toBeInstanceOf(Promise);
      expect((lhssh as any)._read_until).toBe("test string");
      expect((lhssh as any)._read_until_resolve).toBeInstanceOf(Function);
    });
  });

  describe("onData", () => {
    beforeEach(() => {
      (lhssh as any).buffer = "";
    });

    it("should trigger read handlers when text is found", () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      (lhssh as any)._read_handlers = {
        error: handler1,
        warning: handler2,
      };
      (lhssh as any).buffer = "some error occurred";

      (lhssh as any).onData();

      expect(handler1).toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
      expect((lhssh as any).buffer).toBe("some  occurred");
    });
  });

  describe("end and close", () => {
    it("should call conn.end() when end() is called", () => {
      lhssh.end();
      expect(mockClient.end).toHaveBeenCalled();
    });

    it("should call conn.end() when close() is called", () => {
      lhssh.close();
      expect(mockClient.end).toHaveBeenCalled();
    });
  });
});
