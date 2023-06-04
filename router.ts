const wildcard = Symbol('*');

export type HandlerFn<T> = (value: T, params: StringMap<string>) => void;
export type RoutePart = string | typeof wildcard;
export type StringMap<V> = { [key: string]: V };

interface Route {
    parts: RoutePart[];
    params: string[];
}

class RouterNode<T> {
    children: Map<RoutePart, RouterNode<T>> = new Map();
    value: { element: T, route: Route } | null = null;
}

function parseRoute(path: string): Route {
    const fragments = path.trim().split('/').map(s => s.trim()).filter(p => p);

    const parts: RoutePart[] = [], params: any[] = [];
    for (const fragment of fragments) {
        const match = fragment.match(/^:(\w+)$/);
        if (match && match[1]) {
            parts.push(wildcard);
            params.push(match[1]);
        } else
            parts.push(fragment);
    }

    return { parts, params };
}

export class Router<T> {
    #root = new RouterNode<T>();
    #routeHandler: HandlerFn<T> | null = null;
    #errorHandler: ((e: any) => void) | null = null;

    public build(routes: StringMap<T>): Router<T> {
        for (const [path, element] of Object.entries(routes)) {
            const route = parseRoute(path);

            if (route.parts.length === 0) //This is a "root" view
                this.#root.value = { route, element };
            else {
                let node = this.#root;
                for (const part of route.parts) {
                    if (!node.children.has(part))
                        node.children.set(part, new RouterNode<T>());
                    node = node.children.get(part)!;
                }
                node.value = { route, element };
            }
        }

        return this;
    }

    private match(path: string): [T | null, StringMap<string>] {
        const parts = path.trim().split('/').map(p => p.trim()).filter(p => p);
        const params: string[] = [];

        let node = this.#root;
        for (const part of parts) {
            if (node.children.has(part))
                node = node.children.get(part)!;
            else if (node.children.has(wildcard)) {
                node = node.children.get(wildcard)!;
                params.push(part);
            }
            else
                return [null, {}];
        }

        if (node.value) {
            const { route, element } = node.value;
            const fullParams = Object.fromEntries(route.params.map((pkey, i) => [pkey, params[i]]));
            return [element, fullParams];
        }

        return [null, {}];
    }

    public go(route: string) {
        const [element, params] = this.match(route);

        if (element !== null)
            return this.#routeHandler!(element, params);

        this.#errorHandler ? this.#errorHandler!(route) : null;
    }

    public onRouting(handler: HandlerFn<T>): Router<T> { this.#routeHandler = handler; return this; }
    public onRoutingError(errorHandler: (e: any) => void): Router<T> { this.#errorHandler = errorHandler; return this; }
};

export class HashRouter<T> extends Router<T> {
    public build(routes: StringMap<T>): HashRouter<T> {
        super.build(routes);

        window.addEventListener('hashchange', () => this.go(this.getHashRoute()));

        return this;
    }

    private getHashRoute = (): string => window.location.hash.substring(1);

    public onRouting(handler: HandlerFn<T>, autofire: boolean = false): HashRouter<T> {
        super.onRouting(handler);
        if (autofire)
            this.go(this.getHashRoute());
        return this;
    }
    public onRoutingError(errorHandler: (e: any) => void): HashRouter<T> { super.onRoutingError(errorHandler); return this; }

    public static setRoute(path: string) { window.location.hash = path; }
}