import {createAuthAddCommand} from '@hesed/plugin-lib'

import {clearClients, testConnection} from '../../../conni/conni-client.js'

export default createAuthAddCommand({
  clearClients,
  configFile: 'conni-config.json',
  serviceName: 'Confluence',
  testConnection,
})
