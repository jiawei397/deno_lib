import {
  BufWriterSync,
  dateToString,
  handlers,
  join,
  LevelName,
  LogLevels,
  LogRecord,
} from "./deps.ts";

type FormatterFunction = (logRecord: LogRecord) => string;
type LogMode = "a" | "w" | "x";

interface HandlerOptions {
  formatter?: string | FormatterFunction;
}

interface FileHandlerOptions extends HandlerOptions {
  filename: string;
  pattern?: string; // like : yyyy-MM-dd.log
  daysToKeep?: number;
  mode?: LogMode;
}

function mkdir(dir: string) {
  try {
    Deno.mkdirSync(dir, { recursive: true });
  } catch (e) {
  }
}

function expireDate(day: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - day);
  return date;
}

export class DateFileHandler extends handlers.WriterHandler {
  protected _file: Deno.File | undefined;
  protected _buf!: BufWriterSync;
  protected _filename: string;
  protected _pattern: string;
  protected _mode: LogMode;
  protected _daysToKeep: number;
  protected _openOptions: Deno.OpenOptions;
  protected _encoder = new TextEncoder();

  private unloadCallback() {
    this.destroy();
  }

  constructor(levelName: LevelName, options: FileHandlerOptions) {
    super(levelName, options);
    this._filename = options.filename;
    this._pattern = options.pattern || "yyyy-MM-dd.log";
    this._daysToKeep = options.daysToKeep || 30;
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

  init() {
    let name = this._filename;
    let dir = ".";
    if (this._filename.includes("/")) {
      let arr = this._filename.split("/");
      name = arr.pop()!;
      dir = arr.join("/");
      mkdir(dir);
    }
    const ed = expireDate(this._daysToKeep);
    const expiredFileName = this.getFilenameByDate(name, ed);
    for (const dirEntry of Deno.readDirSync(dir)) {
      if (dirEntry.name.startsWith(name) && /\d+/.test(dirEntry.name)) {
        if (expiredFileName > dirEntry.name) {
          console.log(
            `[${dirEntry.name}]Compared to [${expiredFileName}] has expired and will be deleted soon`,
          );
          Deno.removeSync(join(dir, dirEntry.name));
        }
      }
    }
  }

  get filename(): string {
    return this.getFilenameByDate(this._filename);
  }

  getFilenameByDate(filename: string, date?: Date): string {
    if (this._pattern) {
      return filename + "." + dateToString(this._pattern, date || new Date());
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
