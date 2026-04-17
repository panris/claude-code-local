import type { Command } from '../../commands.js'

const model = {
  type: 'local-jsx',
  name: 'model',
  description: 'Open model configuration panel',
  load: () => import('./model.js'),
} satisfies Command

export default model
