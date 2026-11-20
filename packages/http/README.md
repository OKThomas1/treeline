# @waymark/http

File-based routes for an HTTP server, on [find-my-way](https://github.com/delvedor/find-my-way).

```
routes/
  index.ts             /
  users/
    index.ts           /users
    [id].ts            /users/:id
  files/
    [...path].ts       /files/*
```

`index` files map to their folder. `[name]` is a parameter and `[...name]` a catch-all; both arrive in `params` under their name. Files and folders starting with `_` are skipped.

## Server

```ts
import { createServer } from "node:http"
import { createRouter } from "@waymark/http"

const router = await createRouter({
    dir: new URL("./routes", import.meta.url),
})

createServer((req, res) => router.lookup(req, res)).listen(3000)
```

Every other option is passed to find-my-way, and the find-my-way router is returned.

## Routes

A route file exports its handlers by HTTP method:

```ts
export const GET = (req, res, params, searchParams) => res.end("ok")
```

Wrap a handler in `createRoute` to have it typed:

```ts
import { createRoute } from "@waymark/http"

export const POST = createRoute<{ id: string }>((req, res, params) => {
    res.end(params.id)
})
```

A handler that throws or rejects is logged and answered with a 500.
