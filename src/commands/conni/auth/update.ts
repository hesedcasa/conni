import {createAuthUpdateCommand} from '@hesed/plugin-lib'

import {clearClients, testConnection} from '../../../conni/conni-client.js'

export default createAuthUpdateCommand({
  clearClients,
  hasHostFlag: true,
  serviceName: 'Atlassian',
  testConnection,
})
