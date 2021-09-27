import {dateToString, handlers, join, LevelName} from "../deps.ts";
import {FileHandlerOptions} from "./types.ts";
import {expireDate, mkdir} from "./utils.ts";

export class DateFileHandler extends handlers.FileHandler {
  protected _pattern = "yyyy-MM-dd.log";
  protected _daysToKeep = 30;

  private originFileName = "";

  protected _flushTimeout = 1000; // 1s refresh once

  protected tomorrowDay = 0;

  private initingPromise: Promise<void> | undefined;

  constructor(levelName: LevelName, options: FileHandlerOptions) {
    super(levelName, options);
    this.originFileName = options.filename;
    if (options.pattern) {
      this._pattern = options.pattern;
    }
    if (options.daysToKeep) {
      this._daysToKeep = options.daysToKeep;
    }
    if (options.flushTimeout !== undefined) {
      this._flushTimeout = options.flushTimeout;
    }
    this.init();
  }

  getTomorrow() {
    const now = new Date();
    now.setHours(0);
    now.setMinutes(0);
    now.setSeconds(0);
    now.setDate(now.getDate() + 1);
    return now.getTime();
  }

  async init() {
    this._filename = this.getFilenameByDate(this.originFileName);
    this.tomorrowDay = this.getTomorrow();
    let name = this.originFileName;
    let dir = "./";
    if (name.includes("/")) {
      const arr = name.split("/");
      name = arr.pop()!;
      dir = arr.join("/");
      await mkdir(dir);
    }

    // remove expired files
    if (this._daysToKeep > 0) {
      const ed = expireDate(this._daysToKeep);
      const expiredFileName = this.getFilenameByDate(name, ed);
      for await (const dirEntry of Deno.readDir(dir)) {
        const dirEntryName = dirEntry.name;
        if (dirEntryName.startsWith(name) && /\d+/.test(dirEntryName)) {
          if (expiredFileName > dirEntryName) {
            console.log(
                `[${dirEntryName}]Compared to [${expiredFileName}] has expired and will be deleted soon`,
            );
            await Deno.remove(join(dir, dirEntryName));
          }
        }
      }
    }
  }

  private getFilenameByDate(filename: string, date = new Date()): string {
    if (this._pattern) {
      return filename + "." + dateToString(this._pattern, date);
    }
    return filename;
  }

  _log(msg: string): void {
    super.log(msg);
    setTimeout(() => {
      this.flush();
    }, this._flushTimeout);
  }

  log(msg: string): void {
    if (this.tomorrowDay <= Date.now()) {
      if (!this.initingPromise) {
        this.initingPromise = this.init();
      }
      this.initingPromise.then(() => {
        this._log(msg);
        this.initingPromise = undefined;
      });
    } else {
      this._log(msg);
    }
  }
}
