# Waymark

A small file-based router: the folder tree is the route table.

- [`@waymark/cli`](packages/cli): commands for a CLI
- [`@waymark/http`](packages/http): routes for an HTTP server, on find-my-way
- `@waymark/core`: what both share; private, bundled into the other two

## Install

Waymark is not on npm. Yarn 4 fetches git dependencies only from approved repositories, so add it to `.yarnrc.yml`:

```yaml
approvedGitRepositories:
    - "https://github.com/OKThomas1/waymark.git"
```

Then install a package from the repo, pinned to a tag:

```sh
yarn add "@waymark/cli@github:OKThomas1/waymark#workspace=@waymark/cli&tag=v0.2.0"
```

The package builds when it is installed.

## Usage

```
commands/secrets/approve.ts    mycli secrets approve
routes/users/[id].ts           GET /users/:id
```

```ts
// commands/secrets/approve.ts
export default createCommand({
    args: { name: { required: true } },
    run: ({ args }) => console.log(`approved ${args.name}`),
})

// routes/users/[id].ts
export const GET = createRoute<{ id: string }>((req, res, params) =>
    res.end(params.id),
)
```

```ts
await runCli({ name: "mycli", dir: new URL("./commands", import.meta.url) })

const router = await createRouter({ dir: new URL("./routes", import.meta.url) })
createServer((req, res) => router.lookup(req, res)).listen(3000)
```

See each package's README for the full API.
