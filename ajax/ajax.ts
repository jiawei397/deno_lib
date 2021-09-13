export type Method =
  | "get"
  | "GET"
  | "delete"
  | "DELETE"
  | "head"
  | "HEAD"
  | "options"
  | "OPTIONS"
  | "post"
  | "POST"
  | "put"
  | "PUT"
  | "patch"
  | "PATCH"
  | "purge"
  | "PURGE"
  | "link"
  | "LINK"
  | "unlink"
  | "UNLINK";

export type Credentials = "omit" | "include" | "same-origin";

export type Mode = "same-origin" | "cors" | "no-cors";

export type AbortResult<T> = {
  promise: Promise<T>;
  abort: () => void;
};

export interface AjaxResult {
  promise: Promise<unknown>;
  config: AjaxConfig;
  controller?: AbortController;
}

export interface RequestConfig {
  url?: string;

  keepalive?: boolean;

  method?: Method;
  baseURL?: string;
  headers?: Record<string, any>;
  data?: any;
  timeout?: number;
  timeoutErrorMessage?: string;
  timeoutErrorStatus?: number;
  /**
   * omit：忽略cookie的发送
   *
   * same-origin: 表示cookie只能同域发送，不能跨域发送
   *
   * include: cookie既可以同域发送，也可以跨域发送
   */
  credentials?: Credentials;
  /**
   *  same-origin：该模式是不允许跨域的，它需要遵守同源策略，否则浏览器会返回一个error告知不能跨域；其对应的response type为basic。
   *
   *  cors: 该模式支持跨域请求，顾名思义它是以CORS的形式跨域；当然该模式也可以同域请求不需要后端额外的CORS支持；其对应的response type为cors。
   *
   *  no-cors: 该模式用于跨域请求但是服务器不带CORS响应头，也就是服务端不支持CORS；这也是fetch的特殊跨域请求方式；其对应的response type为opaque。
   */
  mode?: Mode;

  stoppedErrorMessage?: string;

  ignore?: number[];
}

export interface AjaxExConfig extends RequestConfig {
  query?: string | Record<string, string | number | boolean>;

  isFile?: boolean; // 是否要传递文件
  isNoAlert?: boolean; // 是否要提示错误信息，默认提示
  isUseOrigin?: boolean; // 为true时，直接返回response，不再处理结果
  isEncodeUrl?: boolean; //get请求时是否要进行浏览器编码
  isOutStop?: boolean;
  /**
   * 主动控制取消请求时可传递此参数，或者直接使用ajaxAbortResult方法。例如：
   *
   *    const controller = new AbortController();
   *    const {signal} = controller;
   */
  signal?: AbortSignal;
  /**
   * 如果是-1，代表不清除缓存
   *
   * 如果是0，代表不使用缓存
   */
  cacheTimeout?: number;
}

export type AjaxData = any;

export interface AjaxConfig extends AjaxExConfig {
  url: string;
  method: Method;
  data?: AjaxData;
}

type RequestCallback = (config: AjaxConfig) => AjaxConfig;

type ErrorCallback = (error: Error) => Promise<Error>;

type ResponseCallback = (data: any) => Promise<any>;


class Interceptors<T> {
  public chain: any[];

  constructor() {
    this.chain = [];
  }

  use(callback: T, errorCallback: ErrorCallback) {
    this.chain.push(callback, errorCallback);
    return this.chain.length - 2;
  }

  eject(index: number) {
    this.chain.splice(index, 2);
  }
}

export function jsonParse(str: any) {
  try {
    return JSON.parse(str);
  } catch (e) {
    return str;
  }
}

export function deleteUndefinedProperty(obj: any) {
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (obj[key] === undefined) {
        delete obj[key];
      }
    }
  }
}

export class BaseAjax {
  static defaults: AjaxExConfig = {
    credentials: "include",
    mode: "cors",
    timeout: 1000 * 60 * 2,
    timeoutErrorMessage: "timeout",
    timeoutErrorStatus: 504,
    stoppedErrorMessage: "Ajax has been stopped! ",
    method: "get",
  };

  public interceptors = {
    request: new Interceptors<RequestCallback>(),
    response: new Interceptors<ResponseCallback>(),
  };

  public caches = new Map(); // 缓存所有已经请求的Promise，同一时间重复的不再请求
  private IS_AJAX_STOP = false;

  /**
   * 停止ajax
   */
  stopAjax() {
    this.IS_AJAX_STOP = true;
  }

  isAjaxStopped() {
    return this.IS_AJAX_STOP;
  }

  protected getUniqueKey(config: AjaxConfig) {
    return (config.baseURL || "") + config.url + config.method +
      (config.data ? JSON.stringify(config.data) : "");
  }

  /**
   * 取消接口请求
   * @param controller 取消控制器
   */
  abort(controller: AbortController | undefined) {
    if (controller) {
      controller.abort();
    }
  }

  /**
   * 取消所有接口请求
   */
  abortAll() {
    for (const cache of this.caches.values()) {
      if (!cache.config.isOutStop) { // 如果是要跳出停止处理的，就不能给取消了
        this.abort(cache.controller);
      }
    }
  }

  /**
   * 提示错误，可以配置不提示
   */
  private showMessage(msg: string, config?: AjaxConfig) {
    if (config && config.isNoAlert) {
      return;
    }
    if (!msg) {
      console.error("No message available");
      return;
    }
    this.handleMessage(msg);
  }

  /**
   * 处理消息，具体实现可以覆盖此项
   */
  protected handleMessage(msg: string) {
    console.error(msg);
  }

  private handleGetUrl(url: string, data: any, isEncodeUrl?: boolean) {
    let tempUrl = url;
    if (typeof data === "object") {
      const exArr = [];
      for (const key in data) {
        exArr.push(key + "=" + data[key]);
      }
      if (exArr.length > 0) {
        const exUrl = isEncodeUrl
          ? encodeURI(encodeURI(exArr.join("&")))
          : exArr.join("&"); //这里怎么加密，与后台解密方式也有关。如果不是这样的格式，就自己拼接url
        if (!tempUrl.includes("?")) {
          tempUrl += "?" + exUrl;
        } else {
          tempUrl += "&" + exUrl;
        }
      }
    } else {
      if (data) {
        if (!tempUrl.includes("?")) {
          tempUrl += "?" + data;
        } else {
          tempUrl += "&" + data;
        }
      }
    }
    return tempUrl;
  }

  private handleBaseUrl(url: string, baseURL?: string) {
    if (url.startsWith("http")) {
      return url;
    }
    if (baseURL) {
      if (!baseURL.endsWith("/")) {
        baseURL += "/";
      }
      if (url.startsWith("/")) {
        url = url.substr(1);
      }
      return baseURL + url;
    }
    return url;
  }

  private handlePostData(data: any, isFile?: boolean) {
    let obj = data;
    if (typeof data === "object") {
      if (isFile) { //文件上传
        const formData = new FormData(); //构造空对象，下面用append方法赋值。
        for (const key in data) {
          if (!data.hasOwnProperty(key)) {
            continue;
          }
          const value = data[key];
          if (key == "files" && Array.isArray(value)) {
            value.forEach((file) => formData.append(key, file));
          } else {
            formData.append(key, value); //例：formData.append("file", document.getElementById('fileName').files[0]);
          }
        }
        obj = formData;
      } else {
        obj = JSON.stringify(data);
      }
    }
    return obj;
  }

  /**
   * 进行fetch请求
   * @param config 配置
   */
  private async request(config: AjaxConfig) {
    const {
      url,
      baseURL, //前缀url
      data,
      query,
      headers = {},
      method,
      credentials,
      isFile,
      isUseOrigin,
      isEncodeUrl, //get请求时是否要进行浏览器编码
      ignore,
      ...otherParams
    } = config;

    let tempUrl = this.handleBaseUrl(url, baseURL);
    let body: any;
    if (method.toUpperCase() === "GET") {
      body = null; //get请求不能有body
      tempUrl = this.handleGetUrl(tempUrl, data, isEncodeUrl);
    } else {
      if (query) {
        tempUrl = this.handleGetUrl(tempUrl, query, isEncodeUrl);
      }
      body = this.handlePostData(data, isFile);
      if (isFile) {
        if (!headers["Content-Type"]) {
          headers["Content-Type"] = "application/x-www-form-urlencoded";
        }
      } else if (method.toUpperCase() === "POST") {
        if (!headers["Content-Type"]) {
          headers["Content-Type"] = "application/json";
        }
      }
    }
    try {
      const response = await fetch(tempUrl, {
        headers,
        body,
        method,
        credentials,
        ...otherParams,
      });
      if (!response.ok) { // 状态码不是200到300或304，代表请求失败
        if (Array.isArray(ignore) && ignore.includes(response.status)) {
          return null;
        }
        const msg = await response.text();
        this.showMessage(msg || response.statusText, config);
        this.handleErrorResponse(response);
        return Promise.reject(response);
      }
      if (isUseOrigin) {
        return response;
      }
      //以下处理成功的结果
      const result = await response.text();
      return jsonParse(result);
    } catch (err) { //代表网络异常
      if (!this.isAbortError(err)) { //不属于主动取消的，需要进行提示
        this.showMessage(err, config);
      }
      return Promise.reject(err);
    }
  }

  /**
   * 处理200-300或304外的错误状态码的请求
   * 一般可以在这里处理跳转逻辑
   */
  protected handleErrorResponse(response: Response) {
    console.error(
      `HTTP error, status = ${response.status}, statusText = ${response.statusText}`,
    );
  }

  isAbortError(err: Error) {
    return err.name === "AbortError";
  }

  private mergeAbortConfig(
    config: AjaxConfig,
    signal?: AbortSignal,
  ): AbortController | undefined {
    let controller;
    if (typeof AbortController === "function" && signal === undefined) { // 如果要自己控制取消请求，需要自己传递signal，或者使用isReturnAbort参数
      controller = new AbortController();
      config.signal = controller.signal;
    }
    return controller;
  }

  private mergeConfig(cfg: AjaxConfig): AjaxConfig {
    deleteUndefinedProperty(cfg);
    const config = Object.assign({}, BaseAjax.defaults, cfg); // 把默认值覆盖了
    const chain = this.interceptors.request.chain;
    let callback;
    let errCallback;
    while (callback = chain.shift()) {
      try {
        errCallback = chain.shift();
        callback(config);
      } catch (e) {
        console.error(e);
        errCallback(e); // TODO 这个作用没想好
        break;
      }
    }
    return config;
  }

  private mergeResponse(promise: Promise<any>) {
    const chain = this.interceptors.response.chain;
    while (chain.length) {
      promise = promise.then(chain.shift(), chain.shift());
    }
    return promise;
  }

  private clearCacheByKey(uniqueKey: string, cacheTimeout?: number) {
    if (cacheTimeout !== undefined) {
      if (cacheTimeout >= 0) { // 如果小于0，不清除
        setTimeout(() => {
          this.caches.delete(uniqueKey);
        }, cacheTimeout);
      }
    } else {
      this.caches.delete(uniqueKey);
    }
  }

  /**
   * 实现fetch的timeout 功能
   * @param fecthPromise fetch
   * @param controller 取消控制器
   * @param config
   **/
  private fetch_timeout(
    fecthPromise: Promise<any>,
    controller: AbortController | undefined,
    config: AjaxConfig,
  ) {
    let tp: any;
    const timeout = config.timeout;
    const abortPromise = new Promise((resolve, reject) => {
      tp = setTimeout(() => {
        this.abort(controller);
        reject({
          code: config.timeoutErrorStatus,
          message: config.timeoutErrorMessage,
        });
      }, timeout);
    });

    return Promise.race([fecthPromise, abortPromise]).then((res) => {
      clearTimeout(tp);
      return res;
    });
  }

  private core_ajax(mergedConfig: AjaxConfig): AjaxResult {
    const { signal } = mergedConfig;
    const controller = this.mergeAbortConfig(mergedConfig, signal);
    const temp = this.request(mergedConfig);
    const promise = this.fetch_timeout(temp, controller, mergedConfig);
    return {
      promise: this.mergeResponse(promise),
      config: mergedConfig,
      controller,
    };
  }

  /**
   * 缓存请求，同一时间同一请求只会向后台发送一次
   */
  private cache_ajax(cfg: AjaxConfig): AjaxResult {
    const mergedConfig = this.mergeConfig(cfg);
    const { cacheTimeout } = mergedConfig;
    if (cacheTimeout === 0) { // 不缓存结果，也就是说不会过滤掉重复的请求
      return this.core_ajax(mergedConfig);
    }
    const uniqueKey = this.getUniqueKey(mergedConfig);
    const caches = this.caches;
    if (!caches.has(uniqueKey)) {
      const result = this.core_ajax(mergedConfig);
      result.promise = result.promise.then((res) => {
        this.clearCacheByKey(uniqueKey, mergedConfig.cacheTimeout);
        return res;
      }, (err) => {
        this.clearCacheByKey(uniqueKey, mergedConfig.cacheTimeout);
        return Promise.reject(err);
      });
      caches.set(uniqueKey, result);
    } else {
      console.debug(`read from cache : ${uniqueKey}`);
    }
    return caches.get(uniqueKey);
  }

  private all_ajax(cfg: AjaxConfig): AjaxResult {
    const { isOutStop } = cfg;
    if (!isOutStop && this.isAjaxStopped()) {
      return {
        promise: Promise.reject(BaseAjax.defaults.stoppedErrorMessage),
        config: cfg,
      };
    }
    return this.cache_ajax(cfg);
  }

  /**
   * ajax主方法，返回promise
   */
  ajax<T>(cfg: AjaxConfig): Promise<T> {
    const result = this.all_ajax(cfg);
    return result.promise as Promise<T>;
  }

  /**
   * 调用ajax的同时，返回取消ajax请求的方法
   */
  ajaxAbortResult<T>(cfg: AjaxConfig): AbortResult<T> {
    const result = this.all_ajax(cfg);
    return {
      promise: result.promise as Promise<T>,
      abort: () => {
        return this.abort(result.controller);
      },
    };
  }

  get<T>(url: string, data?: AjaxData, options?: AjaxExConfig) {
    return this.ajax<T>({
      url,
      method: "get",
      data,
      ...options,
    });
  }

  /**
   * 调用ajax的get请求的同时，返回取消ajax请求的方法
   */
  getAbortResult<T>(url: string, data?: AjaxData, options?: AjaxExConfig) {
    return this.ajaxAbortResult<T>({
      url,
      method: "get",
      data,
      ...options,
    });
  }

  post<T>(url: string, data?: AjaxData, options?: AjaxExConfig) {
    return this.ajax<T>({
      url,
      method: "post",
      data,
      ...options,
    });
  }

  /**
   * 调用ajax的post请求同时，返回取消ajax请求的方法
   */
  postAbortResult<T>(url: string, data?: AjaxData, options?: AjaxExConfig) {
    return this.ajaxAbortResult<T>({
      url,
      method: "post",
      data,
      ...options,
    });
  }
}
