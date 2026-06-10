module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'test', 'refactor', 'docs', 'chore', 'perf', 'ci']],
    'subject-case': [0],
  },
};
