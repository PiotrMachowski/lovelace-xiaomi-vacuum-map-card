import { IconActionConfig, Language, TileConfig, VariablesStorage } from "../../types/types";
import { HomeAssistantFixed } from "../../types/fixes";

export class GeneratorWrapper {
    public static generate<T extends TileConfig | IconActionConfig>(
        hass: HomeAssistantFixed,
        itemsConfigs: T[] | undefined,
        vacuumEntity: string,
        vacuumPlatform: string,
        internalVariables: VariablesStorage,
        language: Language,
        appendItems: boolean,
        idExtractor: (_: T) => string | undefined,
        sortFunction: (_1: T, _2: T) => number,
        generateFunction: (
            hass: HomeAssistantFixed,
            vacuumEntity: string,
            platform: string,
            language: Language,
            itemsToOverride: T[],
            variables: VariablesStorage,
        ) => Promise<T[]>,


    ): Promise<T[]> {
        const itemsToIgnore = (itemsConfigs ?? []).filter(t => idExtractor(t) !== undefined);
        const itemsGenerated: Promise<T[]> =
            (itemsConfigs?.length ?? -1) === -1
                ? generateFunction(
                    hass,
                    vacuumEntity,
                    vacuumPlatform,
                    language,
                    itemsToIgnore,
                    internalVariables,
                )
                : appendItems
                    ? generateFunction(
                        hass,
                        vacuumEntity,
                        vacuumPlatform,
                        language,
                        itemsToIgnore,
                        internalVariables,
                    ).then(items => {
                        const itemsIds = items.map(t => idExtractor(t) ?? "");
                        return [
                            ...items,
                            ...(itemsConfigs ?? []).filter(t => !t.replace_config &&
                                (idExtractor(t) === undefined || !itemsIds.includes(idExtractor(t)??""))),
                        ];
                    })
                    : new Promise(resolve => resolve(itemsConfigs ?? []));
        return itemsGenerated.then(t => [...t].sort(sortFunction));
    }
}