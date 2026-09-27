class RingBuffer<T> {
  private size: number;
  private buffer: Array<T>;
  private head: number;
  private tail: number;
  private count: number;

  constructor(size: number) {
    if (size <= 0) throw new Error("Buffer size must be greater than 0");

    this.size = size;
    this.buffer = new Array<T>(size);
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  enqueue(item: T) {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.size;

    if (this.count === this.size) {
      this.head = (this.head + 1) % this.size;
    } else {
      this.count++;
    }
  }

  dequeue() {
    if (this.count === 0) throw new Error("Buffer is empty");

    const item = this.buffer[this.head];
    this.head = (this.head + 1) % this.size;
    this.count--;

    return item;
  }

  peek() {
    if (this.isEmpty) throw new Error("Buffer is empty");
    return this.buffer[this.head];
  }

  get isEmpty() {
    return this.count === 0;
  }

  get isFull() {
    return this.count === this.size;
  }

  get length() {
    return this.count;
  }

  get capacity() {
    return this.size;
  }

  clear() {
    this.head = 0;
    this.tail = 0;
    this.count = 0;
  }

  toArray() {
    const result = new Array<T>(this.count);
    let index = 0;
    let i = this.head;
    while (index < this.count) {
      result[index++] = this.buffer[i];
      i = (i + 1) % this.size;
    }
    return result;
  }
}

export default RingBuffer;
