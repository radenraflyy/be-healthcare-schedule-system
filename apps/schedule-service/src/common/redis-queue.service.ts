import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { createConnection } from 'node:net';

import { resolveRedisUrl } from '../../../common/redis/redis-connection.options.js';

interface ParsedReply {
  value: unknown;
  next: number;
}

@Injectable()
export class RedisQueueService {
  private readonly url: URL;
  private readonly key = 'healthcare:schedule-reminders';

  constructor(config: ConfigService) {
    this.url = new URL(resolveRedisUrl(config));
    if (this.url.protocol !== 'redis:') {
      throw new Error('REDIS_URL must use the redis:// protocol.');
    }
  }

  add(id: string, dueAt: Date): Promise<number> {
    return this.command('ZADD', this.key, String(dueAt.getTime()), id) as Promise<number>;
  }

  remove(id: string): Promise<number> {
    return this.command('ZREM', this.key, id) as Promise<number>;
  }

  due(now: Date, limit = 100): Promise<string[]> {
    return this.command(
      'ZRANGEBYSCORE',
      this.key,
      '-inf',
      String(now.getTime()),
      'LIMIT',
      '0',
      String(limit),
    ) as Promise<string[]>;
  }

  async acquireLock(id: string): Promise<string | null> {
    const token = randomUUID();
    const result = await this.command(
      'SET',
      `healthcare:reminder-lock:${id}`,
      token,
      'EX',
      '60',
      'NX',
    );
    return result === 'OK' ? token : null;
  }

  async releaseLock(id: string, token: string): Promise<void> {
    await this.command(
      'EVAL',
      "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
      '1',
      `healthcare:reminder-lock:${id}`,
      token,
    );
  }

  private async command(...args: string[]): Promise<unknown> {
    const db = this.url.pathname.length > 1 ? Number(this.url.pathname.slice(1)) : 0;
    const commands: string[][] = [];
    if (this.url.password) {
      commands.push(
        this.url.username
          ? ['AUTH', decodeURIComponent(this.url.username), decodeURIComponent(this.url.password)]
          : ['AUTH', decodeURIComponent(this.url.password)],
      );
    }
    if (Number.isInteger(db) && db > 0) commands.push(['SELECT', String(db)]);
    commands.push(args);

    return new Promise((resolve, reject) => {
      const socket = createConnection({
        host: this.url.hostname,
        port: Number(this.url.port || 6379),
      });
      let buffer = Buffer.alloc(0);
      const replies: unknown[] = [];
      let parseOffset = 0;
      socket.setTimeout(5000, () => socket.destroy(new Error('Redis command timed out.')));
      socket.once('error', reject);
      socket.once('close', () => {
        if (replies.length < commands.length) reject(new Error('Redis closed before replying.'));
      });
      socket.once('connect', () => {
        socket.write(Buffer.concat(commands.map((command) => this.encode(command))));
      });
      socket.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        try {
          while (replies.length < commands.length) {
            const parsed = this.parse(buffer, parseOffset);
            if (!parsed) break;
            replies.push(parsed.value);
            parseOffset = parsed.next;
          }
          if (replies.length === commands.length) {
            socket.end();
            resolve(replies[replies.length - 1]);
          }
        } catch (error) {
          socket.destroy();
          reject(error);
        }
      });
    });
  }

  private encode(args: string[]): Buffer {
    const parts = [`*${args.length}\r\n`];
    for (const arg of args) parts.push(`$${Buffer.byteLength(arg)}\r\n${arg}\r\n`);
    return Buffer.from(parts.join(''), 'utf8');
  }

  private parse(buffer: Buffer, offset: number): ParsedReply | null {
    if (offset >= buffer.length) return null;
    const type = String.fromCharCode(buffer[offset]);
    const lineEnd = buffer.indexOf('\r\n', offset);
    if (lineEnd < 0) return null;
    const header = buffer.toString('utf8', offset + 1, lineEnd);
    const bodyStart = lineEnd + 2;
    if (type === '+' || type === '-') {
      if (type === '-') throw new Error(`Redis error: ${header}`);
      return { value: header, next: bodyStart };
    }
    if (type === ':') return { value: Number(header), next: bodyStart };
    if (type === '$') {
      const length = Number(header);
      if (length === -1) return { value: null, next: bodyStart };
      if (buffer.length < bodyStart + length + 2) return null;
      return {
        value: buffer.toString('utf8', bodyStart, bodyStart + length),
        next: bodyStart + length + 2,
      };
    }
    if (type === '*') {
      const count = Number(header);
      if (count === -1) return { value: null, next: bodyStart };
      const values: unknown[] = [];
      let cursor = bodyStart;
      for (let index = 0; index < count; index += 1) {
        const item = this.parse(buffer, cursor);
        if (!item) return null;
        values.push(item.value);
        cursor = item.next;
      }
      return { value: values, next: cursor };
    }
    throw new Error(`Unsupported Redis response type: ${type}`);
  }
}
