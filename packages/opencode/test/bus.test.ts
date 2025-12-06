import { describe, expect, test, mock, afterEach } from "bun:test";
import z from "zod";

// A simple spy implementation
const createSpy = () => {
  const spy = (...args: any[]) => {
    spy.called = true;
    spy.callCount++;
    spy.calls.push(args);
  };
  spy.called = false;
  spy.callCount = 0;
  spy.calls = [] as any[][];
  spy.mockClear = () => {
    spy.called = false;
    spy.callCount = 0;
    spy.calls = [];
  };
  return spy;
};

// Mock the global bus
const mockGlobalBus = {
  emit: createSpy(),
};

mock.module("../src/bus/global", () => ({
  GlobalBus: mockGlobalBus,
}));

// Mock Instance to provide a stable directory
mock.module("../src/project/instance", async () => {
  const { State } = await import("../src/project/state");
  const context = {
    directory: "/mock/bus/directory",
    worktree: "/mock/bus/worktree",
  };
  return {
    Instance: {
      get directory() {
        return context.directory;
      },
      state: (init, dispose) => State.create(() => context.directory, init, dispose),
      dispose: async () => {
        await State.dispose(context.directory);
      },
    },
  };
});

// Import the module to be tested
const { Bus } = await import("../src/bus");

describe("Bus", () => {
  afterEach(() => {
    mockGlobalBus.emit.mockClear();
  });

  const testEvent = Bus.event("test.event", z.object({ foo: z.string() }));
  const anotherEvent = Bus.event("another.event", z.object({ bar: z.number() }));

  test("should subscribe to and publish an event", async () => {
    const callback = createSpy();
    Bus.subscribe(testEvent, callback);

    await Bus.publish(testEvent, { foo: "bar" });

    expect(callback.callCount).toBe(1);
    expect(callback.calls[0][0]).toEqual({
      type: "test.event",
      properties: { foo: "bar" },
    });
  });

  test("should call multiple subscribers for an event", async () => {
    const callback1 = createSpy();
    const callback2 = createSpy();
    Bus.subscribe(testEvent, callback1);
    Bus.subscribe(testEvent, callback2);

    await Bus.publish(testEvent, { foo: "baz" });

    expect(callback1.callCount).toBe(1);
    expect(callback2.callCount).toBe(1);
  });

  test("should unsubscribe from an event", async () => {
    const callback = createSpy();
    const unsubscribe = Bus.subscribe(testEvent, callback);

    unsubscribe();

    await Bus.publish(testEvent, { foo: "qux" });

    expect(callback.called).toBe(false);
  });

  test("subscribeAll should receive all events", async () => {
    const callback = createSpy();
    Bus.subscribeAll(callback);

    await Bus.publish(testEvent, { foo: "all" });
    await Bus.publish(anotherEvent, { bar: 123 });

    expect(callback.callCount).toBe(2);
    expect(callback.calls[0][0]).toEqual({
      type: "test.event",
      properties: { foo: "all" },
    });
    expect(callback.calls[1][0]).toEqual({
      type: "another.event",
      properties: { bar: 123 },
    });
  });

  test("once should only receive an event once", async () => {
    const callback = createSpy();
    Bus.once(testEvent, () => {
      callback();
      return "done";
    });

    await Bus.publish(testEvent, { foo: "first" });
    await Bus.publish(testEvent, { foo: "second" });

    expect(callback.callCount).toBe(1);
  });

  test("should emit event to GlobalBus", async () => {
    await Bus.publish(testEvent, { foo: "global" });

    expect(mockGlobalBus.emit.callCount).toBe(1);
    expect(mockGlobalBus.emit.calls[0][0]).toBe("event");
    expect(mockGlobalBus.emit.calls[0][1]).toEqual({
      directory: "/mock/bus/directory",
      payload: {
        type: "test.event",
        properties: { foo: "global" },
      },
    });
  });
});
