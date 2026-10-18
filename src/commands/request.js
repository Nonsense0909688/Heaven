// heaven get|post|put|patch|delete|head|options URL [options]
import { HeavenError } from '../core/errors.js';
import { templateFromFlags } from '../request/template.js';
import { execute } from './execute.js';

export async function cmdRequest(ctx, method, url) {
  if (!url) throw new HeavenError(`Usage: heaven ${method} <url> [options]   (heaven help)`);
  return execute(ctx, templateFromFlags(ctx.flags, method, url));
}
