// home-assistant/frontend/src/common/entity/compute_domain.ts

export const computeDomain = (entityId: string): string =>
    entityId.substr(0, entityId.indexOf("."));
