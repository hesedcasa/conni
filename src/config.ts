import {createProfileManager, type AuthConfig, type Config, type Profiles} from '@hesed/plugin-lib'

const {getDefaultProfile, setDefaultProfile, readConfig, readProfiles} = createProfileManager('conni-config.json')

export {getDefaultProfile, setDefaultProfile, readConfig, readProfiles}
export type {AuthConfig, Config, Profiles}
