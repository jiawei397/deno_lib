/*
 * EJS Embedded JavaScript templates
 * Copyright 2112 Matthew Eernisse (mde@fleegix.org)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
*/

"use strict";

/**
 * @file Embedded JavaScript templating engine. {@link http://ejs.co}
 * @author Matthew Eernisse <mde@fleegix.org>
 * @author Tiancheng "Timothy" Gu <timothygu99@gmail.com>
 * @project EJS
 * @license {@link http://www.apache.org/licenses/LICENSE-2.0 Apache License, Version 2.0}
 */

/**
 * EJS internal functions.
 *
 * Technically this "module" lies in the same file as {@link module:ejs}, for
 * the sake of organization all the private functions re grouped into this
 * module.
 *
 * @module ejs-internal
 * @private
 */

/**
 * Embedded JavaScript templating engine.
 *
 * @module ejs
 * @public
 */

import { existsSync, path } from "./deps.ts";
import * as utils from "./utils.ts";

const { readFileSync } = Deno;

var scopeOptionWarned = false;
/** @type {string} */
var _VERSION_STRING = "1.0.0";
var _DEFAULT_OPEN_DELIMITER = "<";
var _DEFAULT_CLOSE_DELIMITER = ">";
var _DEFAULT_DELIMITER = "%";
var _DEFAULT_LOCALS_NAME = "locals";
var _NAME = "ejs";
var _REGEX_STRING = "(<%%|%%>|<%=|<%-|<%_|<%#|<%|%>|-%>|_%>)";
var _OPTS_PASSABLE_WITH_DATA = [
  "delimiter",
  "scope",
  "context",
  "debug",
  "compileDebug",
  "client",
  "_with",
  "rmWhitespace",
  "strict",
  "filename",
  "async",
];
// We don't allow 'cache' option to be passed in the data obj for
// the normal `render` call, but this is where Express 2 & 3 put it
// so we make an exception for `renderFile`
var _OPTS_PASSABLE_WITH_DATA_EXPRESS = _OPTS_PASSABLE_WITH_DATA.concat("cache");
var _BOM = /^\uFEFF/;

/**
 * EJS template function cache. This can be a LRU object from lru-cache NPM
 * module. By default, it is {@link module:utils.cache}, a simple in-process
 * cache that grows continuously.
 *
 * @type {Cache}
 */

export const cache = utils.cache;

/**
 * Custom file loader. Useful for template preprocessing or restricting access
 * to a certain part of the filesystem.
 *
 * @type {fileLoader}
 */

export let fileLoader = (path: string) => {
  const decoder = new TextDecoder("utf-8");
  const data = readFileSync(path);
  return decoder.decode(data);
};

export const setFileLoader = (loader: typeof fileLoader) => {
  fileLoader = loader;
};

/**
 * Name of the object containing the locals.
 *
 * This variable is overridden by {@link Options}`.localsName` if it is not
 * `undefined`.
 *
 * @type {String}
 * @public
 */

export const localsName = _DEFAULT_LOCALS_NAME;

/**
 * Promise implementation -- defaults to the native implementation if available
 * This is mostly just for testability
 *
 * @type {PromiseConstructorLike}
 * @public
 */

export const promiseImpl = (new Function("return this;"))().Promise;

/**
 * Get the path to the included file from the parent file path and the
 * specified path.
 *
 * @param {String}  name     specified path
 * @param {String}  filename parent file path
 * @param {Boolean} [isDir=false] whether the parent file path is a directory
 * @return {String}
 */
export const resolveInclude = function (
  name: string,
  filename: string,
  isDir?: boolean,
) {
  var dirname = path.dirname;
  var extname = path.extname;
  var resolve = path.resolve;
  var includePath = resolve(isDir ? filename : dirname(filename), name);
  var ext = extname(name);
  if (!ext) {
    includePath += ".ejs";
  }
  return includePath;
};

/**
 * Try to resolve file path on multiple directories
 *
 * @param  {String}        name  specified path
 * @param  {Array<String>} paths list of possible parent directory paths
 * @return {String}
 */
function resolvePaths(name: string, paths: string[]) {
  var filePath;
  if (
    paths.some(function (v) {
      filePath = resolveInclude(name, v, true);
      return existsSync(filePath);
    })
  ) {
    return filePath;
  }
}

/**
 * Get the path to the included file by Options
 *
 * @param  {String}  path    specified path
 * @param  {Options} options compilation options
 * @return {String}
 */
function getIncludePath(path: string, options: Options) {
  var includePath;
  var filePath;
  var views = options.views;
  var match = /^[A-Za-z]+:\\|^\//.exec(path);

  // Abs path
  if (match && match.length) {
    path = path.replace(/^\/*/, "");
    if (Array.isArray(options.root)) {
      includePath = resolvePaths(path, options.root);
    } else {
      includePath = resolveInclude(path, options.root || "/", true);
    }
  } // Relative paths
  else {
    // Look relative to a passed filename first
    if (options.filename) {
      filePath = resolveInclude(path, options.filename);
      if (existsSync(filePath)) {
        includePath = filePath;
      }
    }
    // Then look in any views directories
    if (!includePath && Array.isArray(views)) {
      includePath = resolvePaths(path, views);
    }
    if (!includePath && typeof options.includer !== "function") {
      throw new Error(
        'Could not find the include file "' +
          options.escapeFunction(path) + '"',
      );
    }
  }
  return includePath;
}

/**
 * Get the template from a string or a file, either compiled on-the-fly or
 * read from cache (if enabled), and cache the template if needed.
 *
 * If `template` is not set, the file specified in `options.filename` will be
 * read.
 *
 * If `options.cache` is true, this function reads the file from
 * `options.filename` so it must be set prior to calling this function.
 *
 * @memberof module:ejs-internal
 * @param {Options} options   compilation options
 * @param {String} [template] template source
 * @return {(TemplateFunction|ClientFunction)}
 * Depending on the value of `options.client`, either type might be returned.
 * @static
 */
type CacheOptions = { filename: string; cache: any };

function handleCache(options: CacheOptions, template?: string) {
  var func;
  var filename = options.filename;
  var hasTemplate = !!template;

  if (options.cache) {
    if (!filename) {
      throw new Error("cache option requires a filename");
    }
    func = cache.get(filename);
    if (func) {
      return func;
    }
    if (!hasTemplate) {
      template = fileLoader(filename).toString().replace(_BOM, "");
    }
  } else if (!hasTemplate) {
    // istanbul ignore if: should not happen at all
    if (!filename) {
      throw new Error(
        "Internal EJS error: no file name or template " +
          "provided",
      );
    }
    template = fileLoader(filename).toString().replace(_BOM, "");
  }
  func = compile(template || "", <Options> options);
  if (options.cache) {
    cache.set(filename, func);
  }
  return func;
}

/**
 * Try calling handleCache with the given options and data and call the
 * callback with the result. If an error occurs, call the callback with
 * the error. Used by renderFile().
 *
 * @memberof module:ejs-internal
 * @param {Options} options    compilation options
 * @param {Object} data        template data
 * @param {RenderFileCallback} cb callback
 * @static
 */

function tryHandleCache(
  options: CacheOptions,
  data: any,
  cb: (err: null | Error, data?: any) => void,
) {
  var result;
  if (!cb) {
    if (typeof promiseImpl == "function") {
      return new promiseImpl(
        function (resolve: (arg0: any) => void, reject: (arg0: any) => void) {
          try {
            // @ts-ignore
            result = handleCache(options)(data);
            resolve(result);
          } catch (err) {
            reject(err);
          }
        },
      );
    } else {
      throw new Error("Please provide a callback function");
    }
  } else {
    try {
      // @ts-ignore
      result = handleCache(options)(data);
    } catch (err) {
      return cb(err);
    }

    cb(null, result);
  }
}

/**
 * Get the template function.
 *
 * If `options.cache` is `true`, then the template is cached.
 *
 * @memberof module:ejs-internal
 * @param {String}  path    path for the specified file
 * @param {Options} options compilation options
 * @return {(TemplateFunction|ClientFunction)}
 * Depending on the value of `options.client`, either type might be returned
 * @static
 */

function includeFile(path: string, options: Options) {
  var opts = utils.shallowCopy({}, options);
  opts.filename = getIncludePath(path, opts);
  if (typeof options.includer === "function") {
    var includerResult = options.includer(path, opts.filename);
    if (includerResult) {
      if (includerResult.filename) {
        opts.filename = includerResult.filename;
      }
      if (includerResult.template) {
        return handleCache(opts, includerResult.template);
      }
    }
  }
  return handleCache(opts);
}

/**
 * Re-throw the given `err` in context to the `str` of ejs, `filename`, and
 * `lineno`.
 *
 * @implements {RethrowCallback}
 * @memberof module:ejs-internal
 * @param {Error}  err      Error object
 * @param {String} str      EJS source
 * @param {String} flnm     file name of the EJS file
 * @param {Number} lineno   line number of the error
 * @param {EscapeCallback} esc
 * @static
 */

function rethrow(
  err: Error,
  str: string,
  flnm: string,
  lineno: number,
  esc: (arg0: any) => any,
) {
  var lines = str.split("\n");
  var start = Math.max(lineno - 3, 0);
  var end = Math.min(lines.length, lineno + 3);
  var filename = esc(flnm);
  // Error context
  var context = lines.slice(start, end).map(function (line, i) {
    var curr = i + start + 1;
    return (curr == lineno ? " >> " : "    ") +
      curr +
      "| " +
      line;
  }).join("\n");

  // Alter exception message
  // @ts-ignore
  err.path = filename;
  err.message = (filename || "ejs") + ":" +
    lineno + "\n" +
    context + "\n\n" +
    err.message;

  throw err;
}

function stripSemi(str: string) {
  return str.replace(/;(\s*$)/, "$1");
}

/**
 * Compile the given `str` of ejs into a template function.
 *
 * @param {String}  template EJS template
 *
 * @param {Options} [opts] compilation options
 *
 * @return {(TemplateFunction|ClientFunction)}
 * Depending on the value of `opts.client`, either type might be returned.
 * Note that the return type of the function also depends on the value of `opts.async`.
 * @public
 */

export const compile = function (template: string, opts: Options) {
  var templ = new Template(template, opts);
  return templ.compile();
};

/**
 * Render the given `template` of ejs.
 *
 * If you would like to include options but not data, you need to explicitly
 * call this function with `data` being an empty object or `null`.
 *
 * @param {String}   template EJS template
 * @param {Object}  [data={}] template data
 * @param {Options} [opts={}] compilation and rendering options
 * @return {(String|Promise<String>)}
 * Return value type depends on `opts.async`.
 * @public
 */

export const render = function (template: string, d: {}, o: {}) {
  var data = d || {};
  var opts = o || {};

  // No options object -- if there are optiony names
  // in the data, copy them to options
  if (arguments.length == 2) {
    utils.shallowCopyFromList(opts, data, _OPTS_PASSABLE_WITH_DATA);
  }

  return handleCache(<CacheOptions> opts, template)(data);
};

/**
 * Render an EJS file at the given `path` and callback `cb(err, str)`.
 *
 * If you would like to include options but not data, you need to explicitly
 * call this function with `data` being an empty object or `null`.
 *
 * @param {String}             path     path to the EJS file
 * @param {Object}            [data={}] template data
 * @param {Options}           [opts={}] compilation and rendering options
 * @param {RenderFileCallback} cb callback
 * @public
 */

export const renderFile = function (filename: string, ...args: any[]) {
  // var args = Array.prototype.slice.call(arguments);
  // var filename = args.shift();
  var cb;
  var opts = { filename, views: undefined, cache: false };
  var data;
  var viewOpts;

  // Do we have a callback?
  if (typeof args[args.length - 1] == "function") {
    cb = args.pop();
  }
  // Do we have data/opts?
  if (args.length) {
    // Should always have data obj
    data = args.shift();
    // Normal passed opts (data obj + opts obj)
    if (args.length) {
      // Use shallowCopy so we don't pollute passed in opts obj with new vals
      utils.shallowCopy(opts, args.pop());
    } // Special casing for Express (settings + opts-in-data)
    else {
      // Express 3 and 4
      if (data.settings) {
        // Pull a few things from known locations
        if (data.settings.views) {
          opts.views = data.settings.views;
        }
        if (data.settings["view cache"]) {
          opts.cache = true;
        }
        // Undocumented after Express 2, but still usable, esp. for
        // items that are unsafe to be passed along with data, like `root`
        viewOpts = data.settings["view options"];
        if (viewOpts) {
          utils.shallowCopy(opts, viewOpts);
        }
      }
      // Express 2 and lower, values set in app.locals, or people who just
      // want to pass options in their data. NOTE: These values will override
      // anything previously set in settings  or settings['view options']
      utils.shallowCopyFromList(opts, data, _OPTS_PASSABLE_WITH_DATA_EXPRESS);
    }
    opts.filename = filename;
  } else {
    data = {};
  }

  return tryHandleCache(opts, data, cb);
};

/**
 * Clear intermediate JavaScript cache. Calls {@link Cache#reset}.
 * @public
 */
export const clearCache = function () {
  cache.reset();
};

type Options = {
  scope?: boolean;
  escape?: undefined | ((markup?: string) => string);
  cache: boolean;
  destructuredLocals: string | undefined;
  debug: boolean;
  closeDelimiter: string;
  legacyInclude: boolean;
  openDelimiter: string;
  includer?: (path: string, filename: string) => {
    template: string;
    filename: string;
  };
  outputFunctionName: undefined;
  localsName: string;
  async: undefined;
  filename: string;
  compileDebug: boolean;
  delimiter: string;
  rmWhitespace: boolean;
  root?: string[];
  _with: boolean;
  context: undefined;
  client: boolean;
  escapeFunction: ((markup?: string) => string);
  strict: boolean;
  views: undefined;
};

/**
 * EJS template class
 * @public
 */
export class Template {
  static modes = {
    EVAL: "eval",
    ESCAPED: "escaped",
    RAW: "raw",
    COMMENT: "comment",
    LITERAL: "literal",
  };
  private templateText: string;
  private mode: string | null | undefined;
  private truncate: boolean = false;
  private currentLine: number = 1;
  private source: string = "";
  private regex: RegExp;
  private opts: Options;

  constructor(text: string, opts: Options) {
    const options: Options = {
      _with: false,
      async: undefined,
      cache: false,
      client: false,
      compileDebug: false,
      context: undefined,
      debug: false,
      delimiter: _DEFAULT_DELIMITER,
      destructuredLocals: undefined,
      escapeFunction: utils.escapeXML,
      filename: "",
      legacyInclude: false,
      localsName: "",
      openDelimiter: _DEFAULT_OPEN_DELIMITER,
      closeDelimiter: _DEFAULT_CLOSE_DELIMITER,
      outputFunctionName: undefined,
      rmWhitespace: false,
      strict: false,
      views: undefined,
    };
    this.templateText = text;
    Object.assign(options, opts);
    options.escapeFunction = opts.escape || opts.escapeFunction ||
      utils.escapeXML;
    options.compileDebug = opts.compileDebug !== false;
    options.debug = !!opts.debug;
    options.localsName = opts.localsName || localsName || _DEFAULT_LOCALS_NAME;
    options.legacyInclude = typeof opts.legacyInclude != "undefined"
      ? !!opts.legacyInclude
      : true;

    if (options.strict) {
      options._with = false;
    } else {
      options._with = typeof opts._with != "undefined" ? opts._with : true;
    }

    this.opts = options;

    this.regex = this.createRegex();
  }

  createRegex() {
    var str = _REGEX_STRING;
    var delim = utils.escapeRegExpChars(this.opts.delimiter);
    var open = utils.escapeRegExpChars(this.opts.openDelimiter);
    var close = utils.escapeRegExpChars(this.opts.closeDelimiter);
    str = str.replace(/%/g, delim)
      .replace(/</g, open)
      .replace(/>/g, close);
    return new RegExp(str);
  }

  compile() {
    /** @type {string} */
    var src;
    /** @type {ClientFunction} */
    var fn: any;
    var opts = this.opts;
    var prepended = "";
    var appended = "";
    /** @type {EscapeCallback} */
    var escapeFn = opts.escapeFunction;
    /** @type {FunctionConstructor} */
    var ctor;
    /** @type {string} */
    var sanitizedFilename = opts.filename
      ? JSON.stringify(opts.filename)
      : "undefined";

    if (!this.source) {
      this.generateSource();
      prepended += '  var __output = "";\n' +
        "  function __append(s) { if (s !== undefined && s !== null) __output += s }\n";
      if (opts.outputFunctionName) {
        prepended += "  var " + opts.outputFunctionName + " = __append;" + "\n";
      }
      if (opts.destructuredLocals && opts.destructuredLocals.length) {
        var destructuring = "  var __locals = (" + opts.localsName +
          " || {}),\n";
        for (var i = 0; i < opts.destructuredLocals.length; i++) {
          var name = opts.destructuredLocals[i];
          if (i > 0) {
            destructuring += ",\n  ";
          }
          destructuring += name + " = __locals." + name;
        }
        prepended += destructuring + ";\n";
      }
      if (opts._with !== false) {
        prepended += "  with (" + opts.localsName + " || {}) {" + "\n";
        appended += "  }" + "\n";
      }
      appended += "  return __output;" + "\n";
      this.source = prepended + this.source + appended;
    }

    if (opts.compileDebug) {
      src = "var __line = 1" + "\n" +
        "  , __lines = " + JSON.stringify(this.templateText) + "\n" +
        "  , __filename = " + sanitizedFilename + ";" + "\n" +
        "try {" + "\n" +
        this.source +
        "} catch (e) {" + "\n" +
        "  rethrow(e, __lines, __filename, __line, escapeFn);" + "\n" +
        "}" + "\n";
    } else {
      src = this.source;
    }

    if (opts.client) {
      src = "escapeFn = escapeFn || " + escapeFn.toString() + ";" + "\n" + src;
      if (opts.compileDebug) {
        src = "rethrow = rethrow || " + rethrow.toString() + ";" + "\n" + src;
      }
    }

    if (opts.strict) {
      src = '"use strict";\n' + src;
    }
    if (opts.debug) {
      console.log(src);
    }
    if (opts.compileDebug && opts.filename) {
      src = src + "\n" +
        "//# sourceURL=" + sanitizedFilename + "\n";
    }

    try {
      if (opts.async) {
        // Have to use generated function for this, since in envs without support,
        // it breaks in parsing
        try {
          ctor = (new Function("return (async function(){}).constructor;"))();
        } catch (e) {
          if (e instanceof SyntaxError) {
            throw new Error("This environment does not support async/await");
          } else {
            throw e;
          }
        }
      } else {
        ctor = Function;
      }
      fn = new ctor(opts.localsName + ", escapeFn, include, rethrow", src);
    } catch (e) {
      // istanbul ignore else
      if (e instanceof SyntaxError) {
        if (opts.filename) {
          e.message += " in " + opts.filename;
        }
        e.message += " while compiling ejs\n\n";
        e.message +=
          "If the above error is not helpful, you may want to try EJS-Lint:\n";
        e.message += "https://github.com/RyanZim/EJS-Lint";
        if (!opts.async) {
          e.message += "\n";
          e.message +=
            "Or, if you meant to create an async function, pass `async: true` as an option.";
        }
      }
      throw e;
    }

    // Return a callable function which will execute the function
    // created by the source-code, with the passed data as locals
    // Adds a local `include` function which allows full recursive include
    var returnedFn = opts.client ? fn : function anonymous(data: any) {
      var include = function (path: string, includeData: string) {
        var d = utils.shallowCopy({}, data);
        if (includeData) {
          d = utils.shallowCopy(d, includeData);
        }
        return includeFile(path, opts)(d);
      };
      return fn.apply(opts.context, [data || {}, escapeFn, include, rethrow]);
    };
    if (opts.filename && typeof Object.defineProperty === "function") {
      var filename = opts.filename;
      var basename = path.basename(filename, path.extname(filename));
      try {
        Object.defineProperty(returnedFn, "name", {
          value: basename,
          writable: false,
          enumerable: false,
          configurable: true,
        });
      } catch (e) {
        /* ignore */
      }
    }
    return returnedFn;
  }

  generateSource() {
    var opts = this.opts;

    if (opts.rmWhitespace) {
      // Have to use two separate replace here as `^` and `$` operators don't
      // work well with `\r` and empty lines don't work well with the `m` flag.
      this.templateText = this.templateText.replace(/[\r\n]+/g, "\n").replace(
        /^\s+|\s+$/gm,
        "",
      );
    }

    // Slurp spaces and tabs before <%_ and after _%>
    this.templateText = this.templateText.replace(/[ \t]*<%_/gm, "<%_").replace(
      /_%>[ \t]*/gm,
      "_%>",
    );

    var self = this;
    var matches = this.parseTemplateText();
    var d = this.opts.delimiter;
    var o = this.opts.openDelimiter;
    var c = this.opts.closeDelimiter;

    if (matches && matches.length) {
      matches.forEach(function (line: string, index: number) {
        var closing;
        // If this is an opening tag, check for closing tags
        // FIXME: May end up with some false positives here
        // Better to store modes as k/v with openDelimiter + delimiter as key
        // Then this can simply check against the map
        if (
          line.indexOf(o + d) === 0 && // If it is a tag
          line.indexOf(o + d + d) !== 0
        ) { // and is not escaped
          closing = matches[index + 2];
          if (
            !(closing == d + c || closing == "-" + d + c ||
              closing == "_" + d + c)
          ) {
            throw new Error(
              'Could not find matching close tag for "' + line + '".',
            );
          }
        }
        self.scanLine(line);
      });
    }
  }

  parseTemplateText() {
    var str = this.templateText;
    var pat = this.regex;
    var result = pat.exec(str);
    var arr = [];
    var firstPos;

    while (result) {
      firstPos = result.index;

      if (firstPos !== 0) {
        arr.push(str.substring(0, firstPos));
        str = str.slice(firstPos);
      }

      arr.push(result[0]);
      str = str.slice(result[0].length);
      result = pat.exec(str);
    }

    if (str) {
      arr.push(str);
    }

    return arr;
  }

  _addOutput(line: string) {
    if (this.truncate) {
      // Only replace single leading linebreak in the line after
      // -%> tag -- this is the single, trailing linebreak
      // after the tag that the truncation mode replaces
      // Handle Win / Unix / old Mac linebreaks -- do the \r\n
      // combo first in the regex-or
      line = line.replace(/^(?:\r\n|\r|\n)/, "");
      this.truncate = false;
    }
    if (!line) {
      return line;
    }

    // Preserve literal slashes
    line = line.replace(/\\/g, "\\\\");

    // Convert linebreaks
    line = line.replace(/\n/g, "\\n");
    line = line.replace(/\r/g, "\\r");

    // Escape double-quotes
    // - this will be the delimiter during execution
    line = line.replace(/"/g, '\\"');
    this.source += '    ; __append("' + line + '")' + "\n";
  }

  scanLine(line: string) {
    var self = this;
    var d = this.opts.delimiter;
    var o = this.opts.openDelimiter;
    var c = this.opts.closeDelimiter;
    var newLineCount = 0;

    newLineCount = (line.split("\n").length - 1);

    switch (line) {
      case o + d:
      case o + d + "_":
        this.mode = Template.modes.EVAL;
        break;
      case o + d + "=":
        this.mode = Template.modes.ESCAPED;
        break;
      case o + d + "-":
        this.mode = Template.modes.RAW;
        break;
      case o + d + "#":
        this.mode = Template.modes.COMMENT;
        break;
      case o + d + d:
        this.mode = Template.modes.LITERAL;
        this.source += '    ; __append("' + line.replace(o + d + d, o + d) +
          '")' + "\n";
        break;
      case d + d + c:
        this.mode = Template.modes.LITERAL;
        this.source += '    ; __append("' + line.replace(d + d + c, d + c) +
          '")' + "\n";
        break;
      case d + c:
      case "-" + d + c:
      case "_" + d + c:
        if (this.mode == Template.modes.LITERAL) {
          this._addOutput(line);
        }

        this.mode = null;
        this.truncate = line.indexOf("-") === 0 || line.indexOf("_") === 0;
        break;
      default:
        // In script mode, depends on type of tag
        if (this.mode) {
          // If '//' is found without a line break, add a line break.
          switch (this.mode) {
            case Template.modes.EVAL:
            case Template.modes.ESCAPED:
            case Template.modes.RAW:
              if (line.lastIndexOf("//") > line.lastIndexOf("\n")) {
                line += "\n";
              }
          }
          switch (this.mode) {
            // Just executing code
            case Template.modes.EVAL:
              this.source += "    ; " + line + "\n";
              break;
              // Exec, esc, and output
            case Template.modes.ESCAPED:
              this.source += "    ; __append(escapeFn(" + stripSemi(line) +
                "))" + "\n";
              break;
              // Exec and output
            case Template.modes.RAW:
              this.source += "    ; __append(" + stripSemi(line) + ")" + "\n";
              break;
            case Template.modes.COMMENT:
              // Do nothing
              break;
              // Literal <%% mode, append as raw output
            case Template.modes.LITERAL:
              this._addOutput(line);
              break;
          }
        } // In string mode, just add the output
        else {
          this._addOutput(line);
        }
    }

    if (self.opts.compileDebug && newLineCount) {
      this.currentLine += newLineCount;
      this.source += "    ; __line = " + this.currentLine + "\n";
    }
  }
}

/**
 * Escape characters reserved in XML.
 *
 * This is simply an export of {@link module:utils.escapeXML}.
 *
 * If `markup` is `undefined` or `null`, the empty string is returned.
 *
 * @param {String} markup Input string
 * @return {String} Escaped string
 * @public
 * @func
 * */
export const escapeXML = utils.escapeXML;

/**
 * Express.js support.
 *
 * This is an alias for {@link module:ejs.renderFile}, in order to support
 * Express.js out-of-the-box.
 *
 * @func
 */

export const __express = renderFile;

/**
 * Version of EJS.
 *
 * @readonly
 * @type {String}
 * @public
 */

export const VERSION = _VERSION_STRING;

/**
 * Name for detection of EJS.
 *
 * @readonly
 * @type {String}
 * @public
 */

export const name = _NAME;
