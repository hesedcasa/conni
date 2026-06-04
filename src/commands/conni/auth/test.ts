import {createAuthTestCommand} from '@hesed/plugin-lib'

import {clearClients, testConnection} from '../../../conni/conni-client.js'

export default createAuthTestCommand({
  clearClients,
  configFile: 'conni-config.json',
  serviceName: 'Confluence',
  testConnection,
})
