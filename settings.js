// Helper function to handle button state
async function runWithButtonState(button, callback) {
  const originalText = button.innerText;
  button.disabled = true;
  button.innerText = "Please Wait...";
  try {
    await callback();
  } finally {
    button.disabled = false;
    button.innerText = originalText;
  }
}

// Save Name
document.getElementById("saveNameBtn").addEventListener("click", async () => {
  const button = document.getElementById("saveNameBtn");
  await runWithButtonState(button, async () => {
    const name = document.getElementById("adminName").value.trim();
    if (!name) return showMessage("⚠️ Name cannot be empty");

    const token = await getValidAccessToken();
    if (!token) return logout();

    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) return logout();

    const email = userData.user.email;

    const { error } = await supabaseClient
      .from("admins")
      .update({ name })
      .eq("email", email);

    if (error) {
      showMessage("❌ Failed to update name");
      console.error(error);
    } else {
      showMessage("✅ Name updated successfully", "info", "#79ff80ff");
    }
  });
});

// Save Password
document.getElementById("savePasswordBtn").addEventListener("click", async () => {
  const button = document.getElementById("savePasswordBtn");
  await runWithButtonState(button, async () => {
    const currentPassword = document.getElementById("currentPassword").value.trim();
    const newPassword = document.getElementById("newPassword").value.trim();

    if (!currentPassword || !newPassword) return showMessage("⚠️ Please fill both password fields");
    if (newPassword.length < 6) return showMessage("⚠️ New password must be at least 6 characters");

    const isValid = await verifyPassword(currentPassword);
    if (!isValid) return showMessage("❌ Current password is incorrect");

    const token = await getValidAccessToken();
    if (!token) return logout();

    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) return logout();

    const email = userData.user.email;

    const { error: passwordError } = await supabaseClient.auth.updateUser({ password: newPassword });
    if (passwordError) {
      console.error(passwordError);
      return showMessage("❌ Failed to update password");
    }

    await storePasswordHash(newPassword);
    showMessage("✅ Password updated successfully", "info", "#79ff80ff");

    document.getElementById("currentPassword").value = "";
    document.getElementById("newPassword").value = "";
  });
});
