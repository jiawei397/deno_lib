// deno run --unstable --allow-read  demo.ts
import { render, renderFile } from "https://deno.land/x/deno_ejs/mod.ts";

const users = ["geddy", "neil", "alex"];
let res = render('<p>[?= users.join(" | "); ?]</p>', { users: users }, {
  delimiter: "?",
  openDelimiter: "[",
  closeDelimiter: "]",
});
// => '<p>geddy | neil | alex</p>'

console.log(res);

renderFile(
  "./template.ejs",
  {
    title: "from test2",
    name: "world",
    age: 18,
  },
  {},
  function (err: Error, str: any) {
    if (err) {
      console.error(err);
    } else {
      console.log(str);
    }
  },
);
