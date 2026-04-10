import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { FlatCompat } from '@eslint/eslintrc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({
  baseDirectory: __dirname
});

export default [...compat.extends('next/core-web-vitals')];
