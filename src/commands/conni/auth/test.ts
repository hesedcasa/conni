import {createAuthTestCommand} from '@hesed/plugin-lib'

import {clearClients, testConnection} from '../../../conni/conni-client.js'

export default createAuthTestCommand({
  clearClients,
  hasHostFlag: true,
  serviceName: 'Confluence',
  testConnection,
})
