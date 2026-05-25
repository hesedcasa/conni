import {createAuthAddCommand} from '@hesed/plugin-lib'

import {clearClients, testConnection} from '../../../conni/conni-client.js'

export default createAuthAddCommand({
  clearClients,
  hasHostFlag: true,
  serviceName: 'Atlassian',
  testConnection,
})
