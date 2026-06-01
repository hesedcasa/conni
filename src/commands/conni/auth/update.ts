import {createAuthUpdateCommand} from '@hesed/plugin-lib'

import {clearClients, testConnection} from '../../../conni/conni-client.js'

export default createAuthUpdateCommand({
  clearClients,
  serviceName: 'Confluence',
  testConnection,
})
