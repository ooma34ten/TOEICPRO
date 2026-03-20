const https = require('https');

const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/categories?select=*');
const options = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: 'GET',
    headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY
    }
};

const req = https.request(options, res => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => {
        console.log(data);
    });
});

req.on('error', error => { console.error(error); });
req.end();
