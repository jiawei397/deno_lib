import { assert, dirname, fromFileUrl, resolve } from "../../test_deps.ts";
import { render, renderFile } from "../mod.ts";

const __dirname = dirname(fromFileUrl(import.meta.url));

Deno.test("test render", () => {
  const users = ["geddy", "neil", "alex"];
  const res = render('<p>[?= users.join(" | "); ?]</p>', { users: users }, {
    delimiter: "?",
    openDelimiter: "[",
    closeDelimiter: "]",
  });
  assert(res, "<p>geddy | neil | alex</p>");
});

Deno.test("test renderFile", async () => {
  const str = await renderFile(
    resolve(__dirname, "../examples/template.ejs"),
    {
      title: "from test2",
      name: "world",
      age: 18,
    },
    {},
  );
  assert(
    str,
    `<body>
<h1>from test2!</h1>
<h1>18</h1>


<h1>hello, world!</h1>

</body>`,
  );
});
