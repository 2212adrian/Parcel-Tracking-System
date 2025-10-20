// userTypeSelector.js
const UserTypeSelector = (() => {
  let selectedUserType = null;

  // DOM elements
  const customerBtn = document.getElementById("customerBtn");
  const courierBtn = document.getElementById("courierBtn");
  const resultDiv = document.getElementById("result");
  const container = document.getElementById("mainContainer");

  if (!customerBtn || !courierBtn || !resultDiv || !container) {
    console.warn("UserTypeSelector: One or more required elements not found.");
    return;
  }

  // Hide results initially
  resultDiv.classList.add("hidden");

  // Private function to update button styles and container color
  const selectUserType = (type) => {
    selectedUserType = type;
    window.selectedUserType = type; // Make it globally accessible

    if (type === "customer") {
      console.log('Selected Customer Role.');
      customerBtn.classList.add("bg-red-600", "text-white");
      customerBtn.classList.remove("bg-gray-200", "text-gray-700");

      courierBtn.classList.remove("bg-red-600", "text-white");
      courierBtn.classList.add("bg-gray-200", "text-gray-700");

      container.style.backgroundColor = "#ffdcdc";
    } else if (type === "courier") {
      console.log('Selected Courier Role.');
      courierBtn.classList.add("bg-red-600", "text-white");
      courierBtn.classList.remove("bg-gray-200", "text-gray-700");

      customerBtn.classList.remove("bg-red-600", "text-white");
      customerBtn.classList.add("bg-gray-200", "text-gray-700");

      container.style.backgroundColor = "#ff8b8b";
    }

    resultDiv.classList.add("hidden"); // hide previous result
  };

  // Event listeners
  customerBtn.addEventListener("click", () => selectUserType("customer"));
  courierBtn.addEventListener("click", () => selectUserType("courier"));

  // Public API
  return {
    getSelectedUserType: () => selectedUserType,
  };
})();

// Usage