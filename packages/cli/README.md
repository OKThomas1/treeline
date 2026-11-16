# @treeline/cli

File-based commands for a CLI.

```
commands/
  index.ts             mycli
  deploy.ts            mycli deploy
  secrets/
    approve.ts         mycli secrets approve
    list.ts            mycli secrets list
```

`index` files map to their folder. Files and folders starting with `_` are skipped. Only the matched command file is imported; help imports a group's children to show their descriptions.

## Entry

```ts
import { runCli } from "@treeline/cli"

await runCli({ name: "mycli", dir: new URL("./commands", import.meta.url) })
```

`argv` defaults to `process.argv.slice(2)`.

## Commands

A command file default-exports `createCommand`. Everything except `run` is optional.

```ts
import { createCommand } from "@treeline/cli"

export default createCommand({
    description: "Approve a secret",
    args: { name: { required: true } },
    flags: { force: { type: "boolean", short: "f" } },
    run: ({ args, flags }) => {},
})
```

- **args** are positional, in key order: `{ description?, required?, variadic? }`. A variadic arg must be last and receives `string[]`.
- **flags**: `{ type?: "string" | "boolean", short?, description?, multiple?, required?, default? }`. `type` defaults to `"string"`.
- **run** receives `{ args, flags, path }`, typed from the definitions.

`-h` and `--help` print help generated from the folder tree. Unknown commands, unknown flags and missing values print an error and help and set exit code 1.
