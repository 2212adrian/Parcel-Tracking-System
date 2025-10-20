const SUPABASE_URL = "https://ehupnvkselcupxqyofzy.supabase.co";
const SUPABASE_KEY = "sb_publishable_cNXTZmBrYiYvd8SOI2ZGkQ_sWHLy_uf";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true }
});

console.log("🔗 Supabase client created. Attempting connection...");

// Optional: test connection by fetching 1 row from parcels table
supabaseClient
  .from("parcels")
  .select("public_id")
  .then(({ data, error }) => {
    //console.log("🔎 Raw response:", { data, error });
    if (error) {
      console.error("❌ Supabase error:", error);
    } else {
      if (!data || data.length === 0) {
        console.warn("⚠️ No rows found in parcels table.");
      } else {
        console.log("✅ Supabase connection successful.");
        //console.log(data);
      }
    }
  });


  


function showMessage(msg, type = "info") {
  // Remove existing message if present
  let oldMsg = document.getElementById("customMessageBox");
  if (oldMsg) oldMsg.remove();

  // Create message box
  const box = document.createElement("div");
  box.id = "customMessageBox";
  box.className = `fixed top-24 left-1/2 transform -translate-x-1/2 -translate-y-12 z-[200] px-6 py-3 rounded-lg shadow-lg text-white text-center bg-[#e70014] opacity-0 transition-all duration-500`;
  box.innerText = msg;

  document.body.appendChild(box);

  // Entrance animation: slide down and fade in
  requestAnimationFrame(() => {
    box.classList.remove("-translate-y-12", "opacity-0");
    box.classList.add("translate-y-0", "opacity-100");
  });

  // Exit animation: slide up and fade out after 2.5s
  setTimeout(() => {
    box.classList.remove("translate-y-0", "opacity-100");
    box.classList.add("-translate-y-12", "opacity-0");
    setTimeout(() => box.remove(), 5000); // match duration-500
  }, 2500);
}

// FOR DEBUGGING: Display all parcels in console
//async function displayAllParcels() {
//  
//  const { data, error } = await supabaseClient
//    .from("branches")
//    .select(`*`);
//  if (error) {
//    console.error("❌ Error fetching parcels:", error);
//    return;
//  }
//
//  // Format data for console.table
//  const tableData = data.map(parcel => ({
//    id: parcel.id,
//    name: parcel.name,
//  }));
//
//  console.table(tableData);
//}
//displayAllParcels();














// ------------------------------
// Refresh access token if expired
// ------------------------------
async function getValidAccessToken() {
  let accessToken = getCookie("sb-access-token");
  const refreshToken = getCookie("sb-refresh-token");

  if (!accessToken && refreshToken) {
    // Refresh session using Supabase
    const { data, error } = await supabaseClient.auth.setSession({ refresh_token: refreshToken });
    if (error) return null;

    accessToken = data.session.access_token;
    setCookie("sb-access-token", accessToken, 1);
  }
  return accessToken;
}

// ------------------------------
// Cookie helpers
// ------------------------------
function setCookie(name, value, days) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = "; expires=" + date.toUTCString();
  }
  let secureFlag = location.protocol === "https:" ? "; Secure" : "";
document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/; SameSite=Strict" + secureFlag;
}

function getCookie(name) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i].trim();
    if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length));
  }
  return null;
}

function deleteCookie(name) {
  document.cookie = name + "=; Max-Age=0; path=/; Secure; SameSite=Strict";
}

// ------------------------------
// Login function
// ------------------------------
let isLoggingIn = false; // global flag

async function login() {
  if (isLoggingIn) return; // prevent multiple simultaneous logins
  isLoggingIn = true;

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const messageBox = document.getElementById("authMessage");
  const loginButton = document.getElementById("loginButton");

  if (!email || !password) {
    messageBox.innerText = "⚠️ Please enter both email and password.";
    isLoggingIn = false;
    return;
  }

  loginButton.disabled = true;
  loginButton.innerText = "Please wait...";
  messageBox.innerText = "";

  try {
    // 1️⃣ Sign in with Supabase
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      messageBox.innerText = "❌ Either your email or password is incorrect. Please wait 5 seconds before trying again.";
      // Wait 5 seconds before allowing retry
      await new Promise(resolve => setTimeout(resolve, 5000));
      loginButton.disabled = false;
      loginButton.innerText = "LOGIN";
      isLoggingIn = false;
      messageBox.innerText = ""
      return;
    }

    const { session, user } = data;
    if (!session || !user) {
      messageBox.innerText = "❌ Login failed.";
      await new Promise(resolve => setTimeout(resolve, 5000));
      loginButton.disabled = false;
      loginButton.innerText = "LOGIN";
      isLoggingIn = false;
      messageBox.innerText = ""
      return;
    }

    // 2️⃣ Check if another session is active
    const { data: adminStatus, error: statusError } = await supabaseClient
      .from("admins")
      .select("is_loggedIn")
      .eq("email", email)
      .maybeSingle();

    if (statusError) {
      messageBox.innerText = "❌ Login failed. Please try again.";
      await new Promise(resolve => setTimeout(resolve, 5000));
      loginButton.disabled = false;
      loginButton.innerText = "LOGIN";
      isLoggingIn = false;
      return;
    }

    // 3️⃣ Force logout if already logged in
    if (adminStatus?.is_loggedIn) {
      messageBox.innerText = "⚠️ Account is logged in elsewhere. Logging out previous session... Please wait 10 seconds";

      const { error: logoutError } = await supabaseClient
        .from("admins")
        .update({ is_loggedIn: false })
        .eq("email", email);

      if (logoutError) {
        messageBox.innerText = "❌ Could not logout previous session. Try again.";
        await new Promise(resolve => setTimeout(resolve, 5000));
        loginButton.disabled = false;
        loginButton.innerText = "LOGIN";
        isLoggingIn = false;
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 10000));
    }

    // 4️⃣ Mark this session as logged in
    const { error: updateError } = await supabaseClient
      .from("admins")
      .update({ is_loggedIn: true, last_login: new Date() })
      .eq("email", email);

    if (updateError) {
      messageBox.innerText = "❌ Login failed. Please try again.";
      await new Promise(resolve => setTimeout(resolve, 5000));
      loginButton.disabled = false;
      loginButton.innerText = "LOGIN";
      isLoggingIn = false;
      return;
    }

    // 5️⃣ Store session in Supabase client
    await supabaseClient.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    });

    // 6️⃣ Fetch admin UUID
    const { data: adminData } = await supabaseClient
      .from("admins")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    // 7️⃣ Hash password and store in cookie
    const passwordHash = await hashPassword(password);
    setCookie("password_hash", passwordHash, 1);

    // 8️⃣ Store other session info and UUID
    setCookie("sb-access-token", session.access_token, 1);
    setCookie("sb-refresh-token", session.refresh_token, 7);
    setCookie("sb-user-email", email, 1);
    if (adminData?.id) setCookie("userUUID", adminData.id, 1);

    // 9️⃣ Redirect
    messageBox.innerText = "✅ Login successful! Redirecting...";
    setTimeout(() => window.location.href = "AdminWeb.html", 1000);

  } catch (err) {
    console.error(err);
    messageBox.innerText = "❌ An unexpected error occurred. Please try again.";
    await new Promise(resolve => setTimeout(resolve, 5000));
    loginButton.disabled = false;
    loginButton.innerText = "LOGIN";
  } finally {
    // Only reset flag if login failed, button remains disabled if login succeeded
    if (messageBox.innerText.includes("Login failed") || messageBox.innerText.includes("unexpected")) {
      isLoggingIn = false;
    }
  }
}









// Run once on page load
checkLogin();


// ------------------------------
// Logout function
// ------------------------------
// Unified logout function
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    const proceed = confirm("Are you sure you want to log out?");
    if (!proceed) return; // stop if user cancels

    // Call the async logout function
    await logout();
  });
}

async function logout() {
  try {
    const email = getCookie("sb-user-email");

    if (email) {
      // Properly await the update so Supabase marks the admin as logged out
      const { data, error } = await supabaseClient
        .from("admins")
        .update({ is_loggedIn: false, last_login: new Date() })
        .eq("email", email);

      if (error) {
        console.error("❌ Failed to update is_loggedIn on logout:", error);
      } else {
        console.log("✅ Admin marked as logged out:", data);
      }
    }

    // Clear all cookies
    deleteCookie("sb-access-token");
    deleteCookie("sb-refresh-token");
    deleteCookie("userUUID");
    deleteCookie("sb-user-email");

    // Redirect to login page
    window.location.href = "index.html";
  } catch (err) {
    console.error("❌ Error during logout:", err);
  }
}



async function isAdmin(email) {
  const { data, error } = await supabaseClient
    .from("admins")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("Admin lookup failed:", error);
    return false;
  }
  return !!data;
}

// ------------------------------
// Check login on page load
// ------------------------------
async function checkLogin() {
  console.log("Checking login status...");
  const currentPage = window.location.pathname.split("/").pop();
  const token = getCookie("sb-access-token");
  console.log("Current page:", currentPage);

  // --- No token ---
  if (!token) {
    if (currentPage === "AdminWeb.html") {
      console.log("No token, redirecting to login...");
      await logout(); // ensure cookies cleared
      return;
    }
    return; // stay on login page
  }

  try {
    // --- Validate token with Supabase ---
    const { data: sessionData, error: sessionError } = await supabaseClient.auth.getUser(token);

    if (sessionError || !sessionData.user) {
      console.warn("⚠️ Invalid or expired token, logging out...");
      await logout();
      return;
    }

    const email = sessionData.user.email;

    // --- Check is_loggedIn status in database ---
    const { data: adminStatus, error: statusError } = await supabaseClient
      .from("admins")
      .select("is_loggedIn")
      .eq("email", email)
      .maybeSingle();

    if (statusError) {
      console.error("Failed to fetch login status:", statusError);
      await logout();
      return;
    }

    // If database shows user is not logged in, force logout
    if (!adminStatus || !adminStatus.is_loggedIn) {
      console.warn("⚠️ User is marked as logged out in database. Logging out...");
      await logout();
      return;
    }

    // --- Token valid & user logged in ---
    if (currentPage === "index.html" || currentPage === "") {
      console.log("User already logged in, redirecting to AdminWeb...");
      window.location.href = "AdminWeb.html";
    } else if (currentPage === "AdminWeb.html") {
      const emailEl = document.getElementById("userEmail");
      if (emailEl) emailEl.innerText = email;
    }
  } catch (err) {
    console.error("Error validating token:", err);
    await logout();
  }
}



async function checkAdminLoggedIn() {
  try {
    const token = getCookie("sb-access-token");
    if (!token) return logout(); // log out if no token

    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) return logout();

    const email = userData.user.email;

    // Correct query: use .single() instead of .maybeSingle()
    const { data, error } = await supabaseClient
      .from("admins")
      .select("is_loggedIn")
      .eq("email", email)
      .maybeSingle();

    if (error) {
      console.error("Error checking admin status:", error);
      return;
    }

    if (!data) {
      console.log("No admin row found for this email");
      return;
    }


    if (!data.is_loggedIn) {
      showMessage("You have been forced to logged out.", "info");
      setTimeout(() => logout(), 3000);
    } else {
      console.log("Admin still logged in.");
    }
  } catch (err) {
    console.error("Error fetching admin status:", err);
  }
}



async function displayUserEmail() {
  const currentPage = window.location.pathname.split("/").pop();
  if (currentPage !== "AdminWeb.html") return; // only run on dashboard

  const token = await getValidAccessToken();
  if (!token) {
    logout();
    return;
  }

  const { data, error } = await supabaseClient.auth.getUser(token);
  if (error || !data.user) {
    console.error("Failed to get user:", error);
    logout();
    return;
  }

  document.getElementById("userEmail").innerText = data.user.email;
}

displayUserEmail()






// ------------------------------
// Check login and fetch user info
// ------------------------------
const accessToken = getCookie("sb-access-token");
const currentPage = window.location.pathname.split("/").pop(); // get current file name

if (currentPage === "index.html" || currentPage === "") {
  // User is on login page
  if (accessToken) {
    // Already logged in → redirect to dashboard
    window.location.href = "AdminWeb.html";
  } else {
    console.log("No token, stay on login page");
  }
} else if (currentPage === "AdminWeb.html") {
  // User is on dashboard
  if (!accessToken) {
    logout();
  } else {
    // Token exists → fetch user info
    supabaseClient.auth.getUser(accessToken).then(({ data, error }) => {
      if (error) {
        console.error("Failed to get user:", error);
        logout();
      } else {
        //console.log("User info:", data.user); // DEBUGGING ONLY
        // Display email in dashboard
        const emailEl = document.getElementById("userEmail");
        if (emailEl) emailEl.innerText = data.user.email;
      }
    });
  }
}


async function setLoggedIn(email, value) {
  const { data, error } = await supabaseClient
    .from("admins")
    .update({ is_loggedIn: value, last_login: new Date() })
    .eq("email", email);
  
  if (error) console.error("Failed to update is_loggedIn:", error);
  return data;
}

const token = getCookie("sb-access-token");


// Signup
//async function signup() {
//  const email = document.getElementById("email").value.trim();
//  const password = document.getElementById("password").value.trim();
//  const messageBox = document.getElementById("authMessage");
//
//  if (!email || !password) {
//    messageBox.innerText = "⚠️ Please enter both email and password.";
//    return;
//  }
//
//  const { data, error } = await supabaseClient.auth.signUp({
//    email,
//    password,
//  });
//
//  if (error) {
//    messageBox.innerText = "❌ " + error.message;
//    return;
//  }
//
//  messageBox.innerText = "✅ Signup successful! Check your email for confirmation.";
//}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

async function storePasswordHash(password) {
  const hash = await hashPassword(password);
  setCookie("password_hash", hash, 1); // expires in 1 day
}

async function verifyPassword(inputPassword) {
  const storedHash = getCookie("password_hash");
  if (!storedHash) return false;

  const inputHash = await hashPassword(inputPassword);
  return inputHash === storedHash;
}

// FOR DEBUGGING: Call this function from console to see all cookies
async function getUserRole() {
  // Get the current session token
  const token = getCookie("sb-access-token");
  if (!token) return null;

  // Get the authenticated user
  const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
  if (userError || !userData.user) {
    console.error("User not authenticated", userError);
    return null;
  }

  const email = userData.user.email;

  // Query your admins table to determine role
  const { data: roleData, error: roleError } = await supabaseClient
    .from("admins")
    .select("role")   // assuming your table has a "role" column
    .eq("email", email)
    .maybeSingle();

  if (roleError) {
    console.error("Error fetching role:", roleError);
    return null;
  }

  if (!roleData) {
    console.warn("No role found, defaulting to 'guest'");
    return "guest";
  }

  console.log("User role:", roleData.role);
  return roleData.role;
}

getUserRole()