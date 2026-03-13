let cacheBody = null;
let cacheTime = 0;

exports.handler = async function(event) {
  try {
    const apiKey = process.env.BODS_API_KEY || process.env.BODS_KEY || process.env.BODS_APIKEY;
    if(!apiKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Missing BODS_API_KEY' }) };
    }

    const bbox = process.env.BODS_BBOX || '-0.95,51.90,-0.55,52.15';
    const now = Date.now();
    if(cacheBody && now - cacheTime < 15000) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=10'
        },
        body: cacheBody
      };
    }

    const url = `https://data.bus-data.dft.gov.uk/api/v1/datafeed?api_key=${apiKey}&boundingBox=${encodeURIComponent(bbox)}`;
    const r = await fetch(url);
    if(!r.ok) {
      return { statusCode: r.status, body: JSON.stringify({ error: 'Upstream error', status: r.status }) };
    }

    const xml = await r.text();
    const vehicles = parseSiriVm(xml);

    const body = JSON.stringify({ vehicles, fetchedAt: new Date().toISOString() });
    cacheBody = body;
    cacheTime = now;

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=10'
      },
      body
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};

function parseSiriVm(xml) {
  if(!xml || typeof xml !== 'string') return [];
  const activities = xml.split('<VehicleActivity').slice(1).map(chunk => '<VehicleActivity' + chunk.split('</VehicleActivity>')[0]);
  const out = [];

  for(const block of activities) {
    const lat = num(tag(block,'Latitude'));
    const lng = num(tag(block,'Longitude'));
    if(lat === null || lng === null) continue;
    const routeId = tag(block,'LineRef') || tag(block,'PublishedLineName');
    const vehicleId = tag(block,'VehicleRef') || tag(block,'VehicleId');
    const operator = tag(block,'OperatorRef');
    const recorded = tag(block,'RecordedAtTime');
    out.push({
      id: tag(block,'ItemIdentifier') || vehicleId || null,
      lat, lng,
      routeId: routeId || null,
      vehicleId: vehicleId || null,
      operator: operator || null,
      timestamp: recorded || null
    });
  }
  return out;
}

function tag(block, name) {
  const re = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i');
  const m = re.exec(block);
  return m ? m[1].trim() : null;
}

function num(v) {
  if(v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
