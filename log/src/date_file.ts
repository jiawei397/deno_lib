import {
  BufWriterSync,
  dateToString,
  handlers,
  join,
  LevelName,
  LogLevels,
  LogRecord,
} from "../deps.ts";
import { FileHandlerOptions, LogMode } from "./types.ts";
import { expireDate, mkdir } from "./utils.ts";

export class DateFileHandler extends handlers.WriterHandler {
  protected _file: Deno.File | undefined;
  protected _buf!: BufWriterSync;
  protected _filename: string;
  protected _pattern = "yyyy-MM-dd.log";
  protected _mode: LogMode;
  protected _daysToKeep = 30;

  protected _flushDelay = 1000;

  protected _openOptions: Deno.OpenOptions;
  protected _encoder = new TextEncoder();

  private unloadCallback() {
    this.destroy();
  }

  constructor(levelName: LevelName, options: FileHandlerOptions) {
    super(levelName, options);
    this._filename = options.filename;
    if (options.pattern) {
      this._pattern = options.pattern;
    }
    if (options.daysToKeep) {
      this._daysToKeep = options.daysToKeep;
    }
    if (options.flushTimeout !== undefined) {
      this._flushDelay = options.flushTimeout;
    }
    // default to append mode, write only
    this._mode = options.mode ? options.mode : "a";
    this._openOptions = {
      createNew: this._mode === "x",
      create: this._mode !== "x",
      append: this._mode === "a",
      truncate: this._mode !== "a",
      write: true,
    };
    this.init();
  }

  async init() {
    let name = this._filename;
    let dir = "./";
    if (this._filename.includes("/")) {
      const arr = this._filename.split("/");
      name = arr.pop()!;
      dir = arr.join("/");
      await mkdir(dir);
    }
    const ed = expireDate(this._daysToKeep);
    const expiredFileName = this.getFilenameByDate(name, ed);
    for await (const dirEntry of Deno.readDir(dir)) {
      if (dirEntry.name.startsWith(name) && /\d+/.test(dirEntry.name)) {
        if (expiredFileName > dirEntry.name) {
          console.log(
            `[${dirEntry.name}]Compared to [${expiredFileName}] has expired and will be deleted soon`,
          );
          await Deno.remove(join(dir, dirEntry.name));
        }
      }
    }
  }

  get filename(): string {
    return this.getFilenameByDate(this._filename);
  }

  getFilenameByDate(filename: string, date = new Date()): string {
    if (this._pattern) {
      return filename + "." + dateToString(this._pattern, date);
    }
    return filename;
  }

  async setup() {
    this._file = await Deno.open(this.filename, this._openOptions);
    this._writer = this._file;
    this._buf = new BufWriterSync(this._file);

    addEventListener("unload", this.unloadCallback.bind(this));
  }

  handle(logRecord: LogRecord): void {
    super.handle(logRecord);

    // Immediately flush if log level is higher than ERROR
    if (logRecord.level > LogLevels.ERROR) {
      this.flush();
    }
  }

  log(msg: string): void {
    this._buf.writeSync(this._encoder.encode(msg + "\n"));
    setTimeout(() => {
      this.flush();
    }, this._flushDelay);
  }

  flush(): void {
    if (this._buf?.buffered() > 0) {
      this._buf.flush();
    }
  }

  destroy() {
    this.flush();
    this._file?.close();
    this._file = undefined;
    removeEventListener("unload", this.unloadCallback);
    return Promise.resolve();
  }
}
