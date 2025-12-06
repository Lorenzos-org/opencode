export const EnvProtection = ({ project, client, $, directory, worktree }) => {
  return {
    'tool.execute.before': (input, output) => {
      if (input.tool === 'read' && output.args.filePath.includes('.env')) {
        throw new Error('Do not read .env files')
      }
    }
  }
}
