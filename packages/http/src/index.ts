import type { IncomingMessage, ServerResponse } from "node:http"
import { METHODS } from "node:http"
import { load, scan } from "@treeline/core"
import Router from "find-my-way"

export type Params = Record<string, string | undefined>

export type Handler<P extends Params = Params> = (
    req: IncomingMessage,
    res: ServerResponse,
    params: P,
    searchParams: Record<string, string>,
) => unknown

export type RouterOptions = Router.Config<Router.HTTPVersion.V1> & {
    dir: string | URL
}

export const createRoute = <P extends Params = Params>(
    handler: Handler<P>,
): Handler<P> => handler

const toRoutePath = (segments: string[]): string =>
    "/" +
    segments
        .map((segment) => {
            const match = /^\[(\.\.\.)?(.+)\]$/.exec(segment)
            if (!match) return segment
            return match[1] ? "*" : `:${match[2]}`
        })
        .join("/")

const fail = (res: ServerResponse, error: unknown): void => {
    console.error(error)
    if (res.headersSent) return void res.destroy()
    res.statusCode = 500
    res.end()
}

export const createRouter = async ({
    dir,
    ...options
}: RouterOptions): Promise<Router.Instance<Router.HTTPVersion.V1>> => {
    const router = Router(options)
    for (const { segments, file } of await scan(dir)) {
        const route = await load<Record<string, unknown>>(file)
        for (const method of METHODS) {
            const handler = route[method]
            if (typeof handler !== "function") continue
            router.on(
                method as Router.HTTPMethod,
                toRoutePath(segments),
                (req, res, params, _, query) => {
                    try {
                        const result = handler(req, res, params, query)
                        if (result instanceof Promise)
                            result.catch((error: unknown) => fail(res, error))
                    } catch (error) {
                        fail(res, error)
                    }
                },
            )
        }
    }
    return router
}
