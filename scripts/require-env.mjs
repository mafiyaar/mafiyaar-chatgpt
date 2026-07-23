import fs from 'node:fs';
const target=process.argv[2];if(!['staging','production'].includes(target)){console.error('Usage: node scripts/require-env.mjs <staging|production>');process.exit(2)}
const config=JSON.parse(fs.readFileSync('wrangler.jsonc','utf8'));const env=config.env?.[target],db=env?.d1_databases?.[0];const errors=[];
if(!env)errors.push(`Missing ${target} environment`);if(!db||/^0{8}-/.test(db.database_id)||String(db.database_id).includes('REPLACE'))errors.push(`${target} D1 database_id is still a placeholder`);
if(!env?.vars?.PUBLIC_ORIGIN||env.vars.PUBLIC_ORIGIN.includes('example.'))errors.push(`${target} PUBLIC_ORIGIN is still a placeholder`);
if(!env?.vars?.TURNSTILE_SITE_KEY||env.vars.TURNSTILE_SITE_KEY.startsWith('REPLACE'))errors.push(`${target} TURNSTILE_SITE_KEY is still a placeholder`);
if(errors.length){console.error(errors.join('\n'));process.exit(1)}console.log(`${target} non-secret configuration is ready. Run wrangler secret list --env ${target} before deployment.`);
