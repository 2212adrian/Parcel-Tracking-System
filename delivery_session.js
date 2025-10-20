// delivery_session.js

// --------------- Geolocation ----------------
document.getElementById("getLocationBtn")?.addEventListener("click", async () => {
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      document.getElementById("sessionLatitude").value = lat;
      document.getElementById("sessionLongitude").value = lng;

      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        document.getElementById("sessionLocation").value = data.display_name || "";
      } catch (err) {
        console.warn("Reverse geocoding failed:", err);
      }
    },
    (error) => {
      console.warn(error);
      alert("Unable to retrieve your location. Please allow location access.");
    }
  );
});

// --------------- Delivery Session Module ----------------
(() => {
  const client = window.supabaseClient ?? (typeof SUPABASE_URL !== 'undefined' ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null);
  if (!client) return console.warn("supabaseClient not found.");

  // DOM Elements
  const toggleBtn = document.getElementById("toggleSessionForm");
  const form = document.getElementById("deliverySessionForm");
  const parcelsSelect = document.getElementById("sessionParcels");
  const courierSelect = document.getElementById("sessionCourier");
  const sessionsList = document.getElementById("deliverySessionsList");
  const msgEl = document.getElementById("deliverySessionMessage");
  const refreshBtn = document.getElementById("refreshSessions");
  const modal = document.getElementById("sessionDetailModal");
  const modalTitle = document.getElementById("modalTitle");
  const modalBody = document.getElementById("modalBody");
  const closeModalBtn = document.getElementById("closeSessionModal");
  const cancelBtn = document.getElementById("cancelSessionBtn");

  let moduleLoaded = false;

  // ----------------- Event Listeners -----------------
  toggleBtn?.addEventListener("click", async () => {
    form.classList.toggle("hidden");
    if (!moduleLoaded) {
      await loadOptions();
      await loadActiveSessions();
      moduleLoaded = true;
    }
  });

  refreshBtn?.addEventListener("click", () => loadActiveSessions());
  cancelBtn?.addEventListener("click", () => { form.reset(); form.classList.add("hidden"); msgEl.textContent = ""; });
  closeModalBtn?.addEventListener("click", () => modal.classList.add("hidden"));

  // ----------------- Load dropdown options -----------------
  async function loadOptions() {
    try {
      // Load couriers
      const { data: couriers, error: e1 } = await client.from("couriers").select("id,name").order("name");
      if (e1) throw e1;
      courierSelect.innerHTML = `<option value="">Select Courier</option>` + (couriers || []).map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");

      // Load only unassigned parcels
      const { data: parcels, error: e2 } = await client.from("parcels")
        .select("id,tracking_code,status")
        .in("status", ["Pending", "In Transit", "Out for Delivery"])
        .is("connect_parcel", null);
      if (e2) throw e2;

      parcelsSelect.innerHTML = (parcels || []).map(p => `<option value="${p.id}">${escapeHtml(p.tracking_code)} — ${escapeHtml(p.status)}</option>`).join("");
    } catch (err) {
      console.error("loadOptions error:", err);
      msgEl.textContent = "Error loading couriers/parcels.";
      msgEl.className = "text-sm text-red-600";
    }
  }

  // ----------------- Helper Functions -----------------
  function escapeHtml(s) {
    s = s ?? "";
    s = String(s);
    return s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  }

  function escaped(s = "") {
    return (s + "").replaceAll?.("&", "&amp;").replaceAll?.("<", "&lt;").replaceAll?.(">", "&gt;") ?? (s + "");
  }

  // ----------------- Create Delivery Session -----------------
  form?.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    msgEl.textContent = "";
    msgEl.className = "text-sm";

    const courier_id = courierSelect.value || null;
    let status = document.getElementById("sessionStatus").value || "Out for Delivery";

    const validStatuses = ["Pending", "In Transit", "Out for Delivery", "Delivered", "Cancelled"];
    if (!validStatuses.includes(status)) status = "Out for Delivery";

    const selectedParcelIds = Array.from(parcelsSelect.selectedOptions || []).map(o => o.value);
    const route = document.getElementById("sessionRoute").value || null;
    const location = document.getElementById("sessionLocation").value || null;
    const lat = document.getElementById("sessionLatitude").value || null;
    const lng = document.getElementById("sessionLongitude").value || null;
    const courierNotes = document.getElementById("sessionCourierNotes").value || null;

    if (!courier_id) {
      msgEl.textContent = "Please select a courier.";
      msgEl.className = "text-sm text-red-600";
      return;
    }

    const secret_id = `SEC${Date.now()}`;
    const sessionRow = {
      parcel_id: null,
      courier_id,
      status,
      location: location || null,
      latitude: lat || null,
      longitude: lng || null,
      courier_notes: courierNotes || null,
      admin_notes: route || null,
      secret_id,
      is_active: true
    };

    try {
      // 1. Insert the session
      const { data: newSession, error: insertError } = await client.from("parcel_updates").insert([sessionRow]).select();
      if (insertError) throw insertError;

      // 2. Connect parcels AND update status for all selected
      if (selectedParcelIds.length > 0) {
        const { error: updateError } = await client.from("parcels")
          .update({ connect_parcel: newSession[0].id, status })
          .in("id", selectedParcelIds);
        if (updateError) throw updateError;
      }

      msgEl.textContent = `✅ Delivery session created. Token: ${secret_id}`;
      msgEl.className = "text-sm text-green-600";
      form.reset();
      form.classList.add("hidden");

      await loadActiveSessions();
    } catch (err) {
      console.error("create session error:", err);
      msgEl.textContent = "Error creating session: " + (err.message || err);
      msgEl.className = "text-sm text-red-600";
    }
  });

  // ----------------- Load Active Sessions -----------------
  async function loadActiveSessions() {
  sessionsList.innerHTML = `<div class="text-sm text-gray-500">Loading sessions...</div>`;
  try {
    const { data, error } = await client.from("parcel_updates")
      .select("id,secret_id,courier_id,status,created_at,is_active,admin_notes,location")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    if (error) throw error;

    if (!data || data.length === 0) {
      sessionsList.innerHTML = `<div class="p-4 bg-white dark:bg-gray-800 rounded shadow text-sm">No active sessions.</div>`;
      return;
    }

    const courierIds = [...new Set(data.map(r => r.courier_id).filter(Boolean))];
    const { data: couriers } = await client.from("couriers").select("id,name").in("id", courierIds);
    const courierMap = (couriers || []).reduce((a, c) => (a[c.id] = c.name, a), {});

    sessionsList.innerHTML = data.map(s => {
      const courierName = courierMap[s.courier_id] || "—";
      const createdAt = new Date(s.created_at).toLocaleString();
      const adminNotes = s.admin_notes || "";
      const location = s.location || "";
      return `
        <div class="p-4 bg-white dark:bg-gray-800 rounded shadow flex justify-between items-center">
          <div>
            <div class="text-sm font-semibold">Token: <span class="font-mono">${escaped(s.secret_id)}</span></div>
            <div class="text-sm text-gray-600 dark:text-gray-300">${escaped(courierName)} • ${escaped(createdAt)}</div>
            <div class="text-xs text-gray-500 mt-1">${escaped(adminNotes)} ${location ? "• " + escaped(location) : ""}</div>
          </div>
          <div class="flex gap-2">
            <button class="btn-view-session px-3 py-1 bg-blue-600 text-white rounded text-sm" data-id="${s.id}">View</button>
            <button class="btn-end-session px-3 py-1 bg-red-600 text-white rounded text-sm" data-id="${s.id}">End</button>
          </div>
        </div>
      `;
    }).join("");

    document.querySelectorAll(".btn-view-session").forEach(b => b.addEventListener("click", viewSessionHandler));
    document.querySelectorAll(".btn-end-session").forEach(b => b.addEventListener("click", endSessionHandler));
  } catch (err) {
    console.error("loadActiveSessions error:", err);
    sessionsList.innerHTML = `<div class="p-4 bg-white dark:bg-gray-800 rounded shadow text-sm text-red-600">Error loading sessions.</div>`;
  }
}


  // ----------------- View Session -----------------
  async function viewSessionHandler(ev) {
    const sessionId = ev.currentTarget.dataset.id;
    modalTitle.textContent = `Session ${sessionId}`;
    modalBody.innerHTML = `<div class="text-sm text-gray-500">Loading...</div>`;
    modal.classList.remove("hidden");

    try {
      const { data: parcels } = await client.from("parcels")
        .select("tracking_code,status,sender_name,receiver_name,connect_parcel")
        .eq("connect_parcel", sessionId);

      if (!parcels || parcels.length === 0) {
        modalBody.innerHTML = `<div class="text-sm">No parcels connected to this session.</div>`;
        return;
      }

      modalBody.innerHTML = parcels.map(p => `
        <div class="p-2 border-b">
          <div class="text-sm font-medium">Parcel: <span class="font-mono">${escapeHtml(p.tracking_code)}</span></div>
          <div class="text-xs text-gray-600 mt-1">Status: ${escapeHtml(p.status)}</div>
          <div class="text-xs text-gray-600">Sender: ${escapeHtml(p.sender_name)} • Receiver: ${escapeHtml(p.receiver_name)}</div>
        </div>
      `).join("");
    } catch (err) {
      console.error("viewSessionHandler error:", err);
      modalBody.innerHTML = `<div class="text-sm text-red-600">Error loading parcels.</div>`;
    }
  }

  // ----------------- End Session -----------------
  async function endSessionHandler(ev) {
    const sessionId = ev.currentTarget.dataset.id;
    if (!confirm("Are you sure you want to end this session? This will mark its updates inactive and disconnect parcels.")) return;

    try {
      const { data: parcels, error: parcelsErr } = await client.from("parcels")
        .select("id")
        .eq("connect_parcel", sessionId);
      if (parcelsErr) throw parcelsErr;

      const parcelIds = parcels.map(p => p.id);

      if (parcelIds.length > 0) {
        const { error: patchErr } = await client.from("parcels")
          .update({ connect_parcel: null })
          .in("id", parcelIds);
        if (patchErr) console.warn("Failed to disconnect parcels:", patchErr);
      }

      const { error: deactivateErr } = await client.from("parcel_updates")
        .update({ is_active: false })
        .eq("id", sessionId);
      if (deactivateErr) throw deactivateErr;

      await loadActiveSessions();
    } catch (err) {
      console.error("endSessionHandler error:", err);
      alert("Failed to end session: " + (err.message || err));
    }
  }

  // ----------------- Lazy-load when nav clicked -----------------
  (function attachNavHook() {
    const navBtn = document.querySelector('.navbtn[data-target="deliverySession"]');
    if (!navBtn) return;
    navBtn.addEventListener("click", async () => {
      if (!moduleLoaded) {
        await loadOptions();
        await loadActiveSessions();
        moduleLoaded = true;
      } else {
        await loadActiveSessions();
      }
    });
  })();

  document.addEventListener("DOMContentLoaded", async () => {
    if (!document.getElementById("deliverySession")?.classList.contains("hidden")) {
      await loadOptions();
      await loadActiveSessions();
      moduleLoaded = true;
    }
  });

})();
