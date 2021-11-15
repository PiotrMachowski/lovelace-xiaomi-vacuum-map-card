export class ServiceCall {
    constructor(
        public readonly domain: string,
        public readonly service: string,
        public readonly serviceData: Record<string, unknown> | undefined,
        public readonly target: Record<string, unknown> | undefined,
    ) {}
}
