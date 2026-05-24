import {createAuthUpdateCommand} from '@hesed/plugin-lib'

import {clearClients, testConnection} from '../../../conni/conni-client.js'

export default createAuthUpdateCommand({
  clearClients,
  configFile: 'conni-config.json',
  hasHostFlag: true,
  serviceName: 'Confluence',
  testConnection,
})
