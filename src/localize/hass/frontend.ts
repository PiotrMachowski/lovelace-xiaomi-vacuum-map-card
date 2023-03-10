// home-assistant/frontend/src/data/frontend.ts

import { Connection } from "home-assistant-js-websocket";

export interface CoreFrontendUserData {
    showAdvanced?: boolean;
}

declare global {
    interface FrontendUserData {
        core: CoreFrontendUserData;
    }
}

export type ValidUserDataKey = keyof FrontendUserData;

export const fetchFrontendUserData = async <
    UserDataKey extends ValidUserDataKey
>(
    conn: Connection,
    key: UserDataKey
): Promise<FrontendUserData[UserDataKey] | null> => {
    const result = await conn.sendMessagePromise<{
        value: FrontendUserData[UserDataKey] | null;
    }>({
        type: "frontend/get_user_data",
        key,
    });
    return result.value;
};