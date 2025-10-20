const SUPABASE_URL = "https://ehupnvkselcupxqyofzy.supabase.co";
const SUPABASE_KEY = "sb_publishable_cNXTZmBrYiYvd8SOI2ZGkQ_sWHLy_uf";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true }
});

console.log("🔗 Supabase client created.");


let map, marker, subscription;
let currentParcels = [];
let geoWatchId = null;

function setStaticInputsDisabled(disabled) {
  // Top form inputs
  document.getElementById("trackingId").disabled = disabled;
  document.getElementById("updateBtn").disabled = disabled;
  document.getElementById("parcelLat").disabled = disabled;
  document.getElementById("parcelLng").disabled = disabled;

  // Disable all inputs and buttons inside parcelList
  const parcelList = document.getElementById("parcelList");
  if(parcelList){
    const inputs = parcelList.querySelectorAll("input, select, button");
    inputs.forEach(el => el.disabled = disabled);
  }
}


// Update all parcels using bottom button
document.getElementById("updateStatusBtn").addEventListener("click", async function() {
  if(!currentParcels.length) return showMessage("No parcels to update", "error");

  const status = document.getElementById("parcelStatus").value;
  const lat = parseFloat(document.getElementById("parcelLat").value);
  const lng = parseFloat(document.getElementById("parcelLng").value);
  if(isNaN(lat) || isNaN(lng)) return showMessage("Invalid latitude or longitude", "error");

  for (let i = 0; i < currentParcels.length; i++){
    const parcel = currentParcels[i];

    const { data, error } = await supabaseClient
      .from("parcels")
      .update({ status, latitude: lat, longitude: lng })
      .eq("id", parcel.id)
      .select("*");

    if(error){
      showMessage(`Error updating parcel ID ${parcel.id}: ${error.message}`, "error");
      continue;
    }

    currentParcels[i] = data[0];

    const statusEl = document.getElementById(`status_${i}`);
    if(statusEl) statusEl.innerText = status;
    const latEl = document.getElementById(`lat_${i}`);
    if(latEl) latEl.value = lat;
    const lngEl = document.getElementById(`lng_${i}`);
    if(lngEl) lngEl.value = lng;
    const selectEl = document.getElementById(`statusSelect_${i}`);
    if(selectEl) selectEl.value = status;
  }

showMessage(`All parcels updated: ${status}, ${lat}, ${lng}`, "success", "#28a745");


  if(map && currentParcels.length){
    const lastParcel = currentParcels[currentParcels.length-1];
    if(marker) animateMarker(marker, marker.getLatLng(), L.latLng(lastParcel.latitude, lastParcel.longitude), 1000);
    map.setView([lastParcel.latitude, lastParcel.longitude], 13);
    if(marker) marker.bindPopup(`📍 ${status}`).openPopup();
  }
});


// Role selection overlay
window.addEventListener('DOMContentLoaded', function() {
  const appContent = document.getElementById('appContent');
  const loadingOverlay = document.getElementById('loadingOverlay');
  const roleOverlay = document.getElementById('roleOverlay');
  const geoToggleContainer = document.getElementById("geoToggleContainer");

  appContent.style.display = 'none';

  setTimeout(() => {
    loadingOverlay.classList.add('opacity-0');
    setTimeout(() => {
      loadingOverlay.style.display = 'none';
      roleOverlay.style.display = 'flex';
      roleOverlay.classList.remove('pointer-events-none', 'opacity-0', '-translate-y-20');
      roleOverlay.classList.add('opacity-100', 'translate-y-0');
    }, 700);
  }, 1800);

  function handleRoleSelect(selectedBtnId) {
    roleOverlay.classList.remove('opacity-100', 'translate-y-0');
    roleOverlay.classList.add('opacity-0', '-translate-y-20');

    setTimeout(() => {
      roleOverlay.style.display = 'none';
      appContent.style.display = 'block';
      const otherBtnId = selectedBtnId === 'customerBtn' ? 'courierBtn' : 'customerBtn';
      document.getElementById(otherBtnId).style.display = 'none';
      document.getElementById(selectedBtnId).style.display = 'inline-block';
      setTimeout(() => {
        appContent.classList.remove('opacity-0');
        appContent.classList.add('opacity-100');
      }, 50);

      geoToggleContainer.style.display = selectedBtnId === "courierBtn" ? "flex" : "none";
    }, 700);
  }

  document.getElementById('overlayCustomerBtn').addEventListener('click', () => {
    window.selectedUserType = 'customer';
    handleRoleSelect('customerBtn');
  });
  document.getElementById('overlayCourierBtn').addEventListener('click', () => {
    window.selectedUserType = 'courier';
    handleRoleSelect('courierBtn');
  });

  document.getElementById("geoToggle").addEventListener("change", function() {
  const statusInput = document.getElementById("parcelStatus");
  const latInput = document.getElementById("parcelLat");
  const lngInput = document.getElementById("parcelLng");

  if(this.checked){
    if(navigator.geolocation){
      // Disable all inputs while live location is on
      setStaticInputsDisabled(true);

      geoWatchId = navigator.geolocation.watchPosition(async pos => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        // Update Courier Actions inputs
        latInput.value = lat;
        lngInput.value = lng;

        // Update all parcels in parcelList UI in real-time
        currentParcels.forEach((parcel, idx) => {
          const latEl = document.getElementById(`lat_${idx}`);
          const lngEl = document.getElementById(`lng_${idx}`);
          const statusSelectEl = document.getElementById(`statusSelect_${idx}`);
          const statusTextEl = document.getElementById(`status_${idx}`);

          if(latEl) latEl.value = lat;
          if(lngEl) lngEl.value = lng;
          if(statusSelectEl) statusSelectEl.value = statusInput.value;
          if(statusTextEl) statusTextEl.innerText = statusInput.value;

          parcel.latitude = lat;
          parcel.longitude = lng;
          parcel.status = statusInput.value;
        });

        // Push updates to Supabase for all parcels
        for(const parcel of currentParcels){
          await supabaseClient
            .from("parcels")
            .update({ latitude: parcel.latitude, longitude: parcel.longitude, status: parcel.status })
            .eq("id", parcel.id);
        }

        // Update map marker for last parcel
        if(map && marker && currentParcels.length){
          const lastParcel = currentParcels[currentParcels.length-1];
          animateMarker(marker, marker.getLatLng(), L.latLng(lastParcel.latitude, lastParcel.longitude), 1000);
          map.setView([lastParcel.latitude, lastParcel.longitude], 13);
        }

      }, err => showMessage("Geolocation error: "+err.message, "error"), { enableHighAccuracy: true });

    } else showMessage("Geolocation not supported", "error");
  } else {
    // Stop live location
    if(geoWatchId !== null){
      navigator.geolocation.clearWatch(geoWatchId);
      geoWatchId = null;
      setStaticInputsDisabled(false); // re-enable inputs
    }
  }
});

});

// Tracking parcels
async function trackParcel() {
  const secretId = document.getElementById("trackingId").value.trim();
  if (!secretId) return showMessage("Enter a valid Secret ID", "error");
  if (!window.selectedUserType) return showMessage("Select user type first, Customer or Courier.", "error");

  if(subscription) supabaseClient.removeChannel(subscription);

  if(window.selectedUserType === "courier"){
    const { data: updates, error: updatesError } = await supabaseClient
      .from("parcel_updates")
      .select("*")
      .eq("secret_id", secretId);

    if (updatesError || !updates.length) return showMessage("No parcels linked to this Courier ID", "error");

    const parcelIds = updates.map(u => u.id);
    const { data: parcels, error: parcelsError } = await supabaseClient
      .from("parcels")
      .select("*")
      .in("connect_parcel", parcelIds);

    if(parcelsError || !parcels.length) return showMessage("No parcels found for this Courier ID", "error");

    currentParcels = parcels;
    document.getElementById("courierInfo").style.display = "block";
    displayParcels(parcels);
  } else {
    const { data: parcel, error } = await supabaseClient
      .from("parcels")
      .select("*")
      .eq("public_id", secretId)
      .maybeSingle();

    if(error || !parcel) return showMessage("No parcel found with this Secret ID", "error");
    currentParcels = [parcel];
    displayParcels([parcel]);
  }
}

// Display parcels with toggleable details
function displayParcels(parcels) {
  const parcelList = document.getElementById("parcelList");
  parcelList.innerHTML = "";

  const isCourier = window.selectedUserType === "courier";
  document.getElementById("courierInfo").style.display = isCourier ? "block" : "none";

  if (!isCourier) {
  const parcel = parcels[0];

  // Show customer container
  const customerDiv = document.getElementById("customerInfo");
  customerDiv.style.display = "block";

  // Populate sender/receiver info
  document.getElementById("sender").innerText = parcel.sender_name || "-";
  document.getElementById("senderAddress").innerText = parcel.sender_address || "-";
  document.getElementById("senderContact").innerText = parcel.sender_contact || "-";
  document.getElementById("senderEmail").innerText = parcel.sender_email || "-";

  document.getElementById("receiver").innerText = parcel.receiver_name || "-";
  document.getElementById("receiverAddress").innerText = parcel.receiver_address || "-";
  document.getElementById("receiverContact").innerText = parcel.receiver_contact || "-";
  document.getElementById("receiverEmail").innerText = parcel.receiver_email || "-";

  document.getElementById("status").innerText = parcel.status || "-";
  document.getElementById("parcelName").innerText = parcel.parcel_name || "-";

  // Show toggleable details
  const toggleBtn = document.getElementById("toggleCustomerDetails");
  const detailsDiv = document.getElementById("customerDetails");

  // Remove previous listeners to avoid duplicates
  const newToggleBtn = toggleBtn.cloneNode(true);
  toggleBtn.parentNode.replaceChild(newToggleBtn, toggleBtn);

  newToggleBtn.addEventListener("click", () => {
    detailsDiv.classList.toggle("hidden");
    newToggleBtn.innerText = detailsDiv.classList.contains("hidden") ? "Show Details" : "Hide Details";
  });

  // Show map
  const lat = parcel.latitude || 14.5995;
  const lng = parcel.longitude || 120.9842;
  if (!map) {
    map = L.map("map").setView([lat, lng], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors"
    }).addTo(map);
    marker = L.marker([lat, lng]).addTo(map);
  } else {
    animateMarker(marker, marker.getLatLng(), L.latLng(lat, lng), 1000);
    map.setView([lat, lng], 13);
  }
  marker.bindPopup(`📍 ${parcel.status}`).openPopup();
}

 else {
    // Courier view (multiple parcels with editable fields)
    parcels.forEach((parcel, idx) => {
      const div = document.createElement("div");
      div.className = "mb-2 p-2 bg-gray-100 rounded shadow relative";

      div.innerHTML = `
        <div class="flex justify-between items-center">
          <p><strong>Parcel Name:</strong> ${parcel.parcel_name || "N/A"}</p>
          <button id="toggle_${idx}" class="bg-blue-600 text-white px-2 py-1 rounded text-sm">Show Details</button>
        </div>
        <div id="details_${idx}" class="mt-2 hidden p-2 bg-gray-50 rounded">
          <p><strong>Status:</strong> <span id="status_${idx}">${parcel.status}</span></p>
          <p><strong>Weight:</strong> ${parcel.weight || "-"}</p>
          <p><strong>Dimension:</strong> ${parcel.dimension || "-"}</p>
          <p><strong>Parcel Type:</strong> ${parcel.parcel_type || "-"}</p>
          <p><strong>Sender Name:</strong> ${parcel.sender_name || "-"}</p>
          <p><strong>Sender Address:</strong> ${parcel.sender_address || "-"}</p>
          <p><strong>Sender Contact:</strong> ${parcel.sender_contact || "-"}</p>
          <p><strong>Receiver Name:</strong> ${parcel.receiver_name || "-"}</p>
          <p><strong>Receiver Address:</strong> ${parcel.receiver_address || "-"}</p>
          <p><strong>Receiver Contact:</strong> ${parcel.receiver_contact || "-"}</p>
          <div class="flex flex-wrap gap-2 mt-1">
            <input type="number" id="lat_${idx}" placeholder="Latitude" step="0.000001" value="${parcel.latitude || 0}" class="flex-1 min-w-[120px] border px-2 py-1 rounded">
            <input type="number" id="lng_${idx}" placeholder="Longitude" step="0.000001" value="${parcel.longitude || 0}" class="flex-1 min-w-[120px] border px-2 py-1 rounded">
            <select id="statusSelect_${idx}" class="border px-2 py-1 rounded flex-1 min-w-[140px]">
              <option value="Pending">Pending</option>
              <option value="In Transit">In Transit</option>
              <option value="Out for Delivery">Out for Delivery</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <button class="bg-gray-700 text-white px-2 py-1 rounded flex-1 min-w-[80px]" onclick="updateParcel(${idx})">Update</button>
          </div>
        </div>
      `;
      parcelList.appendChild(div);

      document.getElementById(`statusSelect_${idx}`).value = parcel.status || "Pending";

      document.getElementById(`toggle_${idx}`).addEventListener("click", () => {
        const detailsDiv = document.getElementById(`details_${idx}`);
        const btn = document.getElementById(`toggle_${idx}`);
        detailsDiv.classList.toggle("hidden");
        btn.innerText = detailsDiv.classList.contains("hidden") ? "Show Details" : "Hide Details";
      });

      // Update map for last parcel
      const lat = parcel.latitude || 14.5995;
      const lng = parcel.longitude || 120.9842;
      if (!map) {
        map = L.map("map").setView([lat, lng], 13);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors" }).addTo(map);
        marker = L.marker([lat, lng]).addTo(map);
      } else {
        animateMarker(marker, marker.getLatLng(), L.latLng(lat, lng), 1000);
        map.setView([lat, lng], 13);
      }
      marker.bindPopup(`📍 ${parcel.status}`).openPopup();
    });
  }

  document.getElementById("result").classList.remove("hidden");
}


// Update single parcel
async function updateParcel(idx){
  const parcel = currentParcels[idx];
  const lat = parseFloat(document.getElementById(`lat_${idx}`).value) || 0;
  const lng = parseFloat(document.getElementById(`lng_${idx}`).value) || 0;
  const status = document.getElementById(`statusSelect_${idx}`).value;

  await supabaseClient.from("parcels")
    .update({ latitude: lat, longitude: lng, status })
    .eq("id", parcel.id);

  parcel.latitude = lat;
  parcel.longitude = lng;
  parcel.status = status;
  document.getElementById(`status_${idx}`).innerText = status;

  if(map && marker) animateMarker(marker, marker.getLatLng(), L.latLng(lat, lng), 1000);
}

// Smooth marker animation
function animateMarker(marker, startLatLng, endLatLng, duration){
  const startTime = performance.now();
  function animate(time){
    const elapsed = time - startTime;
    const t = Math.min(1, elapsed/duration);
    const lat = startLatLng.lat + (endLatLng.lat - startLatLng.lat)*t;
    const lng = startLatLng.lng + (endLatLng.lng - startLatLng.lng)*t;
    marker.setLatLng([lat, lng]);
    if(t < 1) requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}















function showMessage(msg, type = "info", bgColor = "#e70014") {
  let oldMsg = document.getElementById("customMessageBox");
  if (oldMsg) oldMsg.remove();

  const box = document.createElement("div");
  box.id = "customMessageBox";
  box.className = `fixed top-24 left-1/2 transform -translate-x-1/2 -translate-y-12 z-[200] px-6 py-3 rounded-lg shadow-lg text-white text-center opacity-0 transition-all duration-500`;
  box.style.backgroundColor = bgColor; // set the background color
  box.innerText = msg;

  document.body.appendChild(box);

  requestAnimationFrame(() => {
    box.classList.remove("-translate-y-12", "opacity-0");
    box.classList.add("translate-y-0", "opacity-100");
  });

  setTimeout(() => {
    box.classList.remove("translate-y-0", "opacity-100");
    box.classList.add("-translate-y-12", "opacity-0");
    setTimeout(() => box.remove(), 5000);
  }, 2500);
}
