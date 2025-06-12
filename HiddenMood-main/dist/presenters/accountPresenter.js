import { API_BASE_URL, apiCall } from "../config.js";

let currentUser = null;

export function renderAccount() {
    console.log("renderAccount called");
    console.log("isLoggedIn:", sessionStorage.getItem("isLoggedIn"));
    console.log("user:", sessionStorage.getItem("user"));
    console.log("token:", sessionStorage.getItem("token"));

    const isLoggedIn = sessionStorage.getItem("isLoggedIn") === "true";
    console.log("isLoggedIn check result:", isLoggedIn);

    if (!isLoggedIn) {
        console.log("Not logged in, redirecting to login");
        window.loadView("login");
        return;
    }

    fetch("views/account.html")
        .then((res) => {
            if (!res.ok) throw new Error("Failed to load account.html");
            return res.text();
        })
        .then((html) => {
            console.log("Account HTML loaded successfully");
            document.getElementById("app").innerHTML = html;

            const cachedUser = JSON.parse(sessionStorage.getItem("user") || "{}");
            if (cachedUser && cachedUser.name) {
                currentUser = cachedUser;
                const dropdownUsername = document.getElementById("dropdown-username");
                const dropdownEmail = document.getElementById("dropdown-email");
                const usernameField = document.getElementById("username-field");
                if (dropdownUsername) dropdownUsername.textContent = cachedUser.name;
                if (dropdownEmail) dropdownEmail.textContent = cachedUser.email;
                if (usernameField) usernameField.value = cachedUser.name;
                updateProfileUI();
            }

            try {
                fetchUserProfile();
                setupEventListeners();
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.get('success') === 'true') {
                    showSuccess('Profile updated successfully');
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            } catch (error) {
                console.error('Error initializing account page:', error);
                showError('Failed to load account information');
            }
        })
        .catch((error) => {
            console.error("Error loading account view:", error);
        });
}

async function fetchUserProfile() {
    try {
        const response = await apiCall("/api/profile", {
            method: "GET",
        });

        if (!response || !response.user) {
            throw new Error("Failed to fetch profile");
        }

        currentUser = response.user;
        sessionStorage.setItem("user", JSON.stringify(currentUser));
        updateProfileUI();
    } catch (error) {
        console.error("Error fetching profile:", error);
        showError("Failed to fetch latest profile data. Using cached data.");
        updateProfileUI();
    }
}

function validatePassword(password) {
    const minLength = 8;
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength || !(hasLetter && hasNumber && hasSymbol)) {
        return {
            isValid: false,
            message: "Password must be at least 8 characters long and include a mix of letters, numbers, and symbols.",
        };
    }
    return { isValid: true, message: "" };
}

function handleProfileImageDisplay(imageElement) {
    const defaultImage = 'https://via.placeholder.com/150x150/e2e8f0/64748b?text=User';
    
    try {
        if (!currentUser?.img) {
            imageElement.src = defaultImage;
            return;
        }

        if (typeof currentUser.img === 'string') {
            if (currentUser.img.startsWith('http') || currentUser.img.startsWith('data:image/')) {
                imageElement.src = currentUser.img;
                return;
            }
            
            if (currentUser.img.startsWith('\\x')) {
                try {
                    const hexString = currentUser.img.substring(2);
                    const url = hexString.match(/.{2}/g)?.map(hex => String.fromCharCode(parseInt(hex, 16))).join('') || '';
                    if (url.startsWith('http')) {
                        imageElement.src = url;
                        return;
                    }
                } catch (hexError) {
                    console.error('Error decoding hex string:', hexError);
                }
            }
        }

        if (currentUser.img && typeof currentUser.img === 'object' && currentUser.img.data) {
            const base64String = convertBinaryToBase64(currentUser.img.data);
            if (base64String) {
                imageElement.src = base64String;
                return;
            }
        }

        imageElement.src = defaultImage;
        
        imageElement.onerror = () => {
            console.warn('Failed to load profile image, using default');
            imageElement.src = defaultImage;
            imageElement.onerror = null;
        };
        
    } catch (error) {
        console.error('Error displaying profile image:', error);
        imageElement.src = defaultImage;
    }
}

function updateProfileUI() {
    const usernameSpan = document.getElementById("username");
    if (usernameSpan) {
        usernameSpan.textContent = currentUser?.name || "User";
    }

    const profileImagePreview = document.getElementById('profile-image-preview');
    if (profileImagePreview) {
        handleProfileImageDisplay(profileImagePreview);
    }

    const navbarProfileImg = document.getElementById('profile-image');
    if (navbarProfileImg) {
        handleProfileImageDisplay(navbarProfileImg);
    }

    const usernameField = document.getElementById('username-field');
    const emailField = document.getElementById('email');

    if (usernameField) usernameField.value = currentUser?.name || '';
    if (emailField) emailField.value = currentUser?.email || '';
}

async function handleSettingsSubmit(e) {
    e.preventDefault();
    resetFormErrors();

    const usernameField = document.getElementById("username-field") || document.getElementById("username");
    const username = usernameField ? usernameField.value.trim() : "";
    const currentPassword = document.getElementById("current-password")?.value || "";
    const newPassword = document.getElementById("new-password")?.value || "";
    const confirmPassword = document.getElementById("confirm-password")?.value || "";
    const profileImageInput = document.getElementById("profile-image-input");

    if (!username) {
        showFieldError("username", "Username is required");
        return;
    }

    if (newPassword || currentPassword || confirmPassword) {
        if (!currentPassword) {
            showFieldError("current-password", "Current password is required to change password");
            return;
        }
        if (!newPassword) {
            showFieldError("new-password", "New password is required");
            return;
        }
        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.isValid) {
            showFieldError("new-password", passwordValidation.message);
            return;
        }
        if (newPassword !== confirmPassword) {
            showFieldError("confirm-password", "Passwords do not match");
            return;
        }
    }

    showLoading();

    try {
        const token = sessionStorage.getItem("token");
        const formData = new FormData();
        formData.append("name", username);

        if (newPassword && currentPassword) {
            formData.append("currentPassword", currentPassword);
            formData.append("newPassword", newPassword);
        }

        if (profileImageInput && profileImageInput.files.length > 0) {
            formData.append("profileImage", profileImageInput.files[0]);
        }

        const response = await fetch(`${API_BASE_URL}/api/profile`, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${token}`,
            },
            body: formData,
        });

        if (!response.ok) {
            let errorText = await response.text();
            console.error("Update profile failed:", response.status, errorText);
            throw new Error(`Failed to update profile: ${response.status} - ${errorText}`);
        }

        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
            let responseText = await response.text();
            console.error("Non-JSON response:", responseText);
            throw new Error("Non-JSON response from server");
        }

        const data = await response.json();
        currentUser = data.user;
        sessionStorage.setItem("user", JSON.stringify(currentUser));
        
        updateProfileUI();

        const currentPasswordField = document.getElementById("current-password");
        const newPasswordField = document.getElementById("new-password");
        const confirmPasswordField = document.getElementById("confirm-password");

        if (currentPasswordField) currentPasswordField.value = "";
        if (newPasswordField) newPasswordField.value = "";
        if (confirmPasswordField) confirmPasswordField.value = "";

        showSuccess();
    } catch (error) {
        console.error("Error updating profile:", error);
        showError(error.message || "Failed to update profile");
    } finally {
        hideLoading();
    }
}

function convertBinaryToBase64(binaryData) {
    try {
        if (!binaryData) return null;

        let binary = '';
        let bytes;

        if (binaryData instanceof ArrayBuffer) {
            bytes = new Uint8Array(binaryData);
        } else if (binaryData instanceof Uint8Array) {
            bytes = binaryData;
        } else if (Array.isArray(binaryData)) {
            bytes = new Uint8Array(binaryData);
        } else {
            console.warn('Unknown binary data format:', typeof binaryData);
            return null;
        }

        const chunkSize = 8192;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
            binary += String.fromCharCode.apply(null, chunk);
        }

        return 'data:image/jpeg;base64,' + btoa(binary);
    } catch (error) {
        console.error('Error converting binary to base64:', error);
        return null;
    }
}

function arrayBufferToBase64(buffer) {
    return convertBinaryToBase64(buffer);
}

function setupEventListeners() {
    const logoutLink = document.querySelector(".nav-links a[href='#']");
    if (logoutLink) {
        logoutLink.addEventListener("click", (e) => {
            e.preventDefault();
            if (window.logout) {
                window.logout();
            }
        });
    }

    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', handleSettingsSubmit);
    }

    const profileImageInput = document.getElementById('profile-image-input');
    if (profileImageInput) {
        profileImageInput.addEventListener('change', handleImageChange);
    }

    const passwordFields = ['current-password', 'new-password', 'confirm-password'];
    passwordFields.forEach(fieldId => {
        const toggleBtn = document.querySelector(`button[data-toggle="${fieldId}"]`);
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => togglePasswordVisibility(fieldId));
        }
    });

    const backButton = document.getElementById('back-button');
    if (backButton) {
        backButton.addEventListener('click', () => {
            window.history.back();
        });
    }

    const deleteAccountBtn = document.getElementById('delete-account-btn');
    if (deleteAccountBtn) {
        deleteAccountBtn.addEventListener('click', () => {
            document.getElementById('delete-modal').classList.remove('hidden');
        });
    }

    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', handleDeleteAccount);
    }

    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    }
}

function handleImageChange(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        showError('Please select an image file');
        event.target.value = '';
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showError('Image size should be less than 5MB');
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('profile-image-preview');
        if (preview) {
            preview.src = e.target.result;
        }
    };
    reader.onerror = () => {
        showError('Error reading image file');
        event.target.value = '';
    };
    reader.readAsDataURL(file);
}

function togglePasswordVisibility(fieldId) {
    const field = document.getElementById(fieldId);
    const icon = document.querySelector(`button[data-toggle="${fieldId}"] i`);

    if (field && icon) {
        if (field.type === 'password') {
            field.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            field.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }
}

function resetFormErrors() {
    const errorElements = document.querySelectorAll('[id$="-error"]');
    errorElements.forEach(el => {
        el.classList.add('hidden');
        el.textContent = '';
    });
}

function showFieldError(fieldId, message) {
    const errorElement = document.getElementById(`${fieldId}-error`);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.remove('hidden');
    }
}

function showError(message) {
    const alertModal = document.getElementById('alert-modal');
    const alertIcon = document.getElementById('alert-icon');
    const alertTitle = document.getElementById('alert-title');
    const alertMessage = document.getElementById('alert-message');
    const alertCloseBtn = document.getElementById('alert-close-btn');

    if (alertModal && alertIcon && alertTitle && alertMessage && alertCloseBtn) {
        alertIcon.innerHTML = '<i class="fas fa-exclamation-circle text-red-500 text-2xl"></i>';
        alertTitle.textContent = 'Error';
        alertMessage.textContent = message;
        alertModal.classList.remove('hidden');

        alertCloseBtn.onclick = () => {
            alertModal.classList.add('hidden');
        };
    }
}

function showSuccess(message = 'Profile updated successfully') {
    const alertModal = document.getElementById('alert-modal');
    const alertIcon = document.getElementById('alert-icon');
    const alertTitle = document.getElementById('alert-title');
    const alertMessage = document.getElementById('alert-message');
    const alertCloseBtn = document.getElementById('alert-close-btn');

    if (alertModal && alertIcon && alertTitle && alertMessage && alertCloseBtn) {
        alertIcon.innerHTML = '<i class="fas fa-check-circle text-green-500 text-2xl"></i>';
        alertTitle.textContent = 'Success';
        alertMessage.textContent = message;
        alertModal.classList.remove('hidden');

        alertCloseBtn.onclick = () => {
            alertModal.classList.add('hidden');
        };
    }
}

function showLoading() {
    const loadingSpinner = document.getElementById('loading-spinner');
    if (loadingSpinner) {
        loadingSpinner.classList.remove('hidden');
    }

    const submitButton = document.querySelector('#settings-form button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Updating...';
    }
}

function hideLoading() {
    const loadingSpinner = document.getElementById('loading-spinner');
    if (loadingSpinner) {
        loadingSpinner.classList.add('hidden');
    }

    const submitButton = document.querySelector('#settings-form button[type="submit"]');
    if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Save Changes';
    }
}

function closeDeleteModal() {
    document.getElementById('delete-modal').classList.add('hidden');
}

async function handleDeleteAccount() {
    showLoading();
    try {
        const response = await apiCall("/api/profile", {
            method: "DELETE",
        });

        if (!response || !response.message) {
            throw new Error("Invalid response from server");
        }

        console.log("Account deleted successfully:", response.message);
        sessionStorage.removeItem("isLoggedIn");
        sessionStorage.removeItem("user");
        sessionStorage.removeItem("token");
        showSuccess("Account deleted successfully");
        setTimeout(() => {
            window.loadView("login");
        }, 2000);
    } catch (error) {
        let errorMessage = "Failed to delete account. Please try again or contact support at support@himo.com.";
        if (error.message.includes("HTTP 500") && error.message.includes("details")) {
            try {
                const details = JSON.parse(error.message.split("HTTP 500 - ")[1]).details;
                errorMessage = details || errorMessage;
            } catch (e) {
                console.warn("Failed to parse error details:", e);
            }
        }
        console.error("Error deleting account:", {
            message: error.message,
            stack: error.stack,
            response: error.message.includes("HTTP 500") ? error.message : null
        });
        showError(errorMessage);
    } finally {
        closeDeleteModal();
        hideLoading();
    }
}