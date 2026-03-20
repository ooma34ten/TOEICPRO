const fetch = require('node-fetch');

async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resp = await fetch(`${url}/rest/v1/categories?select=*`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  const data = await resp.json();
  console.log(JSON.stringify(data, null, 2));
}
run();
