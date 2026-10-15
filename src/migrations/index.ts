import * as migration_20261015_230956_initial from './20261015_230956_initial';
import * as migration_20261015_232427_typologies from './20261015_232427_typologies';

export const migrations = [
  {
    up: migration_20261015_230956_initial.up,
    down: migration_20261015_230956_initial.down,
    name: '20261015_230956_initial',
  },
  {
    up: migration_20261015_232427_typologies.up,
    down: migration_20261015_232427_typologies.down,
    name: '20261015_232427_typologies'
  },
];
