import { it, expect, describe } from "vitest";
import RingBuffer from "./ring-buffer";

describe("RingBuffer", () => {
  describe("enqueue", () => {
    it("should initialize an empty buffer", () => {
      const buffer = new RingBuffer<number>(3);
      expect(buffer.length).toEqual(0);
    });

    it("should add an item to the buffer", () => {
      const buffer = new RingBuffer<number>(3);

      expect(buffer.length).toEqual(0);
      buffer.enqueue(1);
      expect(buffer.length).toEqual(1);
      buffer.enqueue(2);
      expect(buffer.length).toEqual(2);
      buffer.enqueue(3);
      expect(buffer.length).toEqual(3);
    });
  });
});
