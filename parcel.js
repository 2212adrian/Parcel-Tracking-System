
// Wait until supabase script loads
  window.addEventListener('load', async () => {

    // client-side cache for quick mapping
    const cache = {
      parcels: [], customers: [], branches: [], couriers: [], parcel_updates: [], admins: []
    };

    const tableSelect = document.getElementById('tableSelect');
    const tableContainer = document.getElementById('tableContainer');
    const tableCount = document.getElementById('tableCount');
    const rowDetails = document.getElementById('rowDetails');
    const formMessage = document.getElementById('formMessage');

    // helper to fetch a table
    async function fetchTable(name) {
      try {
        // try ordering by created_at where possible for nicer UX
        const orderable = ['parcels','customers','branches','couriers','parcel_updates','admins'];
        const q = supabaseClient.from(name).select('*').limit(1000);
        if (orderable.includes(name)) q.order('created_at', { ascending: false });
        const { data, error } = await q;
        if (error) {
          console.error('Fetch error', name, error);
          return [];
        }
        return data || [];
      } catch (e) {
        console.error('Unexpected fetch error', e);
        return [];
      }
    }

    // load all tables
    async function loadAll() {
      tableContainer.innerHTML = "<div class='p-4 small-muted'>Loading tables...</div>";
      cache.customers = await fetchTable('customers');
      cache.branches = await fetchTable('branches');
      cache.couriers = await fetchTable('couriers');
      cache.parcels = await fetchTable('parcels');
      cache.parcel_updates = await fetchTable('parcel_updates');
      cache.admins = await fetchTable('admins');
      populateFormSelects();
      renderSelectedTable();
    }

    // Build maps for fast lookup
    function buildMaps() {
      const customerMap = new Map(cache.customers.map(c => [c.id, c.name || c.email || (c.phone || c.id)]));
      const branchMap = new Map(cache.branches.map(b => [b.id, b.name || b.address || b.id]));
      const courierMap = new Map(cache.couriers.map(c => [c.id, c.name || c.private_id || c.id]));
      return { customerMap, branchMap, courierMap };
    }

    // generic table rendering
    // generic table rendering
function renderGenericTable(rows, name) {
  if (!rows || rows.length === 0) {
    tableContainer.innerHTML = "<div class='p-4 small-muted'>No rows found.</div>";
    tableCount.textContent = "0 rows";
    return;
  }
  const keys = Object.keys(rows[0]);

  const table = document.createElement('table');
  table.className = "min-w-full border-collapse";

  // Head
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr class="bg-gray-100 dark:bg-gray-600 dark:border-gray-700">
      ${keys.map(k => `<th class="px-3 py-2 border text-left">${escapeHtml(k)}</th>`).join("")}
    </tr>`;
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.className = "hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-300 dark:border-gray-700";
    tr.innerHTML = keys
      .map(k => `<td class="px-3 py-2 border align-top">${escapeHtml(renderCell(r[k]))}</td>`)
      .join("");
    tr.addEventListener('click', () => showDetails(r));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  tableContainer.innerHTML = "";
  tableContainer.appendChild(table);
  tableCount.textContent = `${rows.length} rows`;
}


    // parcels-specific rendering: replace fk uuids with friendly names
    function renderParcelsTable(rows) {
  const { customerMap, branchMap, courierMap } = buildMaps();

  if (!rows || rows.length === 0) {
    tableContainer.innerHTML = "<div class='p-4 small-muted'>No parcels found.</div>";
    tableCount.textContent = "0 rows";
    return;
  }

  const keys = Object.keys(rows[0]);
  const table = document.createElement("table");
  table.className = "min-w-full border-collapse";

  // Header
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr class="bg-gray-100 dark:bg-gray-600 dark:border-gray-700">
      ${keys.map(k => `<th class="px-3 py-2 border text-left">${k}</th>`).join("")}
    </tr>`;
  table.appendChild(thead);

  // Body
  const tbody = document.createElement("tbody");
  rows.forEach(r => {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-300 dark:border-gray-700";
    tr.innerHTML = keys.map(k => {
      let val = r[k];
      if (k === "sender_id") val = customerMap.get(val) || val;
      if (k === "receiver_id") val = customerMap.get(val) || val;
      if (k === "origin_branch_id") val = branchMap.get(val) || val;
      if (k === "destination_branch_id") val = branchMap.get(val) || val;
      if (k === "current_courier_id") val = courierMap.get(val) || val;
      return `<td class="px-3 py-2 border align-top">${escapeHtml(String(val ?? ""))}</td>`;
    }).join("");
    tr.addEventListener("click", () => showDetails(r));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);

  tableContainer.innerHTML = "";
  tableContainer.appendChild(table);
  tableCount.textContent = `${rows.length} rows`;
}


    // helper to render nested objects/arrays as brief strings
    function renderCell(value) {
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    }

    function escapeHtml(s) {
      if (!s && s !== 0) return '';
      return String(s).replace(/[&<>"']/g, function (m) {
        return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[m];
      });
    }

    // show JSON detail
    function showDetails(obj) {
      rowDetails.textContent = JSON.stringify(obj, null, 2);
      rowDetails.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // render currently selected table
    function renderSelectedTable() {
      const t = tableSelect.value;
      if (t === 'parcels') renderParcelsTable(cache.parcels);
      else renderGenericTable(cache[t], t);
    }

    // Populate selects used by Add Parcel form
    function populateFormSelects() {
  const { customers, branches, couriers } = cache;

  // helper
  function fillSelect(el, list, labelKey = "name") {
    el.innerHTML = '<option value="">-- Select --</option>';
    list.forEach(item => {
      const opt = document.createElement("option");
      opt.value = item.id;
      opt.textContent = item[labelKey] || item.email || item.id;
      el.appendChild(opt);
    });
  }

  fillSelect(document.getElementById("sender_id"), customers);
  fillSelect(document.getElementById("receiver_id"), customers);
  fillSelect(document.getElementById("origin_branch_id"), branches);
  fillSelect(document.getElementById("destination_branch_id"), branches);
  fillSelect(document.getElementById("current_courier_id"), couriers);
}


    // Generate simple UUID v4 (browser)
    function uuidv4() {
      return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
      );
    }

    // wire UI events
    document.getElementById('tableSelect').addEventListener('change', renderSelectedTable);
    document.getElementById('refreshAll').addEventListener('click', loadAll);

      // Random helpers
  function randomChar() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return chars.charAt(Math.floor(Math.random() * chars.length));
  }

  function generatePublicId() {
    let str = "PUB";
    for (let i = 0; i < 8; i++) str += randomChar();
    return str;
  }

  function generateSecretId() {
    let str = "SEC";
    for (let i = 0; i < 32; i++) {
      if (i % 2 === 0) str += Math.floor(Math.random() * 10); // digit
      else str += String.fromCharCode(65 + Math.floor(Math.random() * 26)); // letter A–Z
    }
    return str;
  }

  // New: generate Tracking Code like JT5D8390EF
  // Generate Tracking Code like JT5D8390EF
function generateTrackingCode() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  
  function randChar(str) {
    return str[Math.floor(Math.random() * str.length)];
  }

  return (
    "JT" +
    randChar(digits) +                 // 1 digit
    randChar(letters) +                // 1 letter
    randChar(digits) + randChar(digits) + randChar(digits) + randChar(digits) + // 4 digits
    randChar(letters) + randChar(letters) // 2 letters
  );
}



  // Wire buttons

  document.getElementById('genTrackingCode').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('tracking_code').value = generateTrackingCode();
 });

  
  document.getElementById('genPublicId').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('public_id').value = generatePublicId();
  });

  document.getElementById('genSecretId').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('secret_id').value = generateSecretId();
  });

    document.getElementById('clearForm').addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('input, select').forEach(el => { if (el.id && el.id !== 'tableSelect') el.value = ''; });
      formMessage.textContent = '';
      rowDetails.textContent = 'Click a row to view details here.';
    });

    // Add Parcel
    document.getElementById('confirmAdd').addEventListener('click', async (e) => {
      e.preventDefault();
      formMessage.style.color = 'red';
      formMessage.textContent = '';


          // Auto-generate tracking code if left empty
        if (!document.getElementById('tracking_code').value.trim()) {
          document.getElementById('tracking_code').value = generateTrackingCode();
        }
        
        // validate required fields
      const required = ['tracking_code','public_id','secret_id','sender_id','receiver_id'];
      for (const id of required) {
        const val = document.getElementById(id).value;
        if (!val || val.trim() === '') {
          formMessage.textContent = 'Please fill all required fields.';
          return;
        }
      }

      if (!confirm('Confirm adding this parcel?')) return;

      // build payload
      const get = id => document.getElementById(id).value?.trim();
      const payload = {
        tracking_code: get('tracking_code'),
        public_id: get('public_id'),
        secret_id: get('secret_id'),
        sender_id: get('sender_id'),
        receiver_id: get('receiver_id'),
        parcel_name: get('parcel_name') || null,
        weight: get('weight') ? parseFloat(get('weight')) : null,
        dimensions: get('dimensions') || null,
        parcel_type: get('parcel_type') || null,
        parcel_description: get('parcel_description') || null,
        declared_value: get('declared_value') ? parseFloat(get('declared_value')) : null,
        insurance_amount: get('insurance_amount') ? parseFloat(get('insurance_amount')) : null,
        status: get('status') || 'Pending',
        origin_branch_id: get('origin_branch_id') || null,
        destination_branch_id: get('destination_branch_id') || null,
        current_courier_id: get('current_courier_id') || null,
        expected_delivery_date: get('expected_delivery_date') || null,
        expected_delivery_time: get('expected_delivery_time') || null,
        special_instructions: get('special_instructions') || null,
        shipping_cost: get('shipping_cost') ? parseFloat(get('shipping_cost')) : null,
        sender_name: get('sender_name') || null,
        sender_contact: get('sender_contact') || null,
        sender_email: get('sender_contact') || null,
        receiver_name: get('receiver_name') || null,
        receiver_contact: get('receiver_contact') || null,
        receiver_email: get('receiver_contact') || null
      };

      // clean undefined/null/empty keys so we only send present fields
      const cleaned = {};
      Object.keys(payload).forEach(k => {
        const v = payload[k];
        if (v !== null && v !== '' && v !== undefined) cleaned[k] = v;
      });

      try {
        const { data, error } = await supabaseClient.from('parcels').insert([cleaned]).select();
        if (error) {
          formMessage.textContent = `Insert error: ${error.message || error}`;
          return;
        }
        formMessage.style.color = 'green';
        formMessage.textContent = 'Parcel added successfully.';
        // update cache and UI
        await loadAll();
        // show inserted row (if returned)
        if (data && data[0]) showDetails(data[0]);
        // clear required id fields to avoid duplicates but keep selects maybe
        document.getElementById('tracking_code').value = '';
        document.getElementById('public_id').value = '';
        document.getElementById('secret_id').value = '';
        setTimeout(()=> formMessage.textContent = '', 3000);
      } catch (err) {
        console.error(err);
        formMessage.textContent = err.message || 'Unexpected error inserting parcel';
      }
    });

    // initial load
    await loadAll();
  });
  