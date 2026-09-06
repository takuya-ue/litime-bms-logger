const MAX_BUFFER_LENGTH = 512;

function jbdFrameLength(buffer: number[]): number | undefined {
  if (buffer.length < 4 || buffer[0] !== 0xdd) {
    return undefined;
  }
  return 4 + buffer[3] + 2 + 1;
}

function litimeFrameLength(buffer: number[]): number | undefined {
  if (buffer.length < 4 || buffer[0] !== 0x00 || buffer[1] !== 0x00) {
    return undefined;
  }

  const payloadLength = buffer[2];
  if (payloadLength < 1) {
    return undefined;
  }

  return payloadLength + 4;
}

function findNextFrameStart(buffer: number[]): number {
  for (let index = 1; index < buffer.length; index += 1) {
    if (buffer[index] === 0xdd) {
      return index;
    }
    if (buffer[index] === 0x00 && buffer[index + 1] === 0x00) {
      return index;
    }
  }
  return -1;
}

export class LiTimeFrameAssembler {
  private buffer: number[] = [];

  push(chunk: Uint8Array): Uint8Array[] {
    this.buffer.push(...chunk);

    if (this.buffer.length > MAX_BUFFER_LENGTH) {
      this.buffer = this.buffer.slice(-MAX_BUFFER_LENGTH);
    }

    const frames: Uint8Array[] = [];

    while (this.buffer.length > 0) {
      const expectedLength = jbdFrameLength(this.buffer) ?? litimeFrameLength(this.buffer);

      if (expectedLength !== undefined) {
        if (this.buffer.length < expectedLength) {
          break;
        }

        frames.push(Uint8Array.from(this.buffer.slice(0, expectedLength)));
        this.buffer = this.buffer.slice(expectedLength);
        continue;
      }

      const nextStart = findNextFrameStart(this.buffer);
      if (nextStart === -1) {
        this.buffer = [];
        break;
      }

      this.buffer = this.buffer.slice(nextStart);
    }

    return frames;
  }

  reset(): void {
    this.buffer = [];
  }
}
