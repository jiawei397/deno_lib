import { BaseAjax } from "./mod.ts";

class Ajax extends BaseAjax {
  /**
   * 处理消息，具体实现可以覆盖此项
   */
  protected handleMessage(msg: string) {
    console.log("handleMessage", msg);
    super.handleMessage(msg);
  }

  /**
   * 处理错误请求
   */
  protected handleErrorResponse(response: Response) {
    console.error(
      `HTTP error, status = ${response.status}, statusText = ${response.statusText}`,
    );
  }
}

// Ajax.defaults.baseURL = "/api";

export const ajax = new Ajax();

interface User {
  name: string;
}

for (let i = 0; i < 100; i++) {
  ajax.get<User>("http://localhost:4000/api", {
    1: 1,
  }, {
    timeout: 100,
    headers: {
      aa: 2,
    },
  }).then((res) => console.log(res));
}
