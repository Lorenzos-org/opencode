import { afterEach, describe, expect, test, mock } from "bun:test";

// Use a factory to create a fresh module instance for each test
const createCommandModule = async (mockConfig) => {
  mock.module("../src/config/config", () => ({
    Config: {
      get: async () => mockConfig,
    },
  }));
  mock.module("../src/project/instance", async () => {
    const { State } = await import("../src/project/state");
    const context = {
      directory: `/mock/directory/${Math.random()}`,
      worktree: "/mock/worktree",
    };
    return {
      Instance: {
        get directory() {
          return context.directory;
        },
        get worktree() {
          return context.worktree;
        },
        state: (init, dispose) => State.create(() => context.directory, init, dispose),
        dispose: async () => {
          await State.dispose(context.directory);
        },
        provide: async ({ fn }) => fn(),
      },
    };
  });
  return await import("../src/command");
};

describe("Command", () => {
  test("list() should return default commands when config is empty", async () => {
    const { Command } = await createCommandModule({ command: {} });
    const commands = await Command.list();
    expect(commands.length).toBe(2);
    expect(commands.map((c) => c.name)).toContain("init");
    expect(commands.map((c) => c.name)).toContain("review");
  });

  test("get('init') should return the default init command", async () => {
    const { Command } = await createCommandModule({ command: {} });
    const command = await Command.get("init");
    expect(command).toBeDefined();
    expect(command.name).toBe("init");
    expect(command.description).toBe("create/update AGENTS.md");
  });

  test("list() should include commands from config", async () => {
    const { Command } = await createCommandModule({
      command: {
        custom: {
          template: "custom template",
        },
      },
    });
    const commands = await Command.list();
    expect(commands.length).toBe(3);
    expect(commands.map((c) => c.name)).toContain("custom");
  });

  test("get('custom') should return the custom command from config", async () => {
    const { Command } = await createCommandModule({
      command: {
        custom: {
          template: "custom template",
          description: "my custom command",
        },
      },
    });
    const command = await Command.get("custom");
    expect(command).toBeDefined();
    expect(command.name).toBe("custom");
    expect(command.template).toBe("custom template");
    expect(command.description).toBe("my custom command");
  });

  test("get() for a non-existent command should return undefined", async () => {
    const { Command } = await createCommandModule({ command: {} });
    const command = await Command.get("non-existent-command");
    expect(command).toBeUndefined();
  });

  test("list() should correctly merge default and custom commands", async () => {
    const { Command } = await createCommandModule({
      command: {
        another: { template: "another one" },
        test: { template: "testing" },
      },
    });
    const commands = await Command.list();
    const commandNames = commands.map((c) => c.name);

    expect(commands.length).toBe(4);
    expect(commandNames).toContain("init");
    expect(commandNames).toContain("review");
    expect(commandNames).toContain("another");
    expect(commandNames).toContain("test");
  });

  test("template should replace ${path} with Instance.worktree", async () => {
    const { Command } = await createCommandModule({ command: {} });
    const initCommand = await Command.get("init");
    expect(initCommand.template).not.toContain("${path}");
    expect(initCommand.template).toContain("/mock/worktree");
  });
});
