import { HeavenError } from '../core/errors.js';
import { VALUE_FLAGS, BOOL_FLAGS, SHORT_VALUE, SHORT_BOOL } from './flag-definitions.js';

const has = (obj, key) => Object.hasOwn(obj, key);

/**
 * argv -> { _: positional words, flags: { name: value | true | [values] } }
 * Supports  --flag value | --flag=value | -H value | -Hvalue | -ik (bundled) | --
 */
export function parseArgs(argv) {
  const positional = [];
  const flags = {};
  let i = 0; // current position in argv (value-taking flags advance it)

  const storeValue = (name, value) => {
    if (VALUE_FLAGS[name].list) (flags[name] ||= []).push(value);
    else flags[name] = value;
  };

  // Consume the next argv item as a flag's value.
  const takeNext = (label) => {
    i++;
    if (i >= argv.length) throw new HeavenError(`${label} requires a value`);
    return argv[i];
  };

  // --name, --name value, --name=value
  const handleLong = (arg) => {
    const eq = arg.indexOf('=');
    const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    if (has(VALUE_FLAGS, name)) storeValue(name, eq === -1 ? takeNext(`--${name}`) : arg.slice(eq + 1));
    else if (has(BOOL_FLAGS, name)) flags[name] = true;
    else throw new HeavenError(`Unknown option --${name}. Try: heaven help`);
  };

  // -H value, -Hvalue, or bundled booleans like -ik
  const handleShort = (arg) => {
    for (let j = 1; j < arg.length; j++) {
      const ch = arg[j];
      if (has(SHORT_BOOL, ch)) { flags[SHORT_BOOL[ch]] = true; continue; }
      if (has(SHORT_VALUE, ch)) {
        const attached = arg.slice(j + 1);                 // -Hvalue
        storeValue(SHORT_VALUE[ch], attached || takeNext(`-${ch}`));
        return;                                            // a value flag ends the bundle
      }
      throw new HeavenError(`Unknown option -${ch}. Try: heaven help`);
    }
  };

  for (; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') { positional.push(...argv.slice(i + 1)); break; }
    if (arg.startsWith('--')) handleLong(arg);
    else if (arg.length > 1 && arg[0] === '-' && !/^-\d/.test(arg)) handleShort(arg); // "-5" is a value, not a flag
    else positional.push(arg);
  }
  return { _: positional, flags };
}
